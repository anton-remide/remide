/**
 * Notion database operations for parser results.
 *
 * Mirrors Supabase writes to Notion for backup/visibility.
 *
 * Notion Databases:
 *   Country Research Registry (jurisdictions): collection://9618ad8b-302f-421f-9d30-de322226c4d1
 *   Entities:                                  collection://32d2ac10-63c8-81db-98b7-e92a8f8c855a
 *
 * Required env: NOTION_TOKEN (Internal Integration Token)
 *
 * Entity status mapping matches Supabase enum:
 *   Licensed | Registered | Provisional | Unknown | Sandbox
 */

import { Client } from '@notionhq/client';
import type { ParsedEntity, ParseResult } from './types.js';
import { logger } from './logger.js';

// Database IDs (extracted from collection:// URLs)
const ENTITIES_DB_ID = '32d2ac10-63c8-81db-98b7-e92a8f8c855a';
const JURISDICTIONS_DB_ID = '9618ad8b-302f-421f-9d30-de322226c4d1';

let notion: Client | null = null;

/** Valid entity_status values matching Notion select options */
const VALID_STATUSES = ['Licensed', 'Registered', 'Provisional', 'Unknown', 'Sandbox'] as const;

/** Map parser status strings to valid Notion select values */
function mapStatus(status: string | undefined | null): string {
  if (!status) return 'Unknown';
  const lower = status.toLowerCase().trim();

  const direct = VALID_STATUSES.find((v) => v.toLowerCase() === lower);
  if (direct) return direct;

  if (lower.includes('authorized') || lower.includes('authorised') || lower.includes('licensed') || lower.includes('approved')) {
    return 'Licensed';
  }
  if (lower.includes('registered') || lower.includes('enrolled')) {
    return 'Registered';
  }
  if (lower.includes('provisional') || lower.includes('pending') || lower.includes('interim')) {
    return 'Provisional';
  }
  if (lower.includes('sandbox') || lower.includes('experimental')) {
    return 'Sandbox';
  }

  return 'Unknown';
}

/** Get or create the Notion client */
function getNotion(): Client | null {
  if (notion) return notion;

  const token = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
  if (!token) {
    logger.debug('notion', 'No NOTION_TOKEN env var — Notion writes disabled');
    return null;
  }

  notion = new Client({ auth: token });
  return notion;
}

/** Check if Notion integration is configured */
export function isNotionEnabled(): boolean {
  return !!(process.env.NOTION_TOKEN || process.env.NOTION_API_KEY);
}

/**
 * Convert a ParsedEntity to Notion page properties.
 */
function entityToNotionProperties(entity: ParsedEntity, parserId: string): Record<string, unknown> {
  const props: Record<string, unknown> = {
    // Title property
    Name: {
      title: [{ text: { content: entity.name.substring(0, 2000) } }],
    },
    'Country Code': {
      rich_text: [{ text: { content: entity.countryCode } }],
    },
    Country: {
      rich_text: [{ text: { content: entity.country || '' } }],
    },
    'License Number': {
      rich_text: [{ text: { content: (entity.licenseNumber || '').substring(0, 2000) } }],
    },
    Status: {
      select: { name: mapStatus(entity.status) },
    },
    Regulator: {
      rich_text: [{ text: { content: (entity.regulator || '').substring(0, 2000) } }],
    },
    'Parser ID': {
      rich_text: [{ text: { content: parserId } }],
    },
  };

  // Optional fields
  if (entity.licenseType) {
    props['License Type'] = {
      rich_text: [{ text: { content: entity.licenseType.substring(0, 2000) } }],
    };
  }

  if (entity.activities && entity.activities.length > 0) {
    props['Activities'] = {
      rich_text: [{ text: { content: entity.activities.join(', ').substring(0, 2000) } }],
    };
  }

  if (entity.website) {
    props['Website'] = { url: entity.website };
  }

  if (entity.sourceUrl) {
    props['Source URL'] = { url: entity.sourceUrl };
  }

  // Parsed At = now
  props['Parsed At'] = {
    date: { start: new Date().toISOString() },
  };

  return props;
}

