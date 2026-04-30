// Phase 1 Step 2b — public cost-guard probe used by admin UI to render
// today/month/cap/burn-rate without triggering anything.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkCostGuard, estimateRunCost } from "@/lib/cost-guard";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { tenant_id, feature_id } = (await req.json()) as {
      tenant_id?: string; feature_id?: string;
    };
    if (!tenant_id) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const guard = await checkCostGuard(sb, tenant_id, feature_id ? estimateRunCost(feature_id) : 0.10);
    return NextResponse.json({ ok: true, guard });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenant_id");
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const guard = await checkCostGuard(sb, tenantId, 0);
  return NextResponse.json({ ok: true, guard });
}
