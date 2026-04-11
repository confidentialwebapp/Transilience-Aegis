"use client";

import { useState, useEffect, useCallback } from "react";
import { api, getOrgId } from "@/lib/api";
import { toast } from "sonner";
import {
  Search, Loader2, Globe, Server, Hash, Mail, Link, Fingerprint,
  Plus, X, Eye, Shield, Clock, AlertTriangle, ChevronRight, ExternalLink,
  Trash2, CheckCircle
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

const IOC_TYPES = [
  { value: "ip", label: "IP Address", icon: Server },
  { value: "domain", label: "Domain", icon: Globe },
  { value: "hash", label: "File Hash", icon: Hash },
  { value: "url", label: "URL", icon: Link },
  { value: "email", label: "Email", icon: Mail },
];

function SourceCard({ source, data }: { source: string; data: any }) {
  const sourceLabels: Record<string, { label: string; color: string }> = {
    virustotal: { label: "VirusTotal", color: "text-blue-400" },
    otx: { label: "AlienVault OTX", color: "text-emerald-400" },
    greynoise: { label: "GreyNoise", color: "text-yellow-400" },
    shodan: { label: "Shodan", color: "text-red-400" },
    whois: { label: "WHOIS / RDAP", color: "text-purple-400" },
    urlscan: { label: "URLScan.io", color: "text-orange-400" },
  };

  const info = sourceLabels[source] || { label: source, color: "text-slate-400" };

  // Render key highlights before raw JSON
  const highlights: { label: string; value: string; color?: string }[] = [];

  if (source === "virustotal") {
    const stats = data?.data?.attributes?.last_analysis_stats;
    if (stats) {
      highlights.push({ label: "Malicious", value: stats.malicious?.toString() || "0", color: stats.malicious > 0 ? "text-red-400" : "text-emerald-400" });
      highlights.push({ label: "Suspicious", value: stats.suspicious?.toString() || "0" });
      highlights.push({ label: "Harmless", value: stats.harmless?.toString() || "0", color: "text-emerald-400" });
    }
  } else if (source === "greynoise") {
    highlights.push({ label: "Classification", value: data.classification || "unknown" });
    highlights.push({ label: "Noise", value: data.noise ? "Yes" : "No", color: data.noise ? "text-yellow-400" : "text-emerald-400" });
    highlights.push({ label: "RIOT", value: data.riot ? "Yes" : "No" });
  } else if (source === "shodan") {
    if (data.ports?.length) highlights.push({ label: "Open Ports", value: data.ports.join(", ") });
    if (data.vulns?.length) highlights.push({ label: "Vulnerabilities", value: `${data.vulns.length} found`, color: "text-red-400" });
    if (data.org) highlights.push({ label: "Org", value: data.org });
  } else if (source === "otx") {
    highlights.push({ label: "Pulses", value: data.pulse_count?.toString() || "0", color: data.pulse_count > 0 ? "text-orange-400" : "text-emerald-400" });
  } else if (source === "whois") {
    if (data.registration) highlights.push({ label: "Registered", value: new Date(data.registration).toLocaleDateString() });
    if (data.expiration) highlights.push({ label: "Expires", value: new Date(data.expiration).toLocaleDateString() });
    if (data.registrar) highlights.push({ label: "Registrar", value: data.registrar });
    if (data.nameservers?.length) highlights.push({ label: "Nameservers", value: data.nameservers.slice(0, 2).join(", ") });
    if (data.country) highlights.push({ label: "Country", value: data.country });
    if (data.org) highlights.push({ label: "Organization", value: data.org });
    if (data.name) highlights.push({ label: "Network", value: data.name });
  }

  return (
    <div className="card-enterprise p-5">
      <h3 className={`text-sm font-bold uppercase mb-3 ${info.color}`}>{info.label}</h3>
      {highlights.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {highlights.map((h, i) => (
            <div key={i} className="stat-card p-3">
              <p className="text-[10px] text-slate-500 uppercase">{h.label}</p>
              <p className={`text-sm font-semibold mt-0.5 ${h.color || "text-slate-300"}`}>{h.value}</p>
            </div>
          ))}
        </div>
      )}
      <details>
        <summary className="text-[11px] text-purple-400 cursor-pointer hover:text-purple-300">View Raw Data</summary>
        <pre className="mt-2 text-[11px] rounded-lg p-4 overflow-x-auto max-h-60 text-slate-400" style={{ background: "rgba(255,255,255,0.02)" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default function IntelPage() {
  const [orgId, setOrgIdLocal] = useState("");
  const [type, setType] = useState("ip");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<"lookup" | "watchlist">("lookup");
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  useEffect(() => { setOrgIdLocal(getOrgId()); }, []);

  const fetchWatchlist = async () => {
    setWatchlistLoading(true);
    try {
      const data = await apiFetch("/api/v1/ioc-watchlist/");
      setWatchlist(data.data || []);
    } catch {}
    finally { setWatchlistLoading(false); }
  };

  useEffect(() => { if (tab === "watchlist") fetchWatchlist(); }, [tab]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setResults(null);
    try {
      // Use enhanced lookup with WHOIS
      const data = await apiFetch(`/api/v1/ioc-watchlist/lookup-enhanced?type=${type}&value=${encodeURIComponent(value.trim())}`);
      setResults(data.results || {});
    } catch {
      // Fallback to standard lookup
      try {
        const data = await api.lookupIOC(orgId, type, value.trim());
        setResults(data.results || {});
      } catch (err) {
        toast.error("IOC lookup failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const addToWatchlist = async () => {
    if (!value.trim() || !type) return;
    try {
      await apiFetch("/api/v1/ioc-watchlist/", {
        method: "POST",
        body: JSON.stringify({ ioc_type: type, ioc_value: value.trim(), label: "" }),
      });
      toast.success("Added to watchlist");
      fetchWatchlist();
    } catch (err: any) {
      toast.error(err.message?.includes("409") ? "Already in watchlist" : "Failed to add");
    }
  };

  const removeFromWatchlist = async (id: string) => {
    try {
      await apiFetch(`/api/v1/ioc-watchlist/${id}`, { method: "DELETE" });
      fetchWatchlist();
    } catch {}
  };

  const inputStyle = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)" };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Fingerprint className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">IOC Lookup & Watchlist</h1>
          <p className="text-[11px] text-slate-500">Multi-source threat intelligence aggregation with WHOIS enrichment</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: "rgba(17,13,26,0.8)", border: "1px solid rgba(139,92,246,0.06)" }}>
        {([
          { key: "lookup" as const, label: "IOC Lookup", icon: Search },
          { key: "watchlist" as const, label: "Watchlist", icon: Eye },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all ${tab === t.key ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-slate-500 hover:text-white"}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Lookup Tab */}
      {tab === "lookup" && (
        <>
          <form onSubmit={handleSearch} className="card-enterprise p-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none" style={inputStyle}>
                {IOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input type="text" value={value} onChange={(e) => setValue(e.target.value)}
                  placeholder="Enter IP, domain, hash, URL, or email..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none" style={inputStyle} required />
              </div>
              <button type="submit" disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-2.5 btn-brand rounded-lg text-sm font-medium">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search
              </button>
              {value.trim() && (
                <button type="button" onClick={addToWatchlist}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors" style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)" }}>
                  <Plus className="w-4 h-4" /> Watch
                </button>
              )}
            </div>
          </form>

          {loading && (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
                <p className="text-xs text-slate-500">Querying VirusTotal, OTX, GreyNoise, Shodan, WHOIS...</p>
              </div>
            </div>
          )}

          {results && !loading && (
            <div className="space-y-4">
              {Object.entries(results).length === 0 ? (
                <div className="card-enterprise p-8 text-center text-slate-500">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No results found for this IOC.</p>
                </div>
              ) : (
                Object.entries(results).map(([source, data]) => (
                  <SourceCard key={source} source={source} data={data} />
                ))
              )}
            </div>
          )}

          {!results && !loading && (
            <div className="card-enterprise p-12 text-center">
              <Fingerprint className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Enter an IOC above to search across multiple threat intelligence sources.</p>
              <p className="text-xs text-slate-600 mt-1">Sources: VirusTotal, AlienVault OTX, GreyNoise, Shodan, WHOIS/RDAP, URLScan.io</p>
            </div>
          )}
        </>
      )}

      {/* Watchlist Tab */}
      {tab === "watchlist" && (
        <div className="card-enterprise overflow-hidden">
          <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(139,92,246,0.06)" }}>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-slate-300">Monitored IOCs</h2>
            </div>
            <span className="text-[11px] text-slate-500">{watchlist.length} indicators</span>
          </div>
          {watchlistLoading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
          ) : watchlist.length === 0 ? (
            <div className="p-12 text-center">
              <Eye className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No IOCs in watchlist. Search for an IOC and click &quot;Watch&quot; to add it.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(139,92,246,0.04)" }}>
              {watchlist.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">{item.ioc_type}</span>
                    <span className="text-sm text-slate-300 font-mono">{item.ioc_value}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${item.status === "monitoring" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>{item.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600">{item.last_checked_at ? new Date(item.last_checked_at).toLocaleDateString() : "Not checked"}</span>
                    <button onClick={() => { setTab("lookup"); setType(item.ioc_type); setValue(item.ioc_value); }}
                      className="p-1.5 rounded text-slate-500 hover:text-purple-400 transition-colors"><Search className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeFromWatchlist(item.id)}
                      className="p-1.5 rounded text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
