-- TAI-AEGIS Phase 5: Email digest infrastructure.
--
-- Adds digest scheduling/tracking to customer_profiles plus a digest_log table
-- so we can debug send failures and avoid duplicate sends.

-- ------------------------------------------------------------------
-- Extend customer_profiles with digest fields
-- ------------------------------------------------------------------
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS digest_frequency text NOT NULL DEFAULT 'off'
    CHECK (digest_frequency IN ('off','daily','weekly')),
  ADD COLUMN IF NOT EXISTS digest_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribe_token text UNIQUE
    DEFAULT encode(gen_random_bytes(16), 'hex');

CREATE INDEX IF NOT EXISTS idx_customer_profiles_digest_due
  ON customer_profiles(digest_frequency, digest_last_sent_at)
  WHERE digest_frequency != 'off' AND notify_email IS NOT NULL;

-- ------------------------------------------------------------------
-- Digest send log — one row per send attempt for audit + dedup.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS digest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES customer_profiles(id) ON DELETE CASCADE,
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  email text NOT NULL,
  frequency text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','failed','skipped')),
  error text,
  alerts_count integer DEFAULT 0,
  posts_count integer DEFAULT 0,
  resend_message_id text,
  sent_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digest_log_profile_sent
  ON digest_log(profile_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_digest_log_org_sent
  ON digest_log(org_id, sent_at DESC);
