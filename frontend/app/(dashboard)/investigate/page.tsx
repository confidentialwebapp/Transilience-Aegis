"use client";

import { useState, useEffect } from "react";
import { api, getOrgId, type Investigation } from "@/lib/api";
import { RiskScoreMeter } from "@/components/shared/RiskScoreMeter";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  Loader2,
  Globe,
  Mail,
  Server,
  User,
  Phone,
  Link,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

const TARGET_TYPES = [
  { value: "domain", label: "Domain", icon: Globe, placeholder: "example.com" },
  { value: "ip", label: "IP Address", icon: Server, placeholder: "8.8.8.8" },
  { value: "email", label: "Email", icon: Mail, placeholder: "user@example.com" },
  { value: "url", label: "URL", icon: Link, placeholder: "https://suspicious-site.com" },
  { value: "username", label: "Username", icon: User, placeholder: "johndoe" },
  { value: "phone", label: "Phone", icon: Phone, placeholder: "+1234567890" },
];

function SourceResult({ name, data }: { name: string; data: any }) {
  const [expanded, setExpanded] = useState(true);

  const statusColor =
    data.status === "found" || data.status === "breached"
      ? "text-red-400 bg-red-500/10"
      : data.status === "clean"
      ? "text-emerald-400 bg-emerald-500/10"
      : data.status === "skipped"
      ? "text-slate-400 bg-slate-500/10"
      : data.status === "error" || data.status === "rate_limited"
      ? "text-yellow-400 bg-yellow-500/10"
      : "text-blue-400 bg-blue-500/10";

  const StatusIcon =
    data.status === "found" || data.status === "breached"
      ? AlertTriangle
      : data.status === "clean"
      ? CheckCircle2
      : data.status === "error" || data.status === "rate_limited"
      ? XCircle
      : Shield;

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-800 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
        <span className="font-medium text-sm capitalize">{name.replace(/_/g, " ")}</span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
          <StatusIcon className="w-3 h-3 inline mr-1" />
          {data.status}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* Render specific fields based on source */}
          {data.breach_count != null && (
            <div className="text-sm">
              <span className="text-red-400 font-bold">{data.breach_count}</span> breaches found
            </div>
          )}
          {data.breaches && data.breaches.length > 0 && (
            <div className="space-y-1">
              {data.breaches.map((b: any, i: number) => (
                <div key={i} className="text-xs bg-slate-900 rounded p-2">
                  <span className="font-medium text-slate-200">{b.name}</span>
                  <span className="text-slate-500 ml-2">{b.date}</span>
                  {b.data_classes && (
                    <div className="text-slate-400 mt-0.5">
                      Exposed: {b.data_classes.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {data.malicious != null && (
            <div className="flex gap-4 text-sm">
              <span className="text-red-400">{data.malicious} malicious</span>
              <span className="text-yellow-400">{data.suspicious} suspicious</span>
              <span className="text-emerald-400">{data.harmless} harmless</span>
            </div>
          )}
          {data.ports && data.ports.length > 0 && (
            <div className="text-sm">
              <span className="text-slate-400">Open ports:</span>{" "}
              <span className="text-purple-400">{data.ports.join(", ")}</span>
            </div>
          )}
          {data.vulns && data.vulns.length > 0 && (
            <div className="text-sm">
              <span className="text-red-400">Vulnerabilities:</span>{" "}
              {data.vulns.slice(0, 10).join(", ")}
            </div>
          )}
          {data.subdomains && data.subdomains.length > 0 && (
            <div className="text-sm">
              <span className="text-slate-400">{data.subdomain_count} subdomains found:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {data.subdomains.slice(0, 20).map((s: string) => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded bg-slate-900 text-purple-400">{s}</span>
                ))}
                {data.subdomain_count > 20 && (
                  <span className="text-xs text-slate-500">+{data.subdomain_count - 20} more</span>
                )}
              </div>
            </div>
          )}
          {data.found_on && data.found_on.length > 0 && (
            <div className="text-sm">
              <span className="text-slate-400">Found on:</span>{" "}
              <span className="text-purple-400">{data.found_on.join(", ")}</span>
            </div>
          )}
          {data.results && data.results.length > 0 && (
            <div className="space-y-1">
              {data.results.slice(0, 5).map((r: any, i: number) => (
                <div key={i} className="text-xs bg-slate-900 rounded p-2 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-slate-200">{r.repo || r.url || r.domain}</div>
                    {r.path && <div className="text-slate-500">{r.path}</div>}
                  </div>
                  {(r.url || r.html_url) && (
                    <a href={r.url || r.html_url} target="_blank" rel="noopener noreferrer"
                       className="text-purple-400 hover:text-purple-300 flex-shrink-0">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          {data.total_count != null && (
            <div className="text-sm text-slate-400">
              Total results: {data.total_count}
            </div>
          )}
          {data.classification && (
            <div className="text-sm">
              Classification: <span className="text-purple-400">{data.classification}</span>
            </div>
          )}
          {data.reason && (
            <div className="text-xs text-slate-500">{data.reason}</div>
          )}
          {data.detail && (
            <div className="text-xs text-slate-500">{data.detail}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InvestigatePage() {
  const [orgId, setOrg] = useState("");
  const [targetType, setTargetType] = useState("domain");
  const [targetValue, setTargetValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<Investigation | null>(null);
  const [history, setHistory] = useState<Investigation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const id = getOrgId();
    setOrg(id);
    loadHistory(id);
  }, []);

  const loadHistory = async (oid: string) => {
    setLoadingHistory(true);
    try {
      const data = await api.getInvestigationHistory(oid);
      setHistory(data.data);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetValue.trim() || scanning) return;

    setScanning(true);
    setResult(null);
    try {
      const data = await api.investigate(orgId, targetType, targetValue.trim());
      setResult(data);
      toast.success("Investigation complete");
      loadHistory(orgId);
    } catch (err: any) {
      toast.error(err.message || "Investigation failed");
    } finally {
      setScanning(false);
    }
  };

  const loadPastResult = async (inv: Investigation) => {
    if (inv.results && Object.keys(inv.results).length > 0) {
      setResult(inv);
      setTargetType(inv.target_type);
      setTargetValue(inv.target_value);
    } else {
      try {
        const full = await api.getInvestigation(orgId, inv.id);
        setResult(full);
        setTargetType(full.target_type);
        setTargetValue(full.target_value);
      } catch {
        toast.error("Failed to load investigation");
      }
    }
  };

  const currentType = TARGET_TYPES.find((t) => t.value === targetType);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Investigate</h1>
        <p className="text-sm text-slate-400 mt-1">
          Scan any URL, email, IP, domain, username, or phone number across multiple OSINT sources
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleScan} className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2 flex-wrap">
            {TARGET_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTargetType(t.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    targetType === t.value
                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder={currentType?.placeholder || "Enter target..."}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={scanning}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white rounded-lg text-sm font-medium transition-colors min-w-[140px] justify-center"
          >
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Investigate
              </>
            )}
          </button>
        </div>
        {scanning && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            Querying OSINT sources... This may take 10-30 seconds.
          </div>
        )}
      </form>

      {/* Results */}
      {result && (
        <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Results for <span className="text-purple-400">{result.target_value}</span>
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-400 capitalize">{result.target_type}</span>
                <span className="text-xs text-slate-500">|</span>
                <span className="text-xs text-slate-400">
                  {result.sources_checked?.length || 0} sources checked
                </span>
                {result.severity && <SeverityBadge severity={result.severity} />}
              </div>
            </div>
            <RiskScoreMeter score={result.risk_score} size={56} />
          </div>

          <div className="space-y-3">
            {Object.entries(result.results || {}).map(([source, data]) => (
              <SourceResult key={source} name={source} data={data} />
            ))}
          </div>
        </div>
      )}

      {/* Investigation History */}
      <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Investigation History
          </h2>
          <span className="text-xs text-slate-500">{history.length} investigations</span>
        </div>

        {loadingHistory ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-8">
            No investigations yet. Run your first scan above.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((inv) => {
              const TypeIcon =
                TARGET_TYPES.find((t) => t.value === inv.target_type)?.icon || Globe;
              return (
                <button
                  key={inv.id}
                  onClick={() => loadPastResult(inv)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
                >
                  <TypeIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{inv.target_value}</div>
                    <div className="text-xs text-slate-500">
                      {inv.target_type} | {inv.sources_checked?.length || 0} sources |{" "}
                      {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <RiskScoreMeter score={inv.risk_score} size={32} />
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      inv.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : inv.status === "failed"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-blue-500/10 text-blue-400"
                    }`}
                  >
                    {inv.status}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
