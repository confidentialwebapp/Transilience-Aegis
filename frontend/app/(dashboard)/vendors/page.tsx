"use client";

import { useState, useEffect, useCallback } from "react";
import { getOrgId } from "@/lib/api";
import { toast } from "sonner";
import {
  Building2, Plus, Search, Loader2, Shield, ChevronLeft, ChevronRight,
  Scan, Trash2, X, Download, Upload, AlertTriangle, TrendingDown, ExternalLink
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

interface Vendor {
  id: string;
  name: string;
  domain: string;
  vendor_type: string;
  risk_tier: string;
  risk_score: number;
  contact_name: string;
  contact_email: string;
  status: string;
  tags: string[];
  last_scan_at: string | null;
  created_at: string;
}

interface VendorScan {
  id: string;
  scan_type: string;
  status: string;
  risk_score: number;
  findings_count: number;
  results: Record<string, any>;
  completed_at: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  critical: number;
  high: number;
  avg_risk_score: number;
}

async function apiFetch(path: string, options: any = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId(), ...options.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const TIER_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/10 text-green-400 border-green-500/30",
};

const SCORE_COLOR = (score: number) =>
  score >= 80 ? "text-red-400" : score >= 60 ? "text-orange-400" : score >= 40 ? "text-yellow-400" : score >= 20 ? "text-blue-400" : "text-green-400";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [riskTier, setRiskTier] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<Vendor | null>(null);
  const [scans, setScans] = useState<VendorScan[]>([]);
  const [scanning, setScanning] = useState<string | null>(null);

  // New vendor form
  const [form, setForm] = useState({ name: "", domain: "", vendor_type: "saas", risk_tier: "medium", contact_name: "", contact_email: "" });

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), per_page: "20", sort_by: "risk_score", sort_desc: "true" });
      if (search) params.set("search", search);
      if (riskTier) params.set("risk_tier", riskTier);
      const data = await apiFetch(`/api/v1/vendors/?${params}`);
      setVendors(data.data || []);
      setTotal(data.total || 0);
    } catch { toast.error("Failed to load vendors"); }
    finally { setLoading(false); }
  }, [page, search, riskTier]);

  const fetchStats = async () => {
    try { setStats(await apiFetch("/api/v1/vendors/stats/summary")); } catch {}
  };

  useEffect(() => { fetchVendors(); }, [fetchVendors]);
  useEffect(() => { fetchStats(); }, []);

  const createVendor = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    try {
      await apiFetch("/api/v1/vendors/", { method: "POST", body: JSON.stringify(form) });
      toast.success("Vendor added");
      setShowAdd(false);
      setForm({ name: "", domain: "", vendor_type: "saas", risk_tier: "medium", contact_name: "", contact_email: "" });
      fetchVendors();
      fetchStats();
    } catch { toast.error("Failed to create vendor"); }
  };

  const deleteVendor = async (id: string) => {
    try {
      await apiFetch(`/api/v1/vendors/${id}`, { method: "DELETE" });
      toast.success("Vendor deleted");
      fetchVendors();
      fetchStats();
      setShowDetail(null);
    } catch { toast.error("Failed to delete"); }
  };

  const triggerScan = async (id: string) => {
    setScanning(id);
    try {
      await apiFetch(`/api/v1/vendors/${id}/scan?scan_type=full`, { method: "POST" });
      toast.success("Scan started. Results will appear in a few moments.");
    } catch { toast.error("Scan failed"); }
    finally { setScanning(null); }
  };

  const openDetail = async (vendor: Vendor) => {
    setShowDetail(vendor);
    try {
      const data = await apiFetch(`/api/v1/vendors/${vendor.id}/scans`);
      setScans(data.data || []);
    } catch { setScans([]); }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6 text-cyan-400" />SVigil - Vendor Registry</h1>
          <p className="text-sm text-slate-400 mt-1">Supply chain & vendor risk monitoring</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" />Add Vendor
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Vendors", value: stats.total, color: "text-slate-300" },
            { label: "Critical Risk", value: stats.critical, color: "text-red-400" },
            { label: "High Risk", value: stats.high, color: "text-orange-400" },
            { label: "Avg Risk Score", value: stats.avg_risk_score, color: SCORE_COLOR(stats.avg_risk_score) },
          ].map((s) => (
            <div key={s.label} className="card-enterprise p-4">
              <p className="text-xs text-slate-500 uppercase">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{typeof s.value === "number" && s.value % 1 !== 0 ? s.value.toFixed(1) : s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search vendors..." className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500" />
        </div>
        <select value={riskTier} onChange={(e) => { setRiskTier(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
          <option value="">All Risk Tiers</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Vendor Table */}
      <div className="card-enterprise overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>
        ) : vendors.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No vendors registered. Add your first vendor to start monitoring.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr className="text-left text-xs text-slate-500 uppercase">
                <th className="p-4">Vendor</th>
                <th className="p-4">Type</th>
                <th className="p-4">Risk Tier</th>
                <th className="p-4">Risk Score</th>
                <th className="p-4">Last Scan</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-slate-800/50 cursor-pointer transition-colors" onClick={() => openDetail(v)}>
                  <td className="p-4">
                    <div className="font-medium text-slate-200">{v.name}</div>
                    {v.domain && <div className="text-xs text-slate-500">{v.domain}</div>}
                  </td>
                  <td className="p-4 text-slate-400 capitalize">{v.vendor_type.replace("_", " ")}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${TIER_COLORS[v.risk_tier] || TIER_COLORS.medium}`}>
                      {v.risk_tier?.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`text-lg font-bold ${SCORE_COLOR(v.risk_score)}`}>{v.risk_score}</span>
                    <span className="text-xs text-slate-500">/100</span>
                  </td>
                  <td className="p-4 text-xs text-slate-500">
                    {v.last_scan_at ? new Date(v.last_scan_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => triggerScan(v.id)} disabled={scanning === v.id}
                        className="p-2 bg-slate-800 hover:bg-cyan-600/20 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors">
                        {scanning === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteVendor(v.id)}
                        className="p-2 bg-slate-800 hover:bg-red-600/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{total} vendors total</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Add Vendor</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 uppercase">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase">Domain</label>
                <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="example.com"
                  className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase">Type</label>
                  <select value={form.vendor_type} onChange={(e) => setForm({ ...form, vendor_type: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200">
                    <option value="saas">SaaS</option>
                    <option value="cloud">Cloud</option>
                    <option value="open_source">Open Source</option>
                    <option value="data_processor">Data Processor</option>
                    <option value="infrastructure">Infrastructure</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase">Risk Tier</label>
                  <select value={form.risk_tier} onChange={(e) => setForm({ ...form, risk_tier: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase">Contact Name</label>
                  <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase">Contact Email</label>
                  <input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} type="email"
                    className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <button onClick={createVendor} className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium">Add Vendor</button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowDetail(null)}>
          <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">{showDetail.name}</h2>
                {showDetail.domain && <p className="text-sm text-cyan-400">{showDetail.domain}</p>}
              </div>
              <button onClick={() => setShowDetail(null)} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-xs text-slate-500">Risk Score</p>
                <p className={`text-2xl font-bold ${SCORE_COLOR(showDetail.risk_score)}`}>{showDetail.risk_score}<span className="text-sm text-slate-500">/100</span></p>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-xs text-slate-500">Risk Tier</p>
                <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium border ${TIER_COLORS[showDetail.risk_tier]}`}>{showDetail.risk_tier?.toUpperCase()}</span>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-xs text-slate-500">Type</p>
                <p className="text-sm text-slate-300 mt-1 capitalize">{showDetail.vendor_type?.replace("_", " ")}</p>
              </div>
            </div>

            {/* Scan History */}
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Scan History</h3>
            {scans.length === 0 ? (
              <p className="text-sm text-slate-500 mb-4">No scans yet. Trigger a scan to assess this vendor.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {scans.map((scan) => (
                  <div key={scan.id} className="bg-slate-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${scan.status === "completed" ? "bg-green-500/10 text-green-400" : scan.status === "failed" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                          {scan.status}
                        </span>
                        <span className="text-xs text-slate-500 capitalize">{scan.scan_type}</span>
                      </div>
                      <div className="text-right">
                        <span className={`font-bold ${SCORE_COLOR(scan.risk_score)}`}>{scan.risk_score}</span>
                        <span className="text-xs text-slate-500 ml-1">risk</span>
                      </div>
                    </div>
                    {scan.results && Object.keys(scan.results).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-cyan-400 cursor-pointer">View Results ({scan.findings_count} findings)</summary>
                        <pre className="mt-2 text-xs bg-slate-900 rounded p-3 overflow-x-auto max-h-60 text-slate-400">
                          {JSON.stringify(scan.results, null, 2)}
                        </pre>
                      </details>
                    )}
                    <p className="text-xs text-slate-500 mt-2">{scan.completed_at ? new Date(scan.completed_at).toLocaleString() : "In progress..."}</p>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => triggerScan(showDetail.id)} disabled={scanning === showDetail.id}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
              {scanning === showDetail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
              Run Full Security Scan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
