-- Phase 1 Step 4 — customer_assets table per Build Spec Part 11.
--
-- Source of truth for the customer asset bundle JSON. The aegis_assets
-- table stays as the denormalized search index (one row per atomic
-- domain/handle/keyword), populated on save by /api/admin/customer-assets.

create table if not exists customer_assets (
  tenant_id          uuid primary key references tenants(id) on delete cascade,
  asset_bundle       jsonb not null,
  version            text not null default '2026-04-30',
  updated_at         timestamptz default now(),
  updated_by         text,
  -- Surfacing flags for the UI: count of TBD_ placeholders that need
  -- customer input before scans go live.
  tbd_count          int default 0
);
create index if not exists idx_customer_assets_updated on customer_assets(updated_at desc);

-- Realtime publication
do $$
begin alter publication supabase_realtime add table customer_assets;
exception when duplicate_object then null; end $$;

-- RLS
alter table customer_assets enable row level security;
do $$ begin
  create policy customer_assets_tenant_read on customer_assets
    for select using (is_admin() or tenant_id = auth_tenant_id());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy customer_assets_admin_write on customer_assets
    for all using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;

-- Seed CA Grameen with the canonical bundle from Build Spec Part 1.3.
-- Re-runnable: ON CONFLICT DO UPDATE preserves the latest customer edits
-- across migration replays unless the version explicitly changes.
insert into customer_assets (tenant_id, asset_bundle, version, updated_by, tbd_count)
values (
  '23610954-5fd0-482f-8eb0-11edce1f5c58'::uuid,
  $bundle$
{
  "customer_id": "creditaccessgrameen",
  "industry": "nbfc_mfi",
  "country": "IN",

  "primary_entity": {
    "entity_id": "ca_grameen",
    "kind": "corporate_entity",
    "legal_name": "CreditAccess Grameen Limited",
    "cin": "L51216KA1991PLC053425",
    "regulator": "RBI",
    "country": "IN",
    "status": "active"
  },

  "brand": {
    "primary_name": "CreditAccess Grameen",
    "aliases": ["CA Grameen", "CreditAccess Grameen Limited", "CAGL", "CA-Grameen"],
    "historical_names": ["Grameen Koota", "Grameen Financial Services", "Madura Micro Finance", "MMFL"],
    "product_brands": [
      "Grameen MAHI", "Pragathi Digital Loan", "Multi-Purpose Digital Loan",
      "Grameen Suraksha", "Grameen Unnati", "Grameen Vikas", "Gruha Vikas",
      "Grameen Two-Wheeler", "Grameen Swarna"
    ],
    "misspellings": ["Credit Access Grameen", "CrediteAccess Grameen", "Grammeen Koota", "Gramin Koota"],
    "transliterations": [
      "ಕ್ರೆಡಿಟ್ಆಕ್ಸೆಸ್ ಗ್ರಾಮೀಣ", "क्रेडिटएक्सेस ग्रामीण",
      "கிரெடிட் ஆக்சஸ் கிராமீன்", "క్రెడిట్ యాక్సెస్ గ్రామీణ్",
      "क्रेडिटअॅक्सेस ग्रामीण", "ক্রেডিট অ্যাক্সেস গ্রামীণ"
    ]
  },

  "domains": {
    "primary": "creditaccessgrameen.in",
    "owned": ["creditaccessgrameen.in", "grameenkoota.in"],
    "watch_keywords": [
      "creditaccess", "creditaccessgrameen", "cagrameen", "ca-grameen",
      "grameen-koota", "grameenkoota", "grameen", "mahi", "pragathi",
      "madura", "mmfl", "maduramicro"
    ]
  },

  "executives": [
    {"entity_id": "exec_ganesh",   "name": "Ganesh Narayanan",     "title": "MD & CEO"},
    {"entity_id": "exec_udaya",    "name": "Udaya Kumar Hebbar",   "title": "Director (former MD & CEO)"},
    {"entity_id": "exec_gururaj",  "name": "Gururaj Rao",          "title": "COO"},
    {"entity_id": "exec_nilesh",   "name": "Nilesh Dalvi",         "title": "CFO"},
    {"entity_id": "exec_manoj",    "name": "Manoj Kumar",          "title": "Director"},
    {"entity_id": "exec_rekha",    "name": "Rekha Warriar",        "title": "Director"}
  ],

  "social_handles": {
    "linkedin":  "cagl",
    "instagram": "creditaccessgrameen",
    "facebook":  "creditaccessgrameen",
    "twitter":   "TBD_VERIFY_AT_ONBOARDING",
    "youtube":   "TBD_VERIFY_AT_ONBOARDING"
  },

  "mobile_apps": {
    "official_app_ids": {
      "play":     ["com.creditaccessgrameen.mahi"],
      "appstore": ["TBD_VERIFY_AT_ONBOARDING_OR_NONE"]
    },
    "google_play_publisher":         "CreditAccess Grameen Limited",
    "apple_developer_id":            "TBD_VERIFY_AT_ONBOARDING",
    "official_apk_signing_cert_sha256": "TBD_FROM_CUSTOMER_DEVOPS"
  },

  "branches": {
    "official_branch_list_csv_url": "TBD_FROM_CUSTOMER",
    "expected_branch_count": 2222,
    "states_covered": [
      "Karnataka", "Maharashtra", "Tamil Nadu", "Madhya Pradesh", "Bihar",
      "Odisha", "Kerala", "West Bengal", "Uttar Pradesh", "Chhattisgarh",
      "Jharkhand", "Goa", "Gujarat", "Rajasthan", "Andhra Pradesh", "Telangana"
    ]
  },

  "leak_patterns": {
    "email_patterns":     ["*@creditaccessgrameen.in", "*@grameenkoota.in", "*@creditaccess.com"],
    "internal_hostnames": ["TBD_FROM_CUSTOMER_SECURITY"],
    "secret_prefixes":    ["TBD_FROM_CUSTOMER_SECURITY"],
    "borrower_id_format": "TBD_FROM_CUSTOMER"
  },

  "regions":   ["IN"],
  "languages": ["en", "hi", "kn", "ta", "te", "mr", "bn", "or", "gu", "ml", "pa"],

  "fraud_lexicons": {
    "loan_scam_en":  ["instant loan", "no documents loan", "quick approval", "Grameen loan online", "instant Grameen", "CA Grameen apply"],
    "loan_scam_hi":  ["तुरंत लोन", "इंस्टेंट लोन", "ग्रामीण लोन", "बिना दस्तावेज़ लोन"],
    "loan_scam_kn":  ["ತಕ್ಷಣ ಸಾಲ", "ಗ್ರಾಮೀಣ ಸಾಲ", "ಆನ್‌ಲೈನ್ ಸಾಲ"],
    "recovery_scam": ["recovery agent", "recovery officer", "loan recovery", "वसूली अधिकारी", "ವಸೂಲಿ ಅಧಿಕಾರಿ"],
    "job_scam":      ["CreditAccess job", "Grameen recruitment", "CA Grameen vacancy", "Grameen Koota careers", "loan officer recruitment"]
  },

  "scan_schedule": {
    "tier_1_brand_serp": "every_12h",
    "social": "every_6h",
    "mobile_app_stores": "daily",
    "phishing_lookalikes": "daily",
    "darkweb": "daily",
    "executive": "every_6h",
    "regional_language_social": "daily"
  }
}
$bundle$::jsonb,
  '2026-04-30',
  'system_seed_phase1_step4',
  6
)
on conflict (tenant_id) do update
  set asset_bundle = excluded.asset_bundle,
      version = excluded.version,
      updated_by = excluded.updated_by,
      tbd_count = excluded.tbd_count,
      updated_at = now()
  -- Don't clobber customer edits when the seed migration is replayed
  where customer_assets.updated_by like 'system_seed%';
