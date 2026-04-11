-- TAI-AEGIS Phase 1: Threat Intelligence Platform Expansion
-- New tables for: Vendors (SVigil), CVE Intel, Infrastructure Monitoring, IOC Watchlist

-- ============================================================
-- Update alerts module enum to support new modules
-- ============================================================
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_module_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_module_check
  CHECK (module IN (
    'dark_web','brand','data_leak','surface_web','credential','cert_monitor',
    'vendor_scan','vendor_breach','cve_intel','subdomain','ssl_monitor',
    'dns_monitor','fake_domain','fake_social','rogue_app','infrastructure'
  ));

-- ============================================================
-- VENDORS (SVigil - Supply Chain & Vendor Risk Monitoring)
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text,
  contact_name text,
  contact_email text,
  vendor_type text DEFAULT 'saas' CHECK (vendor_type IN ('saas','cloud','open_source','data_processor','infrastructure','other')),
  risk_tier text DEFAULT 'medium' CHECK (risk_tier IN ('critical','high','medium','low')),
  risk_score integer DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  tags text[] DEFAULT '{}',
  status text DEFAULT 'active' CHECK (status IN ('active','inactive','under_review','offboarded')),
  metadata jsonb DEFAULT '{}',
  last_scan_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendor_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  scan_type text NOT NULL CHECK (scan_type IN ('vulnerability','breach','certificate','headers','full')),
  status text DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  results jsonb DEFAULT '{}',
  risk_score integer DEFAULT 0,
  findings_count integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendor_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  risk_score integer NOT NULL,
  breakdown jsonb DEFAULT '{}',
  recorded_at timestamptz DEFAULT now()
);

-- ============================================================
-- CVE INTELLIGENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS cve_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cve_id text UNIQUE NOT NULL,
  description text,
  severity text CHECK (severity IN ('critical','high','medium','low','none')),
  cvss_score numeric(3,1) DEFAULT 0,
  cvss_vector text,
  epss_score numeric(6,5) DEFAULT 0,
  epss_percentile numeric(6,5) DEFAULT 0,
  cisa_kev boolean DEFAULT false,
  kev_due_date date,
  affected_products jsonb DEFAULT '[]',
  ref_urls jsonb DEFAULT '[]',
  weaknesses jsonb DEFAULT '[]',
  published_at timestamptz,
  modified_at timestamptz,
  fetched_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cve_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  keyword_type text DEFAULT 'product' CHECK (keyword_type IN ('product','vendor','cpe','cwe')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, keyword, keyword_type)
);

CREATE TABLE IF NOT EXISTS cve_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  cve_id text NOT NULL,
  matched_keyword text,
  status text DEFAULT 'new' CHECK (status IN ('new','reviewing','mitigated','accepted','false_positive')),
  notes text,
  assignee_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- INFRASTRUCTURE MONITORING
-- ============================================================
CREATE TABLE IF NOT EXISTS subdomains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES assets(id) ON DELETE CASCADE,
  subdomain text NOT NULL,
  ip_address text,
  source text CHECK (source IN ('crt_sh','wayback','dns_brute','manual')),
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  is_new boolean DEFAULT true,
  status text DEFAULT 'active' CHECK (status IN ('active','inactive','suspicious')),
  metadata jsonb DEFAULT '{}',
  UNIQUE(org_id, subdomain)
);

CREATE TABLE IF NOT EXISTS ssl_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  domain text NOT NULL,
  issuer text,
  subject text,
  sans text[] DEFAULT '{}',
  valid_from timestamptz,
  valid_until timestamptz,
  serial_number text,
  fingerprint text,
  key_algorithm text,
  key_size integer,
  signature_algorithm text,
  grade text,
  has_weak_cipher boolean DEFAULT false,
  is_wildcard boolean DEFAULT false,
  raw_data jsonb DEFAULT '{}',
  last_checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dns_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  domain text NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('A','AAAA','MX','NS','TXT','CNAME','SOA','SRV','CAA')),
  record_value text NOT NULL,
  ttl integer,
  previous_value text,
  changed_at timestamptz,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- IOC WATCHLIST (Enhanced IOC Lookup)
-- ============================================================
CREATE TABLE IF NOT EXISTS ioc_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  ioc_type text NOT NULL CHECK (ioc_type IN ('ip','domain','hash','url','email')),
  ioc_value text NOT NULL,
  label text,
  tags text[] DEFAULT '{}',
  last_checked_at timestamptz,
  last_result jsonb DEFAULT '{}',
  alert_on_change boolean DEFAULT true,
  status text DEFAULT 'monitoring' CHECK (status IN ('monitoring','resolved','false_positive')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, ioc_type, ioc_value)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_vendors_org ON vendors(org_id);
CREATE INDEX idx_vendors_risk ON vendors(org_id, risk_tier);
CREATE INDEX idx_vendor_scans_vendor ON vendor_scans(vendor_id);
CREATE INDEX idx_vendor_scans_org ON vendor_scans(org_id);
CREATE INDEX idx_vendor_score_history ON vendor_score_history(vendor_id, recorded_at DESC);
CREATE INDEX idx_cve_entries_cve ON cve_entries(cve_id);
CREATE INDEX idx_cve_entries_severity ON cve_entries(severity);
CREATE INDEX idx_cve_entries_kev ON cve_entries(cisa_kev) WHERE cisa_kev = true;
CREATE INDEX idx_cve_entries_published ON cve_entries(published_at DESC);
CREATE INDEX idx_cve_entries_epss ON cve_entries(epss_score DESC);
CREATE INDEX idx_cve_watchlist_org ON cve_watchlist(org_id);
CREATE INDEX idx_cve_alerts_org ON cve_alerts(org_id);
CREATE INDEX idx_cve_alerts_status ON cve_alerts(org_id, status);
CREATE INDEX idx_subdomains_org ON subdomains(org_id);
CREATE INDEX idx_subdomains_asset ON subdomains(asset_id);
CREATE INDEX idx_subdomains_new ON subdomains(org_id, is_new) WHERE is_new = true;
CREATE INDEX idx_ssl_certs_org ON ssl_certificates(org_id);
CREATE INDEX idx_ssl_certs_expiry ON ssl_certificates(valid_until);
CREATE INDEX idx_dns_records_org ON dns_records(org_id);
CREATE INDEX idx_dns_records_domain ON dns_records(org_id, domain);
CREATE INDEX idx_ioc_watchlist_org ON ioc_watchlist(org_id);
CREATE INDEX idx_ioc_watchlist_type ON ioc_watchlist(org_id, ioc_type);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cve_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE cve_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subdomains ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssl_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dns_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ioc_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_access" ON vendors
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY "org_member_access" ON vendor_scans
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY "org_member_access" ON vendor_score_history
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY "org_member_access" ON cve_watchlist
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY "org_member_access" ON cve_alerts
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY "org_member_access" ON subdomains
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY "org_member_access" ON ssl_certificates
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY "org_member_access" ON dns_records
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY "org_member_access" ON ioc_watchlist
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE cve_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE vendor_scans;
ALTER PUBLICATION supabase_realtime ADD TABLE subdomains;
