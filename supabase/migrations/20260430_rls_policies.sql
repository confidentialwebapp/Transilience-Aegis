-- Row-Level Security policies for the real-time DRP platform.
-- Applied AFTER 20260430_realtime_platform.sql.
--
-- Two principals matter:
--   * Customer (authenticated): scoped by tenant_id derived from JWT claims.
--   * Admin: identified by a row in admin_users; gets ALL on every table.
--   * Service role: bypasses RLS by default in Supabase — used by n8n + server
--     routes that ingest findings, scan_runs, dlr_records, and audit entries.
--
-- Realtime publication membership was set in the schema migration. RLS on
-- those tables also gates Realtime broadcasts, so customer subscriptions only
-- see their own tenant's rows.

-- ── Helpers ──────────────────────────────────────────────────────────────
-- Pull tenant_id out of the JWT. Supabase exposes the JWT through auth.jwt().
-- We support two shapes:
--   1. New shape: app_metadata.tenant_id (set via admin API on user metadata)
--   2. Direct claim: tenant_id at the top of jwt.claims (custom JWT)
create or replace function public.auth_tenant_id() returns uuid
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    nullif((auth.jwt() -> 'app_metadata' ->> 'tenant_id'), '')::uuid,
    nullif((auth.jwt() ->> 'tenant_id'), '')::uuid
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;

-- ── Enable RLS on every table ────────────────────────────────────────────
alter table public.tenants            enable row level security;
alter table public.tenant_services    enable row level security;
alter table public.aegis_assets             enable row level security;
alter table public.asset_submissions  enable row level security;
alter table public.scan_runs          enable row level security;
alter table public.findings           enable row level security;
alter table public.dlr_records        enable row level security;
alter table public.apify_runs         enable row level security;
alter table public.aegis_audit_log          enable row level security;
alter table public.admin_users        enable row level security;

-- ── tenants ──────────────────────────────────────────────────────────────
drop policy if exists tenant_select_self on public.tenants;
create policy tenant_select_self on public.tenants
  for select using (id = public.auth_tenant_id());

drop policy if exists admin_all_tenants on public.tenants;
create policy admin_all_tenants on public.tenants
  for all using (public.is_admin()) with check (public.is_admin());

-- ── tenant_services ──────────────────────────────────────────────────────
drop policy if exists tenant_select_services on public.tenant_services;
create policy tenant_select_services on public.tenant_services
  for select using (tenant_id = public.auth_tenant_id());

drop policy if exists admin_all_tenant_services on public.tenant_services;
create policy admin_all_tenant_services on public.tenant_services
  for all using (public.is_admin()) with check (public.is_admin());

-- ── aegis_assets ───────────────────────────────────────────────────────────────
drop policy if exists tenant_select_assets on public.aegis_assets;
create policy tenant_select_assets on public.aegis_assets
  for select using (tenant_id = public.auth_tenant_id());

drop policy if exists admin_all_assets on public.aegis_assets;
create policy admin_all_assets on public.aegis_assets
  for all using (public.is_admin()) with check (public.is_admin());

-- ── asset_submissions ────────────────────────────────────────────────────
drop policy if exists tenant_select_submissions on public.asset_submissions;
create policy tenant_select_submissions on public.asset_submissions
  for select using (tenant_id = public.auth_tenant_id());

drop policy if exists tenant_insert_submissions on public.asset_submissions;
create policy tenant_insert_submissions on public.asset_submissions
  for insert with check (
    tenant_id = public.auth_tenant_id()
    and submitted_by = auth.uid()
  );

drop policy if exists admin_all_submissions on public.asset_submissions;
create policy admin_all_submissions on public.asset_submissions
  for all using (public.is_admin()) with check (public.is_admin());

-- ── scan_runs ────────────────────────────────────────────────────────────
drop policy if exists tenant_select_scan_runs on public.scan_runs;
create policy tenant_select_scan_runs on public.scan_runs
  for select using (tenant_id = public.auth_tenant_id());

drop policy if exists admin_all_scan_runs on public.scan_runs;
create policy admin_all_scan_runs on public.scan_runs
  for all using (public.is_admin()) with check (public.is_admin());

-- ── findings ─────────────────────────────────────────────────────────────
drop policy if exists tenant_select_findings on public.findings;
create policy tenant_select_findings on public.findings
  for select using (tenant_id = public.auth_tenant_id());

drop policy if exists admin_all_findings on public.findings;
create policy admin_all_findings on public.findings
  for all using (public.is_admin()) with check (public.is_admin());

-- ── dlr_records ──────────────────────────────────────────────────────────
drop policy if exists tenant_select_dlr_records on public.dlr_records;
create policy tenant_select_dlr_records on public.dlr_records
  for select using (tenant_id = public.auth_tenant_id());

drop policy if exists admin_all_dlr_records on public.dlr_records;
create policy admin_all_dlr_records on public.dlr_records
  for all using (public.is_admin()) with check (public.is_admin());

-- ── apify_runs ───────────────────────────────────────────────────────────
drop policy if exists tenant_select_apify_runs on public.apify_runs;
create policy tenant_select_apify_runs on public.apify_runs
  for select using (tenant_id = public.auth_tenant_id());

drop policy if exists admin_all_apify_runs on public.apify_runs;
create policy admin_all_apify_runs on public.apify_runs
  for all using (public.is_admin()) with check (public.is_admin());

-- ── aegis_audit_log (admin SELECT only; INSERTs come from service role) ───────
drop policy if exists admin_select_audit on public.aegis_audit_log;
create policy admin_select_audit on public.aegis_audit_log
  for select using (public.is_admin());

-- ── admin_users (admins manage themselves) ───────────────────────────────
drop policy if exists admin_select_admin_users on public.admin_users;
create policy admin_select_admin_users on public.admin_users
  for select using (public.is_admin() or user_id = auth.uid());

drop policy if exists admin_modify_admin_users on public.admin_users;
create policy admin_modify_admin_users on public.admin_users
  for all using (public.is_admin()) with check (public.is_admin());

-- Grants — keep PostgREST able to call helpers from policies
grant execute on function public.auth_tenant_id() to authenticated, anon, service_role;
grant execute on function public.is_admin()       to authenticated, anon, service_role;
