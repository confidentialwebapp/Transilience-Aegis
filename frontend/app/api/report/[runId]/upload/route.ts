// POST /api/report/[runId]/upload
// Builds the same PDF as GET /api/report/[runId], uploads it to the
// "reports" Supabase Storage bucket at <tenant_id>/<run_id>.pdf,
// returns a 7-day signed URL.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createSb } from "@supabase/supabase-js";
import { buildPdfBuffer } from "../route";
import { shortId } from "@/lib/report-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "reports";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

function svc() {
  return createSb(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureBucket(sb: ReturnType<typeof svc>) {
  const { data } = await sb.storage.listBuckets();
  if (!(data ?? []).some((b) => b.name === BUCKET)) {
    await sb.storage.createBucket(BUCKET, { public: false });
  }
}

export async function POST(req: NextRequest, ctx: { params: { runId: string } }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "service-role env missing" }, { status: 500 });
  }

  // Auth: any logged-in user OR service-role header
  const svcAuth = req.headers.get("x-service-role-auth");
  const cookies = req.headers.get("cookie") ?? "";
  const hasSbCookie = /sb-[\w-]+-auth-token/.test(cookies);
  const bearer = req.headers.get("authorization");
  if (!(svcAuth === SUPABASE_SERVICE_ROLE_KEY || hasSbCookie || (bearer && bearer.toLowerCase().startsWith("bearer ")))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = svc();

  const { data: scanRun, error: e1 } = await sb
    .from("scan_runs")
    .select("id, tenant_id, brand, service, status, started_at, completed_at, finding_count, payload")
    .eq("id", ctx.params.runId)
    .maybeSingle();
  if (e1 || !scanRun) {
    return NextResponse.json({ error: "scan_run not found" }, { status: 404 });
  }

  const { data: tenant } = await sb
    .from("tenants")
    .select("id, name, primary_brand, primary_domain")
    .eq("id", scanRun.tenant_id)
    .maybeSingle();

  const { data: findings } = await sb
    .from("findings")
    .select("id, scan_run_id, source, kind, severity, confidence, url_or_value, ai_reason, recommended_action, created_at")
    .eq("scan_run_id", scanRun.id)
    .order("created_at", { ascending: false });

  const buf = await buildPdfBuffer({
    scanRun,
    tenant: tenant ?? {
      id: scanRun.tenant_id, name: scanRun.brand ?? "Unknown",
      primary_brand: scanRun.brand, primary_domain: null,
    },
    findings: findings ?? [],
  });

  await ensureBucket(sb);
  const objectPath = `${scanRun.tenant_id}/${scanRun.id}.pdf`;

  const { error: upErr } = await sb.storage.from(BUCKET).upload(objectPath, buf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) {
    return NextResponse.json({ error: `upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { data: signed, error: signErr } = await sb.storage.from(BUCKET).createSignedUrl(objectPath, SIGNED_URL_TTL);
  if (signErr || !signed) {
    return NextResponse.json({ error: `signed url failed: ${signErr?.message ?? "unknown"}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    run_id: scanRun.id,
    short_id: shortId(scanRun.id),
    bucket: BUCKET,
    path: objectPath,
    signed_url: signed.signedUrl,
    expires_in_seconds: SIGNED_URL_TTL,
    bytes: buf.length,
  });
}
