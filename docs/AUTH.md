# Authentication & Authorization

Transilience Aegis uses Supabase Auth for identity, plus a small RLS layer
for tenant scoping and admin gating.

## Three principals

| Principal | Identifier | Access pattern |
|---|---|---|
| **Customer (authenticated user)** | `auth.uid()`, with `app_metadata.tenant_id` | RLS filters every read by `tenant_id = auth_tenant_id()` |
| **Admin** | row in `public.admin_users` keyed on `auth.uid()` | RLS `is_admin()` returns true → permissive ALL on every table |
| **Service role** | `SUPABASE_SERVICE_ROLE_KEY` (server-only) | Bypasses RLS by default; used by n8n + `/api/report` + admin server actions |

## JWT shape — customer users

A customer user's session JWT must carry their `tenant_id`. Set this via the
admin API at onboarding:

```ts
// Server-side, with service role:
await supabaseAdmin.auth.admin.updateUserById(userId, {
  app_metadata: { tenant_id: "<tenant-uuid>" },
});
```

The RLS helper `public.auth_tenant_id()` reads it from
`auth.jwt() -> 'app_metadata' ->> 'tenant_id'` (and falls back to a top-level
`tenant_id` claim if a custom JWT signer is used).

## Admin membership

Admins are listed in `public.admin_users`. The schema migration seeds:

```sql
insert into admin_users(user_id, email, role)
  values ((select id from auth.users where email='fde@transilienceai.com'), 'fde@transilienceai.com', 'admin')
  on conflict do nothing;
```

If the auth user doesn't yet exist when the migration runs, the seed is a
no-op; the row should be inserted from the admin console once the account is
created. The customer portal also honours `NEXT_PUBLIC_ADMIN_ALLOWLIST_EMAILS`
(comma-separated) as a fallback while the DB row is being provisioned.

## MVP shortcut — `NEXT_PUBLIC_DEMO_TENANT_ID`

The customer portal uses a single demo tenant during the 5-hour MVP. The env
var `NEXT_PUBLIC_DEMO_TENANT_ID` should be set to the seeded tenant id
(CreditAccess Grameen). The Realtime hooks (`frontend/lib/realtime.ts`) read
`localStorage.tai_tenant_id` first, then fall back to this env var. Drop both
once real customer onboarding ships in Phase B (asset submission flow + admin
DNS-TXT verification + per-user JWT tenant_id).

## Audit log

Admin mutations on `tenants`, `tenant_services`, `assets`, `asset_submissions`,
and `scan_runs` are written to `public.audit_log` by the
`audit_admin_action()` trigger. Service-role writes are intentionally skipped
(otherwise n8n's findings inserts would flood the log). RLS on `audit_log`
allows admin SELECT only — INSERTs come exclusively from the trigger running
with `security definer`.
