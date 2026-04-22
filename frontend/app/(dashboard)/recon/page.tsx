"use client";

import { useEffect, useState } from "react";
import { Loader2, Target, Globe, Server, Mail, Link2, Network, AlertCircle, RefreshCw, ChevronDown } from "lucide-react";
import { api, getOrgId, type HarvesterResult, type HarvesterRun } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ReconPage() {
  const [domain, setDomain] = useState("");
  const [sources, setSources] = useState("crtsh,duckduckgo,bing,otx,hackertarget,rapiddns,anubis,urlscan");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<HarvesterResult | null>(null);
  const [history, setHistory] = useState<HarvesterRun[]>([]);
  const [openSection, setOpenSection] = useState<string | null>("hosts");

  const loadHistory = async () => {
    try {
      const r = await api.listReconRuns(getOrgId());
      setHistory(r.data);
    } catch (e) {
      // ignore — table may not exist yet
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleRun = async () => {
    const target = domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!target.includes(".")) {
      toast.error("Enter a valid domain (e.g. example.com)");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const r = await api.runHarvester(getOrgId(), target, sources, 200);
      setResult(r);
      if (r.status === "success" || r.status === "partial") {
        toast.success(`Harvested ${r.counts.hosts} hosts, ${r.counts.emails} emails`);
      } else {
        toast.error(r.error || "harvest failed");
      }
      loadHistory();
    } catch (e: any) {
      toast.error(e?.message ?? "request failed");
    } finally {
      setRunning(false);
    }
  };

  const Section = ({
    id, label, icon: Icon, items, color,
  }: { id: string; label: string; icon: any; items: string[]; color: string }) => {
    const open = openSection === id;
    return (
      <div className="card-enterprise overflow-hidden">
        <button
          onClick={() => setOpenSection(open ? null : id)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <span className="text-sm font-semibold text-slate-200">{label}</span>
          <span className="ml-auto text-[11px] text-slate-500 font-mono">{items.length}</span>
          <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform", open && "rotate-180")} />
        </button>
        {open && items.length > 0 && (
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-80 overflow-auto">
            {items.map((v) => (
              <span key={v} className="font-mono text-[11px] text-slate-300 px-2 py-1 rounded-md bg-white/[0.02] border border-white/[0.05] truncate" title={v}>
                {v}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(34,197,94,0.15),rgba(6,182,212,0.1))", border: "1px solid rgba(34,197,94,0.2)" }}>
          <Target className="w-5 h-5 text-emerald-300" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">OSINT Recon</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">theHarvester · DNSDumpster · Netlas · ThreatMiner</p>
        </div>
      </div>

      <div className="card-enterprise p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-emerald-300" />
          <span className="text-xs text-slate-400 font-semibold">Target domain</span>
        </div>
        <div className="flex gap-2">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !running && handleRun()}
            placeholder="example.com"
            className="flex-1 h-10 px-3 rounded-lg bg-white/[0.02] border border-emerald-500/15 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40"
          />
          <button
            onClick={handleRun}
            disabled={running || !domain.trim()}
            className="h-10 px-5 rounded-lg flex items-center gap-2 text-sm font-semibold text-white btn-brand disabled:opacity-40"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            {running ? "Harvesting…" : "Run theHarvester"}
          </button>
        </div>
        <div className="mt-3">
          <label className="text-[11px] text-slate-500">Sources (comma-separated)</label>
          <input
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            className="w-full mt-1 h-9 px-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[12px] text-slate-300 font-mono focus:outline-none focus:border-emerald-500/30"
          />
        </div>
      </div>

      {running && (
        <div className="card-enterprise p-8 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-sm text-slate-300">Running theHarvester (up to 2 minutes)…</p>
          <p className="text-[11px] text-slate-600">{sources.split(",").length} sources queried in parallel</p>
        </div>
      )}

      {result && !running && (
        <div className="space-y-3">
          <div className="card-enterprise p-4 flex items-center gap-4">
            <div className={cn(
              "px-3 py-1 rounded-lg text-xs font-bold uppercase",
              result.status === "success" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" :
              result.status === "partial" ? "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30" :
              "bg-red-500/15 text-red-300 border border-red-500/30"
            )}>
              {result.status}
            </div>
            <span className="font-mono text-sm text-white">{result.domain}</span>
            <span className="text-[11px] text-slate-500">· {result.duration_seconds.toFixed(1)}s</span>
            {result.error && (
              <span className="ml-auto flex items-center gap-1 text-[11px] text-red-400">
                <AlertCircle className="w-3 h-3" /> {result.error}
              </span>
            )}
          </div>

          <Section id="hosts" label="Hosts" icon={Server} items={result.results.hosts} color="#3b82f6" />
          <Section id="emails" label="Emails" icon={Mail} items={result.results.emails} color="#ec4899" />
          <Section id="ips" label="IPs" icon={Network} items={result.results.ips} color="#f97316" />
          <Section id="asns" label="ASNs" icon={Network} items={result.results.asns} color="#a855f7" />
          <Section id="urls" label="URLs" icon={Link2} items={result.results.urls} color="#eab308" />
        </div>
      )}

      {history.length > 0 && (
        <div className="card-enterprise p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em]">Recent harvests</h3>
            <button onClick={loadHistory} className="text-[11px] text-slate-500 hover:text-white flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              refresh
            </button>
          </div>
          <div className="space-y-1.5">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02] text-sm">
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                  h.status === "success" ? "bg-emerald-500/10 text-emerald-300" :
                  h.status === "partial" ? "bg-yellow-500/10 text-yellow-300" :
                  "bg-red-500/10 text-red-300"
                )}>{h.status}</span>
                <span className="font-mono text-slate-300 flex-1">{h.domain}</span>
                <span className="text-[11px] text-slate-500">
                  {(h.hosts || []).length}h · {(h.emails || []).length}e · {(h.ips || []).length}ip
                </span>
                <span className="text-[11px] text-slate-600 font-mono">{new Date(h.started_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
