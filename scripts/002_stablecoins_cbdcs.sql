-- ============================================================
-- Migration 002: Stablecoins & CBDCs tables
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── Stablecoins ──

CREATE TABLE IF NOT EXISTS stablecoins (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  ticker            TEXT NOT NULL,
  type              TEXT NOT NULL,
  peg_currency      TEXT NOT NULL,
  issuer            TEXT NOT NULL,
  issuer_country    TEXT NOT NULL,
  launch_date       DATE,
  market_cap_bn     NUMERIC(12,2) NOT NULL,
  chains            TEXT[] DEFAULT '{}',
  reserve_type      TEXT,
  audit_status      TEXT,
  regulatory_status TEXT,
  website           TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ── Stablecoin ↔ Jurisdiction junction table ──

CREATE TABLE IF NOT EXISTS stablecoin_jurisdictions (
  stablecoin_id TEXT NOT NULL REFERENCES stablecoins(id) ON DELETE CASCADE,
  country_code  TEXT NOT NULL,
  status        TEXT NOT NULL,
  notes         TEXT,
  PRIMARY KEY (stablecoin_id, country_code)
);

-- ── CBDCs ──

CREATE TABLE IF NOT EXISTS cbdcs (
  id                    TEXT PRIMARY KEY,
  country_code          TEXT NOT NULL,
  country               TEXT NOT NULL,
  name                  TEXT NOT NULL,
  currency              TEXT NOT NULL,
  status                TEXT NOT NULL,
  phase                 TEXT,
  central_bank          TEXT NOT NULL,
  launch_date           DATE,
  technology            TEXT,
  retail_or_wholesale   TEXT,
  cross_border          BOOLEAN DEFAULT false,
  cross_border_projects TEXT[] DEFAULT '{}',
  programmable          BOOLEAN DEFAULT false,
  privacy_model         TEXT,
  interest_bearing      BOOLEAN DEFAULT false,
  offline_capable       BOOLEAN DEFAULT false,
  notes                 TEXT,
  sources               JSONB DEFAULT '[]',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ── RLS: Public read ──

ALTER TABLE stablecoins ENABLE ROW LEVEL SECURITY;
ALTER TABLE stablecoin_jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbdcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY stablecoins_select_public
  ON stablecoins FOR SELECT USING (true);

CREATE POLICY stablecoin_jurisdictions_select_public
  ON stablecoin_jurisdictions FOR SELECT USING (true);

CREATE POLICY cbdcs_select_public
  ON cbdcs FOR SELECT USING (true);

-- ── Indexes ──

CREATE INDEX IF NOT EXISTS idx_stablecoin_jurisdictions_country
  ON stablecoin_jurisdictions(country_code);

CREATE INDEX IF NOT EXISTS idx_cbdcs_country_code
  ON cbdcs(country_code);

CREATE INDEX IF NOT EXISTS idx_cbdcs_status
  ON cbdcs(status);
