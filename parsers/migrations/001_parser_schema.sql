-- Parser system DB schema extension
-- Run via Supabase SQL Editor or CLI
-- Extends existing entities table + adds scrape_runs table

-- ============================================================
-- 1. Extend entities table with parser-specific columns
-- ============================================================

-- entity_types: e.g. trading names, DBA names
ALTER TABLE entities ADD COLUMN IF NOT EXISTS entity_types text[] DEFAULT '{}';

-- activities: licensed activities (e.g. "dealing in virtual currencies")
ALTER TABLE entities ADD COLUMN IF NOT EXISTS activities text[] DEFAULT '{}';

-- source_url: registry page URL where entity was found
ALTER TABLE entities ADD COLUMN IF NOT EXISTS source_url text;

-- parsed_at: last time this entity was parsed
ALTER TABLE entities ADD COLUMN IF NOT EXISTS parsed_at timestamptz;

-- parser_id: which parser produced this record (e.g. "za-fsca")
ALTER TABLE entities ADD COLUMN IF NOT EXISTS parser_id text;

-- raw_data: optional raw JSON blob for debugging
ALTER TABLE entities ADD COLUMN IF NOT EXISTS raw_data jsonb;

-- Unique constraint for upsert deduplication
-- (may already exist — IF NOT EXISTS on constraints needs DO NOTHING trick)
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

-- Index for parser queries
CREATE INDEX IF NOT EXISTS idx_entities_parser_id ON entities (parser_id);
CREATE INDEX IF NOT EXISTS idx_entities_country_code ON entities (country_code);
CREATE INDEX IF NOT EXISTS idx_entities_parsed_at ON entities (parsed_at);

-- ============================================================
-- 2. scrape_runs — log each parser execution
-- ============================================================

CREATE TABLE IF NOT EXISTS scrape_runs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  registry_id   text NOT NULL,
  status        text NOT NULL CHECK (status IN ('success', 'partial', 'error')),
  entities_found integer NOT NULL DEFAULT 0,
  entities_new   integer NOT NULL DEFAULT 0,
  entities_updated integer NOT NULL DEFAULT 0,
  entities_removed integer NOT NULL DEFAULT 0,
  duration_ms    integer NOT NULL DEFAULT 0,
  error_message  text,
  warnings       text[] DEFAULT '{}',
  delta_percent  numeric(8,2) DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_registry ON scrape_runs (registry_id);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_created ON scrape_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_status ON scrape_runs (status);

-- ============================================================
-- 3. verification_runs — log each verification check
-- ============================================================

CREATE TABLE IF NOT EXISTS verification_runs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  check_type     text NOT NULL CHECK (check_type IN ('staleness', 'url_health', 'data_quality', 'full')),
  status         text NOT NULL CHECK (status IN ('pass', 'warn', 'fail')),
  summary        text NOT NULL,
  details        jsonb DEFAULT '{}',
  stale_registries text[] DEFAULT '{}',
  unreachable_count integer DEFAULT 0,
  quality_issues   integer DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_runs_created ON verification_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_runs_type ON verification_runs (check_type);

-- ============================================================
-- 4. RLS policies (optional — for service key these are bypassed)
-- ============================================================

-- Allow anon read on scrape_runs for dashboard
ALTER TABLE scrape_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Public read scrape_runs"
  ON scrape_runs FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Service insert scrape_runs"
  ON scrape_runs FOR INSERT
  WITH CHECK (true);

-- verification_runs
ALTER TABLE verification_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Public read verification_runs"
  ON verification_runs FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Service insert verification_runs"
  ON verification_runs FOR INSERT
  WITH CHECK (true);
