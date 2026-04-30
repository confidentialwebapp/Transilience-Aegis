"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Zap, Shield, Smartphone, Search as SearchIcon, Database, Globe,
  MapPin, Briefcase, Activity, AlertCircle, Building2, Layers,
} from "lucide-react";
import { PageHeader, FilterCard, FilterInput } from "@/components/platform";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Tenant {
  id: string;
  name: string;
  primary_brand: string | null;
  primary_domain: string | null;
}

interface ApifyTask {
  task_id: string;
  tenant_id: string;
  feature_id: string;
  feature_label: string | null;
  language: string | null;
  actor_id: string;
  schedule_cron: string | null;
  active: boolean;
}

interface AssetRow {
  id: string;
  type: string;
  value: string;
  active: boolean;
}

interface LastRun {
  task_id: string | null;
  status: string | null;
  started_at: string;
  finished_at: string | null;
}

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  "FEAT-001": "Detects rogue mobile apps on Google Play impersonating monitored brands. Multilingual coverage.",
  "FEAT-002": "Detects rogue iOS apps on the Apple App Store using monitored brand identifiers.",
  "FEAT-007": "Brand mention SERP monitoring — Tier 1 hourly exact-brand, Tier 3 daily multilingual.",
  "FEAT-019": "WHOIS / DNS / SSL / tech-stack lookup across all registered owned domains.",
  "FEAT-022": "DOM-hash + external-script monitoring of owned websites for defacement and supply-chain attacks.",
  "FEAT-024": "Cross-platform recruitment scam detection (Naukri, LinkedIn, Indeed, Glassdoor).",
  "FEAT-026": "Google Maps fake-branch detection across monitored states.",
};

const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "FEAT-001": Smartphone,
  "FEAT-002": Smartphone,
  "FEAT-007": SearchIcon,
  "FEAT-019": Database,
  "FEAT-022": Shield,
  "FEAT-024": Briefcase,
  "FEAT-026": MapPin,
};

const FEATURE_RELEVANT_ASSETS: Record<string, string[]> = {
  "FEAT-001": ["brand_name", "keyword"],
  "FEAT-002": ["brand_name", "keyword"],
  "FEAT-007": ["brand_name", "keyword"],
  "FEAT-019": ["domain", "subdomain", "keyword"],
  "FEAT-022": ["domain"],
  "FEAT-024": ["brand_name", "keyword"],
  "FEAT-026": ["brand_name"],
};

