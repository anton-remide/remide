-- ============================================================
-- Migration 004: Stride Tracker Data Integration
-- Adds stablecoin regulatory framework columns to jurisdictions,
-- enriches stablecoins table, adds new tables for issuers/laws/events.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- ── 1. Enrich jurisdictions with stablecoin regulatory data ──

ALTER TABLE jurisdictions
  ADD COLUMN IF NOT EXISTS stablecoin_stage        INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_stablecoin_specific  BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS yield_allowed           BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fiat_backed             INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fiat_alert              TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS crypto_backed           INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS crypto_alert            TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS commodity_backed        INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commodity_alert         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS algorithm_backed        INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS algorithm_alert         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS stablecoin_description  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS regulator_description   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS currency                TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS stride_id               INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stride_data             JSONB DEFAULT NULL;

COMMENT ON COLUMN jurisdictions.stablecoin_stage IS 'Stride stage: 0=No Framework, 1=Developing, 2=In Progress, 3=Live';
COMMENT ON COLUMN jurisdictions.fiat_backed IS '0=Prohibited, 1=Permitted, 2=Unclear';
COMMENT ON COLUMN jurisdictions.crypto_backed IS '0=Prohibited, 1=Permitted, 2=Unclear';
COMMENT ON COLUMN jurisdictions.commodity_backed IS '0=Prohibited, 1=Permitted, 2=Unclear';
COMMENT ON COLUMN jurisdictions.algorithm_backed IS '0=Prohibited, 1=Permitted, 2=Unclear';
COMMENT ON COLUMN jurisdictions.stride_id IS 'ISO 3166-1 numeric code from Stride tracker';

-- ── 2. Enrich stablecoins table ──

ALTER TABLE stablecoins
  ADD COLUMN IF NOT EXISTS stride_id          INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whitepaper_url     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS coinmarketcap_id   INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS collateral_method  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS issuer_id          INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stride_data        JSONB DEFAULT NULL;

COMMENT ON COLUMN stablecoins.stride_id IS 'PK from Stride tracker';
COMMENT ON COLUMN stablecoins.coinmarketcap_id IS 'CoinMarketCap UCID for price tracking';
COMMENT ON COLUMN stablecoins.issuer_id IS 'FK to stablecoin_issuers.stride_id';

-- ── 3. New table: Stablecoin Issuers (from Stride) ──

