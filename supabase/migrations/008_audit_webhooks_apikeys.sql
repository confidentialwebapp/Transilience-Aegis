-- TAI-AEGIS Phase 6: Enterprise primitives.
--
-- Three tables that big-firm CISOs expect to find when evaluating a CTI vendor:
--   1. audit_log         — who did what when (compliance + forensics)
--   2. alert_webhooks    — Slack/Teams/Discord/custom HTTP delivery of alerts
--   3. api_keys          — programmatic access scoped per-org with hashed secrets

-- ------------------------------------------------------------------
-- Audit log — append-only record of significant org-scoped actions.
-- The base audit_log table already exists from migration 001 with columns
-- entity_type / entity_id / details. We add a few useful columns here.
-- ------------------------------------------------------------------
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS ip inet,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

-- ------------------------------------------------------------------
-- Alert webhooks — outbound HTTP delivery of alerts to customer systems.
-- Slack / Teams / Discord / custom JSON.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  name text NOT NULL,                  -- "Security team Slack"
  url text NOT NULL,                   -- the endpoint to POST to
  kind text NOT NULL DEFAULT 'generic'
    CHECK (kind IN ('slack', 'teams', 'discord', 'generic')),
  secret text,                         -- HMAC secret for 'generic' kind
  events text[] DEFAULT ARRAY['alert.created']::text[],  -- which events to deliver
  min_severity text DEFAULT 'medium'
    CHECK (min_severity IN ('low', 'medium', 'high', 'critical')),
  enabled boolean DEFAULT true,
  last_delivery_at timestamptz,
  last_delivery_status integer,        -- HTTP status from last attempt
  last_delivery_error text,
  failure_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_org_enabled
  ON alert_webhooks(org_id, enabled) WHERE enabled = true;

-- ------------------------------------------------------------------
-- Webhook delivery log — per-attempt audit, separate so a flood of
-- failures doesn't bloat the alerts table.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid REFERENCES alert_webhooks(id) ON DELETE CASCADE,
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  alert_id uuid,                       -- the alert we tried to deliver
  http_status integer,
  ok boolean,
  response_body text,
  error text,
  attempt integer DEFAULT 1,
  delivered_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_del_webhook
  ON webhook_deliveries(webhook_id, delivered_at DESC);

-- ------------------------------------------------------------------
-- API keys — programmatic access for the org's automation. The full
-- key is only shown to the user at creation time; we store sha256(key).
-- The 8-char `prefix` is shown in the dashboard for identification.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  name text NOT NULL,                  -- "CI pipeline", "SOC dashboard"
  key_hash text NOT NULL UNIQUE,       -- sha256 hex of the full secret
  prefix text NOT NULL,                -- first 8 chars of the key, e.g. "aegis_a1"
  scopes text[] DEFAULT ARRAY['read']::text[],   -- read | write | admin
  created_by uuid,                     -- user that created it
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;
