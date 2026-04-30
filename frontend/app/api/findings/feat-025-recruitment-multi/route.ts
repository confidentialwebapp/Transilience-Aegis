// FEAT-025 — Multi-board recruitment scam detection.
// Same dataset shape as FEAT-024 (agentx/all-jobs-scraper covers Naukri,
// LinkedIn, Indeed, Glassdoor, Bayt) but separate task to handle the
// multi-board fan-out. Defers to the FEAT-024 classifier logic with
// expanded source labels.

import { NextRequest, NextResponse } from "next/server";
const APP_URL = "https://tai-aegis.vercel.app";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Pure proxy — FEAT-025 is identical to FEAT-024 in detection logic.
  // We chain to the same classifier route and rewrite feature_id in the
  // body so findings get categorized correctly.
  const body = (await req.json()) as Record<string, unknown>;
  const r = await fetch(`${APP_URL}/api/findings/feat-024-classify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, feature_id_override: "FEAT-025" }),
  });
  const j = await r.json();
  return NextResponse.json({ ...j, _proxy_to: "FEAT-024", feature_id: "FEAT-025" });
}
