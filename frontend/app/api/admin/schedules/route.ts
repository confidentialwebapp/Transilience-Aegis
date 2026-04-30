// Phase 1 Step 2b — scan_schedules CRUD for the admin UI.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenant_id");
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb.from("scan_schedules").select("*").eq("tenant_id", tenantId).order("feature_id");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, schedules: data });
}

export async function PATCH(req: NextRequest) {
  try {
    const { tenant_id, feature_id, enabled, cadence } = (await req.json()) as {
      tenant_id?: string; feature_id?: string;
      enabled?: boolean; cadence?: string;
    };
    if (!tenant_id || !feature_id) {
      return NextResponse.json({ ok: false, error: "tenant_id + feature_id required" }, { status: 400 });
    }

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof enabled === "boolean") update.enabled = enabled;
    if (cadence) update.cadence = cadence;

    const { data, error } = await sb.from("scan_schedules")
      .update(update)
      .eq("tenant_id", tenant_id).eq("feature_id", feature_id)
      .select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, schedule: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
