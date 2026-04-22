"use client";

import { InfinityLoader } from "@/components/InfinityLoader";

import { useState } from "react";
import { User, Search, ExternalLink, AlertTriangle } from "lucide-react";
import { api, getOrgId, type UsernameSearchResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function OsintPage() {
  const [username, setUsername] = useState("");
  const [topSites, setTopSites] = useState(100);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<UsernameSearchResult | null>(null);

  const handleRun = async () => {
    const u = username.trim().replace(/^@/, "");
    if (!u || u.length < 2) {
      toast.error("Username must be at least 2 chars");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const r = await api.scanUsername(getOrgId(), u, topSites);
      setResult(r);
      if (r?.ok === false && (r as any).error) {
        toast.error(`error: ${(r as any).error.slice(0, 120)}`);
      } else {
        toast.success(`Found ${r.count} sites with @${u}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "search failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(236,72,153,0.15),rgba(168,85,247,0.1))", border: "1px solid rgba(236,72,153,0.2)" }}>
          <User className="w-5 h-5 text-pink-300" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Username OSINT</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">maigret · search 500+ sites in parallel via Modal</p>
        </div>
      </div>

      <div className="card-enterprise p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-pink-300" />
          <span className="text-xs text-slate-400 font-semibold">Username</span>
        </div>
        <div className="flex gap-2">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="acmecorp"
            onKeyDown={(e) => e.key === "Enter" && !running && handleRun()}
            className="flex-1 h-10 px-3 rounded-lg bg-white/[0.02] border border-pink-500/15 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500/40" />
          <select value={topSites} onChange={(e) => setTopSites(Number(e.target.value))}
            className="h-10 px-3 rounded-lg bg-white/[0.02] border border-white/[0.08] text-[12px] text-slate-300">
            <option value={50}>top 50 (~30s)</option>
            <option value={100}>top 100 (~1min)</option>
            <option value={250}>top 250 (~2min)</option>
            <option value={500}>all 500 (~3-4min)</option>
          </select>
          <button onClick={handleRun} disabled={running || !username.trim()}
            className="h-10 px-5 rounded-lg flex items-center gap-2 text-sm font-semibold text-white btn-brand disabled:opacity-40">
            {running ? <InfinityLoader size={16} /> : <Search className="w-4 h-4" />}
            {running ? "Searching…" : "Search"}
          </button>
        </div>
        <p className="text-[11px] text-slate-600 mt-3">
          Useful for: executive impersonation detection, brand squatting on social platforms, employee account discovery during incident response.
        </p>
      </div>

      {running && (
        <div className="card-enterprise p-8 flex flex-col items-center gap-3">
          <InfinityLoader size={32} />
          <p className="text-sm text-slate-300">Searching {topSites} sites for "@{username}"…</p>
        </div>
      )}

      {result && !running && (
        <>
          {result.ok === false && (result as any).error && (
            <div className="card-enterprise p-4 border border-red-500/20 bg-red-500/[0.02]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-300 font-semibold">Error</p>
                  <p className="text-[12px] text-red-200/80 mt-1 font-mono">{(result as any).error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Sites checked" value={topSites} color="#94a3b8" />
            <Stat label="Found" value={result.count} color="#ec4899" />
            <Stat label="Hit rate" value={`${result.count > 0 ? Math.round((result.count / topSites) * 100) : 0}%`} color="#a855f7" />
          </div>

          <div className="card-enterprise p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">Sites with @{result.username}</h3>
            {result.found.length === 0 ? (
              <p className="text-[12px] text-slate-500">No claimed accounts found in the searched sites.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.found.map((s) => (
                  <a key={s.url || s.site} href={s.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg p-2 bg-white/[0.02] border border-white/[0.05] hover:border-pink-500/30 transition-colors group">
                    <span className="text-[12px] font-semibold text-slate-300 group-hover:text-pink-300 flex-1 truncate">{s.site}</span>
                    {s.tags && s.tags.slice(0, 2).map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/10 text-purple-300 border border-purple-500/20">{t}</span>
                    ))}
                    <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-pink-300" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="stat-card p-4">
      <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">{label}</p>
      <p className="text-[26px] font-bold font-mono leading-none mt-2" style={{ color }}>{value}</p>
    </div>
  );
}
