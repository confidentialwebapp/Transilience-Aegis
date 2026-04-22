"use client";

import { InfinityLoader } from "@/components/InfinityLoader";

import { useState, useEffect } from "react";
import { api, getOrgId, type Investigation } from "@/lib/api";
import { modelLabel } from "@/lib/ai-models";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Search, Globe, Mail, Server,
  User, Phone, Link2, Shield,
  CheckCircle2, XCircle, AlertTriangle, ExternalLink,
  Download, Clock, ChevronDown, X,
  Activity, Hash, Wifi, Database,
  Eye, Sparkles, ShieldAlert, ListChecks, Target
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId(), ...(opts.headers as object) },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const TARGET_TYPES = [
  { value: "domain",   label: "Domain",   icon: Globe,   placeholder: "example.com",            color: "#a855f7" },
  { value: "ip",       label: "IP",        icon: Server,  placeholder: "192.168.1.1",            color: "#3b82f6" },
  { value: "email",    label: "Email",     icon: Mail,    placeholder: "user@domain.com",         color: "#ec4899" },
  { value: "username", label: "Username",  icon: User,    placeholder: "johndoe",                 color: "#f97316" },
  { value: "hash",     label: "Hash",      icon: Hash,    placeholder: "md5/sha1/sha256",          color: "#eab308" },
  { value: "phone",    label: "Phone",     icon: Phone,   placeholder: "+1 (555) 000-0000",        color: "#10b981" },
];

const ALL_SOURCES = [
  { key: "shodan",             label: "Shodan",            icon: Wifi,          desc: "Ports, services, banners",         color: "#ef4444" },
  { key: "shodan_internetdb",  label: "InternetDB",        icon: Database,      desc: "Free Shodan CPE/CVE lookup",       color: "#f43f5e" },
  { key: "blocklist",          label: "Blocklists",        icon: Shield,        desc: "Feodo/OpenPhish/ET/Tor feeds",     color: "#6366f1" },
  { key: "malwarebazaar",      label: "MalwareBazaar",     icon: Hash,          desc: "Hash → malware family + YARA",     color: "#eab308" },
  { key: "haveibeenpwned",     label: "HaveIBeenPwned",    icon: Shield,        desc: "Data breach lookup",               color: "#3b82f6" },
  { key: "github",             label: "GitHub",            icon: Database,      desc: "Leaked code & secrets",            color: "#64748b" },
  { key: "whois",              label: "WHOIS",             icon: Globe,         desc: "Registration details",             color: "#a855f7" },
  { key: "dns",                label: "DNS",               icon: Server,        desc: "A/AAAA/MX/TXT records",            color: "#10b981" },
  { key: "virustotal",         label: "VirusTotal",        icon: AlertTriangle, desc: "Malware & reputation",             color: "#eab308" },
  { key: "urlscan",            label: "URLScan",           icon: Link2,         desc: "URL/screenshot analysis",          color: "#f97316" },
  { key: "greynoise",          label: "GreyNoise",         icon: Activity,      desc: "Internet noise classification",    color: "#8b5cf6" },
  { key: "threatfox",          label: "ThreatFox",         icon: AlertTriangle, desc: "Abuse.ch IOC database",            color: "#dc2626" },
  { key: "urlhaus",            label: "URLhaus",           icon: Link2,         desc: "Abuse.ch malicious URLs",          color: "#e11d48" },
  { key: "crtsh",              label: "crt.sh",            icon: Eye,           desc: "Certificate transparency logs",    color: "#0ea5e9" },
  { key: "geolocation",        label: "Geolocation",       icon: Globe,         desc: "IP country/ISP/ASN",               color: "#14b8a6" },
  { key: "intelx",             label: "IntelX",            icon: Database,      desc: "Deep/dark web archives",           color: "#a855f7" },
  { key: "otx",                label: "AlienVault OTX",    icon: Shield,        desc: "Threat intel pulses + malware",    color: "#22c55e" },
  { key: "abuseipdb",          label: "AbuseIPDB",         icon: Shield,        desc: "IP abuse reports + confidence",    color: "#f59e0b" },
  { key: "netlas",             label: "Netlas",            icon: Server,        desc: "Internet-wide passive recon",      color: "#06b6d4" },
  { key: "ipqs",               label: "IPQualityScore",    icon: AlertTriangle, desc: "URL/email/phone fraud scoring",    color: "#d946ef" },
  { key: "subfinder",          label: "Subfinder",         icon: Server,        desc: "Passive subdomain enumeration",    color: "#84cc16" },
  { key: "dnstwist",           label: "dnstwist",          icon: AlertTriangle, desc: "Typosquat + lookalike domains",    color: "#f97316" },
  { key: "theharvester",       label: "theHarvester",      icon: Mail,          desc: "Emails/hosts/ASNs via OSINT",      color: "#ec4899" },
  { key: "nmap",               label: "nmap",              icon: Wifi,          desc: "Port + service detection",         color: "#ef4444" },
  { key: "nuclei",             label: "nuclei",            icon: Shield,        desc: "Templated vulnerability scan",     color: "#dc2626" },
  { key: "sherlock",           label: "sherlock",          icon: User,          desc: "Username across 400+ sites",       color: "#0ea5e9" },
  { key: "holehe",             label: "holehe",            icon: Mail,          desc: "Email → sites it's registered on", color: "#06b6d4" },
  { key: "amass",              label: "amass",             icon: Server,        desc: "Comprehensive DNS enum",           color: "#65a30d" },
  { key: "whatweb",            label: "WhatWeb",           icon: Globe,         desc: "Web tech fingerprinting",          color: "#d97706" },
  { key: "waybackurls",        label: "waybackurls",       icon: Clock,         desc: "Archived URLs from Wayback",       color: "#9333ea" },
  { key: "naabu",              label: "naabu",             icon: Wifi,          desc: "Fast top-ports scanner",           color: "#b91c1c" },
];

