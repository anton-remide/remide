-- DDL 008: Hidden Entities
-- Adds is_hidden flag for entities that are valid data but not shown on frontend.
-- Use case: EPI micro-payment institutions, ENL national-only, Exempt EMI.
-- Workers CAN read hidden entities for learning/enrichment. Frontend excludes them.

ALTER TABLE entities ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

-- Index for frontend queries (filter out hidden)
CREATE INDEX IF NOT EXISTS idx_entities_hidden ON entities(is_hidden) WHERE is_hidden = true;

COMMENT ON COLUMN entities.is_hidden IS 'Valid entity hidden from frontend display. Workers can still access.';
COMMENT ON COLUMN entities.hidden_reason IS 'Why hidden: epi_micro, enl_national, exempt_emi, etc.';
