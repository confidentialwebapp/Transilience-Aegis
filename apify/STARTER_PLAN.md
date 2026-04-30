# Apify Starter Plan — On-Demand Cost Model

**Plan:** Apify Starter ($49/mo platform + $49 credit included)
**Effective compute budget:** ~$49/mo of actor runtime

## What's running autonomously

**Nothing.** All 6 Apify Schedules are disabled. Confirmed via:
```
$ apify_token=... curl /v2/schedules → all isEnabled=false
```

## How scans run

1. Admin opens `/admin/scan`, picks a tenant + a feature (e.g., FEAT-007 SERP).
2. Frontend POSTs to `/api/admin/scan/trigger` (Next.js server route).
3. The route reads the tenant's registered assets from Supabase
   (table `aegis_assets`), constructs the Apify input, and calls
   `POST https://api.apify.com/v2/actor-tasks/{id}/runs` to start the run.
4. Apify executes the actor, calling its API once.
5. On completion, the task's existing webhook fires
   `POST {n8n}/webhook/feat-{NNN}` with `eventType=ACTOR.RUN.SUCCEEDED`.
6. n8n ingests the dataset, runs the heuristic Classify Code node, sends
   the rows to Anthropic Claude Haiku for false-positive filtering, and
   bulk-upserts cleaned rows into `findings` (dedup via the unique index
   on `apify_task_id, item_id`).
7. n8n marks the `scan_runs` row `completed`. Customer dashboard updates
   live via Supabase Realtime.

After step 7 the workflow is done — nothing keeps running.

## Per-scan cost estimate

| Feature | Actor cost / run | Anthropic / run |
|---|---|---|
| FEAT-007 (SERP exact-brand) | ~$0.05 | ~$0.001 |
| FEAT-019 (WHOIS, 4 domains) | ~$0.02 | ~$0.001 |
| FEAT-022 (3 page DOM hash) | ~$0.10 | ~$0.001 |
| FEAT-024 (Naukri jobs, 100 items) | ~$0.40 | ~$0.005 |
| FEAT-026 (Maps, 50 places) | ~$0.20 | ~$0.005 |

Average ~$0.15/scan. **At Starter's $49 credit, that's ~325 scans/month.**

For typical CA Grameen demo cadence (1-3 scans per week per feature ×
6 features = 18-54 scans/week, ~70-220/month), Starter has comfortable
headroom.

## Hard guardrails

- `scan_runs` row inserted **before** Apify call — easy audit + rollback.
- `apify_runs` ledger captures every run with `cost_usd` (populated from
  Apify webhook payload at completion).
- `/admin/apify` console shows today's spend + this-month spend; stop
  triggering if `Today's Spend > $5`.
- Schedules permanently disabled via DB toggle on `apify_tasks.active`.
  Re-enabling requires DB write, not just frontend click.

## When to upgrade to Scale

Upgrade only when one of these is true:
- You want continuous monitoring (re-enable schedules → expect
  ~$200-280/mo on Scale tier with all 6 features hourly).
- You want to add custom Apify Actors (FEAT-003 APK monitor, FEAT-004
  phishing analyzer Standby) — those cost compute units while warm.
- You're onboarding > 5 customers (each with their own task set).

## What admin sees

`/admin/scan` page shows:
- Tenant + brand
- Feature picker grid (only the configured Apify Tasks for that tenant)
- Live preview of the assets that will feed this scan
- "Run Now" button → POST → redirect to `/admin/runs/{id}`

`/admin/runs/{id}` shows:
- Live status (running → completed/failed)
- Apify run id linkable to console.apify.com
- Findings as they land (Realtime)
- "Generate PDF Report" button

`/admin/apify` shows:
- Task ledger, with "Pause/Resume" toggles + Run Now per task
- Recent runs panel with cost per run
- Today's spend / this-month spend KPI cards
