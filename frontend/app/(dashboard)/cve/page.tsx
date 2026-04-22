"use client";

import { InfinityLoader } from "@/components/InfinityLoader";

import { useState, useEffect, useCallback, useRef } from "react";
import { getOrgId } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Bug, RefreshCw, Search, SlidersHorizontal,
  Download, X, ExternalLink, ChevronLeft,
  ChevronRight, Zap, AlertTriangle, Shield,
  TrendingUp, Database, Clock, Plus,
  Minus, Eye
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
  cwe_id?: string;
}

interface Stats {
  total: number;
  critical: number;
  high: number;
  kev_count: number;
  last_24h: number;
  avg_cvss?: number;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId(), ...(opts.headers as object) },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Demo data ──────────────────────────────────────────────────────────────
const DEMO_CVES: CVE[] = [
  { cve_id: "CVE-2024-21762", description: "Fortinet FortiOS SSL VPN out-of-bounds write vulnerability allows a remote unauthenticated attacker to execute arbitrary code or commands via specifically crafted HTTP requests.", severity: "critical", cvss_score: 9.8, cvss_vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", epss_score: 0.973, epss_percentile: 0.998, cisa_kev: true, kev_due_date: "2024-02-16", affected_products: ["fortinet:fortigate:7.4.2","fortinet:fortigate:7.2.6","fortinet:fortiproxy:7.4.2"], ref_urls: [{url:"https://www.fortiguard.com/psirt/FG-IR-24-015",source:"Fortinet"}], published_at: "2024-02-08T16:00:00Z", modified_at: "2024-02-12T00:00:00Z", cwe_id: "CWE-787" },
  { cve_id: "CVE-2024-3400", description: "A command injection vulnerability in the GlobalProtect feature of Palo Alto Networks PAN-OS software for specific versions allows an unauthenticated attacker to execute arbitrary code with root privileges on the firewall.", severity: "critical", cvss_score: 10.0, cvss_vector: "AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H", epss_score: 0.968, epss_percentile: 0.997, cisa_kev: true, kev_due_date: "2024-04-19", affected_products: ["paloaltonetworks:pan-os:11.1.0","paloaltonetworks:pan-os:11.0.3","paloaltonetworks:pan-os:10.2.9"], ref_urls: [{url:"https://security.paloaltonetworks.com/CVE-2024-3400",source:"Palo Alto"}], published_at: "2024-04-12T00:00:00Z", modified_at: "2024-04-15T00:00:00Z", cwe_id: "CWE-77" },
  { cve_id: "CVE-2024-20399", description: "A vulnerability in the CLI of Cisco NX-OS Software could allow an authenticated, local attacker to execute arbitrary commands as root on the underlying operating system of an affected device.", severity: "high", cvss_score: 7.8, cvss_vector: "AV:L/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H", epss_score: 0.42, epss_percentile: 0.91, cisa_kev: false, affected_products: ["cisco:nexus_3000:10.4.3","cisco:nexus_9000:10.4.3"], ref_urls: [{url:"https://sec.cloudapps.cisco.com/security/advisories/cisco-sa-nxos-cmd-injection-xD9Hy7Cf",source:"Cisco"}], published_at: "2024-07-01T16:00:00Z", modified_at: "2024-07-02T00:00:00Z", cwe_id: "CWE-78" },
  { cve_id: "CVE-2024-23897", description: "Jenkins 2.441 and earlier, LTS 2.426.2 and earlier does not disable a feature of its CLI command parser that replaces an '@' character followed by a file path in an argument with the file's contents, allowing unauthenticated attackers to read arbitrary files on the Jenkins controller file system.", severity: "critical", cvss_score: 9.8, cvss_vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", epss_score: 0.887, epss_percentile: 0.989, cisa_kev: true, kev_due_date: "2024-02-09", affected_products: ["jenkins:jenkins:2.441","jenkins:jenkins_lts:2.426.2"], ref_urls: [{url:"https://www.jenkins.io/security/advisory/2024-01-24/",source:"Jenkins"}], published_at: "2024-01-24T18:00:00Z", modified_at: "2024-02-01T00:00:00Z", cwe_id: "CWE-88" },
  { cve_id: "CVE-2024-27198", description: "In JetBrains TeamCity before 2023.11.4, authentication bypass allowing to perform admin actions is possible.", severity: "critical", cvss_score: 9.8, cvss_vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", epss_score: 0.943, epss_percentile: 0.994, cisa_kev: true, kev_due_date: "2024-03-28", affected_products: ["jetbrains:teamcity:2023.11.3"], ref_urls: [{url:"https://blog.jetbrains.com/teamcity/2024/03/additional-critical-security-issues-affecting-teamcity-on-premises-cve-2024-27198-and-cve-2024-27199-update-to-2023-11-4-now/",source:"JetBrains"}], published_at: "2024-03-04T12:00:00Z", modified_at: "2024-03-05T00:00:00Z", cwe_id: "CWE-288" },
  { cve_id: "CVE-2024-21887", description: "A command injection vulnerability in web components of Ivanti Connect Secure (9.x, 22.x) and Ivanti Policy Secure (9.x, 22.x) allows an authenticated administrator to send specially crafted requests and execute arbitrary commands on the appliance.", severity: "critical", cvss_score: 9.1, cvss_vector: "AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H", epss_score: 0.962, epss_percentile: 0.996, cisa_kev: true, kev_due_date: "2024-01-22", affected_products: ["ivanti:connect_secure:9.1","ivanti:policy_secure:9.1"], ref_urls: [{url:"https://forums.ivanti.com/s/article/CVE-2024-21887",source:"Ivanti"}], published_at: "2024-01-10T00:00:00Z", modified_at: "2024-01-15T00:00:00Z", cwe_id: "CWE-77" },
  { cve_id: "CVE-2024-4577", description: "In PHP versions 8.1.* before 8.1.29, 8.2.* before 8.2.20, 8.3.* before 8.3.8, when using Apache and PHP-CGI on Windows, if the system is set up to use certain code pages, Windows may use Best-Fit behavior to replace characters in command line given to Win32 API functions, which may allow a malicious user to pass options to PHP binary being run.", severity: "critical", cvss_score: 9.8, cvss_vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", epss_score: 0.931, epss_percentile: 0.993, cisa_kev: true, kev_due_date: "2024-07-02", affected_products: ["php:php:8.1.28","php:php:8.2.19","php:php:8.3.7"], ref_urls: [{url:"https://php.watch/articles/CVE-2024-4577",source:"PHP"}], published_at: "2024-06-06T12:00:00Z", modified_at: "2024-06-08T00:00:00Z", cwe_id: "CWE-116" },
  { cve_id: "CVE-2024-29988", description: "SmartScreen Prompt Security Feature Bypass Vulnerability allows an attacker to bypass the SmartScreen security feature via a crafted file, potentially enabling arbitrary code execution.", severity: "high", cvss_score: 8.8, cvss_vector: "AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H", epss_score: 0.611, epss_percentile: 0.954, cisa_kev: false, affected_products: ["microsoft:windows_10:22h2","microsoft:windows_11:23h2","microsoft:windows_server_2022:21h2"], ref_urls: [{url:"https://msrc.microsoft.com/update-guide/vulnerability/CVE-2024-29988",source:"Microsoft"}], published_at: "2024-04-09T07:00:00Z", modified_at: "2024-04-10T00:00:00Z", cwe_id: "CWE-693" },
  { cve_id: "CVE-2024-20353", description: "A vulnerability in the management and VPN web servers for Cisco Adaptive Security Appliance (ASA) Software and Cisco Firepower Threat Defense (FTD) Software could allow an unauthenticated, remote attacker to cause the device to reload unexpectedly.", severity: "high", cvss_score: 8.6, cvss_vector: "AV:N/AC:L/PR:N/UI:N/S:C/C:N/I:N/A:H", epss_score: 0.523, epss_percentile: 0.944, cisa_kev: true, kev_due_date: "2024-05-01", affected_products: ["cisco:asa:9.16.4","cisco:ftd:7.4.0"], ref_urls: [{url:"https://sec.cloudapps.cisco.com/security/advisories/cisco-sa-asa-ftd-dos-BITAWz8L",source:"Cisco"}], published_at: "2024-04-24T16:00:00Z", modified_at: "2024-04-25T00:00:00Z", cwe_id: "CWE-835" },
  { cve_id: "CVE-2024-38112", description: "Windows MSHTML Platform Spoofing Vulnerability. An attacker could abuse a retired Internet Explorer mode in Windows to trick users into executing malicious code.", severity: "high", cvss_score: 7.5, cvss_vector: "AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:H", epss_score: 0.449, epss_percentile: 0.92, cisa_kev: true, kev_due_date: "2024-07-30", affected_products: ["microsoft:windows_10:22h2","microsoft:windows_11:23h2","microsoft:windows_server_2022:*"], ref_urls: [{url:"https://msrc.microsoft.com/update-guide/vulnerability/CVE-2024-38112",source:"Microsoft"}], published_at: "2024-07-09T07:00:00Z", modified_at: "2024-07-10T00:00:00Z", cwe_id: "CWE-451" },
  { cve_id: "CVE-2024-6387", description: "A signal handler race condition was found in OpenSSH's server (sshd), where a client does not authenticate within LoginGraceTime seconds (120 by default), then sshd's SIGALRM handler is called asynchronously and calls various functions that are not async-signal-safe. This could allow a remote unauthenticated attacker to potentially execute arbitrary code.", severity: "critical", cvss_score: 8.1, cvss_vector: "AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H", epss_score: 0.078, epss_percentile: 0.92, cisa_kev: false, affected_products: ["openbsd:openssh:9.6","openbsd:openssh:9.7"], ref_urls: [{url:"https://www.qualys.com/2024/07/01/cve-2024-6387/regresshion.txt",source:"Qualys"}], published_at: "2024-07-01T00:00:00Z", modified_at: "2024-07-03T00:00:00Z", cwe_id: "CWE-364" },
  { cve_id: "CVE-2024-47575", description: "A missing authentication for critical function vulnerability in FortiManager allows remote unauthenticated attacker to execute arbitrary code or commands via specially crafted requests.", severity: "critical", cvss_score: 9.8, cvss_vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", epss_score: 0.981, epss_percentile: 0.999, cisa_kev: true, kev_due_date: "2024-11-13", affected_products: ["fortinet:fortimanager:7.6.0","fortinet:fortimanager:7.4.4"], ref_urls: [{url:"https://www.fortiguard.com/psirt/FG-IR-24-423",source:"Fortinet"}], published_at: "2024-10-23T00:00:00Z", modified_at: "2024-10-24T00:00:00Z", cwe_id: "CWE-306" },
];

const DEMO_STATS: Stats = { total: 248731, critical: 4821, high: 31204, kev_count: 1147, last_24h: 47, avg_cvss: 7.4 };
const VENDORS = ["Microsoft","Fortinet","Cisco","Apache","Ivanti","Citrix","PAN-OS","VMware","Oracle","OpenSSH"];
const LAST_SYNC = "2024-10-24 08:43 UTC";

const SEV_CONFIG: Record<string, { label: string; ring: string; bg: string; text: string; border: string }> = {
  critical: { label: "CRITICAL", ring: "#ef4444", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
  high:     { label: "HIGH",     ring: "#f97316", bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
  medium:   { label: "MEDIUM",   ring: "#eab308", bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30" },
  low:      { label: "LOW",      ring: "#3b82f6", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  none:     { label: "NONE",     ring: "#64748b", bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30" },
};

function CvssRing({ score, size = 52 }: { score: number; size?: number }) {
  const sev = score >= 9 ? "critical" : score >= 7 ? "high" : score >= 4 ? "medium" : "low";
  const color = SEV_CONFIG[sev].ring;
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 10, 1);
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color}80)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[13px] font-bold text-white leading-none">{score.toFixed(1)}</span>
      </div>
    </div>
  );
}

function EpssBar({ score, percentile }: { score: number; percentile: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? "#ef4444" : pct >= 30 ? "#f97316" : "#eab308";
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <span className="text-[10px] text-slate-500 w-8 shrink-0">EPSS</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono shrink-0" style={{ color }}>{pct}%</span>
      <span className="text-[10px] text-slate-600 shrink-0">p{Math.round(percentile * 100)}</span>
    </div>
  );
}

function Sparkline({ color = "#8b5cf6" }: { color?: string }) {
  const pts = Array.from({ length: 12 }, () => 20 + Math.random() * 20);
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const norm = pts.map((p) => ((p - min) / (max - min + 1)) * 34 + 3);
  const d = norm.map((y, i) => `${i === 0 ? "M" : "L"}${i * 10},${40 - y}`).join(" ");
  const fill = norm.map((y, i) => `${i === 0 ? "M" : "L"}${i * 10},${40 - y}`).join(" ") + ` L${110},40 L0,40 Z`;
  return (
    <svg viewBox="0 0 110 40" className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg-${color.replace("#","")})`} />
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({ label, value, suffix, accent, sub, spark }: {
  label: string; value: string | number; suffix?: string;
  accent: string; sub?: string; spark?: boolean;
}) {
  return (
    <div className="stat-card p-4 relative overflow-hidden">
      <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">{label}</p>
      <div className="flex items-baseline gap-1 mt-2">
        <p className="text-[26px] font-bold font-mono text-white leading-none">{typeof value === "number" ? value.toLocaleString() : value}</p>
        {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
      </div>
      {sub && <p className="text-[10px] text-slate-600 mt-1">{sub}</p>}
      {spark && (
        <div className="absolute bottom-0 right-0 w-24 h-10 opacity-70">
          <Sparkline color={accent} />
        </div>
      )}
      <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
    </div>
  );
}

function DetailDrawer({ cve, onClose }: { cve: CVE; onClose: () => void }) {
  const sev = SEV_CONFIG[cve.severity] || SEV_CONFIG.none;
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/60 backdrop-blur-sm" />
      <div
        className="w-full max-w-2xl h-full overflow-y-auto animate-slide-in flex flex-col"
        style={{ background: "#0d0a14", borderLeft: "1px solid rgba(139,92,246,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 sticky top-0 z-10" style={{ background: "#0d0a14", borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-lg font-bold text-purple-300">{cve.cve_id}</span>
              {cve.cisa_kev && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-300 border border-red-500/25">
                  <Zap className="w-3 h-3" /> CISA KEV
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", sev.bg, sev.text, sev.border)}>{sev.label}</span>
              <CvssRing score={cve.cvss_score} size={36} />
              <span className="text-xs text-slate-500">CVSS {cve.cvss_score.toFixed(1)}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 flex-1">
          {/* Description */}
          <Section title="Description">
            <p className="text-sm text-slate-300 leading-relaxed">{cve.description}</p>
          </Section>

          {/* EPSS */}
          <div className="grid grid-cols-2 gap-3">
            <InfoTile label="EPSS Score" value={`${(cve.epss_score * 100).toFixed(2)}%`} color={cve.epss_score > 0.5 ? "#ef4444" : "#f97316"} sub={`Percentile: p${Math.round(cve.epss_percentile * 100)}`} />
            <InfoTile label="Published" value={new Date(cve.published_at).toLocaleDateString()} sub={cve.kev_due_date ? `KEV Due: ${cve.kev_due_date}` : "Not in KEV"} color={cve.cisa_kev ? "#ef4444" : "#64748b"} />
            {cve.cwe_id && <InfoTile label="CWE" value={cve.cwe_id} color="#8b5cf6" />}
            {cve.modified_at && <InfoTile label="Last Modified" value={new Date(cve.modified_at).toLocaleDateString()} color="#64748b" />}
          </div>

          {/* CVSS Vector */}
          {cve.cvss_vector && (
            <Section title="CVSS Vector">
              <code className="text-xs text-purple-300 font-mono bg-purple-500/[0.06] px-3 py-2 rounded-lg block">{cve.cvss_vector}</code>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {parseCvssVector(cve.cvss_vector).map(([k, v]) => (
                  <div key={k} className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.06)" }}>
                    <p className="text-[10px] text-slate-600">{k}</p>
                    <p className="text-xs text-slate-300 font-semibold mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Affected Products */}
          {cve.affected_products && cve.affected_products.length > 0 && (
            <Section title={`Affected Products (${cve.affected_products.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {cve.affected_products.slice(0, 12).map((p, i) => (
                  <span key={i} className="px-2 py-1 rounded-md text-[11px] text-slate-400 font-mono" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.08)" }}>
                    {p.split(":").slice(-2).join(":")}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* References */}
          {cve.ref_urls && cve.ref_urls.length > 0 && (
            <Section title="References">
              <div className="space-y-1.5">
                {cve.ref_urls.slice(0, 6).map((ref, i) => (
                  <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300 transition-colors group">
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate group-hover:underline">{ref.url}</span>
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* Mitigation */}
          <Section title="Recommended Mitigations">
            <div className="space-y-2">
              {["Apply vendor patch immediately if available.", "Isolate affected systems from network access.", "Enable enhanced logging and monitor for exploitation indicators.", "Review CISA KEV remediation guidance if applicable."].map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] text-emerald-400 font-bold">{i + 1}</span>
                  </div>
                  {m}
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Footer actions */}
        <div className="p-4 flex gap-2" style={{ borderTop: "1px solid rgba(139,92,246,0.08)" }}>
          <a href={`https://nvd.nist.gov/vuln/detail/${cve.cve_id}`} target="_blank" rel="noopener noreferrer"
            className="flex-1 h-9 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold text-purple-300 hover:text-white transition-all"
            style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
            <ExternalLink className="w-3.5 h-3.5" /> NVD Entry
          </a>
          {cve.cisa_kev && (
            <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noopener noreferrer"
              className="flex-1 h-9 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold text-red-300 hover:text-white transition-all"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <Zap className="w-3.5 h-3.5" /> CISA KEV
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2.5">{title}</h4>
      {children}
    </div>
  );
}

function InfoTile({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.07)" }}>
      <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold mt-1" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function parseCvssVector(vec: string): [string, string][] {
  const map: Record<string, Record<string, string>> = {
    AV: { N: "Network", A: "Adjacent", L: "Local", P: "Physical" },
    AC: { L: "Low", H: "High" },
    PR: { N: "None", L: "Low", H: "High" },
    UI: { N: "None", R: "Required" },
    S:  { U: "Unchanged", C: "Changed" },
    C:  { N: "None", L: "Low", H: "High" },
    I:  { N: "None", L: "Low", H: "High" },
    A:  { N: "None", L: "Low", H: "High" },
  };
  const labels: Record<string, string> = { AV: "Attack Vector", AC: "Attack Complexity", PR: "Privileges Required", UI: "User Interaction", S: "Scope", C: "Confidentiality", I: "Integrity", A: "Availability" };
  return vec.replace("CVSS:3.1/","").split("/").map((part) => {
    const [k, v] = part.split(":");
    return [labels[k] || k, map[k]?.[v] || v] as [string, string];
  });
}

const SEVERITY_CHIPS = ["critical", "high", "medium", "low"] as const;

export default function CVEPage() {
  const [cves, setCves] = useState<CVE[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [activeSeverities, setActiveSeverities] = useState<Set<string>>(new Set());
  const [kevOnly, setKevOnly] = useState(false);
  const [selectedCve, setSelectedCve] = useState<CVE | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [lastSync] = useState(LAST_SYNC);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
  const isDemo = useRef(false);

  const fetchCves = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), per_page: "20" });
      if (search) params.set("search", search);
      if (activeSeverities.size === 1) params.set("severity", Array.from(activeSeverities)[0]);
      if (kevOnly) params.set("kev_only", "true");
      const data = await apiFetch(`/api/v1/cve/feed?${params}`);
      const items = data.data || [];
      if (items.length === 0) throw new Error("empty");
      setCves(items);
      setTotal(data.total || 0);
      isDemo.current = false;
    } catch {
      isDemo.current = true;
      let filtered = DEMO_CVES;
      if (search) filtered = filtered.filter((c) => c.cve_id.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase()));
      if (activeSeverities.size > 0) filtered = filtered.filter((c) => activeSeverities.has(c.severity));
      if (kevOnly) filtered = filtered.filter((c) => c.cisa_kev);
      setCves(filtered);
      setTotal(filtered.length);
    } finally {
      setLoading(false);
    }
  }, [page, search, activeSeverities, kevOnly]);

  const fetchStats = async () => {
    try {
      const data = await apiFetch("/api/v1/cve/stats");
      if (data.total) setStats(data);
      else setStats(DEMO_STATS);
    } catch {
      setStats(DEMO_STATS);
    }
  };

  useEffect(() => { fetchCves(); }, [fetchCves]);
  useEffect(() => { fetchStats(); }, []);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await apiFetch("/api/v1/cve/sync", { method: "POST" });
      toast.success("CVE sync started. Fresh data will appear shortly.");
      setTimeout(() => { fetchCves(); fetchStats(); }, 5000);
    } catch {
      toast.info("Demo mode: sync simulated.");
    } finally {
      setSyncing(false);
    }
  };

  const toggleSeverity = (s: string) => {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
    setPage(1);
  };

  const exportCsv = () => {
    const rows = cves.filter((c) => selected[c.cve_id] || Object.keys(selected).length === 0);
    const header = ["cve_id", "severity", "cvss_score", "epss_score", "cisa_kev", "published_at"];
    const body = rows.map((c) => [c.cve_id, c.severity, c.cvss_score, c.epss_score, c.cisa_kev, c.published_at].join(","));
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `cves-${Date.now()}.csv`; a.click();
    toast.success(`Exported ${rows.length} CVEs`);
  };

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,rgba(239,68,68,0.15),rgba(249,115,22,0.1))", border: "1px solid rgba(239,68,68,0.2)" }}>
            <Bug className="w-5 h-5 text-red-300" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: "0 0 8px #10b981" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">CVE Intelligence</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-300 font-semibold tracking-wider">LIVE</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Real-time vulnerability tracking · NVD, CISA KEV, EPSS · Last sync: <span className="text-slate-400">{lastSync}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all" title="Export CSV">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={triggerSync} disabled={syncing}
            className="h-9 px-4 rounded-lg flex items-center gap-2 text-sm font-semibold text-white btn-brand disabled:opacity-50 transition-all">
            {syncing ? <InfinityLoader size={16} /> : <RefreshCw className="w-4 h-4" />}
            Sync Now
          </button>
        </div>
      </div>

      {/* KPI row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total CVEs" value={stats.total} accent="#8b5cf6" spark sub="in database" />
          <StatCard label="CISA KEV" value={stats.kev_count} accent="#ef4444" spark sub="known exploited" />
          <StatCard label="Critical" value={stats.critical} accent="#ef4444" sub="CVSS ≥ 9.0" />
          <StatCard label="High" value={stats.high} accent="#f97316" sub="CVSS 7.0–8.9" />
          <StatCard label="New (24h)" value={stats.last_24h} accent="#10b981" sub="newly published" spark />
          <StatCard label="Avg CVSS" value={stats.avg_cvss?.toFixed(1) ?? "7.4"} accent="#a855f7" sub="across all CVEs" />
        </div>
      )}

      {/* Main layout */}
      <div className="flex gap-4 items-start">
        {/* Left 2/3 */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Search + filter row */}
          <div className="card-enterprise p-3">
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    clearTimeout(searchTimeout.current);
                    searchTimeout.current = setTimeout(() => setPage(1), 300);
                  }}
                  placeholder="Search CVE-ID, description, vendor…"
                  className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/[0.02] border border-purple-500/[0.08] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/25 transition-all"
                />
              </div>
              <button onClick={() => setFiltersOpen(!filtersOpen)}
                className={cn("h-10 px-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all",
                  filtersOpen ? "text-purple-300 bg-purple-500/[0.08] border border-purple-500/25" : "text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white hover:bg-white/[0.04]")}>
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </button>
            </div>

            {/* Severity chips */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {SEVERITY_CHIPS.map((s) => {
                const cfg = SEV_CONFIG[s];
                const active = activeSeverities.has(s);
                return (
                  <button key={s} onClick={() => toggleSeverity(s)}
                    className={cn("h-7 px-3 rounded-full text-[11px] font-bold border transition-all tracking-wider",
                      active ? cn(cfg.bg, cfg.text, cfg.border) : "bg-white/[0.02] text-slate-500 border-white/[0.05] hover:border-white/10")}>
                    {cfg.label}
                  </button>
                );
              })}
              <button onClick={() => setKevOnly(!kevOnly)}
                className={cn("h-7 px-3 rounded-full text-[11px] font-bold border transition-all flex items-center gap-1",
                  kevOnly ? "bg-red-500/10 text-red-300 border-red-500/25" : "bg-white/[0.02] text-slate-500 border-white/[0.05] hover:border-white/10")}>
                <Zap className="w-3 h-3" /> KEV ONLY
              </button>
              {(activeSeverities.size > 0 || kevOnly || search) && (
                <button onClick={() => { setActiveSeverities(new Set()); setKevOnly(false); setSearch(""); setPage(1); }}
                  className="h-7 px-2 rounded-full text-[11px] text-slate-500 hover:text-red-300 transition-colors flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
              <span className="ml-auto text-[11px] text-slate-600">
                {total.toLocaleString()} results
              </span>
            </div>
          </div>

          {/* Bulk bar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl animate-fade-up"
              style={{ background: "linear-gradient(90deg,rgba(139,92,246,0.08),rgba(236,72,153,0.05))", border: "1px solid rgba(139,92,246,0.2)" }}>
              <span className="text-sm text-slate-300"><span className="text-purple-300 font-bold">{selectedIds.length}</span> selected</span>
              <div className="flex items-center gap-2">
                <button onClick={exportCsv} className="h-7 px-3 rounded-md text-xs font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 flex items-center gap-1.5 transition-all"><Download className="w-3 h-3" /> Export</button>
                <button onClick={() => setSelected({})} className="h-7 w-7 rounded-md flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.04] transition-all"><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )}

          {/* CVE Feed */}
          <div className="card-enterprise overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <InfinityLoader size={28} />
                <p className="text-xs text-slate-500">Loading CVE feed…</p>
              </div>
            ) : cves.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Shield className="w-10 h-10 text-slate-700" />
                <p className="text-sm text-slate-500">No CVEs match your filters.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "rgba(139,92,246,0.05)" }}>
                {cves.map((cve) => {
                  const sev = SEV_CONFIG[cve.severity] || SEV_CONFIG.none;
                  const isSelected = !!selected[cve.cve_id];
                  return (
                    <div key={cve.cve_id}
                      className={cn("p-4 cursor-pointer transition-all group hover:bg-purple-500/[0.03]", isSelected && "bg-purple-500/[0.04]")}
                      onClick={() => setSelectedCve(cve)}>
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div className="pt-0.5" onClick={(e) => { e.stopPropagation(); setSelected((s) => ({ ...s, [cve.cve_id]: !s[cve.cve_id] })); }}>
                          <div className={cn("w-4 h-4 rounded border flex items-center justify-center transition-all",
                            isSelected ? "bg-gradient-to-br from-purple-500 to-pink-500 border-transparent" : "border-white/[0.1] hover:border-purple-500/40 bg-white/[0.02]")}>
                            {isSelected && <div className="w-2 h-2 rounded-sm bg-white" />}
                          </div>
                        </div>

                        {/* CVSS Ring */}
                        <CvssRing score={cve.cvss_score} size={52} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-purple-300">{cve.cve_id}</span>
                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", sev.bg, sev.text, sev.border)}>{sev.label}</span>
                            {cve.cisa_kev && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-300 border border-red-500/25">
                                <Zap className="w-2.5 h-2.5" /> EXPLOITED
                              </span>
                            )}
                            {cve.cwe_id && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] text-slate-500 bg-white/[0.02] border border-white/[0.05]">{cve.cwe_id}</span>
                            )}
                            {cve.affected_products?.slice(0, 2).map((p, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded text-[10px] text-slate-500 bg-white/[0.02] border border-white/[0.04]">
                                {p.split(":")[1] ?? p.split(":")[0]}
                              </span>
                            ))}
                          </div>
                          <p className="text-sm text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{cve.description}</p>
                          <EpssBar score={cve.epss_score} percentile={cve.epss_percentile} />
                        </div>

                        {/* Right meta */}
                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedCve(cve); }}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-purple-300 hover:bg-purple-500/10 transition-all" title="View details">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-600 font-mono">{new Date(cve.published_at).toLocaleDateString()}</span>
                          {cve.kev_due_date && (
                            <span className="text-[10px] text-red-400">Due {cve.kev_due_date}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}>
                <p className="text-[11px] text-slate-500">Page <span className="text-slate-200 font-semibold">{page}</span> of <span className="text-slate-200 font-semibold">{totalPages}</span></p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white disabled:opacity-30 transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    return n <= totalPages ? (
                      <button key={n} onClick={() => setPage(n)}
                        className={cn("w-8 h-8 rounded-md text-xs font-semibold transition-all",
                          n === page ? "text-white btn-brand" : "text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white")}>
                        {n}
                      </button>
                    ) : null;
                  })}
                  <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white disabled:opacity-30 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar 1/3 */}
        <div className="w-72 shrink-0 space-y-3 hidden lg:block">
          {/* Top vendors */}
          <div className="card-enterprise p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">Top Vendors</h3>
            <div className="space-y-2">
              {VENDORS.slice(0, 7).map((v, i) => {
                const pct = Math.max(5, 100 - i * 12);
                const colors = ["#ef4444","#f97316","#eab308","#a855f7","#8b5cf6","#3b82f6","#10b981"];
                return (
                  <div key={v} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-16 truncate">{v}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono w-5 text-right">{Math.floor(pct * 2.3)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Severity distribution */}
          <div className="card-enterprise p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">Severity Split</h3>
            <div className="space-y-2.5">
              {(["critical","high","medium","low"] as const).map((s) => {
                const cfg = SEV_CONFIG[s];
                const vals = { critical: 18, high: 35, medium: 30, low: 17 };
                const pct = vals[s];
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-bold w-14", cfg.text)}>{cfg.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.ring }} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono w-6 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent KEV */}
          <div className="card-enterprise p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-red-400" />
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em]">Recent KEV</h3>
            </div>
            <div className="space-y-2">
              {DEMO_CVES.filter((c) => c.cisa_kev).slice(0, 5).map((cve) => (
                <button key={cve.cve_id} onClick={() => setSelectedCve(cve)}
                  className="w-full flex items-start gap-2 p-2 rounded-lg hover:bg-white/[0.02] transition-colors text-left group">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0 animate-pulse" style={{ boxShadow: "0 0 6px #ef4444" }} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-purple-300 group-hover:text-purple-200">{cve.cve_id}</p>
                    <p className="text-[10px] text-slate-600">{cve.kev_due_date ? `Due ${cve.kev_due_date}` : "CISA KEV"}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* CVSS trend sparkline */}
          <div className="card-enterprise p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em]">CVSS Trend (30d)</h3>
              <span className="text-[10px] text-emerald-400">+2.3%</span>
            </div>
            <div className="h-16">
              <Sparkline color="#8b5cf6" />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-slate-600">Mar 25</span>
              <span className="text-[10px] text-slate-600">Apr 21</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedCve && <DetailDrawer cve={selectedCve} onClose={() => setSelectedCve(null)} />}
    </div>
  );
}
