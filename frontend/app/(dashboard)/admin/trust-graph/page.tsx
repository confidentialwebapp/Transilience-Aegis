"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Network, ShieldCheck, AlertTriangle, Building2, Users, Globe,
  RefreshCw, Save, Plus, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";
import { PageHeader, KPICard, StatusPill, TagPill } from "@/components/platform";
import { createClient } from "@/lib/supabase/client";

const CA_GRAMEEN = "23610954-5fd0-482f-8eb0-11edce1f5c58";

interface TrustEntity {
  entity_id: string;
  kind: string;
  subkind?: string;
  display_name?: string;
  status?: string;
  treat_as?: string;
  identifiers?: {
    domains?: string[];
    brand_variants?: string[];
    asns?: number[];
    ip_ranges?: string[];
    verified_handles?: Record<string, string>;
  };
  severity_modifier?: number;
  note?: string;
  ai_disambiguation_required?: boolean;
  // Historical-entity fields
  merged_into?: string;
  renamed_to?: string;
  merger_effective_date?: string;
  rename_effective_date?: string;
  post_merger_treatment?: string;
  post_rename_treatment?: string;
  active_claim_phrases?: string[];
}

interface PrimaryEntity extends TrustEntity {
  legal_name?: string;
  cin?: string;
  regulator?: string;
  country?: string;
}

interface TrustGraphJson {
  primary_entity: PrimaryEntity;
  entities: TrustEntity[];
}

interface TrustGraphRow {
  customer_id: string;
  graph_json: TrustGraphJson;
  version: string;
  revision: string | null;
  last_reviewed_at: string | null;
  next_review_due: string | null;
  policy: { ai_fallback_enabled?: boolean; audit_all_decisions?: boolean };
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

const KIND_OPTIONS = [
  "corporate_entity", "infrastructure_entity", "partner_entity",
  "people_entity", "name_collision_entity", "generic_term_entity",
  "regulator_entity", "authorized_domain",
];

const TREAT_AS_OPTIONS = [
  "legitimate", "historical_legitimate", "infrastructure_legitimate",
  "impersonation_of_known_entity", "sibling_out_of_scope",
  "name_collision_no_match", "neutral",
];

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

function ListEditor({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {values.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-mono bg-purple-500/15 text-purple-200 border border-purple-500/30">
            {v}
            <button onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-400">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onChange([...values, draft.trim()]); setDraft("");
            }
          }}
          placeholder={placeholder ?? "type and press Enter"}
          className="flex-1 text-[10.5px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-200 font-mono"
        />
      </div>
    </div>
  );
}

