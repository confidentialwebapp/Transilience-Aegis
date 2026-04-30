# n8n Apify Ingestion Workflows

Six webhook-triggered workflows that receive Apify `ACTOR.RUN.SUCCEEDED` events,
fetch the resulting dataset, normalize each item to a `findings` row, and
upsert into Supabase. Provisioned by `apify/provision.sh` to register Apify-side
webhooks pointing at n8n.

## Webhook URLs

Base: `https://transilience--aegis-n8n-server.modal.run`

| Feature | Webhook path | Workflow file |
|---|---|---|
| FEAT-001 — Google Play rogue apps | `/webhook/feat-001` | `feat_001_google_play_rogue.json` |
| FEAT-007 — SERP Tier1 brand mentions | `/webhook/feat-007-tier1` | `feat_007_serp_tier1.json` |
| FEAT-019 — Domain WHOIS / DNS / SSL | `/webhook/feat-019` | `feat_019_whois.json` |
| FEAT-022 — Owned-site defacement | `/webhook/feat-022` | `feat_022_defacement.json` |
| FEAT-024 — Recruitment scam (Naukri/LinkedIn/Indeed) | `/webhook/feat-024` | `feat_024_recruitment.json` |
| FEAT-026 — Google Maps fake branches | `/webhook/feat-026` | `feat_026_fake_branches.json` |

## Expected payload shape (Apify webhook v2)

```json
{
  "userId": "...",
  "createdAt": "ISO-8601",
  "eventType": "ACTOR.RUN.SUCCEEDED",
  "eventData": {
    "actorId": "...",
    "actorRunId": "<runId>",
    "actorTaskId": "tai-aegis/creditaccessgrameen-feat-XXX-..."
  },
  "resource": {
    "id": "<runId>",
    "actId": "...",
    "defaultDatasetId": "<datasetId>",
    "status": "SUCCEEDED",
    "startedAt": "ISO-8601",
    "finishedAt": "ISO-8601"
  },
  "headers": {
    "x-tenant-id": "23610954-5fd0-482f-8eb0-11edce1f5c58",
    "x-feature-id": "FEAT-XXX",
    "x-apify-run-id": "<runId>"
  }
}
```

In webhook typeVersion 2 n8n places this body under `$json.body`.

## Common pipeline shape

```
Webhook (POST /feat-XXX)
   ↓
Fetch Dataset (GET https://api.apify.com/v2/datasets/{datasetId}/items)
   ↓
Code (per-feature classifier — emits {rows, count})
   ↓
Bulk Insert findings (Prefer: resolution=merge-duplicates,return=minimal — relies on
                      ux_findings_apify_dedup unique index on (apify_task_id, item_id))
   ↓
Mark scan_runs (PATCH apify_run_id=eq.<id>, status=completed) — continueOnFail: true
   ↓
Respond OK ({ok, run_id, feature_id, finding_count})
```

`Bulk Insert` and `Mark scan_runs` both use `continueOnFail: true` so a failed
upsert (e.g., FK violation when no `scan_runs` row exists for the run) doesn't
short-circuit the response.

## Importing into n8n

The `modal_app/n8n_orchestrator.py` server bootstrap reads
`/data/imports/*.json` on every container start and re-imports each workflow.
After writing files in this directory, push them to the Modal volume:

```bash
for f in n8n/workflows/feat_*.json; do
  python3 -c "import json,sys;d=json.load(open('$f'));json.dump([d[0]],open('/tmp/$(basename $f)','w'))" \
    && modal volume put aegis-n8n-data /tmp/$(basename $f) /imports/$(basename $f) --force
done
modal run modal_app/n8n_orchestrator.py::reset_and_reimport
modal deploy modal_app/n8n_orchestrator.py
```

## Idempotency

Apify retries failed webhook deliveries up to 11 times with exponential backoff.
The `ux_findings_apify_dedup` unique index on `(apify_task_id, item_id)` plus
`Prefer: resolution=merge-duplicates` make the upsert idempotent — re-deliveries
update existing rows rather than creating duplicates.

The `Mark scan_runs` PATCH targets `apify_run_id=eq.<id>` so it's also
idempotent (no-ops if the row was already marked completed).

## Caveats

- **FEAT-022 defacement** emits `defacement_baseline` rows on every run. True
  diff-based detection requires comparing `dom_hash` against the previous run
  for the same `item_id`. TODO comment in the Code node marks where to add the
  Supabase SELECT for the prior baseline.
- **FEAT-026 fake branches** flags every non-allowlisted Google Maps listing
  for analyst review. Cross-reference against the official branch CSV (lat/long
  within 500m radius) is a TODO once the customer provides the CSV.
- **Tenant resolution** uses `$json.body.headers['x-tenant-id']` first, falling
  back to the seeded CreditAccess Grameen tenant UUID. Multi-tenant deployments
  must ensure `provision.sh` sets the header per task.
- All workflows ship with `active: false` — set to `true` (or run
  `reset_and_reimport` which forces `active=1` in SQLite) before going live.