export default function AdminScanPage() {
  const router = useRouter();
  const params = useSearchParams();
  const queryTenantId = params.get("tenant_id");
  const queryFeatureId = params.get("feature_id");
  const supabase = useMemo(() => createClient(), []);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tasks, setTasks] = useState<ApifyTask[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [lastRuns, setLastRuns] = useState<Record<string, LastRun>>({});
  const [loading, setLoading] = useState(true);

  const [tenantId, setTenantId] = useState<string>(queryTenantId ?? "");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [keywordOverride, setKeywordOverride] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [tRes, taRes, runRes] = await Promise.all([
        supabase.from("tenants").select("id, name, primary_brand, primary_domain").order("name"),
        supabase.from("apify_tasks").select("*"),
        supabase.from("apify_runs").select("task_id, status, started_at, finished_at").order("started_at", { ascending: false }).limit(200),
      ]);
      if (!alive) return;
      const tns = (tRes.data ?? []) as Tenant[];
      const tks = (taRes.data ?? []) as ApifyTask[];
      const runs = (runRes.data ?? []) as LastRun[];
      const lastByTask: Record<string, LastRun> = {};
      for (const r of runs) {
        if (r.task_id && !lastByTask[r.task_id]) lastByTask[r.task_id] = r;
      }
      setTenants(tns);
      setTasks(tks);
      setLastRuns(lastByTask);
      if (!tenantId && tns.length > 0) setTenantId(queryTenantId ?? tns[0].id);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [supabase, tenantId, queryTenantId]);

  // Load assets for selected tenant
  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("aegis_assets")
        .select("id, type, value, active")
        .eq("tenant_id", tenantId)
        .eq("active", true);
      if (!alive) return;
      setAssets((data ?? []) as AssetRow[]);
    })();
    return () => { alive = false; };
  }, [tenantId, supabase]);

  const tasksForTenant = useMemo(
    () => tasks.filter((t) => t.tenant_id === tenantId),
    [tasks, tenantId]
  );
  const tasksByFeature = useMemo(() => {
    const map = new Map<string, ApifyTask[]>();
    for (const t of tasksForTenant) {
      if (!map.has(t.feature_id)) map.set(t.feature_id, []);
      map.get(t.feature_id)!.push(t);
    }
    return map;
  }, [tasksForTenant]);

  useEffect(() => {
    if (queryFeatureId && !selectedTaskId) {
      const cands = tasksByFeature.get(queryFeatureId);
      if (cands?.length) setSelectedTaskId(cands[0].task_id);
    }
  }, [queryFeatureId, tasksByFeature, selectedTaskId]);

  const selectedTask = tasks.find((t) => t.task_id === selectedTaskId);
  const selectedTenant = tenants.find((t) => t.id === tenantId);

  // Assets relevant to the selected feature
  const relevantAssets = useMemo(() => {
    if (!selectedTask) return [];
    const types = FEATURE_RELEVANT_ASSETS[selectedTask.feature_id] ?? [];
    return assets.filter((a) => types.includes(a.type));
  }, [assets, selectedTask]);

  const enrich = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/admin/asset-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const j = await resp.json();
      if (!resp.ok || !j.ok) throw new Error(j.error ?? `HTTP ${resp.status}`);
      // Reload assets since enrichment may have inserted new rows
      const sb = supabase;
      const { data } = await sb.from("aegis_assets").select("id, type, value, active").eq("tenant_id", tenantId).eq("active", true);
      setAssets((data ?? []) as AssetRow[]);
      setError(`✓ Enrichment added ${j.inserted_assets} new assets (run_id ${j.run_id?.slice(0, 8)}).`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const fullSweep = async () => {
    if (!selectedTask) { setError("Pick a feature first."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/admin/scan/full-sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          feature_id: selectedTask.feature_id,
          apify_task_id: selectedTask.task_id,
          brand: selectedTenant?.primary_brand,
          run_kali: true,
        }),
      });
      const j = await resp.json();
      if (!resp.ok || !j.ok) throw new Error(j.error ?? `HTTP ${resp.status}`);
      router.push(`/admin/runs/${j.scan_run_id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (!selectedTask) { setError("Pick a feature first."); return; }
    if (relevantAssets.length === 0) { setError(`No assets registered for this feature. Add some via /assets/* pages.`); return; }
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/admin/scan/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          feature_id: selectedTask.feature_id,
          apify_task_id: selectedTask.task_id,
          brand: selectedTenant?.primary_brand,
          keyword_override: keywordOverride || undefined,
        }),
      });
      const j = await resp.json();
      if (!resp.ok || !j.ok) throw new Error(j.error ?? `HTTP ${resp.status}`);
      router.push(`/admin/runs/${j.scan_run_id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="space-y-3"><div className="h-8 w-64 rounded animate-pulse" style={{ background: "rgba(139,92,246,0.10)" }} /><div className="h-64 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }} /></div>;
  }

  const featureIds = Array.from(tasksByFeature.keys()).sort();

  return (
    <>
      <PageHeader
        title="Run Scan"
        description="Trigger an OSINT scan against a tenant. Each scan reads the customer's registered assets, runs the Apify task on demand, and ingests findings into Supabase via n8n. No autonomous schedules — costs scale with your clicks."
      />

      {/* Tenant */}
      <FilterCard collapsible={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Tenant</label>
            <div className="mt-1 px-3 py-2 rounded-lg flex items-center gap-2"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}>
              <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <select
                value={tenantId}
                onChange={(e) => { setTenantId(e.target.value); setSelectedTaskId(""); }}
                className="flex-1 bg-transparent border-none outline-none text-[12px] text-slate-200 cursor-pointer"
              >
                <option value="" className="bg-[#0d0a14]">— Pick a tenant —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#0d0a14]">
                    {t.name} {t.primary_domain ? `(${t.primary_domain})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Brand</label>
            <div className="mt-1 px-3 py-2 rounded-lg text-[12.5px] text-slate-300"
              style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.10)" }}>
              {selectedTenant?.primary_brand ?? "—"}
            </div>
          </div>
        </div>
      </FilterCard>

      {/* Feature picker */}
      <h2 className="text-[12px] font-bold tracking-[0.13em] uppercase text-slate-400 mt-4 mb-2">
        Choose Feature ({featureIds.length})
      </h2>
      {featureIds.length === 0 ? (
        <div className="rounded-xl p-6 text-center"
          style={{ background: "rgba(255,255,255,0.015)", border: "1px dashed rgba(139,92,246,0.20)" }}>
          <p className="text-[12px] text-slate-500 italic">No Apify Tasks for this tenant. Run apify/provision.py.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {featureIds.map((fid) => {
            const variants = tasksByFeature.get(fid) ?? [];
            const Icon = FEATURE_ICONS[fid] ?? Zap;
            const isSelected = variants.some((v) => v.task_id === selectedTaskId);
            return (
              <div
                key={fid}
                className={cn("rounded-xl p-4 cursor-pointer transition-all", isSelected ? "ring-2 ring-purple-500" : "hover:bg-white/[0.02]")}
                style={{
                  background: isSelected ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isSelected ? "rgba(139,92,246,0.40)" : "rgba(139,92,246,0.10)"}`,
                }}
                onClick={() => setSelectedTaskId(variants[0].task_id)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.20)" }}>
                    <Icon className="w-5 h-5 text-purple-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider"
                        style={{ background: "rgba(168,85,247,0.10)", color: "#d8b4fe", border: "1px solid rgba(168,85,247,0.30)" }}>
                        {fid}
                      </span>
                      {variants.length > 1 && <span className="text-[10px] text-slate-500">{variants.length} variants</span>}
                    </div>
                    <p className="text-[13px] font-bold text-white truncate">{variants[0].feature_label ?? fid}</p>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug line-clamp-2">{FEATURE_DESCRIPTIONS[fid] ?? ""}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.04)", color: "#94a3b8" }}>
                        {variants[0].actor_id}
                      </span>
                    </div>
                    {variants.length > 1 && isSelected && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {variants.map((v) => (
                          <button
                            key={v.task_id}
                            onClick={(e) => { e.stopPropagation(); setSelectedTaskId(v.task_id); }}
                            className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                              selectedTaskId === v.task_id ? "text-white" : "text-slate-400 hover:text-white")}
                            style={{
                              background: selectedTaskId === v.task_id ? "linear-gradient(135deg,#8b5cf6,#7c3aed)" : "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(139,92,246,0.20)",
                            }}
                          >
                            {v.language ?? "—"}
                          </button>
                        ))}
                      </div>
                    )}
                    {(() => {
                      const lr = lastRuns[selectedTaskId];
                      if (!lr || !variants.some((v) => v.task_id === selectedTaskId)) return null;
                      return (
                        <div className="mt-2 flex items-center gap-2 text-[10.5px] text-slate-500">
                          <Activity className="w-3 h-3" />
                          Last: {new Date(lr.started_at).toLocaleString()} · {lr.status}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Asset preview + submit */}
      {selectedTask && (
        <div className="rounded-xl p-5 max-w-3xl"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-3.5 h-3.5 text-purple-300" />
            <h3 className="text-[12px] font-bold tracking-[0.13em] uppercase text-slate-400">
              Assets feeding this scan ({relevantAssets.length})
            </h3>
          </div>
          {relevantAssets.length === 0 ? (
            <div className="px-3 py-2 rounded-lg flex items-start gap-2 text-[11.5px] text-amber-200"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.20)" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>No assets of type <code className="text-amber-100">{(FEATURE_RELEVANT_ASSETS[selectedTask.feature_id] ?? []).join(", ")}</code> registered for this tenant. Add via the <a className="underline" href="/assets/domains">Assets pages</a>.</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {relevantAssets.map((a) => (
                <span key={a.id} className="px-2 py-1 rounded-md text-[11px] font-mono"
                  style={{ background: "rgba(139,92,246,0.06)", color: "#d8b4fe", border: "1px solid rgba(139,92,246,0.20)" }}>
                  <span className="text-purple-400/60 mr-1">{a.type}:</span>{a.value}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4">
            <FilterInput
              placeholder="Keyword Override (optional)"
              value={keywordOverride}
              onChange={setKeywordOverride}
              helper="Override the default keyword for this run only. Leave blank to use registered assets."
            />
          </div>

          {error && (
            <div className="mt-3 px-3 py-2 rounded-lg text-[11.5px] text-red-300"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.20)" }}>
              {error}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 mt-5">
            <button
              disabled={submitting || !tenantId}
              onClick={enrich}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11.5px] font-semibold text-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.30)" }}
              title="Stage 2 — AI Enricher: discover aliases, related entities, fraud lexicons"
            >
              {submitting ? "Working…" : "✨ Enrich Assets (Stage 2)"}
            </button>
            <button
              disabled={submitting || !selectedTask}
              onClick={fullSweep}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11.5px] font-semibold text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.30)" }}
              title="Stage 4 — Apify + Kali parallel sweep with sync gate"
            >
              {submitting ? "Working…" : "🔥 Run Full Sweep (Apify + Kali)"}
            </button>
            <button
              disabled={submitting || !selectedTask || relevantAssets.length === 0}
              onClick={submit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
              title="Apify-only quick scan"
            >
              <Zap className="w-3.5 h-3.5" />
              {submitting ? "Starting…" : "Run (Apify only)"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
