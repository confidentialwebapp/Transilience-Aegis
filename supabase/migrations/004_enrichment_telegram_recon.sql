-- TAI-AEGIS Phase 3: Enrichment cache, Telegram bot ingestion, recon results, provider quotas.
-- Run order: after 003_blocklist_tables.sql

-- ============================================================
-- ENRICHMENT CACHE — fallback when Redis is unavailable.
-- Redis is the primary cache (24h TTL); Postgres keeps a 7-day audit trail.
-- ============================================================
CREATE TABLE IF NOT EXISTS enrichment_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ioc_type text NOT NULL CHECK (ioc_type IN ('ip','domain','url','hash','email','asn','cve')),
  ioc_value text NOT NULL,
  provider text NOT NULL,
  response_json jsonb NOT NULL,
  fetched_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  UNIQUE (provider, ioc_type, ioc_value)
);

CREATE INDEX IF NOT EXISTS idx_enrichment_lookup
  ON enrichment_cache(ioc_type, ioc_value, provider);
CREATE INDEX IF NOT EXISTS idx_enrichment_expires
  ON enrichment_cache(expires_at);

-- ============================================================
-- PROVIDER QUOTAS — surface remaining daily/monthly budget in /settings.
-- Updated atomically by enrichment.py after every provider call.
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  window_start date NOT NULL DEFAULT current_date,
  calls_used integer NOT NULL DEFAULT 0,
  calls_limit integer,
  last_status_code integer,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (provider, window_start)
);

CREATE INDEX IF NOT EXISTS idx_provider_quotas_provider_window
  ON provider_quotas(provider, window_start DESC);

-- ============================================================
-- TELEGRAM CHANNELS — chats the bot has been added to.
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL UNIQUE,
  chat_type text NOT NULL,
  title text,
  username text,
  added_at timestamptz DEFAULT now(),
  enabled boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_telegram_channels_enabled
  ON telegram_channels(enabled);

-- ============================================================
-- TELEGRAM MESSAGES — bot ingest, IOCs extracted at write time.
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL,
  message_id bigint NOT NULL,
  sender_id bigint,
  sender_name text,
  message_date timestamptz NOT NULL,
  text text,
  has_media boolean DEFAULT false,
  media_type text,
  extracted_iocs jsonb DEFAULT '{}',
  raw jsonb DEFAULT '{}',
  ingested_at timestamptz DEFAULT now(),
  UNIQUE (chat_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_msg_chat_date
  ON telegram_messages(chat_id, message_date DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_msg_iocs
  ON telegram_messages USING gin (extracted_iocs);
CREATE INDEX IF NOT EXISTS idx_telegram_msg_text_search
  ON telegram_messages USING gin (to_tsvector('english', coalesce(text, '')));

-- ============================================================
-- TELEGRAM BOT POLL STATE — long-poll cursor (one row).
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_poll_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_update_id bigint DEFAULT 0,
  last_polled_at timestamptz,
  last_error text
);

INSERT INTO telegram_poll_state (id, last_update_id)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RECON RUNS — theHarvester / dnsdumpster / netlas results per domain.
-- ============================================================
CREATE TABLE IF NOT EXISTS recon_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  domain text NOT NULL,
  tool text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','partial','failed','running')),
  emails text[] DEFAULT '{}',
  hosts text[] DEFAULT '{}',
  ips text[] DEFAULT '{}',
  asns text[] DEFAULT '{}',
  urls text[] DEFAULT '{}',
  raw jsonb DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error text
);

CREATE INDEX IF NOT EXISTS idx_recon_runs_domain
  ON recon_runs(domain, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_recon_runs_org
  ON recon_runs(org_id, started_at DESC);
