"use client";

import { InfinityLoader } from "@/components/InfinityLoader";

import { useEffect, useState } from "react";
import {
  Radio, RefreshCw, Search, ExternalLink,
  Hash, Filter, Clock
} from "lucide-react";
import { api, getOrgId, type ResearcherChannel, type ResearcherPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ResearcherFeedPage() {
  const [channels, setChannels] = useState<ResearcherChannel[]>([]);
  const [posts, setPosts] = useState<ResearcherPost[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hasIocs, setHasIocs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        api.listResearcherChannels(getOrgId()),
        api.listResearcherPosts(getOrgId(), {
          channel: activeChannel ?? undefined,
          q: search || undefined,
          has_iocs: hasIocs,
          per_page: 50,
        }),
      ]);
      setChannels(c.data);
      setPosts(p.data);
      setTotal(p.total);
    } catch (e: any) {
      toast.error(e?.message ?? "load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeChannel, hasIocs]);

  const handlePoll = async () => {
    setPolling(true);
    try {
      const r = await api.pollResearcherFeed(getOrgId());
      const total_inserted = r.results.reduce((sum, x) => sum + x.inserted, 0);
      toast.success(`Polled ${r.channels} channels · ${total_inserted} new posts`);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "poll failed");
    } finally {
      setPolling(false);
    }
  };

  const categoryColor = (cat: string | null) => {
    const map: Record<string, string> = {
      malware: "bg-red-500/15 text-red-300 border-red-500/30",
      ransomware: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      threat_intel: "bg-purple-500/15 text-purple-300 border-purple-500/30",
      advisories: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      tools: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
      generic: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    };
    return map[cat || "generic"] || map.generic;
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(168,85,247,0.15),rgba(56,189,248,0.1))", border: "1px solid rgba(168,85,247,0.2)" }}>
            <Radio className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Researcher Feed</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Curated public Telegram channels — security researchers, ransomware tracking, vulnerability advisories
            </p>
          </div>
        </div>
        <button onClick={handlePoll} disabled={polling}
          className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold text-white btn-brand disabled:opacity-40">
          {polling ? <InfinityLoader size={14} /> : <RefreshCw className="w-3.5 h-3.5" />}
          Poll all channels
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Channels</p>
          <p className="text-[26px] font-bold font-mono text-white leading-none mt-2">{channels.length}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Total Posts</p>
          <p className="text-[26px] font-bold font-mono text-purple-300 leading-none mt-2">{total.toLocaleString()}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Auto-polled</p>
          <p className="text-[12px] text-slate-400 font-mono mt-2">every 30 min</p>
        </div>
      </div>

      {/* Channel chips */}
      <div className="card-enterprise p-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveChannel(null)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
              activeChannel === null
                ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200")}>
            All ({channels.length})
          </button>
          {channels.map((c) => (
            <button key={c.id} onClick={() => setActiveChannel(activeChannel === c.handle ? null : c.handle)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2",
                activeChannel === c.handle
                  ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                  : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200")}>
              <span>{c.name}</span>
              <span className={cn("px-1.5 py-0.5 rounded text-[9px] uppercase border", categoryColor(c.category))}>
                {c.category || "generic"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div className="card-enterprise p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Search posts (full-text)…"
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/30" />
          </div>
          <button onClick={() => setHasIocs(!hasIocs)}
            className={cn("h-10 px-3 rounded-lg flex items-center gap-2 text-xs font-semibold border transition-all",
              hasIocs
                ? "bg-orange-500/15 border-orange-500/40 text-orange-300"
                : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200")}>
            <Filter className="w-3.5 h-3.5" />
            With IOCs only
          </button>
          <button onClick={load} className="h-10 px-4 rounded-lg text-sm font-semibold text-white btn-brand">Search</button>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-2">
        {loading && (
          <div className="card-enterprise p-8 flex items-center justify-center"><InfinityLoader size={24} /></div>
        )}
        {!loading && posts.length === 0 && (
          <div className="card-enterprise p-10 flex flex-col items-center text-center animate-fade-up">
            {/* Icon ring */}
            <div className="relative w-28 h-28 mb-6">
              <div className="absolute inset-0 rounded-full opacity-10 animate-ping"
                style={{ background: "radial-gradient(circle, rgba(168,85,247,0.4), transparent 70%)" }} />
              {[
                { label: "vx",    angle: 0,   color: "#a855f7" },
                { label: "THN",   angle: 51,  color: "#3b82f6" },
                { label: "CISA",  angle: 102, color: "#ef4444" },
                { label: "DF",    angle: 153, color: "#f97316" },
                { label: "CRU",   angle: 204, color: "#10b981" },
                { label: "RT",    angle: 255, color: "#eab308" },
                { label: "KR",    angle: 306, color: "#06b6d4" },
              ].map(({ label, angle, color }) => {
                const rad = (angle * Math.PI) / 180;
                const x = 50 + 38 * Math.cos(rad);
                const y = 50 + 38 * Math.sin(rad);
                return (
                  <div key={angle}
                    className="absolute w-7 h-7 rounded-full flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${x}%`, top: `${y}%`, background: `${color}12`, border: `1px solid ${color}30` }}>
                    <span className="text-[8px] font-bold" style={{ color }}>{label}</span>
                  </div>
                );
              })}
              <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,rgba(168,85,247,0.15),rgba(56,189,248,0.1))", border: "1px solid rgba(168,85,247,0.25)" }}>
                <Radio className="w-6 h-6 text-purple-300" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight">Pull threat intel from 8 curated channels</h2>
            <p className="text-[13px] text-slate-400 mt-2 max-w-sm leading-relaxed">
              vx-underground, The Hacker News, CISA, DarkFeed and more —{" "}
              <span className="text-purple-300 font-semibold">IOCs auto-extracted</span> from every post.
            </p>

            <div className="flex flex-wrap gap-2 mt-5 justify-center">
              <button
                onClick={handlePoll}
                disabled={polling}
                className="h-9 px-5 rounded-lg flex items-center gap-2 text-sm font-semibold text-white btn-brand disabled:opacity-40">
                {polling ? <InfinityLoader size={16} /> : <RefreshCw className="w-4 h-4" />}
                Poll all channels now
              </button>
            </div>

            <div className="mt-6 w-full max-w-xs">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-px" style={{ background: "rgba(168,85,247,0.08)" }} />
                <span className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">How it works</span>
                <div className="flex-1 h-px" style={{ background: "rgba(168,85,247,0.08)" }} />
              </div>
              <ol className="space-y-2 text-left">
                {[
                  { n: "1", text: "Click poll — we scrape t.me/s/<handle> for each curated channel" },
                  { n: "2", text: "Posts are stored and IOCs (IPs, domains, hashes) are auto-extracted" },
                  { n: "3", text: "IOCs surface as searchable, filterable posts — pivotable to IOC Lookup" },
                ].map(({ n, text }) => (
                  <li key={n} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-purple-300"
                      style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", marginTop: "1px" }}>
                      {n}
                    </span>
                    <span className="text-[11px] text-slate-500 leading-relaxed">{text}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
        {!loading && posts.map((p) => {
          const iocs = p.extracted_iocs || {};
          const iocCount = Object.values(iocs).reduce((s, v) => s + (v?.length || 0), 0);
          const channel = channels.find((c) => c.handle === p.channel);
          return (
            <div key={p.id} className="card-enterprise p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-purple-300">{channel?.name || p.channel}</span>
                    {p.published_at && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(p.published_at).toLocaleString()}</span>
                    )}
                    {iocCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20">
                        {iocCount} IOC{iocCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {p.text && (
                    <p className="text-[13px] text-slate-300 mt-2 whitespace-pre-wrap break-words">{p.text}</p>
                  )}
                  {iocCount > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(iocs).map(([kind, vals]) => (
                        (vals || []).slice(0, 6).map((v) => (
                          <span key={`${kind}-${v}`} className="px-2 py-0.5 rounded text-[10px] font-mono bg-orange-500/10 text-orange-300 border border-orange-500/20" title={kind}>
                            {kind}: {v.length > 32 ? v.slice(0, 32) + "…" : v}
                          </span>
                        ))
                      ))}
                    </div>
                  )}
                </div>
                {p.link && (
                  <a href={p.link} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-purple-300 shrink-0" title="Open in Telegram">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
