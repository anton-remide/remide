-- Migration 003: Add enrichment columns to entities table
-- These columns are populated by the Firecrawl enrichment worker.
--
-- Apply via Supabase SQL Editor:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this script
--   3. Click "Run"

-- Description from company website
ALTER TABLE entities ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- Social / registry links
ALTER TABLE entities ADD COLUMN IF NOT EXISTS linkedin_url TEXT DEFAULT '';
ALTER TABLE entities ADD COLUMN IF NOT EXISTS registry_url TEXT DEFAULT '';

-- Timestamp of last enrichment run
ALTER TABLE entities ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ DEFAULT NULL;
