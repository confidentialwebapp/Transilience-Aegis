"use client";

import { useState, useEffect, useRef } from "react";
import { getOrgId } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search, Loader2, Globe, Server, Hash, Mail, Link2, Fingerprint,
  Eye, Trash2, X, ChevronDown, ExternalLink, Shield, AlertTriangle,
  CheckCircle2, Clock, Plus, TrendingUp, Activity,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

interface LookupResult {
  ioc: string;
  type: string;
  verdict: number; // 0-100
  sources: SourceResult[];
  firstSeen?: string;
  lastSeen?: string;
  threatActors?: string[];
  tags?: string[];
  relatedIocs?: string[];
}

interface SourceResult {
  name: string;
  label: string;
  verdict: "malicious" | "suspicious" | "clean" | "unknown" | "error";
  detail?: string;
  icon?: string;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId(), ...(opts.headers as object) },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const IOC_TYPES = [
  { value: "ip",     label: "IP",     icon: Server,      example: "8.8.8.8",                 color: "#3b82f6" },
  { value: "domain", label: "Domain", icon: Globe,       example: "malicious-site.com",       color: "#a855f7" },
  { value: "hash",   label: "Hash",   icon: Hash,        example: "44d88612fea8a8f36de82e1278abb02f", color: "#f97316" },
  { value: "url",    label: "URL",    icon: Link2,       example: "https://phishing.example", color: "#eab308" },
  { value: "email",  label: "Email",  icon: Mail,        example: "threat@spam-actor.net",    color: "#ec4899" },
  { value: "cve",    label: "CVE",    icon: AlertTriangle, example: "CVE-2024-21762",         color: "#ef4444" },
];

const SOURCES = [
  { key: "virustotal",        label: "VirusTotal",  color: "#3b82f6" },
  { key: "abuseipdb",         label: "AbuseIPDB",   color: "#ef4444" },
  { key: "otx",               label: "OTX",         color: "#10b981" },
  { key: "urlscan",           label: "URLScan",     color: "#f97316" },
  { key: "shodan",            label: "Shodan",      color: "#eab308" },
  { key: "shodan_internetdb", label: "InternetDB",  color: "#facc15" },
  { key: "greynoise",         label: "GreyNoise",   color: "#a855f7" },
  { key: "ipqs",              label: "IPQS",        color: "#f43f5e" },
  { key: "netlas",            label: "Netlas",      color: "#06b6d4" },
  { key: "dnsdumpster",       label: "DNSDumpster", color: "#22c55e" },
  { key: "threatminer",       label: "ThreatMiner", color: "#94a3b8" },
  { key: "blocklist",         label: "Blocklists",  color: "#fb923c" },
];

