// Shared helpers for FEAT-007 / 019 / 020 / 022 / 023 classifier routes —
// pull customer brand keywords + owned domains, fetch Apify dataset,
// dedupe-insert findings.

import type { SupabaseClient } from "@supabase/supabase-js";

export const APIFY_API = "https://api.apify.com/v2";

export interface CustomerCtx {
  brand_keywords: string[];   // lowercase
  owned_domains: string[];    // lowercase, no schema
  product_brands: string[];
  watch_keywords: string[];
}

export async function loadCustomerCtx(sb: SupabaseClient, tenantId: string): Promise<CustomerCtx> {
  const { data } = await sb.from("customer_assets").select("asset_bundle").eq("tenant_id", tenantId).maybeSingle();
  const bundle = (data?.asset_bundle ?? {}) as Record<string, unknown>;
  const brand = (bundle.brand ?? {}) as { primary_name?: string; aliases?: string[]; product_brands?: string[]; misspellings?: string[] };
  const domains = (bundle.domains ?? {}) as { owned?: string[]; watch_keywords?: string[] };
  return {
    brand_keywords: [brand.primary_name, ...(brand.aliases ?? []), ...(brand.misspellings ?? [])]
      .filter((s): s is string => !!s).map((s) => s.toLowerCase()),
    product_brands: (brand.product_brands ?? []).map((s) => s.toLowerCase()),
    owned_domains: (domains.owned ?? []).map((d) => d.toLowerCase()),
    watch_keywords: (domains.watch_keywords ?? []).map((s) => s.toLowerCase()),
  };
}

export async function fetchApifyDataset(datasetId: string, apifyToken: string, limit = 1000): Promise<unknown[]> {
  const r = await fetch(`${APIFY_API}/datasets/${datasetId}/items?token=${apifyToken}&limit=${limit}`);
  if (!r.ok) throw new Error(`dataset fetch ${r.status}`);
  return (await r.json()) as unknown[];
}

export interface DedupeInsertResult { inserted: number; deduped: number }

export async function insertFindingsDedupe(
  sb: SupabaseClient,
  taskId: string,
  rows: Record<string, unknown>[],
): Promise<DedupeInsertResult> {
  if (rows.length === 0) return { inserted: 0, deduped: 0 };
  const itemIds = rows.map((r) => r.item_id).filter(Boolean) as string[];
  const { data: existing } = await sb.from("findings").select("item_id")
    .eq("apify_task_id", taskId).in("item_id", itemIds);
  const existingIds = new Set((existing ?? []).map((r) => r.item_id));
  const toInsert = rows.filter((r) => !existingIds.has(r.item_id as string));
  const deduped = rows.length - toInsert.length;
  if (toInsert.length === 0) return { inserted: 0, deduped };
  const { error } = await sb.from("findings").insert(toInsert);
  if (error) throw new Error(`findings insert: ${error.message}`);
  return { inserted: toInsert.length, deduped };
}

export function isOwnedDomain(host: string, owned: string[]): boolean {
  const h = host.toLowerCase();
  return owned.some((d) => h === d || h.endsWith("." + d));
}

export function brandMatches(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw));
}