function EntityCard({ entity, onChange, onDelete, expanded, onToggle }: {
  entity: TrustEntity; onChange: (e: TrustEntity) => void;
  onDelete: () => void; expanded: boolean; onToggle: () => void;
}) {
  const Icon = KIND_ICONS[entity.kind] ?? Building2;
  const update = (patch: Partial<TrustEntity>) => onChange({ ...entity, ...patch });
  const updateIds = (patch: Partial<NonNullable<TrustEntity["identifiers"]>>) =>
    update({ identifiers: { ...(entity.identifiers ?? {}), ...patch } });

  return (
    <div className="rounded-md border border-slate-700/60 bg-slate-900/30">
      <button onClick={onToggle} className="w-full p-2.5 flex items-center gap-2 text-left hover:bg-slate-800/40 transition-colors">
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
        <Icon className="w-3.5 h-3.5 text-purple-300" />
        <span className="font-mono text-[11px] text-purple-300 font-semibold">{entity.entity_id}</span>
        <span className="text-[11.5px] text-slate-300 truncate">{entity.display_name}</span>
        {entity.subkind && <TagPill label={entity.subkind} />}
        {entity.treat_as && <TagPill label={entity.treat_as} />}
        {entity.severity_modifier !== undefined && entity.severity_modifier !== 0 && (
          <span className="ml-auto text-[10.5px] text-slate-500 tabular-nums">{entity.severity_modifier > 0 ? "+" : ""}{entity.severity_modifier}</span>
        )}
      </button>
      {expanded && (
        <div className="p-3 border-t border-slate-700/60 grid grid-cols-1 md:grid-cols-2 gap-2.5 bg-slate-950/30">
          <div>
            <label className="text-[9.5px] text-slate-500 uppercase">entity_id</label>
            <input value={entity.entity_id} onChange={(e) => update({ entity_id: e.target.value })} className="w-full text-[11px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-200 font-mono" />
          </div>
          <div>
            <label className="text-[9.5px] text-slate-500 uppercase">display_name</label>
            <input value={entity.display_name ?? ""} onChange={(e) => update({ display_name: e.target.value })} className="w-full text-[11px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-200" />
          </div>
          <div>
            <label className="text-[9.5px] text-slate-500 uppercase">kind</label>
            <select value={entity.kind} onChange={(e) => update({ kind: e.target.value })} className="w-full text-[11px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-200 font-mono">
              {KIND_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9.5px] text-slate-500 uppercase">subkind</label>
            <input value={entity.subkind ?? ""} onChange={(e) => update({ subkind: e.target.value })} className="w-full text-[11px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-200 font-mono" />
          </div>
          <div>
            <label className="text-[9.5px] text-slate-500 uppercase">treat_as</label>
            <select value={entity.treat_as ?? "neutral"} onChange={(e) => update({ treat_as: e.target.value })} className="w-full text-[11px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-200 font-mono">
              {TREAT_AS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9.5px] text-slate-500 uppercase">severity_modifier</label>
            <input type="number" value={entity.severity_modifier ?? 0} onChange={(e) => update({ severity_modifier: parseInt(e.target.value, 10) || 0 })} className="w-full text-[11px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-200 tabular-nums" />
          </div>
          <div className="md:col-span-2">
            <label className="text-[9.5px] text-slate-500 uppercase">brand_variants</label>
            <ListEditor values={entity.identifiers?.brand_variants ?? []} onChange={(v) => updateIds({ brand_variants: v })} />
          </div>
          <div className="md:col-span-2">
            <label className="text-[9.5px] text-slate-500 uppercase">domains</label>
            <ListEditor values={entity.identifiers?.domains ?? []} onChange={(v) => updateIds({ domains: v })} />
          </div>
          {(entity.kind === "infrastructure_entity") && (
            <div className="md:col-span-2">
              <label className="text-[9.5px] text-slate-500 uppercase">ASNs (numeric)</label>
              <ListEditor
                values={(entity.identifiers?.asns ?? []).map(String)}
                onChange={(v) => updateIds({ asns: v.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n)) })}
              />
            </div>
          )}
          {(entity.kind === "corporate_entity" && (entity.subkind === "merged_predecessor" || entity.subkind === "renamed_predecessor")) && (
            <>
              <div>
                <label className="text-[9.5px] text-slate-500 uppercase">merger_effective_date</label>
                <input value={entity.merger_effective_date ?? ""} onChange={(e) => update({ merger_effective_date: e.target.value })} className="w-full text-[11px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-200 font-mono" placeholder="YYYY-MM-DD" />
              </div>
              <div>
                <label className="text-[9.5px] text-slate-500 uppercase">rename_effective_date</label>
                <input value={entity.rename_effective_date ?? ""} onChange={(e) => update({ rename_effective_date: e.target.value })} className="w-full text-[11px] px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-200 font-mono" placeholder="YYYY-MM-DD" />
              </div>
              <div className="md:col-span-2">
                <label className="text-[9.5px] text-slate-500 uppercase">active_claim_phrases (trigger impersonation_of_known_entity)</label>
                <ListEditor values={entity.active_claim_phrases ?? []} onChange={(v) => update({ active_claim_phrases: v })} />
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <label className="text-[9.5px] text-slate-500 uppercase">note</label>
            <textarea value={entity.note ?? ""} onChange={(e) => update({ note: e.target.value })} className="w-full text-[11px] px-1.5 py-1 rounded border border-slate-700 bg-slate-900 text-slate-300" rows={2} />
          </div>
          <div className="md:col-span-2 flex justify-end pt-1">
            <button onClick={onDelete} className="text-[10.5px] px-2 py-1 rounded text-red-300 hover:text-red-200 hover:bg-red-500/10 inline-flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> delete entity
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrustGraphPage() {
  const supabase = useMemo(() => createClient(), []);
  const [graphRow, setGraphRow] = useState<TrustGraphRow | null>(null);
  const [graph, setGraph] = useState<TrustGraphJson | null>(null);
  const [decisions, setDecisions] = useState<AttribDecision[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    void fetch(`/api/admin/trust-graph?tenant_id=${CA_GRAMEEN}`)
      .then(r => r.json())
      .then(d => {
        if (d.graph) {
          setGraphRow(d.graph as TrustGraphRow);
          setGraph(d.graph.graph_json as TrustGraphJson);
        }
        setLoading(false);
      });

    const fetchDecisions = async () => {
      const [dec, all] = await Promise.all([
        supabase.from("attribution_decisions").select("*").order("decided_at", { ascending: false }).limit(20),
        supabase.from("attribution_decisions").select("decision"),
      ]);
      setDecisions((dec.data ?? []) as AttribDecision[]);
      const map: Record<string, number> = {};
      for (const r of (all.data ?? []) as { decision: string }[]) map[r.decision] = (map[r.decision] ?? 0) + 1;
      setCounts(map);
    };
    void fetchDecisions();
    const ch = supabase.channel("admin:trust-graph")
      .on("postgres_changes", { event: "*", schema: "public", table: "attribution_decisions" }, () => void fetchDecisions())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [supabase]);

  const updateGraph = (updater: (g: TrustGraphJson) => TrustGraphJson) => {
    if (!graph) return;
    setGraph(updater({ ...graph }));
    setDirty(true);
  };
  const updateEntity = (entity_id: string, patch: TrustEntity) => {
    updateGraph((g) => ({ ...g, entities: g.entities.map(e => e.entity_id === entity_id ? patch : e) }));
  };
  const deleteEntity = (entity_id: string) => {
    if (!confirm(`Delete entity ${entity_id}?`)) return;
    updateGraph((g) => ({ ...g, entities: g.entities.filter(e => e.entity_id !== entity_id) }));
  };
  const addEntity = () => {
    const id = `new_entity_${Date.now()}`;
    updateGraph((g) => ({ ...g, entities: [...g.entities, {
      entity_id: id, kind: "corporate_entity",
      display_name: "New entity", treat_as: "neutral",
    }]}));
    setExpanded(new Set([...expanded, id]));
  };
  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const save = async () => {
    if (!graph || !graphRow) return;
    setSaving(true);
    const res = await fetch("/api/admin/trust-graph", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: CA_GRAMEEN, graph_json: graph, policy: graphRow.policy,
        revision: `manual_${new Date().toISOString().slice(0, 10)}`,
        reviewed_by: "admin",
      }),
    });
    const j = await res.json();
    setSaving(false);
    if (j.ok) {
      setGraphRow(j.graph);
      setDirty(false);
      alert(`Saved. ${j.entity_count} entities. AI cache invalidated: ${j.cache_invalidated}.`);
    } else {
      alert(`Failed: ${j.error}`);
    }
  };

  const totalDecisions = Object.values(counts).reduce((a, b) => a + b, 0);
  const aiFallbackPct = decisions.length
    ? ((decisions.filter((d) => d.used_ai_fallback).length / decisions.length) * 100).toFixed(0)
    : "0";

  const entitiesByKind = (graph?.entities ?? []).reduce<Record<string, TrustEntity[]>>((acc, e) => {
    (acc[e.kind] ??= []).push(e);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Trust Graph & Attribution"
        description="Per-customer entity ledger consulted by the Attribution Skill before every finding hits the AI false-positive filter. Edit entities below; saving busts the AI cache so the next attribution call uses fresh data."
        actions={
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const res = await fetch("/api/skills/attribution", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ tenant_id: CA_GRAMEEN, max_findings: 200 }),
                });
                const j = await res.json();
                alert(j.ok
                  ? `Attributed ${j.processed} findings\n\nDecision counts: ${JSON.stringify(j.counts, null, 2)}\n\nAI fallback used: ${j.ai_fallback_used}, cache hits: ${j.cache_hits}`
                  : `Failed: ${j.error}`);
              }}
              className="px-3 py-1.5 text-[12px] rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/40 inline-flex items-center gap-1.5 font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Re-attribute
            </button>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className={`px-3 py-1.5 text-[12px] rounded inline-flex items-center gap-1.5 font-semibold border ${dirty ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-500/40" : "bg-slate-800 text-slate-500 border-slate-700"}`}
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? "Saving…" : dirty ? "Save changes" : "No changes"}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Trust Graph version" value={graphRow?.version ?? "—"} accent="purple" icon={Network} />
        <KPICard label="Entities tracked" value={graph?.entities.length ?? 0} accent="blue" />
        <KPICard label="Decisions logged" value={totalDecisions} accent="amber" />
        <KPICard label="AI fallback rate" value={`${aiFallbackPct}%`} accent={Number(aiFallbackPct) > 15 ? "red" : "green"} />
      </div>

      {graph && (
        <div className="mb-4 p-3 rounded-lg border border-slate-700/60 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-slate-200">{graph.primary_entity.legal_name}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Customer: <span className="font-mono">{graphRow?.customer_id}</span>
                {" • "}rev: {graphRow?.revision}
                {graphRow?.next_review_due && <> • next review {graphRow.next_review_due}</>}
              </p>
            </div>
            <StatusPill status="ACTIVE" />
          </div>
        </div>
      )}

      {/* Entities — editable, grouped by kind */}
      <div className="flex items-center justify-between mb-2 mt-6">
        <h3 className="text-[12px] uppercase tracking-wider text-slate-400 font-semibold">Entities ({graph?.entities.length ?? 0})</h3>
        <button onClick={addEntity} className="text-[11px] px-2 py-1 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/30 inline-flex items-center gap-1 font-semibold">
          <Plus className="w-3 h-3" /> add entity
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {KIND_OPTIONS.map((kind) => {
          const ents = entitiesByKind[kind] ?? [];
          if (ents.length === 0) return null;
          const Icon = KIND_ICONS[kind] ?? Building2;
          return (
            <div key={kind}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-3.5 h-3.5 text-purple-300" />
                <h4 className="text-[10.5px] uppercase tracking-wider text-slate-500 font-semibold">
                  {kind.replace(/_/g, " ")} ({ents.length})
                </h4>
              </div>
              <div className="space-y-1.5">
                {ents.map((e) => (
                  <EntityCard
                    key={e.entity_id} entity={e}
                    onChange={(updated) => updateEntity(e.entity_id, updated)}
                    onDelete={() => deleteEntity(e.entity_id)}
                    expanded={expanded.has(e.entity_id)}
                    onToggle={() => toggleExpand(e.entity_id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live decisions feed */}
      <h3 className="text-[12px] uppercase tracking-wider text-slate-400 font-semibold mb-2 mt-6">Recent attribution decisions</h3>
      {loading ? (
        <p className="text-[11px] text-slate-500">Loading…</p>
      ) : decisions.length === 0 ? (
        <p className="text-[11px] text-slate-500">No decisions yet.</p>
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
                {d.matched_entity_id && <span className="text-[11px] font-mono text-purple-300/80">→ {d.matched_entity_id}</span>}
                {d.used_ai_fallback && <TagPill label="AI fallback" />}
                <span className="ml-auto text-[10px] text-slate-500 tabular-nums">
                  {d.match_strength ? `${Math.round(d.match_strength * 100)}%` : ""}
                </span>
              </div>
              <p className="text-[11.5px] text-slate-400 leading-snug">{d.reason}</p>
              {d.resolver_path && d.resolver_path.length > 0 && (
                <p className="text-[10px] text-slate-600 mt-1 font-mono">path: {d.resolver_path.join(" → ")}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
