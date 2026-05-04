"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Plus, Play, X, RefreshCw, Activity } from "lucide-react";
import {
  PageHeader, FilterCard, FilterInput, FilterSelect,
  DataTable, StatusPill, EmptyState,
} from "@/components/platform";
import type { Column, StatusKind } from "@/components/platform";
import { getOrgId } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

type ScanState = {
  scan_id: string;
  brand_name: string;
  primary_domains: string[];
  status: "queued" | "running" | "done" | "failed";
  started_at: string | null;
  finished_at: string | null;
  progress: number;
  engine: string;
  findings_count: number;
  error: string | null;
};

type WssRow = {
  id: string;
  brand: string;
  url: string;
  engine: string;
  verdict: StatusKind;
  findings: number;
  status: ScanState["status"];
  started: string;
};

function verdictFor(s: ScanState): StatusKind {
  if (s.status === "failed") return "ERROR" as StatusKind;
  if (s.status !== "done") return "PENDING" as StatusKind;
  if (s.findings_count === 0) return "CLEAN" as StatusKind;
  return "POTENTIALLY SUSPICIOUS" as StatusKind;
}

export default function WssPage() {
  const [scans, setScans] = useState<ScanState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [brand, setBrand] = useState("");
  const [domain, setDomain] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [keywords, setKeywords] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeScan, setActiveScan] = useState<ScanState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/v1/brand-monitoring/scans`, {
        headers: { "X-Org-Id": getOrgId() },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setScans(j.items || []);
    } catch (e: any) {
      setError(e.message || "Failed to load scans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const addDomain = () => {
    const v = domain.trim().toLowerCase();
    if (!v || domains.includes(v)) { setDomain(""); return; }
    setDomains([...domains, v]);
    setDomain("");
  };
  const removeDomain = (d: string) => setDomains(domains.filter((x) => x !== d));

  const startScan = async () => {
    setError(null);
    if (!brand.trim() || domains.length === 0) {
      setError("Brand name and at least one primary domain are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/brand-monitoring/scans`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId() },
        body: JSON.stringify({
          brand_name: brand.trim(),
          primary_domains: domains,
          keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ScanState = await res.json();
      setActiveScan(data);
      setBrand(""); setDomains([]); setKeywords("");
      // Start polling
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => poll(data.scan_id), 2000);
      load();
    } catch (e: any) {
      setError(e.message || "Failed to start scan");
    } finally {
      setSubmitting(false);
    }
  };

  const poll = async (id: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/v1/brand-monitoring/scans/${id}`, {
        headers: { "X-Org-Id": getOrgId() },
      });
      if (!r.ok) return;
      const s: ScanState = await r.json();
      setActiveScan(s);
      if (s.status === "done" || s.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        load();
      }
    } catch {}
  };

  const rows: WssRow[] = scans.map((s) => ({
    id: s.scan_id,
    brand: s.brand_name,
    url: s.primary_domains.join(", "),
    engine: s.engine,
    verdict: verdictFor(s),
    findings: s.findings_count,
    status: s.status,
    started: s.started_at ? new Date(s.started_at).toLocaleString() : "—",
  }));

  const cols: Column<WssRow>[] = [
    {
      key: "id",
      header: "WSS ID",
      render: (r) => (
        <div>
          <p className="text-[12px] font-mono text-purple-300 font-semibold">{r.id.slice(0, 10)}…</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{r.started}</p>
        </div>
      ),
    },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-200 font-medium">{r.brand}</span> },
    { key: "url", header: "Domains", render: (r) => <span className="text-[12px] text-purple-300 font-mono">{r.url}</span> },
    {
      key: "engine",
      header: "Engine",
      render: (r) => (
        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider"
          style={{ background: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.25)" }}>
          {r.engine}
        </span>
      ),
    },
    { key: "verdict", header: "Verdict", render: (r) => <StatusPill status={r.verdict as any} /> },
    {
      key: "findings",
      header: "Findings",
      align: "right",
      render: (r) => <span className="text-[12px] font-mono font-semibold text-slate-200 tabular-nums">{r.findings}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Website Scanning Suite"
        description="Live brand-monitoring scans powered by the BrandMonitoring engine — typosquats, certificate transparency, phishing infra, code leaks, email exposure. No dummy data: every row below is a real scan against your assets."
      />

      {/* Scan launcher + active progress */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl p-5"
          style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.15)" }}>
          <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase mb-3">New Scan</p>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold tracking-[0.1em] text-slate-500 uppercase">Brand name</label>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="ACME Corp"
                className="mt-1 w-full h-9 px-3 rounded-lg text-[12.5px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-purple-500/40"
                style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(139,92,246,0.18)" }} />
            </div>
            <div>
              <label className="text-[10px] font-semibold tracking-[0.1em] text-slate-500 uppercase">Primary domains</label>
              <div className="flex gap-2 mt-1">
                <input value={domain} onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDomain(); } }}
                  placeholder="example.com"
                  className="flex-1 h-9 px-3 rounded-lg text-[12.5px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-purple-500/40"
                  style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(139,92,246,0.18)" }} />
                <button onClick={addDomain}
                  className="h-9 px-3 rounded-lg text-[12px] font-semibold text-purple-200 hover:text-white"
                  style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)" }}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {domains.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {domains.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-slate-300 font-mono"
                      style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
                      <Globe className="w-2.5 h-2.5" /> {d}
                      <button onClick={() => removeDomain(d)} className="text-slate-500 hover:text-red-400">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] font-semibold tracking-[0.1em] text-slate-500 uppercase">Keywords (comma-separated, optional)</label>
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)}
                placeholder="ACME, ACMEPay"
                className="mt-1 w-full h-9 px-3 rounded-lg text-[12.5px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-purple-500/40"
                style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(139,92,246,0.18)" }} />
            </div>
            {error && (
              <div className="px-3 py-2 rounded-lg text-[12px] text-red-300"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>{error}</div>
            )}
            <button onClick={startScan} disabled={submitting}
              className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {submitting ? "Starting…" : <><Play className="w-3.5 h-3.5" /> Run BrandMonitoring scan</>}
            </button>
          </div>
        </div>

        <div className="rounded-xl p-5"
          style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.15)" }}>
          <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase mb-3">Active Scan</p>
          {!activeScan ? (
            <div className="py-8 text-center">
              <Activity className="w-7 h-7 text-slate-700 mx-auto" />
              <p className="text-[12px] text-slate-500 mt-2">No active scan. Start one to see live progress.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">{activeScan.brand_name}</p>
                <StatusPill status={verdictFor(activeScan) as any} />
              </div>
              <p className="text-[11px] text-slate-500 font-mono">Engine: {activeScan.engine}</p>
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                  <span>Progress</span><span className="font-mono">{activeScan.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.1)" }}>
                  <div className="h-full transition-all duration-500"
                    style={{ width: `${activeScan.progress}%`, background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
                </div>
              </div>
              <p className="text-[12px] text-slate-300"><span className="font-mono font-bold">{activeScan.findings_count}</span> findings so far</p>
              {activeScan.error && (
                <div className="px-3 py-2 rounded-lg text-[11px] text-amber-300"
                  style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>{activeScan.error}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filter + history */}
      <FilterCard onSearch={load} onReset={() => load()}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput icon={Globe} placeholder="Target URL" />
          <FilterInput placeholder="WSS ID" />
          <FilterSelect label="Verdict" options={["CLEAN", "POTENTIALLY SUSPICIOUS", "ERROR", "PENDING"]} />
        </div>
      </FilterCard>

      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[11px] text-slate-500">
          {loading ? "Loading…" : `${rows.length} scan${rows.length === 1 ? "" : "s"}`}
        </p>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-[11px] text-purple-300 hover:text-purple-200">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {rows.length === 0 && !loading ? (
        <EmptyState
          title="No scans yet"
          description="Start your first BrandMonitoring scan above. Results appear here in real time as they complete."
        />
      ) : (
        <DataTable<WssRow>
          columns={cols}
          rows={rows}
          totalEntries={rows.length}
          pageSize={50}
          page={1}
        />
      )}
    </>
  );
}
