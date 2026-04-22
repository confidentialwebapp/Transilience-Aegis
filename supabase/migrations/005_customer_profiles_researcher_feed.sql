-- TAI-AEGIS Phase 4: Customer-facing watchlist + researcher feed.
--
-- Adds:
--   * `ransomware` and `researcher_feed` to the alerts module enum
--   * ransomware_groups (was being written by code but the table never existed)
--   * ransomware_victims (persisted so we can match against customer profiles)
--   * customer_profiles (per-org watchlist criteria for ransomware/feed matching)
--   * researcher_channels (curated, hardcoded set of public Telegram/RSS sources)
--   * researcher_posts (ingested messages from RSSHub bridges, with extracted IOCs)

-- ------------------------------------------------------------------
-- Allow the new alert modules.
-- ------------------------------------------------------------------
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_module_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_module_check
  CHECK (module IN (
    'dark_web','brand','data_leak','surface_web','credential','cert_monitor',
    'vendor_scan','vendor_breach','cve_intel','subdomain','ssl_monitor',
    'dns_monitor','fake_domain','fake_social','rogue_app','infrastructure',
    'ransomware','researcher_feed'
  ));

-- ------------------------------------------------------------------
-- Ransomware groups — was already being upserted by sync_ransomware_to_db()
-- but the table was missing, so writes were silently failing.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ransomware_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  altname text,
  url text,
  description text,
  country text,
  status text DEFAULT 'inactive' CHECK (status IN ('active','dormant','inactive')),
  victim_count integer DEFAULT 0,
  recent_victims integer DEFAULT 0,
  last_seen timestamptz,
  source text DEFAULT 'ransomware.live',
  metadata jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ransomware_groups_status ON ransomware_groups(status);
CREATE INDEX IF NOT EXISTS idx_ransomware_groups_last_seen ON ransomware_groups(last_seen DESC);

-- ------------------------------------------------------------------
-- Ransomware victims — persisted for offline matching against profiles.
-- Unique on (group_name, victim_name, discovered) to dedupe across syncs.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ransomware_victims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  victim_name text NOT NULL,
  website text,
  group_name text NOT NULL,
  country text,
  activity text,                       -- aka sector
  description text,
  discovered timestamptz,
  post_url text,
  screenshot text,
  external_id text,
  source text DEFAULT 'ransomware.live',
  raw jsonb DEFAULT '{}',
  ingested_at timestamptz DEFAULT now(),
  UNIQUE (group_name, victim_name, discovered)
);

CREATE INDEX IF NOT EXISTS idx_rv_discovered ON ransomware_victims(discovered DESC);
CREATE INDEX IF NOT EXISTS idx_rv_group ON ransomware_victims(group_name);
CREATE INDEX IF NOT EXISTS idx_rv_country ON ransomware_victims(country);
CREATE INDEX IF NOT EXISTS idx_rv_activity ON ransomware_victims(activity);
-- Trigram-like substring search on victim_name for matcher
CREATE INDEX IF NOT EXISTS idx_rv_victim_lower ON ransomware_victims(lower(victim_name));

-- ------------------------------------------------------------------
-- Customer profiles — per-org watchlist criteria. The matcher iterates
-- new ransomware victims (and other intel) against every profile.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  display_name text,
  -- Match criteria (any list non-empty acts as a filter; empty = "no filter on this dim")
  sectors text[] DEFAULT '{}',         -- e.g. {'healthcare','finance','energy'}
  countries text[] DEFAULT '{}',       -- ISO codes uppercase, e.g. {'US','GB','IN'}
  domains text[] DEFAULT '{}',         -- exact + wildcard, e.g. {'acme.com','*.acme.io'}
  brand_keywords text[] DEFAULT '{}',  -- substring match on victim_name/description
  -- Notification channels
  notify_in_app boolean DEFAULT true,
  notify_email text,
  notify_telegram_chat_id bigint,      -- bot must be in this chat
  -- Bookkeeping
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (org_id, display_name)
);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_org ON customer_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_enabled ON customer_profiles(enabled) WHERE enabled = true;

-- ------------------------------------------------------------------
-- Researcher channels — curated public Telegram/RSS sources.
-- Hardcoded list seeded below; admins can disable or add via UI.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS researcher_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL UNIQUE,         -- e.g. 'vxunderground' (no @ prefix)
  name text NOT NULL,
  source_kind text NOT NULL DEFAULT 'tme_preview'
    CHECK (source_kind IN ('rsshub_telegram','tme_preview','rss','atom')),
  feed_url text NOT NULL,              -- full URL to the feed
  category text,                       -- 'malware','ransomware','geopolitics','vulns','generic'
  enabled boolean DEFAULT true,
  last_polled_at timestamptz,
  last_post_at timestamptz,
  last_error text,
  added_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_researcher_channels_enabled ON researcher_channels(enabled);

-- ------------------------------------------------------------------
-- Researcher posts — ingested messages from those channels.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS researcher_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,                       -- handle (denormalized for quick lookup)
  external_id text,                            -- RSS guid / message id
  title text,
  text text,
  link text,
  published_at timestamptz,
  extracted_iocs jsonb DEFAULT '{}',
  ingested_at timestamptz DEFAULT now(),
  UNIQUE (channel, external_id)
);

CREATE INDEX IF NOT EXISTS idx_researcher_posts_published ON researcher_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_researcher_posts_channel ON researcher_posts(channel, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_researcher_posts_iocs ON researcher_posts USING gin (extracted_iocs);
CREATE INDEX IF NOT EXISTS idx_researcher_posts_text_search
  ON researcher_posts USING gin (to_tsvector('english', coalesce(text, '')));

-- ------------------------------------------------------------------
-- Seed the curated channel list. Conservative pick: only public Telegram
-- channels with confirmed `t.me/s/<handle>` previews (verified before seeding).
-- The ingester scrapes those preview pages directly — no third-party RSS bridge.
-- ------------------------------------------------------------------
INSERT INTO researcher_channels (handle, name, source_kind, feed_url, category) VALUES
  ('vxunderground',          'vx-underground',         'tme_preview', 'https://t.me/s/vxunderground',          'malware'),
  ('thehackernews',          'The Hacker News',        'tme_preview', 'https://t.me/s/thehackernews',          'generic'),
  ('CyberSecurityNews',      'Cyber Security News',    'tme_preview', 'https://t.me/s/CyberSecurityNews',      'generic'),
  ('CISACyber',              'CISA Cyber',             'tme_preview', 'https://t.me/s/CISACyber',              'advisories'),
  ('darkfeed',               'DarkFeed',               'tme_preview', 'https://t.me/s/darkfeed',               'ransomware'),
  ('Cyber_Security_Channel', 'Cyber Security Channel', 'tme_preview', 'https://t.me/s/Cyber_Security_Channel', 'generic'),
  ('cybersec_news',          'Cybersec News',          'tme_preview', 'https://t.me/s/cybersec_news',          'generic'),
  ('hackgit',                'HackGit',                'tme_preview', 'https://t.me/s/hackgit',                'tools')
ON CONFLICT (handle) DO NOTHING;
