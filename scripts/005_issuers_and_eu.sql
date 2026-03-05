-- DDL 005: Issuer Slugs + EU Jurisdiction Row
-- Purpose: Enable SEO-friendly /issuers/:slug URLs + EU as virtual jurisdiction
-- Depends on: DDL 004 (stablecoin_issuers table must exist)
-- Idempotent: Safe to run multiple times

-- ============================================================
-- 1. Add slug column to stablecoin_issuers
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stablecoin_issuers' AND column_name = 'slug'
  ) THEN
    ALTER TABLE stablecoin_issuers ADD COLUMN slug TEXT UNIQUE;
  END IF;
END $$;

-- Generate slugs from issuer names
-- Pattern: lowercase, replace non-alphanumeric with hyphens, trim edges
UPDATE stablecoin_issuers
SET slug = trim(BOTH '-' FROM lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')))
WHERE slug IS NULL;

-- Handle potential slug collisions by appending stride_id
WITH dupes AS (
  SELECT slug, array_agg(id ORDER BY id) AS ids
  FROM stablecoin_issuers
  WHERE slug IS NOT NULL
  GROUP BY slug
  HAVING count(*) > 1
)
UPDATE stablecoin_issuers si
SET slug = si.slug || '-' || si.stride_id
FROM dupes d
WHERE si.slug = d.slug
AND si.id != d.ids[1];

-- ============================================================
-- 2. Insert EU as virtual jurisdiction (if not exists)
-- ============================================================

INSERT INTO jurisdictions (code, name, regime, travel_rule, regulator, notes,
  stablecoin_stage, is_stablecoin_specific, entity_count)
VALUES (
  'EU',
  'European Union',
  'Licensing',
  'Enforced',
  'ESMA + NCAs',
  'The European Union regulates crypto assets under the Markets in Crypto-Assets Regulation (MiCA), which entered into force in June 2023 with full application from December 2024. MiCA establishes a comprehensive framework for crypto-asset service providers (CASPs) including authorization requirements, capital requirements, and conduct of business rules. The Transfer of Funds Regulation (TFR) implements the FATF Travel Rule for crypto transfers across EU member states.',
  3,
  true,
  0
)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 3. Verification
-- ============================================================

-- Check slug column exists and has values
SELECT
  count(*) AS total_issuers,
  count(slug) AS issuers_with_slug,
  count(*) - count(slug) AS issuers_without_slug
FROM stablecoin_issuers;

-- Check EU jurisdiction exists
SELECT code, name, regime, regulator
FROM jurisdictions
WHERE code = 'EU';