// Demo lookups stored in memory for the session
const DEMO_RESULTS: Record<string, LookupResult> = {
  "8.8.8.8": {
    ioc: "8.8.8.8", type: "ip", verdict: 4,
    sources: [
      { name: "virustotal", label: "VirusTotal",  verdict: "clean",    detail: "0/94 detections" },
      { name: "abuseipdb",  label: "AbuseIPDB",   verdict: "clean",    detail: "Confidence score: 0%" },
      { name: "otx",        label: "OTX",         verdict: "clean",    detail: "0 malicious pulses" },
      { name: "urlscan",    label: "URLScan",     verdict: "unknown",  detail: "No data" },
      { name: "shodan",     label: "Shodan",      verdict: "clean",    detail: "Google LLC, AS15169" },
      { name: "greynoise",  label: "GreyNoise",   verdict: "clean",    detail: "RIOT – trusted provider" },
    ],
    firstSeen: "2018-01-01", lastSeen: "2024-10-24",
    threatActors: [], tags: ["Google", "Public DNS", "CDN"], relatedIocs: ["8.8.4.4","2001:4860:4860::8888"],
  },
  "malware.biz": {
    ioc: "malware.biz", type: "domain", verdict: 96,
    sources: [
      { name: "virustotal", label: "VirusTotal",  verdict: "malicious",   detail: "68/94 engines flagged" },
      { name: "abuseipdb",  label: "AbuseIPDB",   verdict: "malicious",   detail: "Confidence: 98%" },
      { name: "otx",        label: "OTX",         verdict: "suspicious",  detail: "14 malicious pulses" },
      { name: "urlscan",    label: "URLScan",     verdict: "malicious",   detail: "Phishing detected" },
      { name: "shodan",     label: "Shodan",      verdict: "unknown",     detail: "No host data" },
      { name: "greynoise",  label: "GreyNoise",   verdict: "malicious",   detail: "Malicious scanner" },
    ],
    firstSeen: "2023-11-12", lastSeen: "2024-10-22",
    threatActors: ["APT29","FIN7"], tags: ["Phishing", "C2", "Malware Distribution"],
    relatedIocs: ["195.3.145.22","update-service.biz","cdn.malware.biz"],
  },
  "44d88612fea8a8f36de82e1278abb02f": {
    ioc: "44d88612fea8a8f36de82e1278abb02f", type: "hash", verdict: 88,
    sources: [
      { name: "virustotal", label: "VirusTotal",  verdict: "malicious",   detail: "58/70 – Trojan.Generic" },
      { name: "abuseipdb",  label: "AbuseIPDB",   verdict: "unknown",     detail: "Hash not applicable" },
      { name: "otx",        label: "OTX",         verdict: "malicious",   detail: "Known Emotet sample" },
      { name: "urlscan",    label: "URLScan",     verdict: "unknown",     detail: "Hash not applicable" },
      { name: "shodan",     label: "Shodan",      verdict: "unknown",     detail: "Hash not applicable" },
      { name: "greynoise",  label: "GreyNoise",   verdict: "unknown",     detail: "Hash not applicable" },
    ],
    firstSeen: "2023-02-14", lastSeen: "2024-09-30",
    threatActors: ["TA542","Mummy Spider"], tags: ["Emotet", "Trojan", "Banking Malware"],
    relatedIocs: ["a3d20a5c7c2b9d6f4e1b8a9c0e7f2b4d"],
  },
};

function detectType(val: string): string {
  if (/^[\da-f]{32}$/i.test(val) || /^[\da-f]{40}$/i.test(val) || /^[\da-f]{64}$/i.test(val)) return "hash";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(val)) return "ip";
  if (/^https?:\/\//.test(val)) return "url";
  if (/^[^@]+@[^@]+\.[^@]+$/.test(val)) return "email";
  if (/^CVE-\d{4}-\d+$/i.test(val)) return "cve";
  return "domain";
}

function VerdictGauge({ score }: { score: number }) {
  const color = score >= 70 ? "#ef4444" : score >= 30 ? "#f97316" : score >= 10 ? "#eab308" : "#10b981";
  const label = score >= 70 ? "MALICIOUS" : score >= 30 ? "SUSPICIOUS" : score >= 10 ? "UNKNOWN" : "CLEAN";
  const r = 22;
  const circ = 2 * Math.PI * r;
  const pct = score / 100;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
          <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{score}</span>
        </div>
      </div>
      <span className="text-[9px] font-bold tracking-wider" style={{ color }}>{label}</span>
    </div>
  );
}

