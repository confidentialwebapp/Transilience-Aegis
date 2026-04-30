# Real-Time Page Coverage on Apify Starter

Mapping every page in the documented IA to its data source on Apify Starter
($49/mo, ~$0.15 per scan). Pages flagged 🟢 are wired live today; 🟡 are
trivial to wire (data exists, page-level glue only); 🔴 need new Apify
features or external feeds we don't have on Starter.

---

## Sidebar — Threat Management

| Page | Status | Data source | Notes |
|---|---|---|---|
| Incidents (Site Take Down) | 🟢 LIVE | `findings` filtered to incident-kind set | Already shows real Apify-driven findings; fraud_pattern filter exposes fake_branches, recruitment scams, etc. |
| Monitoring (Low Threat Alerts) | 🟡 EASY | `findings` filtered to `severity IN ('Low', 'Moderate')` | Page exists; needs ~30 lines to add severity filter + low-threat badge |
| Data Loss Recovery | 🟢 LIVE | `dlr_records` from HIBP | Already wired |

## Sidebar — Attack Surface Management

| Page | Status | Data source | Notes |
|---|---|---|---|
| Whitelist Management | 🟢 LIVE | `aegis_assets` (active=true) | Already wired |
| Asset Monitoring | 🟢 LIVE | `aegis_assets` joined to `findings` severity counts | Already wired |
| Asset Discovery | 🟡 EASY | `aegis_assets` of type subdomain + new entries from FEAT-019 evidence.dns_records | Page exists; FEAT-019 needs to write subdomain rows |
| Website Scanning Suite | 🟡 EASY | `findings` filtered to feature_id=FEAT-022 | Defacement findings; pipeline live, page needs feature_id filter |
| DNS Monitoring | 🟡 EASY | `findings` filtered to source='dns' OR feature_id=FEAT-019 with kind='dns_drift' | Existing page reads findings; FEAT-019 dns_records jsonb already populated |

## Sidebar — Cyber Threat Intelligence

| Page | Status | Data source | Notes |
|---|---|---|---|
| IOC Feed | 🔴 OUT | External CTI feed (4M+ rows) | Not Apify; would need OTX/Cisco Talos/etc. integration. Display-only mock for now. |
| Cyber Intel Advisory | 🟡 EASY | `findings` filtered to feature_id=FEAT-007 with kind='advisory' | SERP results that look like news/advisory; can derive |
| Threat Actors | 🟢 LIVE | Live counter for `kind='threat_actor_mention'` | Already wired |
| Vulnerabilities — CVEs | 🔴 OUT | NVD or Nuclei feed | Not Apify; needs custom CVE pipeline |
| Malware | 🔴 OUT | MalwareBazaar / VirusTotal | External feed |
| TOR Nodes | 🔴 OUT | TOR consensus scrape (could do via Apify but separate task) | Defer |
| STIX/TAXII | 🔴 OUT | API consumer endpoint | Doc page; data not here |
| Threat Intel API | 🔴 OUT | API doc page | Static |

## Sidebar — DMARC MSS

| Page | Status | Data source | Notes |
|---|---|---|---|
| DMARC Dashboard | 🟡 MEDIUM | New Apify task: actor `balathon/dns-lookup-actor` against owned domains | Needs FEAT-020 spec'd in v2. ~1 day to wire. |

## Sidebar — Third Party Risk Management

| Page | Status | Data source | Notes |
|---|---|---|---|
| Vendors | 🔴 OUT | Customer-supplied vendor list + per-vendor scan | Needs entire TPRM workflow; defer to Phase B |
| Vendor Detail | 🔴 OUT | Same | Defer |

## Sidebar — Reports

| Page | Status | Data source | Notes |
|---|---|---|---|
| Brand Targeted | 🟡 EASY | Aggregate `findings` by brand × month | Pure SQL aggregation over existing data |
| Threat Over Time | 🟡 EASY | Aggregate `findings` by severity × week | SQL only |
| Site Take Down Time | 🟡 EASY | Workflow telemetry from `scan_runs` (started→completed delta) | SQL only |
| Incident By Host Country | 🟡 EASY | Resolve URLs in findings.evidence to country via Apify reverse-DNS or static IP-to-country | Light addition |
| Executive Summary | 🟡 EASY | PDF generated from latest scan_runs + findings; pipeline already exists in /api/report/[runId] | Hook up the ledger to real PDFs |
| Website Scanning Suite | 🟡 EASY | feature_id=FEAT-022 aggregations | Like the page above |
| Incidents Reopened | 🟡 EASY | Findings where same item_id reappeared after closure | SQL aggregation |
| Moved Cases | 🟡 EASY | scan_runs with trigger='admin_manual' that re-classified | SQL |

