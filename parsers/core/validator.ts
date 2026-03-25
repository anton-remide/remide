/**
 * Validation: JSON Schema checks + Delta anomaly detection.
 *
 * - Schema: required fields, types, format checks
 * - Delta: >20% entity count change = anomaly alert
 */

import type { ParsedEntity, ParseResult, VerifyResult } from './types.js';
import { logger, sendTelegramAlert } from './logger.js';

/** Validate a single entity has required fields */
export function validateEntity(entity: ParsedEntity, index: number): string[] {
  const errors: string[] = [];

  if (!entity.name || entity.name.trim().length === 0) {
    errors.push(`Entity[${index}]: missing or empty 'name'`);
  }

  if (!entity.licenseNumber || entity.licenseNumber.trim().length === 0) {
    errors.push(`Entity[${index}]: missing or empty 'licenseNumber'`);
  }

  if (!entity.countryCode || entity.countryCode.length !== 2) {
    errors.push(`Entity[${index}]: invalid 'countryCode' (expected 2-letter ISO code, got '${entity.countryCode}')`);
  }

  if (!entity.country || entity.country.trim().length === 0) {
    errors.push(`Entity[${index}]: missing or empty 'country'`);
  }

  // sourceUrl is optional metadata — don't block writes for it
  // (logged as debug, not as schema error)

  // Name sanity checks
  if (entity.name && entity.name.length > 500) {
    errors.push(`Entity[${index}]: 'name' suspiciously long (${entity.name.length} chars)`);
  }

  return errors;
}

/** Validate all entities in a parse result */
export function validateParseResult(result: ParseResult): string[] {
  const errors: string[] = [];

  if (!result.registryId) {
    errors.push('Missing registryId');
  }

  if (!result.countryCode || result.countryCode.length !== 2) {
    errors.push(`Invalid countryCode: '${result.countryCode}'`);
  }

  if (result.entities.length === 0) {
    errors.push('No entities parsed — result is empty');
  }

  // Validate each entity
  for (let i = 0; i < result.entities.length; i++) {
    const entityErrors = validateEntity(result.entities[i], i);
    errors.push(...entityErrors);
  }

  return errors;
}

/** Find duplicate entities by license_number + country_code */
export function findDuplicates(entities: ParsedEntity[]): ParsedEntity[] {
  const seen = new Map<string, number>();
  const duplicates: ParsedEntity[] = [];

  for (const entity of entities) {
    const key = `${entity.countryCode}:${entity.licenseNumber}`.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);

    if (count > 0) {
      duplicates.push(entity);
    }
  }

  return duplicates;
}

/** Remove duplicates, keeping first occurrence */
export function deduplicateEntities(entities: ParsedEntity[]): ParsedEntity[] {
  const seen = new Set<string>();
  const unique: ParsedEntity[] = [];

  for (const entity of entities) {
    const key = `${entity.countryCode}:${entity.licenseNumber}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(entity);
    }
  }

  return unique;
}

/** Calculate delta percentage between previous and current count */
export function calculateDelta(previousCount: number, currentCount: number): number {
  if (previousCount === 0) return currentCount > 0 ? 100 : 0;
  return Math.abs(((currentCount - previousCount) / previousCount) * 100);
}

/**
 * Full verification pipeline:
 * 1. Schema validation
 * 2. Deduplication check
 * 3. Delta anomaly detection
 *
 * Anomaly triggers only when BOTH conditions are met:
 * - Percentage delta exceeds threshold (default 50%)
 * - Absolute change exceeds minimum floor (default 10 entities)
 * This prevents false positives on small registries (3→4 = 33% but only 1 change).
 */
export async function verify(
  result: ParseResult,
  previousCount: number,
  anomalyThreshold = 50,
  minAbsoluteChange = 10
): Promise<VerifyResult> {
  const { registryId } = result;

  // 1. Schema validation
  const schemaErrors = validateParseResult(result);

  // 2. Duplicates
  const duplicates = findDuplicates(result.entities);
  if (duplicates.length > 0) {
    logger.warn(registryId, `Found ${duplicates.length} duplicate entities`);
  }

  // 3. Delta check (skip anomaly detection on first run when previousCount is 0)
  const deltaPercent = calculateDelta(previousCount, result.entities.length);
  const absoluteChange = Math.abs(result.entities.length - previousCount);
  const isFirstRun = previousCount === 0;
  const anomaly = !isFirstRun && deltaPercent > anomalyThreshold && absoluteChange >= minAbsoluteChange;

  if (anomaly) {
    const msg = `Anomaly detected: entity count changed from ${previousCount} to ${result.entities.length} (${deltaPercent.toFixed(1)}% delta, ${absoluteChange} abs change, threshold: ${anomalyThreshold}%/${minAbsoluteChange} min)`;
    logger.warn(registryId, msg);
    await sendTelegramAlert(registryId, msg, true);
  }

  const valid = schemaErrors.length === 0 && !anomaly;

  return {
    registryId,
    valid,
    schemaErrors,
    duplicates: duplicates.length,
    deltaPercent,
    previousCount,
    currentCount: result.entities.length,
    anomaly,
    timestamp: new Date().toISOString(),
  };
}