type SourceStatus = "idle" | "pending" | "running" | "done" | "failed" | "skipped";

interface SourceState {
  status: SourceStatus;
  data: unknown;
}

// ── Demo result data ─────────────────────────────────────────────────────────
const DEMO_INVESTIGATION: Record<string, unknown> = {
  shodan: {
    status: "found", ports: [22, 80, 443, 8080, 3306], org: "Amazon Technologies Inc.",
    country: "US", isp: "Amazon.com, Inc.", os: "Ubuntu 22.04",
    services: [
      { port: 22,   proto: "ssh",   banner: "OpenSSH_8.9p1 Ubuntu" },
      { port: 80,   proto: "http",  banner: "nginx/1.24.0" },
      { port: 443,  proto: "https", banner: "nginx/1.24.0" },
      { port: 8080, proto: "http",  banner: "Apache Tomcat/10.1.7" },
    ],
    vulns: ["CVE-2023-44487","CVE-2024-21762"],
  },
  whois: {
    status: "found", registrar: "GoDaddy LLC", registration: "2019-03-14",
    expiration: "2025-03-14", updated: "2023-11-01",
    nameservers: ["ns1.example.com","ns2.example.com"],
    country: "US", org: "Example Corp", admin_email: "admin@example.com",
  },
  dns: {
    status: "found",
    A: ["93.184.216.34"],
    AAAA: ["2606:2800:220:1:248:1893:25c8:1946"],
    MX: ["10 mail.example.com","20 mail2.example.com"],
    TXT: ["v=spf1 include:_spf.google.com ~all","_dmarc: v=DMARC1; p=reject;"],
    NS: ["a.iana-servers.net","b.iana-servers.net"],
  },
  haveibeenpwned: {
    status: "breached", breach_count: 3,
    breaches: [
      { name: "Adobe", date: "2013-10-04", data_classes: ["Email addresses","Passwords","Usernames"] },
      { name: "LinkedIn", date: "2012-05-05", data_classes: ["Email addresses","Passwords"] },
      { name: "Dropbox", date: "2012-07-01", data_classes: ["Email addresses","Passwords"] },
    ],
  },
  virustotal: {
    status: "found",
    data: { attributes: { last_analysis_stats: { malicious: 3, suspicious: 2, harmless: 87, undetected: 2 } } },
    categories: ["phishing", "malware distribution"],
  },
  urlscan: {
    status: "found", verdict: "malicious", score: 72,
    technologies: ["Cloudflare", "jQuery 3.6", "Bootstrap 5", "Google Analytics"],
    screenshot: null,
    url: "https://urlscan.io/result/abc123",
  },
  greynoise: {
    status: "found", classification: "malicious", noise: true, riot: false,
    name: "ShadowServer", country: "CN", last_seen: "2024-10-24",
    tags: ["Mirai", "Scanner", "CVE-2024-21762"],
  },
  github: {
    status: "found", total_count: 4,
    results: [
      { repo: "user/leaked-configs", path: "config.env", url: "https://github.com/user/leaked-configs" },
      { repo: "company/old-scripts", path: "deploy.sh", url: "https://github.com/company/old-scripts" },
    ],
  },
};

