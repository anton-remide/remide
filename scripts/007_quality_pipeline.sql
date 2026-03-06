-- 007: Quality Pipeline
-- Adds columns for data quality processing: cleanup, classification, scoring, DNS verification.
-- Part of S4.12: Quality Pipeline Architecture.
-- Related decisions: ARCH-008, DATA-003, DATA-004, DATA-005, INFRA-002, DATA-006
-- Applied: 2026-03-06

-- ==========================================
-- Quality Worker columns
-- ==========================================

-- Cleaned display name (original `name` preserved)
ALTER TABLE entities ADD COLUMN IF NOT EXISTS canonical_name TEXT;

-- Soft-delete for garbage entities (dates, codes, footnotes)
ALTER TABLE entities ADD COLUMN IF NOT EXISTS is_garbage BOOLEAN DEFAULT false;

-- Data completeness score 0-100 (T1=10-30, T2=40-60, T3=60-80, T4=80-100)
ALTER TABLE entities ADD COLUMN IF NOT EXISTS quality_score SMALLINT DEFAULT 0;

-- Current quality state: { rules: [...], garbage_reason: null, tier: "T1" }
ALTER TABLE entities ADD COLUMN IF NOT EXISTS quality_flags JSONB DEFAULT '{}';

-- When Quality Worker last processed this entity
ALTER TABLE entities ADD COLUMN IF NOT EXISTS last_quality_at TIMESTAMPTZ;

-- ==========================================
-- Classification: crypto_status (from S4.0)
-- 4 levels: confirmed_crypto, crypto_adjacent, traditional, unknown
-- Orthogonal to existing `sector` column (business type)
-- ==========================================
ALTER TABLE entities ADD COLUMN IF NOT EXISTS crypto_status TEXT DEFAULT 'unknown';

-- ==========================================
-- DNS / Dead Company tracking (from S4.9)
-- ==========================================

-- alive = DNS resolves + HTTP ok, dead = DNS fails, no_website = no website field, unknown = not checked
ALTER TABLE entities ADD COLUMN IF NOT EXISTS dns_status TEXT DEFAULT 'unknown';

-- When DNS was last checked
ALTER TABLE entities ADD COLUMN IF NOT EXISTS dns_checked_at TIMESTAMPTZ;

-- ==========================================
-- Verify Worker timestamp
-- ==========================================
ALTER TABLE entities ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- ==========================================
-- Indexes for performance
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_entities_quality_score ON entities(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_entities_crypto_status ON entities(crypto_status);
CREATE INDEX IF NOT EXISTS idx_entities_garbage ON entities(is_garbage) WHERE is_garbage = true;
CREATE INDEX IF NOT EXISTS idx_entities_dns_status ON entities(dns_status);

-- ==========================================
-- Initial crypto_status classification (by parser source)
-- Maps existing parser_id → crypto_status
-- ==========================================

-- VASP/CASP/DPT registries → confirmed_crypto
UPDATE entities SET crypto_status = 'confirmed_crypto'
WHERE parser_id IN (
  'esma-de', 'esma-nl', 'esma-fr', 'esma-es', 'esma-it', 'esma-at',
  'esma-cz', 'esma-fi', 'esma-ie', 'esma-lt', 'esma-lu', 'esma-lv',
  'esma-mt', 'esma-pl', 'esma-sk', 'esma-si', 'esma-cy', 'esma-bg',
  'esma-se', 'esma-be', 'esma-hr', 'esma-pt', 'esma-ro', 'esma-hu',
  'esma-gr', 'esma-ee', 'esma-dk', 'esma-li', 'esma-no', 'esma-is',
  'ae-vara', 'ae-adgm', 'ae-dfsareg',
  'th-sec', 'my-sc', 'sc-fsa', 'gi-gfsc', 'im-fsa',
  'li-fma', 'tw-fsc', 'ky-cima', 'id-ojk',
  'hk-sfc', 'kr-fiu', 'ar-cnv', 'ph-bsp', 'sv-cnad',
  'us-nydfs', 'ng-sec'
);

-- ESMA unified (CASP register) → confirmed_crypto
UPDATE entities SET crypto_status = 'confirmed_crypto'
WHERE parser_id = 'esma-unified';

-- Banking registries → traditional
UPDATE entities SET crypto_status = 'traditional'
WHERE parser_id IN ('us-fdic', 'gb-pra');

-- EBA EUCLID (payment institutions) → traditional (until keyword check upgrades some)
UPDATE entities SET crypto_status = 'traditional'
WHERE parser_id LIKE 'eba-%';

-- Mixed registries (serve both crypto and non-crypto) → unknown (Quality Worker will classify)
UPDATE entities SET crypto_status = 'unknown'
WHERE parser_id IN (
  'au-austrac', 'ca-fintrac', 'jp-jfsa', 'sg-mas',
  'ch-finma', 'us-fincen', 'za-fsca', 'br-bcb', 'bm-bma'
) AND crypto_status = 'unknown';

-- Sync crypto_related boolean with crypto_status
UPDATE entities SET crypto_related = true
WHERE crypto_status IN ('confirmed_crypto', 'crypto_adjacent');

UPDATE entities SET crypto_related = false
WHERE crypto_status IN ('traditional', 'unknown');