/**
 * Delete existing Notion entity pages for a country code.
 * Uses filter query to find pages, then archives them.
 */
async function deleteNotionEntities(countryCode: string): Promise<number> {
  const client = getNotion();
  if (!client) return 0;

  let deleted = 0;
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const response = await client.databases.query({
      database_id: ENTITIES_DB_ID,
      filter: {
        property: 'Country Code',
        rich_text: { equals: countryCode },
      },
      start_cursor: startCursor,
      page_size: 100,
    });

    for (const page of response.results) {
      try {
        await client.pages.update({
          page_id: page.id,
          archived: true,
        });
        deleted++;
      } catch (err) {
        logger.debug('notion', `Failed to archive page ${page.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    hasMore = response.has_more;
    startCursor = response.next_cursor ?? undefined;
  }

  return deleted;
}

/**
 * Write entities to Notion.
 *
 * Strategy: delete existing entities for the country, then create new pages.
 * Mirrors the Supabase delete+insert strategy.
 */
export async function upsertEntitiesToNotion(
  result: ParseResult
): Promise<{ inserted: number; errors: string[] }> {
  const client = getNotion();
  if (!client) {
    return { inserted: 0, errors: ['Notion not configured (no NOTION_TOKEN)'] };
  }

  const { registryId, countryCode, entities } = result;

  logger.info(registryId, `[Notion] Writing ${entities.length} entities for ${countryCode}`);

  let inserted = 0;
  const errors: string[] = [];

  try {
    // 1. Delete existing entities for this country
    const deletedCount = await deleteNotionEntities(countryCode);
    if (deletedCount > 0) {
      logger.info(registryId, `[Notion] Archived ${deletedCount} existing entities for ${countryCode}`);
    }

    // 2. Create new entity pages in batches
    // Notion API rate limit: ~3 requests/second for creation
    const batchSize = 10;
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);

      // Create pages concurrently within batch
      const results = await Promise.allSettled(
        batch.map((entity) =>
          client.pages.create({
            parent: { database_id: ENTITIES_DB_ID },
            properties: entityToNotionProperties(entity, registryId) as any,
          })
        )
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          inserted++;
        } else {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          errors.push(msg);
          // Log first few errors only
          if (errors.length <= 3) {
            logger.debug(registryId, `[Notion] Page create error: ${msg}`);
          }
        }
      }

      // Rate limiting: wait 500ms between batches
      if (i + batchSize < entities.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Notion write failed: ${msg}`);
    logger.error(registryId, `[Notion] Write failed: ${msg}`);
  }

  logger.info(registryId, `[Notion] Done: ${inserted} inserted, ${errors.length} errors`);
  return { inserted, errors };
}

/**
 * Update jurisdiction entity count in Notion.
 * Called after successful entity writes to keep counts in sync.
 */
export async function updateJurisdictionCount(
  countryCode: string,
  entityCount: number
): Promise<void> {
  const client = getNotion();
  if (!client) return;

  try {
    // Find the jurisdiction in Country Research Registry (field "Country" = "CC — Name")
    const response = await client.databases.query({
      database_id: JURISDICTIONS_DB_ID,
      filter: {
        property: 'Country',
        rich_text: { starts_with: `${countryCode} ` },
      },
      page_size: 1,
    });

    if (response.results.length === 0) {
      logger.debug('notion', `[Notion] No jurisdiction found for ${countryCode}`);
      return;
    }

    const pageId = response.results[0].id;

    await client.pages.update({
      page_id: pageId,
      properties: {
        'Entity Count': { number: entityCount },
        'Last Run': { date: { start: new Date().toISOString().split('T')[0] } },
      } as any,
    });

    logger.debug('notion', `[Notion] Updated ${countryCode} entity count to ${entityCount}`);
  } catch (err) {
    logger.debug('notion', `[Notion] Failed to update jurisdiction count: ${err instanceof Error ? err.message : String(err)}`);
  }
}