function AIAnalysisCard({
  summary,
  run,
}: {
  summary: NonNullable<Investigation["ai_summary"]>;
  run?: { total_ms?: number; modal_runtime_ms?: number; modal_tools?: string[]; modal_containers_stopped?: boolean };
}) {
  if (summary.error) {
    return (
      <div className="rounded-xl p-4 border border-amber-500/15 bg-amber-500/[0.03]">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span className="text-[11px] font-bold tracking-wider text-amber-300 uppercase">AI Analysis unavailable</span>
        </div>
        <p className="text-[11px] text-slate-500">{summary.error}</p>
      </div>
    );
  }

  const verdict = summary.risk_verdict ?? "info";
  const verdictColor = {
    critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#10b981", info: "#64748b",
  }[verdict];
  const sevColor = (s?: string) => ({
    critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#10b981", info: "#64748b",
  }[s ?? "info"] ?? "#64748b");

  return (
    <div className="rounded-xl p-5 border relative overflow-hidden"
      style={{
        borderColor: "rgba(139,92,246,0.18)",
        background: "linear-gradient(180deg, rgba(139,92,246,0.06) 0%, rgba(236,72,153,0.02) 100%)",
      }}>
      <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)" }} />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.12)" }}>
            <Sparkles className="w-3.5 h-3.5 text-violet-300" />
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wider text-violet-300 uppercase">Transilience AI Analysis</div>
            <div className="text-[10px] text-slate-500">
              {summary._meta?.cached ? "cached" : modelLabel(summary._meta?.model)} · {summary._meta?.duration_ms ? `${Math.round(summary._meta.duration_ms / 100) / 10}s` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded text-[10px] font-bold uppercase border"
            style={{ color: verdictColor, borderColor: `${verdictColor}40`, background: `${verdictColor}10` }}>
            {verdict}
          </span>
          {summary.confidence && (
            <span className="px-2 py-1 rounded text-[10px] font-medium text-slate-400 bg-white/[0.03] border border-white/[0.06]">
              {summary.confidence} confidence
            </span>
          )}
        </div>
      </div>

      {summary.executive_summary && (
        <p className="text-[13px] leading-relaxed text-slate-200 mb-4">{summary.executive_summary}</p>
      )}

      {summary.contradictions && (
        <div className="mb-4 rounded-lg p-2.5 border border-amber-500/20 bg-amber-500/[0.04]">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3 h-3 text-amber-300" />
            <span className="text-[10px] font-bold uppercase text-amber-300 tracking-wider">Contradictions</span>
          </div>
          <p className="text-[11px] text-slate-300">{summary.contradictions}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summary.key_findings && summary.key_findings.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldAlert className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Key findings</span>
            </div>
            <ul className="space-y-1.5">
              {summary.key_findings.slice(0, 8).map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px]">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: sevColor(f.severity) }} />
                  <div>
                    <span className="text-slate-300">{f.finding}</span>
                    <span className="text-slate-600 text-[10px] font-mono ml-1.5">· {f.source}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.recommended_actions && summary.recommended_actions.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ListChecks className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Recommended actions</span>
            </div>
            <ul className="space-y-1.5">
              {summary.recommended_actions.slice(0, 5).map((a, i) => {
                const uc = a.urgency === "now" ? "#ef4444" : a.urgency === "today" ? "#f97316" : "#eab308";
                return (
                  <li key={i} className="flex items-start gap-2 text-[12px]">
                    <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border"
                      style={{ color: uc, borderColor: `${uc}40`, background: `${uc}10` }}>{a.urgency}</span>
                    <span className="text-slate-300">
                      {a.action}
                      {a.owner && <span className="text-slate-600 text-[10px] ml-1.5">· {a.owner}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {summary.indicators && summary.indicators.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/[0.05]">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Indicators to pivot on</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {summary.indicators.slice(0, 12).map((ind, i) => (
              <span key={i} className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-slate-300 break-all">
                {ind}
              </span>
            ))}
          </div>
        </div>
      )}

      {run && (
        <div className="mt-4 pt-3 border-t border-white/[0.05] flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-500">
          {run.modal_containers_stopped && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Modal containers shut down
            </span>
          )}
          {typeof run.modal_runtime_ms === "number" && run.modal_runtime_ms > 0 && (
            <span>
              Modal runtime: <span className="font-mono text-slate-400">{(run.modal_runtime_ms / 1000).toFixed(1)}s</span>
            </span>
          )}
          {typeof run.total_ms === "number" && (
            <span>
              Total scan: <span className="font-mono text-slate-400">{(run.total_ms / 1000).toFixed(1)}s</span>
            </span>
          )}
          {run.modal_tools && run.modal_tools.length > 0 && (
            <span>
              Kali tools run: <span className="font-mono text-slate-400">{run.modal_tools.join(", ")}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  const label = score >= 70 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";
  const color = score >= 70 ? "#ef4444" : score >= 50 ? "#f97316" : score >= 30 ? "#eab308" : "#10b981";
  const r = 18;
  const circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-12 h-12">
        <svg width="48" height="48" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3.5" />
          <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="3.5"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 5px ${color}60)` }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white">{score}</span>
        </div>
      </div>
      <span className="text-[9px] font-bold tracking-wider" style={{ color }}>{label}</span>
    </div>
  );
}

function SourceStatusIcon({ status }: { status: SourceStatus }) {
  if (status === "running") return <InfinityLoader size={14} />;
  if (status === "done") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === "failed") return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  if (status === "skipped") return <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />;
  if (status === "pending") return <div className="w-3.5 h-3.5 rounded-full border border-slate-500 animate-pulse" />;
  return <div className="w-3.5 h-3.5 rounded-full border border-slate-700" />;
}

function ShodanPanel({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[["Organization", data.org],["Country", data.country],["ISP", data.isp],["OS", data.os ?? "Unknown"]].map(([k, v]) => (
          <div key={k} className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.07)" }}>
            <p className="text-[10px] text-slate-600">{k}</p>
            <p className="text-xs text-slate-300 mt-0.5">{v}</p>
          </div>
        ))}
      </div>
      {data.ports && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Open Ports</p>
          <div className="flex flex-wrap gap-1.5">
            {data.ports.map((p: number) => (
              <span key={p} className="px-2 py-1 rounded-md text-xs font-mono text-blue-300 bg-blue-500/10 border border-blue-500/15">{p}</span>
            ))}
          </div>
        </div>
      )}
      {data.services && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Services</p>
          <div className="space-y-1.5">
            {data.services.map((s: any) => (
              <div key={s.port} className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.06)" }}>
                <span className="font-mono text-blue-300 w-12">{s.port}/{s.proto}</span>
                <span className="text-slate-400">{s.banner}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.vulns && data.vulns.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Vulnerabilities</p>
          <div className="flex flex-wrap gap-1.5">
            {data.vulns.map((v: string) => (
              <span key={v} className="px-2 py-0.5 rounded text-[10px] font-mono text-red-300 bg-red-500/10 border border-red-500/15">{v}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WhoisPanel({ data }: { data: any }) {
  const fields = [
    ["Registrar", data.registrar],
    ["Registered", data.registration ? new Date(data.registration).toLocaleDateString() : null],
    ["Expires", data.expiration ? new Date(data.expiration).toLocaleDateString() : null],
    ["Updated", data.updated ? new Date(data.updated).toLocaleDateString() : null],
    ["Organization", data.org],
    ["Country", data.country],
    ["Admin Email", data.admin_email],
  ].filter(([, v]) => v);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([k, v]) => (
          <div key={k as string} className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.07)" }}>
            <p className="text-[10px] text-slate-600">{k}</p>
            <p className="text-xs text-slate-300 mt-0.5">{v}</p>
          </div>
        ))}
      </div>
      {data.nameservers && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Nameservers</p>
          <div className="space-y-1">
            {data.nameservers.map((ns: string) => (
              <p key={ns} className="text-xs font-mono text-purple-300">{ns}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DnsPanel({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      {(["A","AAAA","MX","TXT","NS"] as const).filter((t) => data[t]?.length).map((type) => (
        <div key={type}>
          <p className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/15">{type}</span>
          </p>
          <div className="space-y-1">
            {data[type].map((r: string, i: number) => (
              <p key={i} className="text-xs font-mono text-slate-300 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.015)" }}>{r}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HibpPanel({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <p className="text-sm font-semibold text-red-300">{data.breach_count} data breaches found</p>
      </div>
      {data.breaches?.map((b: any) => (
        <div key={b.name} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.07)" }}>
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-slate-200">{b.name}</p>
            <span className="text-[10px] text-slate-500 font-mono">{b.date}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {b.data_classes.map((d: string) => (
              <span key={d} className="px-1.5 py-0.5 rounded text-[10px] text-slate-400 bg-white/[0.03] border border-white/[0.06]">{d}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MalwareBazaarPanel({ data }: { data: any }) {
  if (data?.status !== "found") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-300">{data?.detail || "Not seen in MalwareBazaar"}</p>
      </div>
    );
  }
  const fields = [
    ["File Name", data.file_name],
    ["File Type", data.file_type],
    ["Size", data.file_size ? `${data.file_size} bytes` : null],
    ["Signature", data.signature],
    ["First Seen", data.first_seen],
    ["Last Seen", data.last_seen],
    ["Delivery", data.delivery_method],
    ["Reporter", data.reporter],
  ].filter(([, v]) => v);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)" }}>
        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
        <p className="text-sm font-semibold text-yellow-300">
          Known malware sample {data.signature ? `— ${data.signature}` : ""}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([k, v]) => (
          <div key={k as string} className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(234,179,8,0.1)" }}>
            <p className="text-[10px] text-slate-600">{k}</p>
            <p className="text-xs text-slate-300 mt-0.5">{v}</p>
          </div>
        ))}
      </div>
      {data.tags?.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((t: string) => (
              <span key={t} className="px-2 py-0.5 rounded text-[10px] font-mono text-yellow-300 bg-yellow-500/10 border border-yellow-500/15">{t}</span>
            ))}
          </div>
        </div>
      )}
      {data.yara_rules?.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">YARA Rules</p>
          <div className="space-y-1">
            {data.yara_rules.map((y: any) => (
              <p key={y.rule} className="text-xs font-mono text-slate-300 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.015)" }}>
                {y.rule} <span className="text-slate-600">by {y.author}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BlocklistPanel({ data }: { data: any }) {
  if (data?.status !== "found") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-300">{data?.detail || "No open-blocklist hits"}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <p className="text-sm font-semibold text-red-300">
          {data.hit_count} hit{data.hit_count === 1 ? "" : "s"} across {data.sources?.length ?? 0} feed{data.sources?.length === 1 ? "" : "s"}
        </p>
      </div>
      {data.sources?.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Source feeds</p>
          <div className="flex flex-wrap gap-1.5">
            {data.sources.map((s: string) => (
              <span key={s} className="px-2 py-0.5 rounded text-[10px] font-mono text-red-300 bg-red-500/10 border border-red-500/15">{s}</span>
            ))}
          </div>
        </div>
      )}
      {data.categories?.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {data.categories.map((c: string) => (
              <span key={c} className="px-2 py-0.5 rounded text-[10px] text-slate-300 bg-white/[0.03] border border-white/[0.06]">{c}</span>
            ))}
          </div>
        </div>
      )}
      {data.hits?.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Recent entries</p>
          <div className="space-y-1.5">
            {data.hits.slice(0, 8).map((h: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(239,68,68,0.08)" }}>
                <span className="font-mono text-red-300 w-28 truncate">{h.source}</span>
                <span className="text-slate-400 flex-1">{h.category || "—"}</span>
                <span className="text-slate-600 text-[10px] font-mono">{h.confidence}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InternetDbPanel({ data }: { data: any }) {
  if (data?.status !== "found") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-300">{data?.detail || "No InternetDB record"}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {data.ports?.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Open Ports ({data.ports.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {data.ports.map((p: number) => (
              <span key={p} className="px-2 py-1 rounded-md text-xs font-mono text-rose-300 bg-rose-500/10 border border-rose-500/15">{p}</span>
            ))}
          </div>
        </div>
      )}
      {data.vulns?.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Vulnerabilities</p>
          <div className="flex flex-wrap gap-1.5">
            {data.vulns.slice(0, 30).map((v: string) => (
              <span key={v} className="px-2 py-0.5 rounded text-[10px] font-mono text-red-300 bg-red-500/10 border border-red-500/15">{v}</span>
            ))}
          </div>
        </div>
      )}
      {data.cpes?.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Detected CPEs</p>
          <div className="space-y-1">
            {data.cpes.slice(0, 10).map((c: string) => (
              <p key={c} className="text-xs font-mono text-slate-300 px-3 py-1.5 rounded-lg truncate" style={{ background: "rgba(255,255,255,0.015)" }}>{c}</p>
            ))}
          </div>
        </div>
      )}
      {data.hostnames?.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Hostnames</p>
          <div className="flex flex-wrap gap-1.5">
            {data.hostnames.map((h: string) => (
              <span key={h} className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 bg-white/[0.03] border border-white/[0.06]">{h}</span>
            ))}
          </div>
        </div>
      )}
      {data.tags?.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 mb-1.5">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((t: string) => (
              <span key={t} className="px-2 py-0.5 rounded text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/15">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GenericPanel({ data }: { data: any }) {
  return (
    <pre className="text-[11px] text-slate-400 rounded-xl p-4 overflow-x-auto max-h-64 font-mono" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.06)" }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function SourcePanel({ source, data }: { source: string; data: any }) {
  switch (source) {
    case "shodan":            return <ShodanPanel data={data} />;
    case "shodan_internetdb": return <InternetDbPanel data={data} />;
    case "blocklist":         return <BlocklistPanel data={data} />;
    case "malwarebazaar":     return <MalwareBazaarPanel data={data} />;
    case "whois":             return <WhoisPanel data={data} />;
    case "dns":               return <DnsPanel data={data} />;
    case "haveibeenpwned":    return <HibpPanel data={data} />;
    default:                  return <GenericPanel data={data} />;
  }
}

export default function InvestigatePage() {
  const [orgId, setOrg] = useState("");
  const [targetType, setTargetType] = useState("domain");
  const [targetValue, setTargetValue] = useState("");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set(["shodan","whois","dns","haveibeenpwned","virustotal","greynoise"]));
  const [scanning, setScanning] = useState(false);
  const [sourceStatuses, setSourceStatuses] = useState<Record<string, SourceState>>({});
  const [result, setResult] = useState<Investigation | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
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
      setHistory(data.data || []);
    } catch {}
    finally { setLoadingHistory(false); }
  };

  const toggleSource = (key: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  };

  const runScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetValue.trim() || scanning) return;
    setScanning(true);
    setResult(null);
    setActiveTab("");

    // Initialize source statuses
    const initial: Record<string, SourceState> = {};
    [...selectedSources].forEach((s) => { initial[s] = { status: "pending", data: null }; });
    setSourceStatuses(initial);

    // Simulate sequential source completion for UX
    const sourceArr = [...selectedSources];
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    try {
      // Mark first as running immediately
      setSourceStatuses((prev) => ({ ...prev, [sourceArr[0]]: { ...prev[sourceArr[0]], status: "running" } }));

      const data = await api.investigate(orgId, targetType, targetValue.trim());

      // Backend returns every source it actually ran (API + Modal/Kali).
      // Surface all of them — not just the user's pre-selection — so the
      // Intelligence Sources panel reflects reality.
      const returned = Object.keys((data.results as Record<string, unknown>) ?? {})
        .filter((k) => !k.startsWith("_"));
      const checked = (data.sources_checked as string[] | undefined) ?? [];
      // map `haveibeenpwned` tab key used by the UI to the `hibp` results key
      const srcKey = (k: string) => (k === "haveibeenpwned" ? "hibp" : k);
      const allKeys = Array.from(new Set<string>([...sourceArr, ...checked, ...returned]));

      // Animate completion across the union
      const merged: Record<string, SourceState> = {};
      for (const s of allKeys) {
        const d = (data.results as Record<string, unknown>)?.[srcKey(s)] ?? (data.results as Record<string, unknown>)?.[s];
        merged[s] = { status: d ? "done" : "skipped", data: d ?? null };
      }
      for (let i = 0; i < allKeys.length; i++) {
        await delay(60);
        setSourceStatuses((prev) => ({ ...prev, [allKeys[i]]: merged[allKeys[i]] }));
      }

      setResult(data);
      const firstDone = allKeys.find((s) => merged[s].status === "done");
      setActiveTab(firstDone ?? allKeys[0] ?? "");
      toast.success("Investigation complete");
      loadHistory(orgId);
    } catch {
      // Demo mode
      for (let i = 0; i < sourceArr.length; i++) {
        await delay(150 + Math.random() * 100);
        const src = sourceArr[i];
        const demoData = DEMO_INVESTIGATION[src] ?? null;
        setSourceStatuses((prev) => ({
          ...prev,
          [src]: { status: demoData ? "done" : "skipped", data: demoData },
          ...(i + 1 < sourceArr.length ? { [sourceArr[i + 1]]: { ...prev[sourceArr[i + 1]], status: "running" } } : {}),
        }));
      }
      const demoResult = {
        id: "demo-1", target_type: targetType, target_value: targetValue.trim(),
        status: "completed", risk_score: 68, severity: "high",
        sources_checked: sourceArr,
        results: Object.fromEntries(sourceArr.map((s) => [s, DEMO_INVESTIGATION[s] ?? null]).filter(([, v]) => v)),
        created_at: new Date().toISOString(),
      } as unknown as Investigation;
      setResult(demoResult);
      const firstDone = sourceArr.find((s) => DEMO_INVESTIGATION[s]);
      setActiveTab(firstDone ?? sourceArr[0]);
    } finally {
      setScanning(false);
    }
  };

  const loadPastResult = async (inv: Investigation) => {
    setResult(inv);
    setTargetType(inv.target_type);
    setTargetValue(inv.target_value);
    const srcs = inv.sources_checked ?? [];
    const statuses: Record<string, SourceState> = {};
    srcs.forEach((s) => { statuses[s] = { status: "done", data: (inv.results as Record<string, unknown>)?.[s] ?? null }; });
    setSourceStatuses(statuses);
    const firstDone = srcs.find((s) => (inv.results as Record<string, unknown>)?.[s]);
    setActiveTab(firstDone ?? srcs[0] ?? "");
  };

  const currentType = TARGET_TYPES.find((t) => t.value === targetType) ?? TARGET_TYPES[0];
  const TypeIcon = currentType.icon;

  const resultSources: string[] = result ? ((result.sources_checked as string[] | undefined) ?? Object.keys(sourceStatuses)) : [];
  const doneCount = Object.values(sourceStatuses).filter((s) => s.status === "done").length;
  const totalCount = Object.keys(sourceStatuses).length;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,rgba(168,85,247,0.15),rgba(59,130,246,0.1))", border: "1px solid rgba(168,85,247,0.2)" }}>
          <Search className="w-5 h-5 text-purple-300" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Investigate</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">OSINT aggregation across 10+ sources · Domains, IPs, Emails, Usernames, Hashes</p>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-4 items-start">
        {/* Left main */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Target form */}
          <div className="card-enterprise p-5">
            {/* Type selector */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {TARGET_TYPES.map((t) => {
                const Icon = t.icon;
                const active = targetType === t.value;
                return (
                  <button key={t.value} type="button" onClick={() => setTargetType(t.value)}
                    className={cn("h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold border transition-all",
                      active ? "text-white border-transparent" : "text-slate-500 bg-white/[0.02] border-white/[0.05] hover:text-slate-300 hover:border-white/10"
                    )}
                    style={active ? { background: `${t.color}20`, borderColor: `${t.color}40`, color: t.color } : {}}>
                    <Icon className="w-3.5 h-3.5" />{t.label}
                  </button>
                );
              })}
            </div>

            {/* Target input */}
            <form onSubmit={runScan} className="flex gap-2">
              <div className="flex-1 relative">
                <TypeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder={currentType.placeholder}
                  className="w-full h-12 pl-10 pr-4 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/30 transition-all"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}
                  required
                />
              </div>
              <button type="submit" disabled={scanning || !targetValue.trim()}
                className="h-12 px-6 rounded-xl flex items-center gap-2 text-sm font-semibold text-white btn-brand disabled:opacity-40 transition-all min-w-[140px] justify-center">
                {scanning ? <InfinityLoader size={16} /> : <Search className="w-4 h-4" />}
                {scanning ? `${doneCount}/${totalCount} sources` : "Investigate"}
              </button>
            </form>
          </div>

          {/* Source selector */}
          <div className="card-enterprise p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em]">Intelligence Sources</h3>
              <span className="text-[11px] text-slate-600">{selectedSources.size} selected</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {ALL_SOURCES.map((src) => {
                const Icon = src.icon;
                const active = selectedSources.has(src.key);
                const status = sourceStatuses[src.key];
                return (
                  <button key={src.key} onClick={() => toggleSource(src.key)}
                    className={cn("relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all",
                      active
                        ? "bg-white/[0.03] border-purple-500/20 hover:border-purple-500/35"
                        : "bg-white/[0.01] border-white/[0.04] hover:border-white/10 opacity-50"
                    )}>
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg"
                      style={{ background: active ? `${src.color}15` : "transparent" }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: active ? src.color : "#64748b" }} />
                    </div>
                    <span className={cn("text-[10px] font-semibold", active ? "text-slate-300" : "text-slate-600")}>{src.label}</span>
                    {status && (
                      <div className="absolute top-1.5 right-1.5">
                        <SourceStatusIcon status={status.status} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Progress bar when scanning */}
            {scanning && totalCount > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-slate-500">Querying sources…</span>
                  <span className="text-[11px] text-slate-500">{doneCount}/{totalCount}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`, background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(sourceStatuses).map(([key, s]) => {
                    const srcInfo = ALL_SOURCES.find((x) => x.key === key);
                    return (
                      <div key={key} className="flex items-center gap-1">
                        <SourceStatusIcon status={s.status} />
                        <span className="text-[10px] text-slate-500">{srcInfo?.label ?? key}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Results tabs */}
          {result && (
            <div className="space-y-3 animate-fade-up">
              {/* Summary header */}
              <div className="card-enterprise p-4">
                <div className="flex items-start gap-4">
                  <RiskBadge score={result.risk_score ?? 0} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-base font-bold text-white break-all">{result.target_value}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-slate-400 bg-white/[0.04] border border-white/[0.06]">{result.target_type}</span>
                      {result.severity && (
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border",
                          result.severity === "critical" ? "bg-red-500/10 text-red-300 border-red-500/25" :
                          result.severity === "high" ? "bg-orange-500/10 text-orange-300 border-orange-500/25" :
                          "bg-yellow-500/10 text-yellow-300 border-yellow-500/25"
                        )}>{result.severity.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {doneCount} sources completed
                      </span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(result.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => { toast.info("PDF export coming soon"); }}
                    className="h-8 px-3 rounded-lg flex items-center gap-2 text-xs font-semibold text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white hover:bg-white/[0.04] transition-all shrink-0">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </div>
              </div>

              {/* AI Analysis card — prefer fresh `ai_summary`, else read from persisted `results._ai_summary` */}
              {(() => {
                const ai = result.ai_summary ?? (result.results as Record<string, unknown>)?._ai_summary;
                const run = (result.results as Record<string, unknown>)?._run as
                  | { total_ms?: number; modal_runtime_ms?: number; modal_tools?: string[]; modal_containers_stopped?: boolean }
                  | undefined;
                return ai ? <AIAnalysisCard summary={ai as NonNullable<Investigation["ai_summary"]>} run={run} /> : null;
              })()}

              {/* Tabs */}
              <div className="flex gap-0 overflow-x-auto" style={{ borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
                {resultSources.filter((s) => sourceStatuses[s]?.status === "done" && Boolean(sourceStatuses[s]?.data)).map((src) => {
                  const srcInfo = ALL_SOURCES.find((x) => x.key === src);
                  const active = activeTab === src;
                  return (
                    <button key={src} onClick={() => setActiveTab(src)}
                      className={cn("relative px-4 h-10 flex items-center gap-2 text-sm font-medium transition-all shrink-0",
                        active ? "text-white" : "text-slate-500 hover:text-slate-300")}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: srcInfo?.color ?? "#64748b" }} />
                      {srcInfo?.label ?? src}
                      {active && (
                        <div className="absolute left-0 right-0 bottom-[-1px] h-[2px] rounded-full"
                          style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab panel */}
              {activeTab && sourceStatuses[activeTab]?.data && (
                <div className="card-enterprise p-5 animate-fade-up">
                  <div className="flex items-center gap-2 mb-4">
                    {(() => {
                      const srcInfo = ALL_SOURCES.find((x) => x.key === activeTab);
                      const Icon = srcInfo?.icon ?? Shield;
                      return (
                        <>
                          <Icon className="w-4 h-4" style={{ color: srcInfo?.color ?? "#8b5cf6" }} />
                          <h3 className="text-sm font-semibold text-slate-300">{srcInfo?.label ?? activeTab}</h3>
                          <span className="text-[11px] text-slate-600">— {srcInfo?.desc}</span>
                        </>
                      );
                    })()}
                  </div>
                  <SourcePanel source={activeTab} data={sourceStatuses[activeTab].data} />
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!result && !scanning && (
            <div className="card-enterprise p-12 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.12)" }}>
                <Search className="w-8 h-8 text-purple-400 opacity-50" />
              </div>
              <p className="text-sm text-slate-400 font-medium">Enter a target and run an investigation</p>
              <p className="text-xs text-slate-600 mt-1">Supports Domain, IP, Email, Username, Hash, and Phone</p>
            </div>
          )}
        </div>

        {/* Right sidebar — history */}
        <div className="w-64 shrink-0 hidden lg:block">
          <div className="card-enterprise overflow-hidden">
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(139,92,246,0.07)" }}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em]">Recent Investigations</h3>
              <span className="text-[11px] text-slate-600">{history.length}</span>
            </div>
            {loadingHistory ? (
              <div className="flex justify-center py-8"><InfinityLoader size={20} /></div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs text-slate-600">No investigations yet.</p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[70vh]">
                {history.map((inv) => {
                  const tType = TARGET_TYPES.find((t) => t.value === inv.target_type);
                  const Icon = tType?.icon ?? Globe;
                  const riskColor = (inv.risk_score ?? 0) >= 70 ? "#ef4444" : (inv.risk_score ?? 0) >= 30 ? "#f97316" : "#10b981";
                  return (
                    <button key={inv.id} onClick={() => loadPastResult(inv)}
                      className="w-full flex items-start gap-3 p-3 hover:bg-white/[0.02] transition-colors text-left group"
                      style={{ borderBottom: "1px solid rgba(139,92,246,0.04)" }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: `${tType?.color ?? "#8b5cf6"}10` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: tType?.color ?? "#8b5cf6" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate group-hover:text-white">{inv.target_value}</p>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: riskColor, boxShadow: `0 0 4px ${riskColor}` }} />
                          <span className="text-[10px] font-mono" style={{ color: riskColor }}>{inv.risk_score ?? "—"}</span>
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full ml-auto",
                            inv.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                            inv.status === "failed" ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400")}>
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
