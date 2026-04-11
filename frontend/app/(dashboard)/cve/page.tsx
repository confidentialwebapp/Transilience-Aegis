"use client";

import { useState, useEffect, useCallback } from "react";
import { getOrgId } from "@/lib/api";
import { toast } from "sonner";
import {
  Shield, Search, Loader2, AlertTriangle, RefreshCw,
  ChevronLeft, ChevronRight, ExternalLink, Plus, X, Bug, Zap
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

interface CVE {
  id?: string;
  cve_id: string;
  description: string;
  severity: string;
  cvss_score: number;
  cvss_vector?: string;
  epss_score: number;
  epss_percentile: number;
  cisa_kev: boolean;
  kev_due_date?: string;
  affected_products?: string[];
  ref_urls?: { url: string; source?: string }[];
  published_at: string;
  modified_at?: string;
}

interface WatchlistItem {
  id: string;
  keyword: string;
  keyword_type: string;
  created_at: string;
}

interface Stats {
  total: number;
  critical: number;
  high: number;
  kev_count: number;
  last_24h: number;
}

async function apiFetch(path: string, options: any = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId(), ...options.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  none: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

export default function CVEPage() {
  const [cves, setCves] = useState<CVE[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [kevOnly, setKevOnly] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [selectedCve, setSelectedCve] = useState<CVE | null>(null);
  const [tab, setTab] = useState<"feed" | "kev" | "watchlist">("feed");

  const fetchCves = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), per_page: "20" });
      if (search) params.set("search", search);
      if (severity) params.set("severity", severity);
      if (kevOnly) params.set("kev_only", "true");
      const data = await apiFetch(`/api/v1/cve/feed?${params}`);
      setCves(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error("Failed to load CVE feed");
    } finally {
      setLoading(false);
    }
  }, [page, search, severity, kevOnly]);

  const fetchStats = async () => {
    try {
      const data = await apiFetch("/api/v1/cve/stats");
      setStats(data);
    } catch {}
  };

  const fetchWatchlist = async () => {
    try {
      const data = await apiFetch("/api/v1/cve/watchlist");
      setWatchlist(data.data || []);
    } catch {}
  };

  useEffect(() => { fetchCves(); }, [fetchCves]);
  useEffect(() => { fetchStats(); fetchWatchlist(); }, []);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await apiFetch("/api/v1/cve/sync", { method: "POST" });
      toast.success("CVE sync started. New data will appear shortly.");
      setTimeout(() => { fetchCves(); fetchStats(); }, 5000);
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const addKeyword = async () => {
    if (!newKeyword.trim()) return;
    try {
      await apiFetch("/api/v1/cve/watchlist", {
        method: "POST",
        body: JSON.stringify({ keyword: newKeyword.trim(), keyword_type: "product" }),
      });
      setNewKeyword("");
      fetchWatchlist();
      toast.success("Keyword added to watchlist");
    } catch (err: any) {
      toast.error(err.message?.includes("409") ? "Already in watchlist" : "Failed to add");
    }
  };

  const removeKeyword = async (id: string) => {
    try {
      await apiFetch(`/api/v1/cve/watchlist/${id}`, { method: "DELETE" });
      fetchWatchlist();
    } catch {}
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bug className="w-6 h-6 text-purple-400" />CVE Intelligence Feed
          </h1>
          <p className="text-sm text-slate-400 mt-1">Real-time vulnerability tracking from NVD, CISA KEV & EPSS</p>
        </div>
        <button
          onClick={triggerSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync NVD
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total CVEs", value: stats.total, color: "text-slate-300" },
            { label: "Critical", value: stats.critical, color: "text-red-400" },
            { label: "High", value: stats.high, color: "text-orange-400" },
            { label: "CISA KEV", value: stats.kev_count, color: "text-yellow-400" },
            { label: "Last 24h", value: stats.last_24h, color: "text-purple-400" },
          ].map((s) => (
            <div key={s.label} className="card-enterprise p-4">
              <p className="text-xs text-slate-500 uppercase">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 rounded-lg p-1 border border-slate-700/50 w-fit">
        {(["feed", "kev", "watchlist"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); if (t === "kev") setKevOnly(true); else setKevOnly(false); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t === "feed" ? "All CVEs" : t === "kev" ? "CISA KEV" : "Watchlist"}
          </button>
        ))}
      </div>

      {/* Watchlist Tab */}
      {tab === "watchlist" && (
        <div className="card-enterprise p-6 space-y-4">
          <h3 className="text-lg font-semibold">Tech Stack Watchlist</h3>
          <p className="text-sm text-slate-400">Add keywords to filter CVEs relevant to your tech stack</p>
          <div className="flex gap-2">
            <input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addKeyword()}
              placeholder="e.g. apache, nginx, react, postgresql..."
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <button onClick={addKeyword} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {watchlist.map((w) => (
              <span key={w.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-sm text-slate-300">
                {w.keyword}
                <button onClick={() => removeKeyword(w.id)} className="text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {watchlist.length === 0 && <p className="text-sm text-slate-500">No keywords added yet.</p>}
          </div>
        </div>
      )}

      {/* Feed/KEV Tab */}
      {tab !== "watchlist" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search CVE ID or description..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <select
              value={severity}
              onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* CVE Table */}
          <div className="card-enterprise overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : cves.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No CVEs found. Click &quot;Sync NVD&quot; to fetch latest vulnerabilities.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {cves.map((cve) => (
                  <div
                    key={cve.cve_id}
                    className="p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedCve(cve)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold text-purple-400">{cve.cve_id}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${SEVERITY_COLORS[cve.severity] || SEVERITY_COLORS.none}`}>
                            {cve.severity?.toUpperCase()}
                          </span>
                          {cve.cisa_kev && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
                              <Zap className="w-3 h-3" />KEV
                            </span>
                          )}
                          {cve.epss_score > 0.1 && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30">
                              EPSS: {(cve.epss_score * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">{cve.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-slate-300">{cve.cvss_score.toFixed(1)}</div>
                        <div className="text-xs text-slate-500">CVSS</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {new Date(cve.published_at).toLocaleDateString()}
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
              <p className="text-sm text-slate-500">{total} CVEs total</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* CVE Detail Modal */}
      {selectedCve && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCve(null)}>
          <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold font-mono text-purple-400">{selectedCve.cve_id}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${SEVERITY_COLORS[selectedCve.severity]}`}>
                    {selectedCve.severity?.toUpperCase()}
                  </span>
                  <span className="text-sm text-slate-400">CVSS {selectedCve.cvss_score.toFixed(1)}</span>
                  {selectedCve.cisa_kev && <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-300 border border-red-500/30">CISA KEV</span>}
                </div>
              </div>
              <button onClick={() => setSelectedCve(null)} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-1">Description</h4>
                <p className="text-sm text-slate-400">{selectedCve.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-500">EPSS Score</p>
                  <p className="text-lg font-bold text-purple-400">{(selectedCve.epss_score * 100).toFixed(2)}%</p>
                  <p className="text-xs text-slate-500">Percentile: {(selectedCve.epss_percentile * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Published</p>
                  <p className="text-sm font-medium text-slate-300">{new Date(selectedCve.published_at).toLocaleDateString()}</p>
                  {selectedCve.kev_due_date && (
                    <p className="text-xs text-red-400 mt-1">KEV Due: {selectedCve.kev_due_date}</p>
                  )}
                </div>
              </div>
              {selectedCve.affected_products && selectedCve.affected_products.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">Affected Products</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedCve.affected_products.slice(0, 10).map((p, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400 font-mono">{p.split(":").slice(-2).join(":")}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedCve.ref_urls && selectedCve.ref_urls.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">References</h4>
                  <div className="space-y-1">
                    {selectedCve.ref_urls.slice(0, 5).map((ref, i) => (
                      <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300">
                        <ExternalLink className="w-3 h-3" />{ref.url}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
