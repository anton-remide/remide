/**
 * Apply missing parser columns to Supabase entities table.
 * Uses Supabase Management API to execute DDL.
 *
 * Usage: SUPABASE_ACCESS_TOKEN=xxx npx tsx parsers/apply-migration.ts
 *
 * If no access token, falls back to modifying columns via REST where possible,
 * or prints instructions for manual execution.
 */
import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = 'cydzgjrvcclkigcizddc';
const url = process.env.VITE_SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const MIGRATION_SQL = `
-- Add missing parser columns
ALTER TABLE entities ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS parsed_at timestamptz;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS parser_id text;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS raw_data jsonb;

-- Unique constraint for upsert deduplication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'entities_license_country_unique'
  ) THEN
    ALTER TABLE entities
      ADD CONSTRAINT entities_license_country_unique
      UNIQUE (license_number, country_code);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entities_parser_id ON entities (parser_id);
CREATE INDEX IF NOT EXISTS idx_entities_country_code ON entities (country_code);
CREATE INDEX IF NOT EXISTS idx_entities_parsed_at ON entities (parsed_at);
`;

async function main() {
  // Try Management API first
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (accessToken) {
    console.log('Using Supabase Management API...');
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: MIGRATION_SQL }),
      }
    );

    if (response.ok) {
      console.log('✓ Migration applied successfully via Management API');
      return;
    } else {
      const text = await response.text();
      console.log(`Management API failed (${response.status}): ${text}`);
    }
  }

  // Fallback: try using the service key with a Postgres function
  if (serviceKey) {
    console.log('Trying to create columns via individual ALTER statements...');
    const sb = createClient(url, serviceKey, {
      db: { schema: 'public' },
    });

    // Check if we can execute SQL via rpc
    // First, try creating a temporary function
    const statements = [
      "ALTER TABLE entities ADD COLUMN IF NOT EXISTS source_url text",
      "ALTER TABLE entities ADD COLUMN IF NOT EXISTS parsed_at timestamptz",
      "ALTER TABLE entities ADD COLUMN IF NOT EXISTS parser_id text",
      "ALTER TABLE entities ADD COLUMN IF NOT EXISTS raw_data jsonb",
    ];

    // Try using the sql function if available
    for (const stmt of statements) {
      const { error } = await sb.rpc('exec_sql', { sql_query: stmt }).single();
      if (error) {
        // Expected to fail if function doesn't exist
        break;
      }
    }
  }

  // Print instructions for manual execution
  console.log('\n═══════════════════════════════════════════════════');
  console.log('⚠️  MANUAL MIGRATION REQUIRED');
  console.log('═══════════════════════════════════════════════════');
  console.log('\nGo to Supabase Dashboard → SQL Editor and run:\n');
  console.log(MIGRATION_SQL);
  console.log('═══════════════════════════════════════════════════');
  console.log('\nOr set SUPABASE_ACCESS_TOKEN env var and re-run this script.');
  console.log('Get token from: https://supabase.com/dashboard/account/tokens');
}

main().catch(console.error);
