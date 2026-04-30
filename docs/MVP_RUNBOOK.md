# Real-Time MVP Runbook

End-to-end deploy + first scan against `creditaccessgrameen.in`.

**Stable URLs (deterministic from Modal workspace `transilience`):**

| Service | URL |
|---|---|
| OSINT API | `https://transilience--aegis-osint-api-web.modal.run` |
| n8n | `https://transilience--aegis-n8n-server.modal.run` |
| Supabase | `https://pccbqjissbuogvfukscv.supabase.co` |

---

## 0. One-time prep

```bash
# Modal CLI on PATH (already done if you're reading this)
export PATH="$HOME/.local/bin:$PATH"
modal profile current     # → transilience

# Required API keys (paste into Modal Secret in step 2)
# - APIFY_TOKEN          (from apify.com console)
# - HIBP_API_KEY         (haveibeenpwned.com)
# - ANTHROPIC_API_KEY    (console.anthropic.com)
```

## 1. Deploy Modal apps

Already deployed via this session:

```bash
modal deploy modal_app/main.py            # aegis-scanners (Kali toolchain)
modal deploy modal_app/osint_api.py       # aegis-osint-api (HTTP wrapper)
modal deploy modal_app/n8n_orchestrator.py  # aegis-n8n (24/7 orchestrator)
```

Smoke tests:

```bash
curl https://transilience--aegis-osint-api-web.modal.run/health
# {"ok":true,"service":"aegis-osint-api"}

curl "https://transilience--aegis-osint-api-web.modal.run/sherlock?username=elonmusk" | jq '.hits | length'
```

## 2. Modal Secret — fill in real keys

The `aegis-n8n-env` Modal Secret was created with placeholder values for
APIFY/HIBP/ANTHROPIC keys. Overwrite with real values:

```bash
modal secret create --force aegis-n8n-env \
  N8N_BASIC_AUTH_USER=admin \
  N8N_BASIC_AUTH_PASSWORD='<keep the existing one — see /tmp/n8n_creds.txt>' \
  N8N_ENCRYPTION_KEY='<keep the existing one — losing it bricks all stored credentials>' \
  APIFY_TOKEN='<paste your apify token>' \
  HIBP_API_KEY='<paste your hibp key>' \
  ANTHROPIC_API_KEY='<paste your anthropic key>' \
  SUPABASE_URL='https://pccbqjissbuogvfukscv.supabase.co' \
  SUPABASE_SERVICE_ROLE_KEY='<from Supabase dashboard → Settings → API>' \
  OSINT_API_BASE='https://transilience--aegis-osint-api-web.modal.run'
```

**Critical:** never lose `N8N_ENCRYPTION_KEY`. Back it up to 1Password.

After the secret update, redeploy n8n so the new env vars take effect:

```bash
modal deploy modal_app/n8n_orchestrator.py
```

## 3. Run Supabase migrations

In the Supabase SQL editor (https://supabase.com/dashboard/project/pccbqjissbuogvfukscv/sql/new),
paste these files in order:

1. `supabase/migrations/20260430_realtime_platform.sql` — schema, indexes, realtime publications, seed `CreditAccess Grameen` tenant + `fde@transilienceai.com` admin row
2. `supabase/migrations/20260430_rls_policies.sql` — RLS on every table (when Track F lands)
3. `supabase/migrations/20260430_audit_triggers.sql` — auto-log every admin mutation

After step 1, capture the seeded tenant id:

```sql
select id from tenants where primary_domain = 'creditaccessgrameen.in';
```

Save that UUID — you'll need it as `NEXT_PUBLIC_DEMO_TENANT_ID` for the customer
portal until real auth-based tenant assignment ships.

## 4. Import n8n workflows

1. Open `https://transilience--aegis-n8n-server.modal.run` and log in (basic auth: `admin` / the password from step 2).
2. Workflows → "Add workflow" → "..." menu → "Import from File"
3. Import `n8n/workflows/brand_monitoring.json` and `n8n/workflows/dlr_monitoring.json`.
4. Open each → click **Activate** (top-right toggle).

Webhooks become live at:
- `POST https://transilience--aegis-n8n-server.modal.run/webhook/run-brand-sweep`
- `POST https://transilience--aegis-n8n-server.modal.run/webhook/run-dlr-sweep`

Test with curl (replace TENANT_UUID with the value from step 3):

```bash
curl -X POST 'https://transilience--aegis-n8n-server.modal.run/webhook/run-brand-sweep' \
  -H 'content-type: application/json' \
  -d '{
    "run_id": "00000000-0000-0000-0000-000000000001",
    "tenant_id": "TENANT_UUID",
    "brand": "CreditAccess Grameen",
    "owned_domains": ["creditaccessgrameen.in"],
    "whitelisted_handles": ["@creditaccessgrameen"],
    "executive_emails": []
  }'
```

Watch the run live at `/executions` on the n8n UI.

## 5. Vercel env vars

In Vercel project settings (`tai-aegis`) → Environment Variables, add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pccbqjissbuogvfukscv.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from Supabase dashboard) |
| `SUPABASE_SERVICE_ROLE_KEY` | (server-only, from Supabase dashboard) |
| `NEXT_PUBLIC_N8N_WEBHOOK_BASE` | `https://transilience--aegis-n8n-server.modal.run` |
| `NEXT_PUBLIC_DEMO_TENANT_ID` | (UUID from step 3) |
| `NEXT_PUBLIC_ADMIN_ALLOWLIST_EMAILS` | `fde@transilienceai.com` |

Trigger a deploy (push to `main` or click Redeploy).

## 6. End-to-end demo flow

1. Open `https://tai-aegis.vercel.app/admin/scan`
2. Confirm you're logged in as `fde@transilienceai.com`
3. Pick `CreditAccess Grameen` tenant; service `Brand Monitoring`; click **Run Now**
4. You're redirected to `/admin/runs/<id>` — scan_run row shows `running`
5. Switch to a second tab: `/threat-management/incidents` — initially empty
6. Within 60-90 seconds, findings appear live (Realtime push from Supabase)
7. Click **Generate PDF** → opens `/api/report/<runId>` → downloads CEO-ready PDF

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `n8n` URL 502 / hanging | Container is restarting — wait 90s. If persistent, `modal app logs aegis-n8n` to see startup errors. |
| Webhook returns "not registered" | The workflow isn't activated. Open it in n8n UI and toggle Active. |
| Apify branch returns `402 Payment Required` | Basic plan exhausted — check apify.com console; switch to lighter actor. |
| HIBP returns `401 Unauthorized` | Token wrong or User-Agent header missing. |
| Anthropic returns 400 | Model id outdated; check that `claude-haiku-4-5-20251001` is current, otherwise update workflow node. |
| Findings don't appear on `/threat-management/incidents` | RLS may be blocking; verify `NEXT_PUBLIC_DEMO_TENANT_ID` matches the seeded tenant; check browser console for Realtime subscription errors. |
| PDF generation 500s | Check `pdfkit` is in `frontend/package.json` and Vercel rebuilt with deps. |

## 8. Cost monitoring

| Service | Watch | Where |
|---|---|---|
| Modal n8n always-on | ~$10-15/mo | modal.com/usage |
| Modal Kali per-scan | ~$0.05-0.30/scan | modal.com/usage |
| Apify | ~$0.30/scan, basic plan ~$49 credit | apify.com/account/billing |
| Anthropic Haiku | ~$0.001/scan | console.anthropic.com/usage |
| HIBP | flat, depends on tier | (existing subscription) |

Set Modal usage alert at $30/mo.
Set per-tenant scan cap of 4/day in admin CMS to prevent runaway loops.
