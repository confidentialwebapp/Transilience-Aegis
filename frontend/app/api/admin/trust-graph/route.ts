// Phase 1 Step 5 — Trust Graph CRUD.
//
// GET  /api/admin/trust-graph?tenant_id=...  → full graph
// PUT  /api/admin/trust-graph                → update graph_json + policy

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface TrustEntity {
  entity_id: string;
  kind: string;
  subkind?: string;
  display_name?: string;
  status?: string;
  treat_as?: string;
  severity_modifier?: number;
  identifiers?: { domains?: string[]; brand_variants?: string[]; verified_handles?: Record<string, string> };
  note?: string;
}

interface TrustGraphJson {
  primary_entity: TrustEntity & { legal_name?: string; cin?: string; regulator?: string };
  entities: TrustEntity[];
}

const VALID_KINDS = new Set([
  "corporate_entity", "infrastructure_entity", "partner_entity",
  "people_entity", "name_collision_entity", "generic_term_entity",
  "regulator_entity", "authorized_domain",
]);

const VALID_TREAT_AS = new Set([
  "legitimate", "historical_legitimate", "infrastructure_legitimate",
  "impersonation_of_known_entity", "sibling_out_of_scope",
  "name_collision_no_match", "neutral",
]);

function validateGraph(graph: TrustGraphJson): string | null {
  if (!graph.primary_entity) return "primary_entity is required";
  if (!Array.isArray(graph.entities)) return "entities must be an array";
  const seen = new Set<string>();
  for (const ent of graph.entities) {
    if (!ent.entity_id) return "every entity needs an entity_id";
    if (seen.has(ent.entity_id)) return `duplicate entity_id: ${ent.entity_id}`;
    seen.add(ent.entity_id);
    if (!VALID_KINDS.has(ent.kind)) return `invalid kind on ${ent.entity_id}: ${ent.kind}`;
    if (ent.treat_as && !VALID_TREAT_AS.has(ent.treat_as)) {
      return `invalid treat_as on ${ent.entity_id}: ${ent.treat_as}`;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenant_id");
  if (!tenantId) return NextResponse.json({ ok: false, error: "tenant_id required" }, { status: 400 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb.from("trust_graph").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, graph: data });
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      tenant_id?: string;
      graph_json?: TrustGraphJson;
      policy?: Record<string, unknown>;
      revision?: string;
      reviewed_by?: string;
    };
    if (!body.tenant_id || !body.graph_json) {
      return NextResponse.json({ ok: false, error: "tenant_id + graph_json required" }, { status: 400 });
    }
    const validationError = validateGraph(body.graph_json);
    if (validationError) {
      return NextResponse.json({ ok: false, error: `validation: ${validationError}` }, { status: 400 });
    }

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Bump version to today + an inc suffix; revision tracks the human label.
    const today = new Date().toISOString().slice(0, 10);
    const update: Record<string, unknown> = {
      graph_json: body.graph_json,
      version: today,
      updated_at: new Date().toISOString(),
    };
    if (body.policy) update.policy = body.policy;
    if (body.revision) update.revision = body.revision;
    if (body.reviewed_by) {
      update.last_reviewed_by = body.reviewed_by;
      update.last_reviewed_at = new Date().toISOString();
    }

    const { data, error } = await sb.from("trust_graph")
      .update(update)
      .eq("tenant_id", body.tenant_id)
      .select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Bust the AI cache so the next attribution call uses the new graph
    await sb.from("attribution_ai_cache").delete().eq("customer_id", data.customer_id);

    return NextResponse.json({
      ok: true,
      graph: data,
      cache_invalidated: true,
      entity_count: body.graph_json.entities.length,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