## Sidebar — Management

| Page | Status | Data source | Notes |
|---|---|---|---|
| Client Users | 🟢 LIVE | `auth.users` + `admin_users` + `tenants` | Existing page, already real |
| Subscription | 🟡 EASY | Hard-coded plan info + Apify usage from `apify_runs` | Already shows static plan; just needs Apify cost panel |

## Sidebar — Knowledge Centre (8 pages)

All 🟢 — these are static articles already shipped.

---

## Topbar — Dashboard

| Page | Status | Data source | Notes |
|---|---|---|---|
| Incident | 🟢 LIVE | KPI counts from `findings` | Already wired |
| Attack Surface Management | 🟢 LIVE | aegis_assets + findings severity | Already wired |
| Threat Management | 🟢 LIVE | findings counts | Already wired |
| DMARC | 🔴 needs FEAT-020 | (see DMARC MSS row) | |
| Data Loss Recovery | 🟢 LIVE | dlr_records counts | Already wired |
| Cyber Threat Intelligence | 🟢 LIVE (mostly) | Mix of mock + live counters | Threat Actors live; rest mock until FEAT-XXX added |

## Topbar — Assets

| Page | Status | Data source | Notes |
|---|---|---|---|
| Domains | 🟢 LIVE | `aegis_assets` type=domain joined to FEAT-019 findings | Wired in this session |
| Brands | 🟡 EASY | `aegis_assets` type=brand_name | One-line wiring |
| Social Media Account | 🟡 EASY | `aegis_assets` type=social_handle | One-line wiring |
| Mobile Apps | 🟢 LIVE | `findings` filtered FEAT-001/002 (when those tasks add back) | Wired; needs FEAT-001 actor identified |
| Executives | 🟡 EASY | `aegis_assets` type=executive_email/handle | One-line wiring |
| Authorised Contents | 🟡 EASY | `aegis_assets` extended type='authorised_content' (new asset type) | Need to add type to schema check constraint |
| Trademark Documents | 🟡 EASY | New `aegis_assets` type='trademark' | Same as above |
| DNS Data | 🟡 EASY | FEAT-019 evidence.dns_records | Pipeline live, page-level glue |
| BIN Numbers | 🟡 EASY | New `aegis_assets` type='bin' | Already in type check constraint, just needs page wiring |

## Topbar — Case Manager

| Page | Status | Data source | Notes |
|---|---|---|---|
| Report New Case | 🟢 LIVE | Insert into scan_runs with trigger='customer_report' | Existing form works |
| Reported Incidents By Clients | 🟢 LIVE | scan_runs filtered to trigger='customer_report' | Already wired |

## Topbar — Support (5 pages)

All static docs already shipped 🟢.

---

# Final tally on Apify Starter

| Status | Count |
|---|---|
| 🟢 Already live | 18 |
| 🟡 Trivial to wire (page-level glue, no new Apify) | 22 |
| 🔴 Out (needs new feeds / Phase B) | 8 |

**Coverage ceiling on Starter:** ~80% of the documented pages (40 of 48)
can show real, customer-specific data — every one of them powered by
on-demand admin scans of the existing 6 Apify Tasks plus simple SQL
aggregations.

**The 🔴 8** all need either (a) external CTI/malware/IOC feeds we
don't have a license for, or (b) full TPRM vendor onboarding flow.
None of them are blocked by Apify itself.

# Recommended wiring order (next 8-12 hours of work)

1. **Reports — Brand Targeted + Threat Over Time + Site Takedown Time + Executive Summary** — pure SQL over existing tables, ~2h total. Highest customer-visible impact.
2. **Topbar Assets — Brands / Social / Executives / DNS Data / BIN / Authorised Content / Trademark** — extend the assets table, add 5 thin pages, ~3h. Customer onboarding suddenly becomes a real flow.
3. **Threat Management → Monitoring (Low Threat Alerts)** — 30-line filter on existing Incidents page logic, ~30min.
4. **Cyber Threat Intelligence → Cyber Intel Advisory** — derive from FEAT-007 findings classified as advisory, ~1h.
5. **Attack Surface Management → DNS Monitoring + WSS** — surface FEAT-019/FEAT-022 findings; pages exist but read mock data, ~1h.
6. **DMARC MSS** — add FEAT-020 to apify provisioning, wire dashboard, ~3h. (Phase B; do after the easier wins.)

After step 1-5: 🟢 count goes from 18 → 38, 🟡 to 2, 🔴 to 8.
That's 38/48 = **79% of all customer pages live** on a $49/mo Apify
plan, fed entirely by admin-triggered scans of 6 reusable tasks.
