// Phase 1 Step 21 — Takedown drafts CRUD: list, approve, reject.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenant_id");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  let q = sb.from("takedown_drafts").select("*, findings(severity, source, url_or_value, ai_summary)")
    .order("created_at", { ascending: false }).limit(100);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, drafts: data });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; action?: "approve" | "reject"; decided_by?: string };
    if (!body.id || !body.action) return NextResponse.json({ ok: false, error: "id + action required" }, { status: 400 });

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await sb.from("takedown_drafts").update({
      status: body.action === "approve" ? "approved" : "rejected",
      decided_by: body.decided_by ?? "admin",
      decided_at: new Date().toISOString(),
    }).eq("id", body.id).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, draft: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
