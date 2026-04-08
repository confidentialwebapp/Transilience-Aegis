-- TAI-AEGIS: Threat Intelligence & Digital Risk Monitoring Platform
-- Initial Schema Migration

-- Organizations
CREATE TABLE IF NOT EXISTS orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text,
  plan text DEFAULT 'free',
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Organization members
CREATE TABLE IF NOT EXISTS org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- Assets being monitored
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('domain','ip','email','keyword','github_org','social','certificate')),
  value text NOT NULL,
  label text,
  tags text[] DEFAULT '{}',
  status text DEFAULT 'active' CHECK (status IN ('active','inactive','compromised','expiring')),
  last_scan_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Alerts/findings
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  module text NOT NULL CHECK (module IN ('dark_web','brand','data_leak','surface_web','credential','cert_monitor')),
  severity text NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  title text NOT NULL,
  description text,
  source_url text,
  raw_data jsonb DEFAULT '{}',
  risk_score integer DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  status text DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','false_positive')),
  assignee_id uuid,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Scan jobs
CREATE TABLE IF NOT EXISTS scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  module text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  started_at timestamptz,
  completed_at timestamptz,
  findings_count integer DEFAULT 0,
  error text,
  metadata jsonb DEFAULT '{}'
);

-- Threat intelligence cache
CREATE TABLE IF NOT EXISTS threat_intel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ioc_type text CHECK (ioc_type IN ('ip','domain','hash','url','email')),
  ioc_value text NOT NULL,
  source text,
  threat_type text,
  confidence integer DEFAULT 0,
  raw_data jsonb DEFAULT '{}',
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Notification settings
CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE UNIQUE,
  email_enabled boolean DEFAULT true,
  email_recipients text[] DEFAULT '{}',
  webhook_enabled boolean DEFAULT false,
  webhook_url text,
  telegram_enabled boolean DEFAULT false,
  telegram_chat_id text,
  min_severity text DEFAULT 'medium',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_assets_org ON assets(org_id);
CREATE INDEX idx_assets_type ON assets(org_id, type);
CREATE INDEX idx_alerts_org ON alerts(org_id);
CREATE INDEX idx_alerts_severity ON alerts(org_id, severity);
CREATE INDEX idx_alerts_module ON alerts(org_id, module);
CREATE INDEX idx_alerts_status ON alerts(org_id, status);
CREATE INDEX idx_alerts_created ON alerts(org_id, created_at DESC);
CREATE INDEX idx_scan_jobs_org ON scan_jobs(org_id);
CREATE INDEX idx_threat_intel_ioc ON threat_intel(ioc_type, ioc_value);
CREATE INDEX idx_audit_log_org ON audit_log(org_id, created_at DESC);

-- Enable RLS
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "org_member_access" ON orgs
  USING (id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "org_member_access" ON assets
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "org_member_access" ON alerts
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "org_member_access" ON scan_jobs
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "org_member_access" ON notification_settings
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "org_member_access" ON audit_log
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "org_member_access" ON org_members
  USING (user_id = auth.uid());

-- Enable Realtime on alerts table
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
