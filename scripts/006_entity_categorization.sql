-- 006: Entity Categorization
-- Adds sector classification and crypto_related flag to entities table.
-- Enables filtering entities by sector (Crypto, Payments, Banking)
-- and cross-cutting crypto relevance.
-- Applied: 2026-03-06

-- Add sector column (Crypto, Payments, Banking)
ALTER TABLE entities ADD COLUMN IF NOT EXISTS sector TEXT;

-- Add crypto_related boolean flag
ALTER TABLE entities ADD COLUMN IF NOT EXISTS crypto_related BOOLEAN DEFAULT false;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_entities_sector ON entities(sector);
CREATE INDEX IF NOT EXISTS idx_entities_crypto_related ON entities(crypto_related);

-- Auto-classify by parser_id:
-- Crypto sector: ESMA CASPs, standalone VASP registries
UPDATE entities SET sector = 'Crypto', crypto_related = true
WHERE parser_id IN (
  'esma-de', 'esma-nl', 'esma-fr', 'esma-es', 'esma-it', 'esma-at',
  'esma-cz', 'esma-fi', 'esma-ie', 'esma-lt', 'esma-lu', 'esma-lv',
  'esma-mt', 'esma-pl', 'esma-sk', 'esma-si', 'esma-cy', 'esma-bg',
  'esma-se', 'esma-be', 'esma-hr', 'esma-pt', 'esma-ro', 'esma-hu',
  'esma-gr', 'esma-ee', 'esma-dk', 'esma-li', 'esma-no', 'esma-is',
  'au-austrac', 'ca-fintrac', 'jp-jfsa', 'sg-mas',
  'ch-finma', 'us-fincen', 'ae-vara', 'ae-adgm', 'ae-dfsareg',
  'za-fsca', 'ng-sec', 'ke-cma', 'bm-bma',
  'th-sec', 'my-sc', 'sc-fsa', 'gi-gfsc', 'im-fsa',
  'li-fma', 'tw-fsc', 'ky-cima', 'id-ojk',
  'hk-sfc', 'kr-fiu', 'br-bcb', 'ar-cnv', 'ph-bsp', 'sv-cnad',
  'us-nydfs'
);

-- Payments sector: EBA EUCLID (EMI, PI, EPI, EEMI, ENL)
UPDATE entities SET sector = 'Payments', crypto_related = false
WHERE parser_id LIKE 'eba-%';

-- Banking sector: FDIC banks, PRA banks
UPDATE entities SET sector = 'Banking', crypto_related = false
WHERE parser_id IN ('us-fdic', 'gb-pra');

-- Catch-all: any remaining NULL sectors default to Crypto (legacy parsers)
UPDATE entities SET sector = 'Crypto', crypto_related = true
WHERE sector IS NULL;
