-- Migration 010: Add brand_name and twitter_url columns
-- Part of Parser Audit + Enrichment Pipeline plan

ALTER TABLE entities ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS twitter_url TEXT;
