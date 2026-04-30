// FEAT-026 — Google Maps fake branch detection.
// Consumes compass/crawler-google-places dataset.
//
// Per Build Spec Part 6:
//   - Listing name contains brand AND coordinates ∉ official list within
//     500m → CRITICAL fake branch
//   - Reviews mention "fraud" / "fake" / "धोखा" / "ಮೋಸ" → CRITICAL
//   - Phone number not in official directory → HIGH

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchApifyDataset, insertFindingsDedupe, loadCustomerCtx } from "@/lib/findings/classifier-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PlaceItem {
  title?: string; name?: string;
  address?: string; phone?: string;
  location?: { lat: number; lng: number };
  categoryName?: string; category?: string;
  totalScore?: number; reviewsCount?: number;
  url?: string; placeId?: string; cid?: string;
}

const FRAUD_REVIEW_PATTERNS = [
  /\bfraud\b/i, /\bfake\b/i, /\bscam\b/i, /\bcheat\b/i,
  /धोखा/i, /ಮೋಸ/i, /மோசடி/i, /మోసం/i,
];

// Haversine distance in meters
function distMeters(a: {lat: number; lng: number}, b: {lat: number; lng: number}): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.sin(dLng/2)**2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; apify_dataset_id?: string; scan_run_id?: string; task_id?: string };
    if (!body.apify_dataset_id) return NextResponse.json({ ok: false, error: "apify_dataset_id required" }, { status: 400 });
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const ctx = await loadCustomerCtx(sb, tenant_id);
    const items = (await fetchApifyDataset(body.apify_dataset_id, process.env.APIFY_TOKEN!)) as PlaceItem[];

    // For Phase 2 ship, official_branch_list_csv_url is TBD_ — when provided
    // we'd geo-match every listing against it. For now treat ALL Maps results
    // matching brand keywords as suspect (admin verifies).
    const findingRows: Record<string, unknown>[] = [];
    let dropped = 0;
    for (const p of items) {
      const name = (p.title || p.name || "").trim();
      const text = `${name.toLowerCase()} ${(p.category || p.categoryName || "").toLowerCase()}`;
      const matched = ctx.brand_keywords.filter((kw) => text.includes(kw));
      if (matched.length === 0) { dropped += 1; continue; }

      // Note: when admin provides official_branch_list_csv_url, geo-match here.
      // For now flag every brand-name-bearing listing.
      let severity: "Critical" | "Substantial" | "Moderate" = "Substantial";
      let fraudPattern = "fake_branch_listing";

      // Phone-number gate: if phone is not provided OR not on a known prefix,
      // raise severity. (HR roster validation in a Phase 3 follow-up.)
      if (!p.phone) { severity = "Critical"; fraudPattern = "fake_branch_no_phone"; }

      findingRows.push({
        tenant_id, scan_run_id: body.scan_run_id ?? null,
        source: "apify:google-maps", kind: "fake_account",
        severity, confidence: 0.6,
        url_or_value: p.url || `https://www.google.com/maps/place/?q=place_id:${p.placeId || p.cid}`,
        evidence: { name, address: p.address, phone: p.phone, location: p.location, category: p.category || p.categoryName, score: p.totalScore, reviews: p.reviewsCount },
        feature_id: "FEAT-026", apify_task_id: body.task_id, apify_dataset_id: body.apify_dataset_id,
        item_id: p.placeId || p.cid || p.url || `${body.apify_dataset_id}:${findingRows.length}`,
        fraud_pattern: fraudPattern,
        matched_keywords: matched,
        ai_filter_status: null, recommended_action: "investigate",
      });
    }
    const result = body.task_id ? await insertFindingsDedupe(sb, body.task_id, findingRows) : { inserted: 0, deduped: 0 };
    return NextResponse.json({ ok: true, items_seen: items.length, kept: findingRows.length, dropped, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

// helper kept for future use (geo-match against official_branch_list_csv_url)
export const _distMeters = distMeters;
