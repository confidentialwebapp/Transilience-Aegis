"use client";

import { useState, useEffect, useCallback } from "react";
import { getOrgId } from "@/lib/api";
import { toast } from "sonner";
import {
  Globe, Shield, Lock, Network, Search, Loader2, ChevronLeft, ChevronRight,
  RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, Wifi, Mail
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

interface Subdomain {
  id: string; subdomain: string; ip_address: string; source: string;
  is_new: boolean; status: string; first_seen_at: string; last_seen_at: string;
}
interface SSLCert {
  id: string; domain: string; issuer: string; subject: string; valid_from: string;
  valid_until: string; grade: string; has_weak_cipher: boolean; is_wildcard: boolean; sans: string[];
}
interface DNSRecord {
  id: string; domain: string; record_type: string; record_value: string;
  previous_value: string | null; changed_at: string | null; checked_at: string;
}

type Tab = "overview" | "subdomains" | "ssl" | "dns";

export default function InfrastructurePage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<any>(null);
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [sslCerts, setSslCerts] = useState<SSLCert[]>([]);
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [domain, setDomain] = useState("");
  const [scanDomain, setScanDomain] = useState("");
  const [scanning, setScanning] = useState(false);
  const [emailSecurity, setEmailSecurity] = useState<any>(null);

  const fetchOverview = async () => {
    try { setOverview(await apiFetch("/api/v1/infrastructure/overview")); } catch {}
  };

  const fetchSubdomains = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), per_page: "50" });
      if (domain) params.set("domain", domain);
      const data = await apiFetch(`/api/v1/infrastructure/subdomains?${params}`);
      setSubdomains(data.data || []); setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  }, [page, domain]);

  const fetchSSL = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/v1/infrastructure/ssl?page=${page}&per_page=20`);
      setSslCerts(data.data || []); setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  }, [page]);

  const fetchDNS = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/v1/infrastructure/dns?page=${page}&per_page=50`);
      setDnsRecords(data.data || []); setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchOverview(); }, []);
  useEffect(() => {
    setPage(1);
    if (tab === "subdomains") fetchSubdomains();
    else if (tab === "ssl") fetchSSL();
    else if (tab === "dns") fetchDNS();
  }, [tab]);
  useEffect(() => {
    if (tab === "subdomains") fetchSubdomains();
    else if (tab === "ssl") fetchSSL();
    else if (tab === "dns") fetchDNS();
  }, [page, fetchSubdomains, fetchSSL, fetchDNS]);

  const triggerSubdomainEnum = async () => {
    if (!scanDomain.trim()) { toast.error("Enter a domain"); return; }
    setScanning(true);
    try {
      await apiFetch("/api/v1/infrastructure/subdomains/enumerate", { method: "POST", body: JSON.stringify({ domain: scanDomain.trim() }) });
      toast.success("Subdomain enumeration started");
      setTimeout(fetchSubdomains, 5000);
    } catch { toast.error("Failed"); } finally { setScanning(false); }
  };

  const triggerSSLCheck = async () => {
    if (!scanDomain.trim()) { toast.error("Enter a domain"); return; }
    setScanning(true);
    try {
      await apiFetch("/api/v1/infrastructure/ssl/check", { method: "POST", body: JSON.stringify({ domain: scanDomain.trim() }) });
      toast.success("SSL check started");
      setTimeout(fetchSSL, 5000);
    } catch { toast.error("Failed"); } finally { setScanning(false); }
  };

  const triggerDNSCheck = async () => {
    if (!scanDomain.trim()) { toast.error("Enter a domain"); return; }
    setScanning(true);
    try {
      await apiFetch("/api/v1/infrastructure/dns/check", { method: "POST", body: JSON.stringify({ domain: scanDomain.trim() }) });
      toast.success("DNS check started");
      setTimeout(fetchDNS, 5000);
    } catch { toast.error("Failed"); } finally { setScanning(false); }
  };

  const checkEmailSecurity = async () => {
    if (!scanDomain.trim()) { toast.error("Enter a domain"); return; }
    try {
      const data = await apiFetch(`/api/v1/infrastructure/dns/email-security/${scanDomain.trim()}`);
      setEmailSecurity(data);
    } catch { toast.error("Failed"); }
  };

  const daysRemaining = (validUntil: string) => {
    if (!validUntil) return null;
    const days = Math.floor((new Date(validUntil).getTime() - Date.now()) / 86400000);
    return days;
  };

  const perPage = tab === "subdomains" || tab === "dns" ? 50 : 20;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Network className="w-6 h-6 text-purple-400" />Infrastructure Monitor</h1>
        <p className="text-sm text-slate-400 mt-1">Subdomain enumeration, SSL/TLS monitoring, DNS change tracking</p>
      </div>

      {/* Domain Input */}
      <div className="card-enterprise p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={scanDomain} onChange={(e) => setScanDomain(e.target.value)}
              placeholder="Enter domain to scan (e.g. example.com)"
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)" }}
              onKeyDown={(e) => e.key === "Enter" && triggerSubdomainEnum()} />
          </div>
          <button onClick={triggerSubdomainEnum} disabled={scanning}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}Subdomains
          </button>
          <button onClick={triggerSSLCheck} disabled={scanning}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            <Lock className="w-4 h-4" />SSL
          </button>
          <button onClick={triggerDNSCheck} disabled={scanning}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            <Wifi className="w-4 h-4" />DNS
          </button>
          <button onClick={checkEmailSecurity} disabled={scanning}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            <Mail className="w-4 h-4" />Email
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Subdomains", value: overview.subdomains?.total || 0, icon: Globe, color: "text-purple-400" },
            { label: "New Subs", value: overview.subdomains?.new || 0, icon: AlertTriangle, color: "text-yellow-400" },
            { label: "SSL Certs", value: overview.ssl?.total || 0, icon: Lock, color: "text-emerald-400" },
            { label: "Expiring (30d)", value: overview.ssl?.expiring_30d || 0, icon: Clock, color: "text-orange-400" },
            { label: "DNS Records", value: overview.dns?.total || 0, icon: Wifi, color: "text-purple-400" },
            { label: "DNS Changes", value: overview.dns?.changes_detected || 0, icon: RefreshCw, color: "text-red-400" },
          ].map((s) => (
            <div key={s.label} className="card-enterprise p-4">
              <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Email Security Results */}
      {emailSecurity && (
        <div className="card-enterprise p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2"><Mail className="w-4 h-4 text-orange-400" />Email Security Check</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.08)" }}>
              <p className="text-xs text-slate-500 mb-1">SPF Record</p>
              <p className="text-xs text-slate-300 font-mono break-all">{emailSecurity.spf || "Not found"}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.08)" }}>
              <p className="text-xs text-slate-500 mb-1">DMARC Record</p>
              <p className="text-xs text-slate-300 font-mono break-all">{emailSecurity.dmarc || "Not found"}</p>
            </div>
          </div>
          {emailSecurity.issues?.length > 0 && (
            <div className="space-y-1">
              {emailSecurity.issues.map((issue: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm text-yellow-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />{issue}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.1)" }}>
        {([
          { key: "overview", label: "Overview" },
          { key: "subdomains", label: "Subdomains" },
          { key: "ssl", label: "SSL/TLS" },
          { key: "dns", label: "DNS Records" },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-slate-400 hover:text-white"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Subdomains Tab */}
      {tab === "subdomains" && (
        <div className="card-enterprise overflow-hidden">
          {loading ? <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div> :
          subdomains.length === 0 ? <div className="p-12 text-center text-slate-500"><Globe className="w-10 h-10 mx-auto mb-3 opacity-50" /><p>No subdomains found. Enter a domain above and click Subdomains.</p></div> : (
            <table className="w-full text-sm">
              <thead style={{ background: "rgba(139,92,246,0.04)" }}>
                <tr className="text-left text-xs text-slate-500 uppercase">
                  <th className="p-3">Subdomain</th><th className="p-3">IP</th><th className="p-3">Source</th><th className="p-3">Status</th><th className="p-3">First Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "rgba(139,92,246,0.06)" }}>
                {subdomains.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="p-3 font-mono text-xs text-purple-400">
                      {s.subdomain}
                      {s.is_new && <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded text-[10px] font-medium">NEW</span>}
                    </td>
                    <td className="p-3 text-xs text-slate-400 font-mono">{s.ip_address || "-"}</td>
                    <td className="p-3 text-xs text-slate-500">{s.source}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${s.status === "active" ? "bg-green-500/10 text-green-400" : "bg-slate-500/10 text-slate-400"}`}>{s.status}</span>
                    </td>
                    <td className="p-3 text-xs text-slate-500">{new Date(s.first_seen_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* SSL Tab */}
      {tab === "ssl" && (
        <div className="card-enterprise overflow-hidden">
          {loading ? <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div> :
          sslCerts.length === 0 ? <div className="p-12 text-center text-slate-500"><Lock className="w-10 h-10 mx-auto mb-3 opacity-50" /><p>No SSL certificates monitored. Enter a domain above and click SSL.</p></div> : (
            <div className="divide-y" style={{ borderColor: "rgba(139,92,246,0.06)" }}>
              {sslCerts.map((cert) => {
                const days = daysRemaining(cert.valid_until);
                const isExpired = days !== null && days < 0;
                const isExpiring = days !== null && days <= 30 && days >= 0;
                return (
                  <div key={cert.id} className="p-4 transition-colors hover:bg-white/[0.02]">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-purple-400">{cert.domain}</span>
                          {cert.grade && <span className={`px-2 py-0.5 rounded text-xs font-bold ${cert.grade?.startsWith("A") ? "bg-green-500/10 text-green-400" : cert.grade?.startsWith("B") ? "bg-yellow-500/10 text-yellow-400" : "bg-red-500/10 text-red-400"}`}>{cert.grade}</span>}
                          {cert.is_wildcard && <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400">Wildcard</span>}
                          {cert.has_weak_cipher && <span className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400">Weak Cipher</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Issuer: {cert.issuer} | Subject: {cert.subject}</p>
                        {cert.sans?.length > 0 && <p className="text-xs text-slate-600 mt-0.5">SANs: {cert.sans.slice(0, 3).join(", ")}{cert.sans.length > 3 ? ` +${cert.sans.length - 3} more` : ""}</p>}
                      </div>
                      <div className="text-right">
                        {isExpired ? (
                          <div className="flex items-center gap-1 text-red-400"><XCircle className="w-4 h-4" /><span className="text-sm font-bold">Expired</span></div>
                        ) : isExpiring ? (
                          <div className="flex items-center gap-1 text-yellow-400"><Clock className="w-4 h-4" /><span className="text-sm font-bold">{days}d left</span></div>
                        ) : days !== null ? (
                          <div className="flex items-center gap-1 text-green-400"><CheckCircle className="w-4 h-4" /><span className="text-sm">{days}d</span></div>
                        ) : null}
                        <p className="text-xs text-slate-500 mt-1">{cert.valid_until ? new Date(cert.valid_until).toLocaleDateString() : ""}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DNS Tab */}
      {tab === "dns" && (
        <div className="card-enterprise overflow-hidden">
          {loading ? <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div> :
          dnsRecords.length === 0 ? <div className="p-12 text-center text-slate-500"><Wifi className="w-10 h-10 mx-auto mb-3 opacity-50" /><p>No DNS records tracked. Enter a domain above and click DNS.</p></div> : (
            <table className="w-full text-sm">
              <thead style={{ background: "rgba(139,92,246,0.04)" }}>
                <tr className="text-left text-xs text-slate-500 uppercase">
                  <th className="p-3">Domain</th><th className="p-3">Type</th><th className="p-3">Value</th><th className="p-3">Changed</th><th className="p-3">Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "rgba(139,92,246,0.06)" }}>
                {dnsRecords.map((r) => (
                  <tr key={r.id} className={`transition-colors hover:bg-white/[0.02] ${r.changed_at ? "bg-yellow-500/5" : ""}`}>
                    <td className="p-3 text-xs text-slate-300 font-mono">{r.domain}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded text-xs text-slate-300 font-mono" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.08)" }}>{r.record_type}</span></td>
                    <td className="p-3 text-xs text-slate-400 font-mono max-w-xs truncate">{r.record_value}</td>
                    <td className="p-3 text-xs">
                      {r.changed_at ? (
                        <div>
                          <span className="text-yellow-400">Changed</span>
                          {r.previous_value && <p className="text-slate-600 line-through">{r.previous_value}</p>}
                        </div>
                      ) : <span className="text-slate-600">-</span>}
                    </td>
                    <td className="p-3 text-xs text-slate-500">{new Date(r.checked_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pagination */}
      {tab !== "overview" && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{total} records total</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 transition-colors" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)" }}><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
              className="p-2 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 transition-colors" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)" }}><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