CREATE TABLE IF NOT EXISTS stablecoin_issuers (
  id                    SERIAL PRIMARY KEY,
  stride_id             INTEGER UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  official_name         TEXT DEFAULT '',
  former_names          TEXT DEFAULT '',
  lei                   TEXT DEFAULT '',
  cik                   TEXT DEFAULT '',
  auditor               TEXT DEFAULT '',
  description           TEXT DEFAULT '',
  assurance_frequency   TEXT DEFAULT '',
  redemption_policy     TEXT DEFAULT '',
  website               TEXT DEFAULT '',
  country_code          TEXT DEFAULT '',
  country               TEXT DEFAULT '',
  is_verified           BOOLEAN DEFAULT false,
  stride_data           JSONB DEFAULT NULL,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stablecoin_issuers_country
  ON stablecoin_issuers(country_code);
CREATE INDEX IF NOT EXISTS idx_stablecoin_issuers_stride_id
  ON stablecoin_issuers(stride_id);

-- ── 4. New table: Stablecoin Laws (per jurisdiction, from Stride) ──

CREATE TABLE IF NOT EXISTS stablecoin_laws (
  id              SERIAL PRIMARY KEY,
  stride_id       INTEGER NOT NULL,
  country_code    TEXT NOT NULL,
  title           TEXT NOT NULL,
  enacted_date    DATE DEFAULT NULL,
  description     TEXT DEFAULT '',
  citation_url    TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stablecoin_laws_country
  ON stablecoin_laws(country_code);

-- ── 5. New table: Regulatory Events/Timeline (per jurisdiction, from Stride) ──

CREATE TABLE IF NOT EXISTS stablecoin_events (
  id              SERIAL PRIMARY KEY,
  stride_id       INTEGER NOT NULL,
  country_code    TEXT NOT NULL,
  event_date      DATE DEFAULT NULL,
  event_type      INTEGER DEFAULT NULL,
  title           TEXT NOT NULL,
  details         TEXT DEFAULT '',
  citation_url    TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stablecoin_events_country
  ON stablecoin_events(country_code);

COMMENT ON COLUMN stablecoin_events.event_type IS '2=Legislative, 3=Regulatory/News (from Stride)';

-- ── 6. New table: Issuer Subsidiaries (from Stride) ──

CREATE TABLE IF NOT EXISTS issuer_subsidiaries (
  id                  SERIAL PRIMARY KEY,
  stride_id           INTEGER NOT NULL,
  issuer_stride_id    INTEGER NOT NULL,
  name                TEXT NOT NULL,
  lei                 TEXT DEFAULT '',
  country_code        TEXT DEFAULT '',
  country             TEXT DEFAULT '',
  can_issue           BOOLEAN DEFAULT false,
  incorporation_date  DATE DEFAULT NULL,
  description         TEXT DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issuer_subsidiaries_issuer
  ON issuer_subsidiaries(issuer_stride_id);

-- ── 7. New table: Issuer Licenses (from Stride) ──

CREATE TABLE IF NOT EXISTS issuer_licenses (
  id                  SERIAL PRIMARY KEY,
  stride_id           INTEGER NOT NULL,
  issuer_stride_id    INTEGER NOT NULL,
  title               TEXT NOT NULL,
  detail              TEXT DEFAULT '',
  can_issue           BOOLEAN DEFAULT false,
  country_code        TEXT DEFAULT '',
  country             TEXT DEFAULT '',
  subsidiary_name     TEXT DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issuer_licenses_issuer
  ON issuer_licenses(issuer_stride_id);
CREATE INDEX IF NOT EXISTS idx_issuer_licenses_country
  ON issuer_licenses(country_code);

-- ── 8. New table: Blockchain Deployments (stablecoin contract addresses) ──

CREATE TABLE IF NOT EXISTS stablecoin_blockchains (
  id                  SERIAL PRIMARY KEY,
  stablecoin_ticker   TEXT NOT NULL,
  blockchain_name     TEXT NOT NULL,
  contract_address    TEXT DEFAULT '',
  deploy_date         DATE DEFAULT NULL,
  stride_blockchain_id INTEGER DEFAULT NULL,
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (stablecoin_ticker, blockchain_name)
);

CREATE INDEX IF NOT EXISTS idx_stablecoin_blockchains_ticker
  ON stablecoin_blockchains(stablecoin_ticker);

-- ── 9. RLS: Public read for all new tables ──

ALTER TABLE stablecoin_issuers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stablecoin_laws ENABLE ROW LEVEL SECURITY;
ALTER TABLE stablecoin_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE issuer_subsidiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE issuer_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stablecoin_blockchains ENABLE ROW LEVEL SECURITY;

CREATE POLICY stablecoin_issuers_select_public
  ON stablecoin_issuers FOR SELECT USING (true);
CREATE POLICY stablecoin_laws_select_public
  ON stablecoin_laws FOR SELECT USING (true);
CREATE POLICY stablecoin_events_select_public
  ON stablecoin_events FOR SELECT USING (true);
CREATE POLICY issuer_subsidiaries_select_public
  ON issuer_subsidiaries FOR SELECT USING (true);
CREATE POLICY issuer_licenses_select_public
  ON issuer_licenses FOR SELECT USING (true);
CREATE POLICY stablecoin_blockchains_select_public
  ON stablecoin_blockchains FOR SELECT USING (true);

-- ── 10. Service role INSERT policies for new tables ──

CREATE POLICY stablecoin_issuers_insert_service
  ON stablecoin_issuers FOR INSERT WITH CHECK (true);
CREATE POLICY stablecoin_issuers_update_service
  ON stablecoin_issuers FOR UPDATE USING (true);
CREATE POLICY stablecoin_issuers_delete_service
  ON stablecoin_issuers FOR DELETE USING (true);

CREATE POLICY stablecoin_laws_insert_service
  ON stablecoin_laws FOR INSERT WITH CHECK (true);
CREATE POLICY stablecoin_laws_delete_service
  ON stablecoin_laws FOR DELETE USING (true);

CREATE POLICY stablecoin_events_insert_service
  ON stablecoin_events FOR INSERT WITH CHECK (true);
CREATE POLICY stablecoin_events_delete_service
  ON stablecoin_events FOR DELETE USING (true);

CREATE POLICY issuer_subsidiaries_insert_service
  ON issuer_subsidiaries FOR INSERT WITH CHECK (true);
CREATE POLICY issuer_subsidiaries_delete_service
  ON issuer_subsidiaries FOR DELETE USING (true);

CREATE POLICY issuer_licenses_insert_service
  ON issuer_licenses FOR INSERT WITH CHECK (true);
CREATE POLICY issuer_licenses_delete_service
  ON issuer_licenses FOR DELETE USING (true);

CREATE POLICY stablecoin_blockchains_insert_service
  ON stablecoin_blockchains FOR INSERT WITH CHECK (true);
CREATE POLICY stablecoin_blockchains_delete_service
  ON stablecoin_blockchains FOR DELETE USING (true);

-- Also need INSERT/UPDATE/DELETE on existing tables for service role
-- (jurisdictions, stablecoins already have these from earlier migrations)
