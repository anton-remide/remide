/**
 * HTTP client with conservative rate limiting, retry, and User-Agent rotation.
 *
 * - 10+ sec between requests (configurable per parser)
 * - 3 retries with exponential backoff
 * - Rotating User-Agent strings
 * - Honest Referer headers
 */

import { logger } from './logger.js';

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

let lastRequestTime = 0;
let uaIndex = 0;

function getNextUserAgent(): string {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex++;
  return ua;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchOptions {
  /** Registry ID for logging */
  registryId: string;
  /** Minimum delay between requests in ms (default: 10000) */
  rateLimit?: number;
  /** Max retries (default: 3) */
  maxRetries?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

/**
 * Fetch a URL with rate limiting, retries, and UA rotation.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions
): Promise<string> {
  const {
    registryId,
    rateLimit = 10_000,
    maxRetries = 3,
    headers = {},
    timeout = 30_000,
  } = options;

  // Rate limiting: wait if needed
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < rateLimit) {
    const waitMs = rateLimit - elapsed;
    logger.debug(registryId, `Rate limit: waiting ${waitMs}ms`);
    await delay(waitMs);
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      lastRequestTime = Date.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        headers: {
          'User-Agent': getNextUserAgent(),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          ...headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitSec = retryAfter ? parseInt(retryAfter, 10) : 60;
        logger.warn(registryId, `429 Too Many Requests. Waiting ${waitSec}s (attempt ${attempt}/${maxRetries})`);
        await delay(waitSec * 1000);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      logger.debug(registryId, `Fetched ${url} (${text.length} bytes, attempt ${attempt})`);
      return text;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30_000);
        logger.warn(registryId, `Attempt ${attempt}/${maxRetries} failed: ${message}. Retrying in ${backoffMs}ms`);
        await delay(backoffMs);
      } else {
        logger.error(registryId, `All ${maxRetries} attempts failed: ${message}`);
        throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts: ${message}`);
      }
    }
  }

  throw new Error(`Unreachable: fetch loop exited without return or throw`);
}

/**
 * Fetch JSON with rate limiting and retries.
 */
export async function fetchJsonWithRetry<T>(
  url: string,
  options: FetchOptions
): Promise<T> {
  const text = await fetchWithRetry(url, {
    ...options,
    headers: {
      ...options.headers,
      Accept: 'application/json',
    },
  });
  return JSON.parse(text) as T;
}
