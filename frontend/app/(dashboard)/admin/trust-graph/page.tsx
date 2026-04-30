"use client";

import { useEffect, useMemo, useState } from "react";
import { Network, ShieldCheck, AlertTriangle, Building2, Users, Globe, RefreshCw } from "lucide-react";
import { PageHeader, KPICard, StatusPill, TagPill } from "@/components/platform";
import { createClient } from "@/lib/supabase/client";

interface TrustGraphRow {
  customer_id: string;
  graph_json: {
    primary_entity: { legal_name?: string; identifiers?: { domains?: string[]; brand_variants?: string[] } };
    entities: TrustEntity[];
  };
  version: string;
  revision: string | null;
  last_reviewed_at: string | null;
  next_review_due: string | null;
}

interface TrustEntity {
  entity_id: string;
  kind: string;
  subkind?: string;
  display_name?: string;
  status?: string;
  treat_as?: string;
  identifiers?: { domains?: string[]; brand_variants?: string[]; verified_handles?: Record<string, string> };
  severity_modifier?: number;
  note?: string;
}

interface AttribDecision {
  id: string;
  finding_id: string;
  decision: string;
  matched_entity_id: string | null;
  resolver_path: string[] | null;
  used_ai_fallback: boolean;
  match_strength: number | null;
  reason: string | null;
  decided_at: string;
}

const KIND_ICONS: Record<string, typeof Building2> = {
  corporate_entity: Building2,
  infrastructure_entity: Globe,
  partner_entity: Network,
  people_entity: Users,
  name_collision_entity: AlertTriangle,
  generic_term_entity: AlertTriangle,
  regulator_entity: ShieldCheck,
  authorized_domain: Globe,
};

const DECISION_COLOR: Record<string, string> = {
  legitimate: "#86efac",
  historical_legitimate: "#fde047",
  infrastructure_legitimate: "#7dd3fc",
  impersonation_of_known_entity: "#fca5a5",
  sibling_out_of_scope: "#d8b4fe",
  name_collision_no_match: "#a3e635",
  needs_attribution_check: "#fdba74",
  no_match: "#94a3b8",
};

