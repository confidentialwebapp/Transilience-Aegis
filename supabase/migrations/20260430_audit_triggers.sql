-- Audit triggers — capture admin mutations to audit_log.
-- Service-role calls (where auth.uid() is null) are intentionally skipped:
--   we don't want to log n8n's billion findings inserts as "admin actions".
-- Applied AFTER 20260430_realtime_platform.sql and 20260430_rls_policies.sql.

create or replace function public.audit_admin_action() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_actor uuid := auth.uid();
  v_target text;
  v_payload jsonb;
begin
  -- Skip if no authenticated user (service role or anon)
  if v_actor is null then
    return coalesce(new, old);
  end if;

  -- Build target identifier
  if tg_op = 'DELETE' then
    v_target := tg_table_name || ':' || coalesce(old.id::text, '?');
    v_payload := to_jsonb(old);
  else
    v_target := tg_table_name || ':' || coalesce(new.id::text, '?');
    v_payload := to_jsonb(new);
  end if;

  insert into public.audit_log(actor_id, action, target, payload, at)
  values (v_actor, tg_op, v_target, v_payload, now());

  return coalesce(new, old);
end;
$$;

-- Attach AFTER triggers to tables where admin writes matter
drop trigger if exists trg_audit_tenants on public.tenants;
create trigger trg_audit_tenants
  after insert or update or delete on public.tenants
  for each row execute function public.audit_admin_action();

drop trigger if exists trg_audit_tenant_services on public.tenant_services;
create trigger trg_audit_tenant_services
  after insert or update or delete on public.tenant_services
  for each row execute function public.audit_admin_action();

drop trigger if exists trg_audit_assets on public.assets;
create trigger trg_audit_assets
  after insert or update or delete on public.assets
  for each row execute function public.audit_admin_action();

drop trigger if exists trg_audit_asset_submissions on public.asset_submissions;
create trigger trg_audit_asset_submissions
  after insert or update or delete on public.asset_submissions
  for each row execute function public.audit_admin_action();

drop trigger if exists trg_audit_scan_runs on public.scan_runs;
create trigger trg_audit_scan_runs
  after insert or update or delete on public.scan_runs
  for each row execute function public.audit_admin_action();