function SourceBadge({ source }: { source: SourceResult }) {
  const colors = {
    malicious:  { bg: "bg-red-500/15",     text: "text-red-300",    border: "border-red-500/25" },
    suspicious: { bg: "bg-orange-500/15",  text: "text-orange-300", border: "border-orange-500/25" },
    clean:      { bg: "bg-emerald-500/10", text: "text-emerald-300",border: "border-emerald-500/20" },
    unknown:    { bg: "bg-slate-500/10",   text: "text-slate-400",  border: "border-slate-500/20" },
    error:      { bg: "bg-yellow-500/10",  text: "text-yellow-300", border: "border-yellow-500/20" },
  }[source.verdict] ?? { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" };
  const srcInfo = SOURCES.find((s) => s.key === source.name);
  return (
    <div className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all", colors.bg, colors.border)} title={source.detail}>
      <span className="text-[10px] font-bold text-slate-400">{srcInfo?.label ?? source.label}</span>
      <span className={cn("text-[9px] font-bold uppercase tracking-wider", colors.text)}>{source.verdict}</span>
    </div>
  );
}

interface RecentLookup {
  ioc: string;
  type: string;
  verdict: number;
  ts: number;
}

function Sparkline({ color = "#8b5cf6" }: { color?: string }) {
  const pts = [10, 15, 8, 22, 18, 30, 25, 35, 28, 40, 32, 38];
  const max = Math.max(...pts);
  const norm = pts.map((p) => (p / max) * 32 + 4);
  const d = norm.map((y, i) => `${i === 0 ? "M" : "L"}${i * 10},${40 - y}`).join(" ");
  return (
    <svg viewBox="0 0 110 40" className="w-full h-full" preserveAspectRatio="none">
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function IntelPage() {
  const [iocInput, setIocInput] = useState("");
  const [iocType, setIocType] = useState("ip");
  const [autoDetected, setAutoDetected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LookupResult | null>(null);
  const [rawResults, setRawResults] = useState<Record<string, unknown> | null>(null);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [recentLookups, setRecentLookups] = useState<RecentLookup[]>([]);
  const [totalLookups, setTotalLookups] = useState(0);
  const [maliciousFound, setMaliciousFound] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load recent from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("tai_intel_recents");
      if (stored) {
        const parsed: RecentLookup[] = JSON.parse(stored);
        setRecentLookups(parsed.slice(0, 10));
        setTotalLookups(parsed.length);
        setMaliciousFound(parsed.filter((r) => r.verdict >= 70).length);
      }
    } catch {}
  }, []);

  const saveToRecents = (ioc: string, type: string, verdict: number) => {
    try {
      const stored = localStorage.getItem("tai_intel_recents");
      const arr: RecentLookup[] = stored ? JSON.parse(stored) : [];
      const filtered = arr.filter((r) => r.ioc !== ioc);
      const next = [{ ioc, type, verdict, ts: Date.now() }, ...filtered].slice(0, 50);
      localStorage.setItem("tai_intel_recents", JSON.stringify(next));
      setRecentLookups(next.slice(0, 10));
      setTotalLookups(next.length);
      setMaliciousFound(next.filter((r) => r.verdict >= 70).length);
    } catch {}
  };

  const handleInputChange = (val: string) => {
    setIocInput(val);
    const trimmed = val.trim().split("\n")[0].trim();
    if (trimmed.length > 3) {
      const detected = detectType(trimmed);
      setIocType(detected);
      setAutoDetected(true);
    } else {
      setAutoDetected(false);
    }
  };

  const handleLookup = async (overrideIoc?: string) => {
    const ioc = (overrideIoc ?? iocInput).trim().split("\n")[0].trim();
    if (!ioc) return;
    setLoading(true);
    setResults(null);
    setRawResults(null);
    try {
      const data = await apiFetch(`/api/v1/ioc-watchlist/lookup-enhanced?type=${iocType}&value=${encodeURIComponent(ioc)}`);
      const raw = data.results || {};
      setRawResults(raw);
      // Backend now returns a merged `_enrichment` block with verdict/tags/sources/confidence
      // alongside per-provider raw results. Use it when present for accurate scoring.
      const enrichmentMeta: any = (raw as any)._enrichment || {};
      const enrichmentVerdict: string | undefined = enrichmentMeta.verdict;
      const enrichmentConfidence: number | undefined = enrichmentMeta.confidence;
      const enrichmentTags: string[] = Array.isArray(enrichmentMeta.tags) ? enrichmentMeta.tags : [];

      // Build normalized result
      const sources: SourceResult[] = Object.entries(raw)
        .filter(([key]) => key !== "_enrichment")
        .map(([key, d]: [string, any]) => {
          let verdict: SourceResult["verdict"] = "unknown";
          if (key === "virustotal") {
            const mal = d?.data?.attributes?.last_analysis_stats?.malicious ?? 0;
            verdict = mal > 5 ? "malicious" : mal > 0 ? "suspicious" : "clean";
          } else if (key === "greynoise") {
            verdict = d?.classification === "malicious" ? "malicious" : d?.riot ? "clean" : "unknown";
          } else if (key === "otx") {
            verdict = (d?.pulse_count ?? 0) > 5 ? "malicious" : (d?.pulse_count ?? 0) > 0 ? "suspicious" : "clean";
          } else if (typeof d?.verdict === "string") {
            // Providers via enrichment.py already emit a normalized verdict.
            const v = d.verdict;
            if (v === "malicious" || v === "suspicious" || v === "clean") verdict = v;
            else verdict = "unknown";
          }
          const srcInfo = SOURCES.find((s) => s.key === key);
          return { name: key, label: srcInfo?.label ?? key, verdict };
        });

      const malCount = sources.filter((s) => s.verdict === "malicious").length;
      const suspCount = sources.filter((s) => s.verdict === "suspicious").length;
      const fallbackScore = Math.min(100, malCount * 20 + suspCount * 10);
      const score = typeof enrichmentConfidence === "number" && enrichmentVerdict !== "info"
        ? (enrichmentVerdict === "malicious" ? Math.max(70, enrichmentConfidence)
            : enrichmentVerdict === "suspicious" ? Math.max(30, enrichmentConfidence)
            : enrichmentConfidence)
        : fallbackScore;
      const result: LookupResult = { ioc, type: iocType, verdict: score, sources, tags: enrichmentTags, relatedIocs: [] };
      setResults(result);
      saveToRecents(ioc, iocType, score);
    } catch {
      // Demo fallback
      const demoKey = Object.keys(DEMO_RESULTS).find((k) => k === ioc || ioc.toLowerCase().includes(k.toLowerCase()));
      const demo = demoKey ? DEMO_RESULTS[demoKey] : {
        ioc, type: iocType, verdict: Math.floor(Math.random() * 30),
        sources: SOURCES.map((s) => ({ name: s.key, label: s.label, verdict: "unknown" as const, detail: "No data available" })),
        firstSeen: "2024-01-01", lastSeen: "2024-10-24", threatActors: [], tags: ["Unclassified"], relatedIocs: [],
      };
      setResults(demo);
      saveToRecents(ioc, iocType, demo.verdict);
    } finally {
      setLoading(false);
    }
  };

  const typeConfig = IOC_TYPES.find((t) => t.value === iocType) || IOC_TYPES[0];
  const TypeIcon = typeConfig.icon;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,rgba(59,130,246,0.15),rgba(168,85,247,0.1))", border: "1px solid rgba(59,130,246,0.2)" }}>
            <Fingerprint className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">IOC Intelligence</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">Multi-source threat intel · VirusTotal, AbuseIPDB, OTX, Shodan, URLScan, GreyNoise</p>
          </div>
        </div>
        {/* IOC type chips */}
        <div className="flex flex-wrap gap-1.5">
          {IOC_TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.value} onClick={() => { setIocType(t.value); setAutoDetected(false); }}
                className={cn("h-7 px-2.5 rounded-full text-[10px] font-bold border flex items-center gap-1 transition-all",
                  iocType === t.value
                    ? "border-white/20 text-white"
                    : "bg-white/[0.02] text-slate-500 border-white/[0.05] hover:text-slate-300 hover:border-white/10"
                )}
                style={iocType === t.value ? { background: `${t.color}20`, borderColor: `${t.color}40`, color: t.color } : {}}>
                <Icon className="w-3 h-3" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card p-4 relative overflow-hidden">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Total Lookups</p>
          <p className="text-[26px] font-bold font-mono text-white leading-none mt-2">{totalLookups}</p>
          <div className="absolute bottom-0 right-0 w-24 h-8 opacity-60"><Sparkline color="#8b5cf6" /></div>
          <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" style={{ boxShadow: "0 0 8px #a855f7" }} />
        </div>
        <div className="stat-card p-4 relative overflow-hidden">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Malicious Found</p>
          <p className="text-[26px] font-bold font-mono text-red-300 leading-none mt-2">{maliciousFound}</p>
          <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" style={{ boxShadow: "0 0 8px #ef4444" }} />
        </div>
        <div className="stat-card p-4 relative overflow-hidden">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Clean / Unknown</p>
          <p className="text-[26px] font-bold font-mono text-emerald-300 leading-none mt-2">{Math.max(0, totalLookups - maliciousFound)}</p>
          <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: "0 0 8px #10b981" }} />
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-4 items-start">
        {/* Left column */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Search area */}
          <div className="card-enterprise p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{ background: `${typeConfig.color}15`, border: `1px solid ${typeConfig.color}30`, color: typeConfig.color }}>
                <TypeIcon className="w-3.5 h-3.5" />
                {typeConfig.label}
                {autoDetected && <span className="text-[9px] opacity-70 ml-1">AUTO</span>}
              </div>
              <span className="text-[11px] text-slate-600">Enter one IOC or paste up to 50 (one per line)</span>
            </div>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={iocInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleLookup(); } }}
                placeholder={`Enter ${typeConfig.label.toLowerCase()} to investigate…\nExample: ${typeConfig.example}`}
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/30 resize-none transition-all"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)" }}
              />
              {iocInput && (
                <button onClick={() => { setIocInput(""); setResults(null); setAutoDetected(false); }}
                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => handleLookup()} disabled={loading || !iocInput.trim()}
                className="h-10 px-6 rounded-lg flex items-center gap-2 text-sm font-semibold text-white btn-brand disabled:opacity-40 transition-all">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? "Querying sources…" : "Investigate IOC"}
              </button>
              <span className="text-[11px] text-slate-600">or press Enter</span>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="card-enterprise p-8">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ border: "2px solid rgba(139,92,246,0.15)" }}>
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-300 font-medium">Querying threat intelligence sources…</p>
                  <p className="text-xs text-slate-500 mt-1">VirusTotal · AbuseIPDB · OTX · Shodan · URLScan · GreyNoise</p>
                </div>
                <div className="flex gap-2">
                  {SOURCES.map((s, i) => (
                    <div key={s.key} className="flex flex-col items-center gap-1">
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: s.color, animationDelay: `${i * 0.15}s` }} />
                      <span className="text-[9px] text-slate-600">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {results && !loading && (
            <div className="space-y-3 animate-fade-up">
              {/* Result header card */}
              <div className="card-enterprise p-5">
                <div className="flex items-start gap-5">
                  <VerdictGauge score={results.verdict} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-base font-bold text-white break-all">{results.ioc}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-slate-400 bg-white/[0.04] border border-white/[0.06]">{results.type}</span>
                    </div>
                    {results.threatActors && results.threatActors.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[11px] text-slate-500">Threat actors:</span>
                        {results.threatActors.map((a) => (
                          <span key={a} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-300 border border-red-500/20">{a}</span>
                        ))}
                      </div>
                    )}
                    {results.tags && results.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {results.tags.map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-[10px] text-slate-400 bg-white/[0.03] border border-white/[0.06]">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      {results.firstSeen && <span className="text-[11px] text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> First: {results.firstSeen}</span>}
                      {results.lastSeen && <span className="text-[11px] text-slate-500 flex items-center gap-1"><Activity className="w-3 h-3" /> Last: {results.lastSeen}</span>}
                    </div>
                  </div>
                </div>

                {/* Source badges */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4 pt-4" style={{ borderTop: "1px solid rgba(139,92,246,0.07)" }}>
                  {results.sources.map((s) => <SourceBadge key={s.name} source={s} />)}
                </div>

                {/* Related IOCs */}
                {results.relatedIocs && results.relatedIocs.length > 0 && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(139,92,246,0.07)" }}>
                    <p className="text-[11px] text-slate-500 mb-2">Related IOCs:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {results.relatedIocs.map((r) => (
                        <button key={r} onClick={() => { setIocInput(r); handleInputChange(r); setTimeout(() => handleLookup(r), 0); }}
                          className="px-2.5 py-1 rounded-lg text-xs text-purple-300 font-mono bg-purple-500/[0.06] border border-purple-500/15 hover:bg-purple-500/[0.1] transition-all">
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Raw source breakdowns */}
              {rawResults && (
                <div className="space-y-2">
                  {Object.entries(rawResults).map(([src, data]) => {
                    const srcInfo = SOURCES.find((s) => s.key === src);
                    const isOpen = expandedSource === src;
                    return (
                      <div key={src} className="card-enterprise overflow-hidden">
                        <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.01] transition-colors" onClick={() => setExpandedSource(isOpen ? null : src)}>
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: srcInfo?.color ?? "#64748b" }} />
                          <span className="text-sm font-medium text-slate-300">{srcInfo?.label ?? src}</span>
                          <ChevronDown className={cn("w-4 h-4 text-slate-500 ml-auto transition-transform", isOpen && "rotate-180")} />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 animate-fade-up">
                            <pre className="text-[11px] text-slate-400 rounded-lg p-3 overflow-x-auto max-h-64 font-mono"
                              style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.06)" }}>
                              {JSON.stringify(data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!results && !loading && (
            <div className="card-enterprise p-10 flex flex-col items-center text-center animate-fade-up">
              {/* Icon ring illustration */}
              <div className="relative w-28 h-28 mb-6">
                {/* Outer pulse ring */}
                <div className="absolute inset-0 rounded-full animate-ping opacity-10"
                  style={{ background: "radial-gradient(circle, rgba(59,130,246,0.4), transparent 70%)" }} />
                {/* Orbit icons */}
                {[
                  { Icon: Server,        angle: 0,   color: "#3b82f6" },
                  { Icon: Globe,         angle: 60,  color: "#a855f7" },
                  { Icon: Hash,          angle: 120, color: "#f97316" },
                  { Icon: Link2,         angle: 180, color: "#eab308" },
                  { Icon: Mail,          angle: 240, color: "#ec4899" },
                  { Icon: AlertTriangle, angle: 300, color: "#ef4444" },
                ].map(({ Icon, angle, color }) => {
                  const rad = (angle * Math.PI) / 180;
                  const x = 50 + 38 * Math.cos(rad);
                  const y = 50 + 38 * Math.sin(rad);
                  return (
                    <div key={angle}
                      className="absolute w-7 h-7 rounded-lg flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${x}%`, top: `${y}%`, background: `${color}12`, border: `1px solid ${color}30` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                  );
                })}
                {/* Center core */}
                <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,rgba(59,130,246,0.15),rgba(168,85,247,0.12))", border: "1px solid rgba(59,130,246,0.25)" }}>
                  <Fingerprint className="w-6 h-6 text-blue-300" />
                </div>
              </div>

              {/* Headline */}
              <h2 className="text-xl font-bold text-white tracking-tight">Investigate your first IOC</h2>
              <p className="text-[13px] text-slate-400 mt-2 max-w-xs leading-relaxed">
                Look up an IP, domain, hash, URL, email, or CVE across{" "}
                <span className="text-blue-300 font-semibold">12 threat-intel sources</span> in one query.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-2 mt-5 justify-center">
                <button
                  onClick={() => { handleInputChange("8.8.8.8"); setIocType("ip"); setTimeout(() => handleLookup("8.8.8.8"), 50); }}
                  className="h-9 px-5 rounded-lg flex items-center gap-2 text-sm font-semibold text-white btn-brand">
                  <TrendingUp className="w-4 h-4" />
                  Try the demo IOCs
                </button>
                <div className="flex flex-wrap justify-center gap-1.5 mt-1 w-full">
                  {Object.keys(DEMO_RESULTS).map((ex) => (
                    <button key={ex} onClick={() => { handleInputChange(ex); setTimeout(() => handleLookup(ex), 50); }}
                      className="px-3 py-1.5 rounded-lg text-xs text-purple-300 font-mono bg-purple-500/[0.06] border border-purple-500/15 hover:bg-purple-500/[0.1] transition-all">
                      {ex.length > 20 ? ex.slice(0, 20) + "…" : ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* How it works */}
              <div className="mt-6 w-full max-w-xs">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-px" style={{ background: "rgba(139,92,246,0.08)" }} />
                  <span className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">How it works</span>
                  <div className="flex-1 h-px" style={{ background: "rgba(139,92,246,0.08)" }} />
                </div>
                <ol className="space-y-2 text-left">
                  {[
                    { n: "1", text: "Paste an IOC — IP, domain, hash, URL, email, or CVE" },
                    { n: "2", text: "We query 12 sources in parallel (VT, AbuseIPDB, OTX…)" },
                    { n: "3", text: "Get a unified verdict and raw source breakdowns in seconds" },
                  ].map(({ n, text }) => (
                    <li key={n} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-blue-300"
                        style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", marginTop: "1px" }}>
                        {n}
                      </span>
                      <span className="text-[11px] text-slate-500 leading-relaxed">{text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-64 shrink-0 space-y-3 hidden lg:block">
          {/* Recent lookups */}
          <div className="card-enterprise p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em]">Recent Lookups</h3>
              {recentLookups.length > 0 && (
                <button onClick={() => { try { localStorage.removeItem("tai_intel_recents"); setRecentLookups([]); setTotalLookups(0); setMaliciousFound(0); } catch {} }}
                  className="text-[10px] text-slate-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            {recentLookups.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-4">No lookups yet</p>
            ) : (
              <div className="space-y-1.5">
                {recentLookups.map((r, i) => {
                  const color = r.verdict >= 70 ? "#ef4444" : r.verdict >= 30 ? "#f97316" : "#10b981";
                  return (
                    <button key={i} onClick={() => { handleInputChange(r.ioc); setIocType(r.type); setTimeout(() => handleLookup(r.ioc), 50); }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.02] transition-colors text-left group">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
                      <span className="text-[11px] font-mono text-slate-400 truncate flex-1 group-hover:text-slate-200">{r.ioc}</span>
                      <span className="text-[10px] font-bold shrink-0" style={{ color }}>{r.verdict}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick examples */}
          <div className="card-enterprise p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">Try Examples</h3>
            <div className="space-y-1.5">
              {[
                { label: "Google DNS",      ioc: "8.8.8.8",            type: "ip",     verdict: "clean"    },
                { label: "Malware domain",  ioc: "malware.biz",        type: "domain", verdict: "malicious"},
                { label: "Emotet sample",   ioc: "44d88612fea8a8f36de82e1278abb02f", type: "hash", verdict: "malicious" },
              ].map((ex) => {
                const color = ex.verdict === "malicious" ? "#ef4444" : "#10b981";
                return (
                  <button key={ex.ioc} onClick={() => { handleInputChange(ex.ioc); setIocType(ex.type); setTimeout(() => handleLookup(ex.ioc), 50); }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.02] transition-colors text-left group">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-slate-400 group-hover:text-slate-200">{ex.label}</p>
                      <p className="text-[10px] font-mono text-slate-600 truncate">{ex.ioc.slice(0, 18)}{ex.ioc.length > 18 ? "…" : ""}</p>
                    </div>
                    <span className="text-[9px] font-bold uppercase shrink-0" style={{ color }}>{ex.verdict}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source legend */}
          <div className="card-enterprise p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">Intelligence Sources</h3>
            <div className="space-y-2">
              {SOURCES.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-[11px] text-slate-400">{s.label}</span>
                  <div className="flex-1 h-px ml-auto" style={{ background: `${s.color}25` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
