// Phase 1 Step 4 — customer asset bundle CRUD + denormalize-on-save.

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface AssetBundle {
  customer_id: string;
  industry: string;
  country: string;
  primary_entity?: { legal_name?: string; cin?: string; regulator?: string; country?: string; status?: string };
  brand?: {
    primary_name?: string; aliases?: string[]; historical_names?: string[];
    product_brands?: string[]; misspellings?: string[]; transliterations?: string[];
  };
  domains?: { primary?: string; owned?: string[]; watch_keywords?: string[] };
  executives?: { entity_id: string; name: string; title: string }[];
  social_handles?: Record<string, string>;
  mobile_apps?: {
    official_app_ids?: { play?: string[]; appstore?: string[] };
    google_play_publisher?: string;
    apple_developer_id?: string;
    official_apk_signing_cert_sha256?: string;
  };
  branches?: { official_branch_list_csv_url?: string; expected_branch_count?: number; states_covered?: string[] };
  leak_patterns?: {
    email_patterns?: string[]; internal_hostnames?: string[]; secret_prefixes?: string[]; borrower_id_format?: string;
  };
  regions?: string[];
  languages?: string[];
  fraud_lexicons?: Record<string, string[]>;
  scan_schedule?: Record<string, string>;
}

function countTbd(obj: unknown): number {
  let count = 0;
  const walk = (v: unknown): void => {
    if (typeof v === "string" && v.startsWith("TBD_")) count += 1;
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(obj);
  return count;
}

async function denormalizeIntoAssets(sb: SupabaseClient, tenantId: string, b: AssetBundle): Promise<{ inserted: number; deleted: number }> {
  // Wipe customer-discovered rows; AI-enricher rows stay.
  const { count: deleted } = await sb.from("aegis_assets")
    .delete({ count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("discovered_by", "customer");

  const rows: { tenant_id: string; type: string; value: string; metadata: object; discovered_by: string; active: boolean }[] = [];
  const push = (type: string, value: string | undefined | null, meta: object = {}) => {
    if (!value || value.startsWith("TBD_")) return;
    rows.push({ tenant_id: tenantId, type, value, metadata: meta, discovered_by: "customer", active: true });
  };

  // Domains
  for (const d of b.domains?.owned ?? []) push("domain", d, { kind: "owned" });
  for (const k of b.domains?.watch_keywords ?? []) push("keyword", k, { kind: "watch" });

  // Brand variants (primary + aliases + historical + products + misspellings)
  if (b.brand?.primary_name) push("brand_name", b.brand.primary_name, { kind: "primary" });
  for (const a of b.brand?.aliases ?? []) push("brand_name", a, { kind: "alias" });
  for (const h of b.brand?.historical_names ?? []) push("brand_name", h, { kind: "historical" });
  for (const p of b.brand?.product_brands ?? []) push("brand_name", p, { kind: "product" });
  for (const m of b.brand?.misspellings ?? []) push("keyword", m, { kind: "misspelling" });
  for (const t of b.brand?.transliterations ?? []) push("brand_name", t, { kind: "transliteration" });

  // Executives → social handles for monitoring (1 per exec, name-keyed)
  for (const e of b.executives ?? []) {
    push("executive", e.name, { entity_id: e.entity_id, title: e.title });
  }

  // Social handles
  for (const [platform, handle] of Object.entries(b.social_handles ?? {})) {
    if (handle && !handle.startsWith("TBD_")) push("social_handle", `${platform}:${handle}`, { platform });
  }

  // Mobile apps
  for (const id of b.mobile_apps?.official_app_ids?.play ?? []) push("mobile_app", id, { store: "play" });
  for (const id of b.mobile_apps?.official_app_ids?.appstore ?? []) push("mobile_app", id, { store: "appstore" });

  // Email patterns (executive_email subset for /api/admin/scan/full-sweep Kali holehe)
  for (const p of b.leak_patterns?.email_patterns ?? []) {
    if (!p.includes("*")) push("executive_email", p, { kind: "leak_pattern" });
  }

  let inserted = 0;
  if (rows.length > 0) {
    const { count } = await sb.from("aegis_assets").insert(rows).select("id", { count: "exact", head: true });
    inserted = count ?? rows.length;
  }
  return { inserted, deleted: deleted ?? 0 };
}

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenant_id");
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb.from("customer_assets").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: true, bundle: null });
  return NextResponse.json({ ok: true, bundle: data });
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; asset_bundle?: AssetBundle; updated_by?: string };
    if (!body.tenant_id || !body.asset_bundle) {
      return NextResponse.json({ ok: false, error: "tenant_id + asset_bundle required" }, { status: 400 });
    }
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const tbd = countTbd(body.asset_bundle);

    const { error: upErr } = await sb.from("customer_assets").upsert({
      tenant_id: body.tenant_id,
      asset_bundle: body.asset_bundle,
      version: body.asset_bundle.customer_id ? "2026-04-30" : "draft",
      updated_at: new Date().toISOString(),
      updated_by: body.updated_by ?? "admin",
      tbd_count: tbd,
    }, { onConflict: "tenant_id" });
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    // Denormalize into aegis_assets so scrapers + skill see fresh values
    const denorm = await denormalizeIntoAssets(sb, body.tenant_id, body.asset_bundle);

    return NextResponse.json({ ok: true, tbd_count: tbd, denormalized: denorm });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
