"use client";

import { useState, useEffect, useCallback } from "react";
import { getOrgId } from "@/lib/api";
import { toast } from "sonner";
import {
  Eye, Search, Loader2, AlertTriangle, Shield, Radio, Globe,
  FileText, MessageSquare, Lock, Database, ChevronLeft, ChevronRight,
  RefreshCw, ExternalLink, Clock, Skull, Hash, Mail
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

async function apiFetch(path: string, options: any = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId(), ...options.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const SOURCES = [
  { id: "forums", label: "Dark Web Forums", icon: MessageSquare, color: "#a855f7", desc: "Underground discussion boards" },
  { id: "paste", label: "Paste Sites", icon: FileText, color: "#f97316", desc: "Pastebin, GhostBin, etc." },
  { id: "leaks", label: "Data Leak Sites", icon: Database, color: "#ef4444", desc: "Ransomware blogs, leak sites" },
  { id: "credentials", label: "Credential Markets", icon: Lock, color: "#eab308", desc: "Stolen credential shops" },
  { id: "telegram", label: "Telegram Channels", icon: Radio, color: "#3b82f6", desc: "Threat actor channels" },
  { id: "ransomware", label: "Ransomware Feeds", icon: Skull, color: "#dc2626", desc: "Active group monitoring" },
];

export default function DarkWebPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [stats, setStats] = useState<any>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), per_page: "20", module: "dark_web" });
      if (searchQuery) params.set("search", searchQuery);
      const data = await apiFetch(`/api/v1/alerts/?${params}`);
      setAlerts(data.data || []);
      setTotal(data.total || 0);
    } catch { toast.error("Failed to load dark web alerts"); }
    finally { setLoading(false); }
  }, [page, searchQuery]);

  const fetchStats = async () => {
    try {
      const data = await apiFetch("/api/v1/alerts/stats");
      setStats(data);
    } catch {}
  };

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);
  useEffect(() => { fetchStats(); }, []);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Eye className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Dark Web Monitor</h1>
            <p className="text-[11px] text-slate-500">Deep & dark web threat surveillance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-medium">Monitoring Active</span>
          </div>
        </div>
      </div>

      {/* Source Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {SOURCES.map((source) => (
          <button
            key={source.id}
            onClick={() => setSelectedSource(selectedSource === source.id ? "" : source.id)}
            className={`card-enterprise p-4 text-left transition-all ${selectedSource === source.id ? "border-purple-500/30 glow-purple" : ""}`}
          >
            <source.icon className="w-5 h-5 mb-2" style={{ color: source.color }} />
            <p className="text-xs font-semibold text-slate-300">{source.label}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{source.desc}</p>
          </button>
        ))}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card p-4">
          <p className="text-[11px] text-slate-500 uppercase">Total Dark Web Alerts</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{stats?.by_module?.dark_web || 0}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[11px] text-slate-500 uppercase">Credential Leaks</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{stats?.by_module?.credential || 0}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[11px] text-slate-500 uppercase">Data Leaks</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{stats?.by_module?.data_leak || 0}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[11px] text-slate-500 uppercase">Open Alerts</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{stats?.by_status?.open || 0}</p>
        </div>
      </div>

      {/* Search */}
      <div className="card-enterprise p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search dark web findings..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-purple-500/[0.06] rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-purple-500/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Alert Feed */}
      <div className="card-enterprise overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-purple-500/[0.06]">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-slate-300">Dark Web Intelligence Feed</h2>
          </div>
          <span className="text-[11px] text-slate-500">{total} findings</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center">
            <Eye className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No dark web alerts found. Add assets to begin monitoring.</p>
          </div>
        ) : (
          <div className="divide-y divide-cyan-500/[0.04]">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-4 hover:bg-white/[0.01] transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    alert.severity === "critical" ? "bg-red-500 status-critical" :
                    alert.severity === "high" ? "bg-orange-500" :
                    alert.severity === "medium" ? "bg-yellow-500" : "bg-blue-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        alert.severity === "critical" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                        alert.severity === "high" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" :
                        alert.severity === "medium" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
                        "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}>{alert.severity}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {alert.module?.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mt-1.5 font-medium">{alert.title}</p>
                    {alert.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{alert.description}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-slate-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{new Date(alert.created_at).toLocaleString()}
                      </span>
                      {alert.risk_score > 0 && (
                        <span className="text-[10px] text-slate-600">Risk: <span className={alert.risk_score >= 80 ? "text-red-400 font-bold" : alert.risk_score >= 60 ? "text-orange-400 font-bold" : "text-yellow-400"}>{alert.risk_score}</span>/100</span>
                      )}
                      {alert.source_url && (
                        <a href={alert.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />Source
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-600">{total} total findings</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-slate-500 hover:text-white disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
              className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-slate-500 hover:text-white disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
