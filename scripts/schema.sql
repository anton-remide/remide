-- ============================================================
-- RemiDe — Supabase Database Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Enums matching TypeScript union types
CREATE TYPE entity_status AS ENUM (
  'Licensed', 'Provisional', 'Sandbox', 'Registered', 'Pending', 'Unknown'
);
CREATE TYPE regime_type AS ENUM (
  'Licensing', 'Registration', 'Sandbox', 'Ban', 'None', 'Unclear'
);
CREATE TYPE travel_rule_status AS ENUM (
  'Enforced', 'Legislated', 'In Progress', 'Not Implemented', 'N/A'
);

-- JURISDICTIONS (206 rows from countries.json)
CREATE TABLE jurisdictions (
  code         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  regime       regime_type NOT NULL DEFAULT 'None',
  regulator    TEXT NOT NULL DEFAULT '',
  key_law      TEXT NOT NULL DEFAULT '',
  travel_rule  travel_rule_status NOT NULL DEFAULT 'N/A',
  entity_count INTEGER NOT NULL DEFAULT 0,
  sources      JSONB NOT NULL DEFAULT '[]',
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ENTITIES (608 rows from entities.json)
CREATE TABLE entities (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  country_code    TEXT NOT NULL REFERENCES jurisdictions(code),
  country         TEXT NOT NULL,
  license_number  TEXT NOT NULL DEFAULT '',
  license_type    TEXT NOT NULL DEFAULT '',
  entity_types    TEXT[] NOT NULL DEFAULT '{}',
  activities      TEXT[] NOT NULL DEFAULT '{}',
  status          entity_status NOT NULL DEFAULT 'Unknown',
  regulator       TEXT NOT NULL DEFAULT '',
  website         TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_entities_country_code ON entities(country_code);
CREATE INDEX idx_entities_status ON entities(status);

-- PROFILES (linked to Supabase auth.users)
CREATE TABLE profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  first_name     TEXT NOT NULL DEFAULT '',
  last_name      TEXT NOT NULL DEFAULT '',
  business_email TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  role_title     TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Jurisdictions: public read (anon + authenticated)
CREATE POLICY "jurisdictions_select_public"
  ON jurisdictions FOR SELECT USING (true);

-- Entities: public read (blur paywall is frontend-only)
CREATE POLICY "entities_select_public"
  ON entities FOR SELECT USING (true);

-- Profiles: own data only
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- Auto-create profile on signup (trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
