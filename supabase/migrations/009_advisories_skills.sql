-- TAI-AEGIS Phase 7: Advisories module + AI skill invocation log.

-- ------------------------------------------------------------------
-- Advisories — categorized intel deliverables (threat / breach / product).
-- Body is markdown. IOCs are typed JSON: {ipv4: [], domain: [], hash: [], cve: []}.
-- pdf_path / stix_path point at Modal Volume objects (or external URLs).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS advisories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('threat', 'breach', 'product')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  tlp text NOT NULL DEFAULT 'WHITE' CHECK (tlp IN ('WHITE', 'GREEN', 'AMBER', 'RED')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  summary text,
  body_markdown text,
  iocs jsonb DEFAULT '{}',
  tags text[] DEFAULT '{}',
  ref_links jsonb DEFAULT '[]',  -- 'references' is a SQL reserved word
  generated_by_skill text,                 -- e.g. 'draft-advisory'
  pdf_path text,                           -- Modal Volume key (or s3 url)
  stix_path text,
  author_id uuid,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisories_org_kind
  ON advisories(org_id, kind, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_advisories_status
  ON advisories(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_advisories_search
  ON advisories USING gin (to_tsvector('english',
    coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(body_markdown,'')));

-- ------------------------------------------------------------------
-- AI skill invocation log — every Claude call accounted for.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skill_invocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  skill text NOT NULL,
  model text NOT NULL,
  input_hash text,                         -- sha1 prefix, for dedup viz
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  cost_usd numeric(10, 6) DEFAULT 0,
  duration_ms integer DEFAULT 0,
  cached boolean DEFAULT false,
  error text,
  result_preview text,                     -- first 1000 chars of result for debug
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_invocations_org_time
  ON skill_invocations(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_invocations_skill_time
  ON skill_invocations(skill, created_at DESC);

-- ------------------------------------------------------------------
-- Attack-surface snapshots — per-customer-domain history for diff alerts.
-- Populated by the nightly Modal cron.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attack_surface_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES customer_profiles(id) ON DELETE CASCADE,
  domain text NOT NULL,
  subdomains text[] DEFAULT '{}',
  alive_hosts jsonb DEFAULT '[]',
  resolved_count integer DEFAULT 0,
  alive_count integer DEFAULT 0,
  raw jsonb DEFAULT '{}',
  scanned_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asn_snap_profile_time
  ON attack_surface_snapshots(profile_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_asn_snap_domain
  ON attack_surface_snapshots(domain, scanned_at DESC);
