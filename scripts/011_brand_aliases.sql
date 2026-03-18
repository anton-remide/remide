-- Brand alias map: links well-known brand names to legal entities in our DB.
-- One brand can map to many entities (Binance → 15+ legal entities across jurisdictions).
-- One entity can belong to multiple brands (rare, e.g. white-label).

CREATE TABLE IF NOT EXISTS brand_aliases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_slug    TEXT NOT NULL,                    -- 'binance', 'crypto-com', 'kraken'
  display_name  TEXT NOT NULL,                    -- 'Binance', 'Crypto.com', 'Kraken'
  entity_id     TEXT REFERENCES entities(id) ON DELETE SET NULL,
  legal_name    TEXT,                             -- matched entity's legal name
  alias_type    TEXT NOT NULL DEFAULT 'auto',     -- 'auto_domain', 'auto_name', 'auto_brand', 'manual'
  confidence    REAL NOT NULL DEFAULT 0,          -- 0.0–1.0
  country_code  TEXT,
  source        TEXT NOT NULL DEFAULT 'coingecko', -- 'coingecko', 'manual', 'enrichment'
  source_rank   INT,                              -- position in source list
  website       TEXT,                             -- brand's known website
  category      TEXT DEFAULT 'exchange',          -- 'exchange', 'stablecoin_issuer', 'wallet', 'defi'
  match_status  TEXT NOT NULL DEFAULT 'unmatched', -- 'matched', 'partial', 'unmatched'
  gap_reason    TEXT,                             -- why unmatched: 'no_registry', 'different_name', 'unparsed_registry'
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_aliases_slug ON brand_aliases (brand_slug);
CREATE INDEX IF NOT EXISTS idx_brand_aliases_entity ON brand_aliases (entity_id);
CREATE INDEX IF NOT EXISTS idx_brand_aliases_status ON brand_aliases (match_status);
CREATE INDEX IF NOT EXISTS idx_brand_aliases_display ON brand_aliases (lower(display_name));

-- Index brand_name column on entities for search
CREATE INDEX IF NOT EXISTS idx_entities_brand_name ON entities (lower(brand_name))
  WHERE brand_name IS NOT NULL;

COMMENT ON TABLE brand_aliases IS 'Maps well-known crypto brands to legal entities in the database';
