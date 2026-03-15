/**
 * Enriches 5 well-known entities and displays them as "full entity pages".
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { promises as dns } from 'node:dns';
import Firecrawl from '@mendable/firecrawl-js';
import { getSupabase } from '../shared/supabase.js';

const sb = getSupabase();
const fc = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });

function normalizeUrl(url: string): string {
  let u = url.trim();
  if (u.includes('|')) u = u.split(/\s*\|\s*/)[0].trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'https://' + u;
  return u.replace(/\/+$/, '');
}

// Extractors (same as fixed run.ts)
const JUNK_RE = [/403 forbidden/i, /404 not found/i, /invalid ssl/i, /ssl.*certificate/i, /cloudflare/i, /just a moment/i, /^skip to/i, /^https?:\/\//i, /captcha/i, /^we use cookies/i, /under construction/i, /coming soon/i, /502 bad gateway/i];
function isJunk(t: string): boolean { return JUNK_RE.some(r => r.test(t)); }
function looksLikeUrl(t: string): boolean { return /^https?:\/\//.test(t.trim()); }

function extractDescription(md: string, meta: Record<string, unknown>): string | null {
  for (const key of ['ogDescription', 'description', 'og:description', 'twitter:description']) {
    const v = meta?.[key];
    if (v && typeof v === 'string') {
      const c = v.trim().replace(/\s+/g, ' ').slice(0, 500);
      if (c.length > 20 && !isJunk(c) && !looksLikeUrl(c)) return c;
    }
  }
  for (const p of md.split(/\n{2,}/)) {
    const c = p.replace(/[#*_\[\]()!]/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
    if (c.length >= 40 && !c.includes('|') && !/^(cookie|accept|skip|menu|toggle)/i.test(c) && !isJunk(c)) return c.slice(0, 500);
  }
  return null;
}

function extractLinkedIn(md: string, meta: Record<string, unknown>): string | null {
  const re = /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/i;
  const m = JSON.stringify(meta).match(re) ?? md.match(re);
  return m ? m[0] : null;
}

function extractTwitter(md: string, meta: Record<string, unknown>): string | null {
  const skip = new Set(['share', 'intent', 'home', 'search', 'explore', 'settings', 'login', 'signup', 'i', 'hashtag']);
  const site = meta?.['twitter:site'] ?? meta?.twitterSite;
  if (site && typeof site === 'string') { const h = site.replace(/^@/, ''); if (h.length >= 2 && !skip.has(h.toLowerCase())) return `https://x.com/${h}`; }
  const re = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i;
  for (const src of [JSON.stringify(meta), md]) {
    const m = src.match(re);
    if (m && !skip.has(m[1].toLowerCase())) return `https://x.com/${m[1]}`;
  }
  return null;
}

function extractBrand(meta: Record<string, unknown>): string | null {
  const sc = meta?.statusCode; if (typeof sc === 'number' && sc >= 400) return null;
  for (const key of ['og:site_name', 'ogSiteName', 'application-name', 'applicationName']) {
    const v = meta?.[key];
    if (v && typeof v === 'string') { const b = v.replace(/\s*[|·–—:]\s*$/, '').trim(); if (b.length >= 2 && b.length <= 60) return b; }
  }
  const title = meta?.title ?? meta?.ogTitle;
  if (title && typeof title === 'string') {
    const c = title.replace(/\s*[-–—|·:]\s*(Home|Homepage|Official|Website|Main|Welcome|About).*$/i, '').replace(/\s*[-–—|·:]\s*$/g, '').trim();
    const parts = c.split(/\s*[|·]\s*/); const best = parts.find(p => p.length >= 2 && p.length <= 40) ?? parts[0];
    if (best && best.length >= 2 && best.length <= 60) return best.trim();
  }
  return null;
}

function extractLogo(meta: Record<string, unknown>, baseUrl: string): string | null {
  const og = meta?.ogImage ?? meta?.['og:image'];
  let url: string | null = null;
  if (typeof og === 'string') url = og;
  else if (og && typeof og === 'object' && 'url' in (og as Record<string, unknown>)) url = (og as { url: string }).url;
  if (url && url.startsWith('http') && !url.includes('localhost')) return url;
  const icon = meta?.favicon;
  if (icon && typeof icon === 'string') { if (icon.startsWith('http')) return icon; try { return new URL(icon, baseUrl).toString(); } catch {} }
  return null;
}

function extractEmail(md: string, meta: Record<string, unknown>): string | null {
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const skip = /example\.com|sentry\.|noreply|no-reply|unsubscribe/i;
  const m = JSON.stringify(meta).match(re);
  if (m && !skip.test(m[0])) return m[0].toLowerCase();
  for (const line of md.split('\n')) {
    if (/contact|email|mailto|support|info/i.test(line)) { const m2 = line.match(re); if (m2 && !skip.test(m2[0])) return m2[0].toLowerCase(); }
  }
  return null;
}

function extractKeywords(meta: Record<string, unknown>): string[] {
  const kw = meta?.keywords ?? meta?.['keywords'];
  if (kw && typeof kw === 'string') return kw.split(',').map(s => s.trim()).filter(s => s.length > 1 && s.length < 60).slice(0, 10);
  return [];
}

// Target entities: well-known companies with rich websites
const TARGETS = [
  { name: 'Kraken (Payward)', filters: { name_like: '%Payward%' } },
  { name: 'Clear Junction', filters: { name_like: '%Clear Junction%Canada%' } },
  { name: 'Direct Crypto', filters: { name_like: '%Direct Crypto%' } },
  { name: 'Indodax', filters: { name_like: '%INDODAX%' } },
  { name: 'Nuage Payments', filters: { name_like: '%Nuage%' } },
];

async function main() {
  const div = '═'.repeat(70);

  for (const target of TARGETS) {
    // Find entity in DB
    const { data } = await sb.from('entities')
      .select('id, name, canonical_name, country_code, website, description, linkedin_url, crypto_status, parser_id, quality_score, quality_flags, license_number, license_type, entity_types, activities, regulator, status, brand_name, dns_status, enriched_at')
      .ilike('name', target.filters.name_like)
      .not('website', 'is', null)
      .neq('website', '')
      .limit(1);

    if (!data || data.length === 0) {
      console.log(`\n  ⚠️  "${target.name}" not found in DB. Skipping.`);
      continue;
    }

    const e = data[0] as Record<string, unknown>;
    const url = normalizeUrl(e.website as string);

    console.log(`\n\n${div}`);
    console.log(`  📋 ENTITY PAGE: ${target.name}`);
    console.log(div);

    // ── BEFORE (raw DB state) ──
    console.log('\n  ── BEFORE (current DB state) ──');
    console.log(`  Name:          ${e.name}`);
    console.log(`  Canonical:     ${e.canonical_name ?? '(not set)'}`);
    console.log(`  Country:       ${e.country_code}`);
    console.log(`  Website:       ${e.website}`);
    console.log(`  Description:   ${e.description ? (e.description as string).slice(0, 80) + '...' : '(empty)'}`);
    console.log(`  LinkedIn:      ${e.linkedin_url ?? '(empty)'}`);
    console.log(`  Brand:         ${e.brand_name ?? '(empty)'}`);
    console.log(`  Crypto status: ${e.crypto_status ?? '(null)'}`);
    console.log(`  Quality score: ${e.quality_score ?? '(null)'}`);
    console.log(`  DNS status:    ${e.dns_status ?? '(null)'}`);
    console.log(`  Enriched at:   ${e.enriched_at ?? '(never)'}`);
    console.log(`  License:       ${e.license_number ?? '(empty)'}`);
    console.log(`  License type:  ${e.license_type ?? '(empty)'}`);
    console.log(`  Entity types:  ${JSON.stringify(e.entity_types) ?? '[]'}`);
    console.log(`  Activities:    ${JSON.stringify(e.activities) ?? '[]'}`);
    console.log(`  Regulator:     ${e.regulator ?? '(empty)'}`);
    console.log(`  Status:        ${e.status ?? '(empty)'}`);

    // ── Scrape website ──
    let hostname: string;
    try { hostname = new URL(url).hostname; } catch { console.log('  Bad URL'); continue; }
    let alive = false;
    try { await dns.resolve4(hostname); alive = true; } catch {}

    if (!alive) {
      console.log(`\n  ── DNS DEAD — cannot enrich ──`);
      continue;
    }

    let markdown = '', metadata: Record<string, unknown> = {};
    try {
      const doc = await fc.scrape(url, { formats: ['markdown'], onlyMainContent: true, timeout: 30_000 });
      markdown = doc.markdown ?? '';
      metadata = (doc.metadata ?? {}) as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`\n  ── SCRAPE FAILED: ${msg.slice(0, 80)} ──`);
      continue;
    }

    // Run all extractors
    const desc = extractDescription(markdown, metadata);
    const linkedin = extractLinkedIn(markdown, metadata);
    const twitter = extractTwitter(markdown, metadata);
    const brand = extractBrand(metadata);
    const logo = extractLogo(metadata, url);
    const email = extractEmail(markdown, metadata);
    const keywords = extractKeywords(metadata);

    // ── AFTER (enriched state) ──
    console.log('\n  ── AFTER (maximum enriched state) ──');
    console.log('');
    console.log(`  ┌──────────────────────────────────────────────────────┐`);
    if (logo) console.log(`  │  🖼️  ${logo.slice(0, 52).padEnd(52)} │`);
    console.log(`  │                                                      │`);
    console.log(`  │  ${(brand ?? e.canonical_name ?? e.name as string).slice(0, 50).padEnd(54)}│`);
    console.log(`  │  ${('(' + (e.canonical_name ?? e.name as string) + ')').slice(0, 50).padEnd(54)}│`);
    console.log(`  │                                                      │`);
    console.log(`  │  🏷️  ${(e.crypto_status as string ?? 'unknown').toUpperCase().padEnd(20)} 🌍 ${(e.country_code as string).padEnd(5)} ⭐ ${String(e.quality_score ?? '-').padEnd(3)}   │`);
    console.log(`  │  📊 Status: ${(e.status as string ?? 'Active').padEnd(40)}│`);
    console.log(`  │                                                      │`);
    if (desc) {
      const lines = [desc.slice(0, 55), desc.slice(55, 110), desc.slice(110, 165)].filter(l => l.length > 0);
      console.log(`  │  📝 Description:                                     │`);
      for (const l of lines) console.log(`  │    ${l.padEnd(52)}│`);
    }
    console.log(`  │                                                      │`);
    console.log(`  │  🔗 Links:                                            │`);
    console.log(`  │    🌐 ${(url).slice(0, 50).padEnd(50)}│`);
    if (linkedin) console.log(`  │    💼 ${linkedin.slice(0, 50).padEnd(50)}│`);
    if (twitter)  console.log(`  │    🐦 ${twitter.slice(0, 50).padEnd(50)}│`);
    if (email)    console.log(`  │    ✉️  ${email.slice(0, 50).padEnd(50)}│`);
    console.log(`  │                                                      │`);
    if (e.license_number) {
      console.log(`  │  📜 License: ${(e.license_number as string).slice(0, 40).padEnd(40)}│`);
      if (e.license_type) console.log(`  │    Type: ${(e.license_type as string).slice(0, 43).padEnd(43)}│`);
    }
    if (e.regulator) console.log(`  │  🏛️  Regulator: ${(e.regulator as string).slice(0, 37).padEnd(37)}│`);
    if (keywords.length > 0) {
      console.log(`  │                                                      │`);
      console.log(`  │  🏷️  Keywords: ${keywords.slice(0, 4).join(', ').slice(0, 38).padEnd(38)}│`);
    }
    console.log(`  │                                                      │`);
    console.log(`  │  Parser: ${(e.parser_id as string ?? '?').padEnd(15)} Quality: T${((e.quality_flags as Record<string,string>)?.tier ?? '?').padEnd(3)} Score: ${String(e.quality_score ?? '-').padEnd(3)} │`);
    console.log(`  └──────────────────────────────────────────────────────┘`);

    // Show raw enrichment data
    console.log('\n  Enrichment data extracted:');
    console.log(`    description: ${desc ? 'YES (' + desc.length + ' chars)' : 'NO'}`);
    console.log(`    brand:       ${brand ?? 'NO'}`);
    console.log(`    linkedin:    ${linkedin ?? 'NO'}`);
    console.log(`    twitter:     ${twitter ?? 'NO'}`);
    console.log(`    logo:        ${logo ? 'YES' : 'NO'}`);
    console.log(`    email:       ${email ?? 'NO'}`);
    console.log(`    keywords:    ${keywords.length > 0 ? keywords.join(', ') : 'NO'}`);

    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n\n' + div);
  console.log('  Demo complete. 5 credits used.');
  console.log(div + '\n');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
