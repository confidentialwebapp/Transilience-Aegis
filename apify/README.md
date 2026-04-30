# Apify Tasks — Transilience Aegis v2

Self-contained Apify-side configuration for CreditAccess Grameen (and future
customers). The Tasks here mirror the rows seeded into Supabase
`apify_tasks` by `supabase/migrations/20260430_apify_v2.sql`.

## Structure

```
apify/
  README.md          ← this file
  provision.sh       ← idempotent CLI provisioning script
  tasks/
    feat-001-en.json
    feat-001-hi.json
    feat-001-kn.json
    feat-007-tier1-en.json
    feat-007-tier3-hi.json
    feat-019-whois.json
    feat-022-defacement.json
    feat-024-naukri.json
    feat-026-fake-branches.json
```

Each task JSON is a self-contained config:
- `task_id`              — Apify task slug (`tai-aegis/{customer}-feat-{NNN}-{lang}`)
- `tenant_id`            — Supabase tenant uuid
- `feature_id`           — `FEAT-XXX` per the v2 spec
- `feature_label`        — Human label
- `language`             — ISO 639-1 (en / hi / kn / ta / te / mr / bn / etc.)
- `actor_id`             — Apify actor identifier
- `schedule_cron`        — Cron expression (Apify-side, not n8n)
- `keyword_rotation`     — Optional array; provision script creates one Schedule per keyword
- `input_template`       — Actor input with `{{keyword}}` placeholder
- `webhook_url`          — n8n endpoint receiving `ACTOR.RUN.SUCCEEDED`
- `proxy_group`          — `RESIDENTIAL` / `GOOGLE_SERP` / `DATACENTER`
- `proxy_country`        — ISO 3166-1 alpha-2 (`IN`)

## Prerequisites

- `apify-cli` or `curl` + `jq` available locally
- `APIFY_TOKEN` env var with **Apify Scale tier** access
  (Basic plan exhausts credits in ~24h once the schedules are active)
- Residential proxy access enabled on the Apify account (FEAT-001/024/026)
- Google SERP proxy access enabled (FEAT-007)

## Run provisioning

```bash
export APIFY_TOKEN="apify_api_..."
./apify/provision.sh
```

The script is idempotent — re-running updates configs in place.

## Feature → actor → webhook map

| Feature | Actor | Webhook path | Schedule |
|---|---|---|---|
| FEAT-001 | `lukaskrivka/google-play-store-scraper` | `/webhook/feat-001` | `0 */6 * * *` |
| FEAT-007 (Tier 1) | `apify/google-search-scraper` | `/webhook/feat-007-tier1` | `0 * * * *` |
| FEAT-007 (Tier 3) | `apify/google-search-scraper` | `/webhook/feat-007-tier1` | `0 4 * * *` |
| FEAT-019 | `sovereigntaylor/domain-whois-scraper` | `/webhook/feat-019` | `0 2 * * *` |
| FEAT-022 | `apify/web-scraper` | `/webhook/feat-022` | `0 * * * *` |
| FEAT-024 | `agentx/all-jobs-scraper` | `/webhook/feat-024` | `0 6 * * *` |
| FEAT-026 | `compass/crawler-google-places` | `/webhook/feat-026` | `0 6 * * 1` |

## Idempotency contract

Every webhook delivers `X-Idempotency-Key: {{run.id}}`. n8n ingestion endpoints
upsert findings via Supabase Postgrest with
`Prefer: resolution=merge-duplicates`, keyed on the unique index
`ux_findings_apify_dedup (apify_task_id, item_id)`. Replays are safe.

## Cost notes

Phase 1 (8 tasks active) burns roughly **$200-280/month** on Apify Scale.
Set a Modal/Apify usage alert at $400/month.