export default function TrustGraphPage() {
  const supabase = useMemo(() => createClient(), []);
  const [graph, setGraph] = useState<TrustGraphRow | null>(null);
  const [decisions, setDecisions] = useState<AttribDecision[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const fetchAll = async () => {
      const [tg, dec] = await Promise.all([
        supabase.from("trust_graph").select("*").maybeSingle(),
        supabase.from("attribution_decisions").select("*").order("decided_at", { ascending: false }).limit(50),
      ]);
      if (!alive) return;
      setGraph((tg.data as TrustGraphRow | null) ?? null);
      setDecisions((dec.data ?? []) as AttribDecision[]);

      // Count decision distribution across all attributions for this tenant
      const { data: allDec } = await supabase.from("attribution_decisions").select("decision");
      const map: Record<string, number> = {};
      for (const r of (allDec ?? []) as { decision: string }[]) {
        map[r.decision] = (map[r.decision] ?? 0) + 1;
      }
      setCounts(map);
      setLoading(false);
    };
    void fetchAll();
    const ch = supabase.channel("admin:attrib")
      .on("postgres_changes", { event: "*", schema: "public", table: "attribution_decisions" }, () => void fetchAll())
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(ch); };
  }, [supabase]);

  const totalDecisions = Object.values(counts).reduce((a, b) => a + b, 0);
  const aiFallbackPct = totalDecisions
    ? ((decisions.filter((d) => d.used_ai_fallback).length / Math.max(decisions.length, 1)) * 100).toFixed(0)
    : "0";

  const entitiesByKind = (graph?.graph_json.entities ?? []).reduce<Record<string, TrustEntity[]>>((acc, e) => {
    (acc[e.kind] ??= []).push(e);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Trust Graph & Attribution"
        description="Per-customer entity ledger consulted by the Attribution Skill before every finding hits the AI false-positive filter. 8 resolvers cascade — domain → corporate → infra → partner → people → generic → regulator → AI."
        actions={
          graph && (
            <button
              onClick={async () => {
                const res = await fetch("/api/skills/attribution", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ tenant_id: "23610954-5fd0-482f-8eb0-11edce1f5c58", max_findings: 200 }),
                });
                const j = await res.json();
                alert(j.ok
                  ? `Attributed ${j.processed} findings\n\nDecision counts: ${JSON.stringify(j.counts, null, 2)}\n\nAI fallback used: ${j.ai_fallback_used}, cache hits: ${j.cache_hits}`
                  : `Failed: ${j.error}`);
              }}
              className="px-3 py-1.5 text-[12px] rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/40 inline-flex items-center gap-1.5 font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Re-attribute Pending
            </button>
          )
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Trust Graph version" value={graph?.version ?? "—"} accent="purple" icon={Network} />
        <KPICard label="Entities tracked" value={graph?.graph_json.entities.length ?? 0} accent="blue" />
        <KPICard label="Decisions logged" value={totalDecisions} accent="amber" />
        <KPICard label="AI fallback rate" value={`${aiFallbackPct}%`} accent={Number(aiFallbackPct) > 15 ? "red" : "green"} />
      </div>

      {graph && (
        <div className="mb-4 p-3 rounded-lg border border-slate-700/60 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-slate-200">{graph.graph_json.primary_entity.legal_name}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Customer: <span className="font-mono">{graph.customer_id}</span>
                {" • "}rev: {graph.revision}
                {graph.next_review_due && <> • next review {graph.next_review_due}</>}
              </p>
            </div>
            <StatusPill status="ACTIVE" />
          </div>
        </div>
      )}

      {/* Entities grid */}
      <h3 className="text-[12px] uppercase tracking-wider text-slate-400 font-semibold mb-2 mt-6">Entities by kind</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {Object.entries(entitiesByKind).map(([kind, ents]) => {
          const Icon = KIND_ICONS[kind] ?? Building2;
          return (
            <div key={kind} className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-purple-300" />
                <h4 className="text-[12px] font-semibold text-slate-200">{kind.replace(/_/g, " ")}</h4>
                <span className="ml-auto text-[10px] text-slate-500">{ents.length}</span>
              </div>
              <div className="space-y-1.5">
                {ents.map((e) => (
                  <div key={e.entity_id} className="text-[11px] text-slate-300 flex items-center gap-2">
                    <span className="font-mono text-purple-300/80">{e.entity_id}</span>
                    <span className="truncate">{e.display_name}</span>
                    {e.subkind && <TagPill label={e.subkind} />}
                    {e.severity_modifier !== undefined && e.severity_modifier !== 0 && (
                      <span className="ml-auto text-[10px] text-slate-500 tabular-nums">
                        {e.severity_modifier > 0 ? "+" : ""}{e.severity_modifier}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent decisions */}
      <h3 className="text-[12px] uppercase tracking-wider text-slate-400 font-semibold mb-2 mt-6">Recent attribution decisions</h3>
      {loading ? (
        <p className="text-[11px] text-slate-500">Loading…</p>
      ) : decisions.length === 0 ? (
        <p className="text-[11px] text-slate-500">No attribution decisions yet. Click "Re-attribute Pending" above to run the skill on existing findings.</p>
      ) : (
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 divide-y divide-slate-800/60">
          {decisions.map((d) => (
            <div key={d.id} className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: `${DECISION_COLOR[d.decision] ?? "#94a3b8"}20`,
                           color: DECISION_COLOR[d.decision] ?? "#94a3b8",
                           border: `1px solid ${DECISION_COLOR[d.decision] ?? "#94a3b8"}40` }}>
                  {d.decision}
                </span>
                {d.matched_entity_id && (
                  <span className="text-[11px] font-mono text-purple-300/80">→ {d.matched_entity_id}</span>
                )}
                {d.used_ai_fallback && <TagPill label="AI fallback" />}
                <span className="ml-auto text-[10px] text-slate-500 tabular-nums">
                  {d.match_strength ? `${Math.round(d.match_strength * 100)}%` : ""}
                </span>
              </div>
              <p className="text-[11.5px] text-slate-400 leading-snug">{d.reason}</p>
              {d.resolver_path && d.resolver_path.length > 0 && (
                <p className="text-[10px] text-slate-600 mt-1 font-mono">
                  path: {d.resolver_path.join(" → ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
