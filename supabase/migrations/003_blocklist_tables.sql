-- TAI-AEGIS Phase 2: Open blocklist ingestion (Feodo, OpenPhish, PhishStats, ET, Tor)
-- Global reference tables (not per-org). Populated by scheduler.
-- Run order: after 002_phase1_tables.sql

-- ============================================================
-- BLOCKLIST ENTRIES
-- Global IOC feed from open sources with no API key.
-- Cross-referenced during /investigate and /intel/lookup.
-- ============================================================
CREATE TABLE IF NOT EXISTS blocklist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ioc_type text NOT NULL CHECK (ioc_type IN ('ip','domain','url','hash')),
  ioc_value text NOT NULL,
  source text NOT NULL,
  category text,
  confidence integer DEFAULT 75 CHECK (confidence >= 0 AND confidence <= 100),
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  UNIQUE (source, ioc_value)
);

CREATE INDEX IF NOT EXISTS idx_blocklist_value       ON blocklist_entries(ioc_value);
CREATE INDEX IF NOT EXISTS idx_blocklist_type_value  ON blocklist_entries(ioc_type, ioc_value);
CREATE INDEX IF NOT EXISTS idx_blocklist_source      ON blocklist_entries(source);
CREATE INDEX IF NOT EXISTS idx_blocklist_last_seen   ON blocklist_entries(last_seen DESC);

-- ============================================================
-- SYNC RUNS — per-source audit trail for the scheduler
-- ============================================================
CREATE TABLE IF NOT EXISTS blocklist_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','partial','failed')),
  entries_fetched integer DEFAULT 0,
  entries_upserted integer DEFAULT 0,
  error text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_blocklist_runs_source_started
  ON blocklist_sync_runs(source, started_at DESC);
