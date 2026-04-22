"use client";

import { InfinityLoader } from "@/components/InfinityLoader";

import { useState, useEffect, useMemo, useCallback } from "react";
import { api, getOrgId, type Alert } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import {
  Bell, Search, X, RefreshCw,
  Download, Settings2, Check, Ban,
  ChevronDown, ArrowUpRight, Users, Shield,
  Clock, AlertTriangle, Copy, ExternalLink,
  Filter, Keyboard, GitBranch, Database,
  Target, Activity, Lock, Globe,
  FileText, Layers, ChevronsUp, TrendingUp,
  Inbox
} from "lucide-react";

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_ASSIGNEES = ["Alice Chen", "Bob Kumar", "Carla Rivera", "David Park", "Unassigned"];
const DEMO_COMPANIES = ["Acme Corp", "GlobalBank", "HealthNet", "RetailGiant", "TechStartup X"];
const DEMO_CVEs = ["CVE-2024-21762", "CVE-2024-3400", "CVE-2024-1709", "CVE-2023-46805", "CVE-2024-6387"];
const MITRE_IDS = ["T1078", "T1190", "T1566", "T1059", "T1055", "T1027", "T1003", "T1082", "T1021", "T1071"];
const MITRE_NAMES = [
  "Valid Accounts", "Exploit Public-Facing Application", "Phishing", "Command & Scripting Interpreter",
  "Process Injection", "Obfuscated Files", "OS Credential Dumping", "System Information Discovery",
  "Remote Services", "Application Layer Protocol",
];

const ALERT_TITLES = [
  "Credential dump detected in dark web forum",
  "Phishing page impersonating corporate login portal",
  "Exposed database with customer PII found on paste site",
  "APT29 TTPs detected in network telemetry",
  "Critical RCE vulnerability in production VPN",
  "Ransomware pre-cursor activity detected",
  "Brand impersonation domain registered",
  "Stealer log dump includes employee accounts",
  "BGP route hijacking targeting org prefixes",
  "Supply chain compromise via dependency confusion",
  "Brute force attack on MFA-disabled accounts",
  "Cobalt Strike C2 beacon detected in egress traffic",
  "Dark web sale of internal source code",
  "Certificate spoofing for executive domain",
  "Mass credential stuffing against customer portal",
  "Insider threat: abnormal data download volume",
  "Zero-day in widely deployed enterprise software",
  "Telegram channel selling org employee data",
  "DNS hijacking targeting corporate email domain",
  "Malicious npm package mimicking internal library",
  "Cloud storage bucket exposed with backups",
  "Lookalike app in third-party app store",
  "VPN concentrator under sustained brute force",
  "Threat actor researching org's attack surface",
  "Executive email addresses found in breach dump",
  "Malvertising campaign targeting sector employees",
  "Watering hole on industry conference site",
  "FIN7 spearphishing lure with finance theme",
  "Lazarus Group cryptocurrency-themed lure",
  "Scattered Spider vishing playbook active",
];

const MODULES = ["dark_web", "brand", "data_leak", "surface_web", "credential", "cert_monitor"] as const;
const MODULE_LABELS: Record<string, string> = {
  dark_web: "Dark Web", brand: "Brand", data_leak: "Data Leak",
  surface_web: "Surface Web", credential: "Credential", cert_monitor: "Certificate",
};

const STATUSES = ["open", "investigating", "resolved", "false_positive"] as const;
type AlertStatus = (typeof STATUSES)[number];

function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

interface DemoAlert extends Alert {
  assignee: string;
  unread: boolean;
  affected_assets: string[];
  mitre_id: string;
  mitre_name: string;
  cve: string | null;
}

function generateDemoAlerts(): DemoAlert[] {
  const rnd = seedRand(0xcafebabe);
  const now = new Date("2026-04-21T12:00:00Z");
  return Array.from({ length: 30 }, (_, i) => {
    const hoursAgo = Math.floor(rnd() * 720);
    const sev = (() => {
      const v = rnd();
      if (v < 0.1) return "critical";
      if (v < 0.3) return "high";
      if (v < 0.68) return "medium";
      return "low";
    })();
    const mod = MODULES[Math.floor(rnd() * MODULES.length)];
    const status = (() => {
      const v = rnd();
      if (v < 0.45) return "open";
      if (v < 0.65) return "investigating";
      if (v < 0.85) return "resolved";
      return "false_positive";
    })() as AlertStatus;
    const mitreIdx = Math.floor(rnd() * MITRE_IDS.length);
    const score = Math.round(
      sev === "critical" ? 78 + rnd() * 22 :
      sev === "high" ? 55 + rnd() * 23 :
      sev === "medium" ? 30 + rnd() * 25 :
      8 + rnd() * 22
    );
    return {
      id: `alert-demo-${i}`,
      org_id: "demo",
      asset_id: null,
      module: mod,
      severity: sev,
      title: ALERT_TITLES[i % ALERT_TITLES.length],
      description: `Automated detection flagged this event based on intelligence correlation. Multiple sources corroborate the finding. Immediate analyst review recommended.`,
      source_url: rnd() > 0.5 ? "https://example.com/source" : "",
      raw_data: { cve: rnd() > 0.6 ? DEMO_CVEs[Math.floor(rnd() * DEMO_CVEs.length)] : null },
      risk_score: score,
      status,
      tags: [mod],
      created_at: new Date(now.getTime() - hoursAgo * 3600000).toISOString(),
      updated_at: new Date(now.getTime() - Math.floor(rnd() * hoursAgo / 2) * 3600000).toISOString(),
      assignee: DEMO_ASSIGNEES[Math.floor(rnd() * DEMO_ASSIGNEES.length)],
      unread: rnd() > 0.55,
      affected_assets: [
        `${DEMO_COMPANIES[Math.floor(rnd() * DEMO_COMPANIES.length)].toLowerCase().replace(/ /g, "-")}.com`,
        `192.168.${Math.floor(rnd() * 255)}.${Math.floor(rnd() * 255)}`,
      ],
      mitre_id: MITRE_IDS[mitreIdx],
      mitre_name: MITRE_NAMES[mitreIdx],
      cve: rnd() > 0.6 ? DEMO_CVEs[Math.floor(rnd() * DEMO_CVEs.length)] : null,
    };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEV_CONFIG = {
  critical: { label: "Critical", color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" },
  high:     { label: "High",     color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)" },
  medium:   { label: "Medium",   color: "#eab308", bg: "rgba(234,179,8,0.08)",  border: "rgba(234,179,8,0.2)" },
  low:      { label: "Low",      color: "#3b82f6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)" },
  info:     { label: "Info",     color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.2)" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  open:          { label: "Open",          color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.2)" },
  investigating: { label: "Investigating", color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.2)" },
  resolved:      { label: "Resolved",      color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.2)" },
  false_positive:{ label: "False Positive",color: "#a855f7", bg: "rgba(168,85,247,0.08)",  border: "rgba(168,85,247,0.2)" },
};

function getSev(s: string) {
  return SEV_CONFIG[s as keyof typeof SEV_CONFIG] ?? SEV_CONFIG.info;
}

function getStatusCfg(s: string) {
  return STATUS_CONFIG[s] ?? STATUS_CONFIG.open;
}

function relTime(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); }
  catch { return "recently"; }
}

function absTime(iso: string) {
  try { return format(new Date(iso), "MMM d, yyyy HH:mm"); }
  catch { return iso; }
}

// ─── Inline checkbox ─────────────────────────────────────────────────────────

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={cn(
        "w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all",
        checked
          ? "bg-gradient-to-br from-purple-500 to-pink-500 border-transparent shadow-[0_0_0_1px_rgba(139,92,246,0.5)]"
          : "bg-white/[0.02] border border-white/[0.12] hover:border-purple-500/40"
      )}
      aria-checked={checked} role="checkbox">
      {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
    </button>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function AlertDetail({
  alert,
  onClose,
  onStatusChange,
}: {
  alert: DemoAlert | null;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  if (!alert) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.1)" }}>
          <Inbox className="w-7 h-7 text-slate-600" />
        </div>
        <div>
          <p className="text-slate-400 text-sm font-medium">No alert selected</p>
          <p className="text-slate-600 text-xs mt-1">Click an alert to view details</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <Keyboard className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-[11px] text-slate-600">J / K to navigate</span>
        </div>
      </div>
    );
  }

  const sev = getSev(alert.severity);
  const statusCfg = getStatusCfg(alert.status);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sticky header */}
      <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider"
              style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}>
              {sev.label}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-purple-500/[0.06] text-purple-300 border-purple-500/20">
              {MODULE_LABELS[alert.module] ?? alert.module}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold border"
              style={{ color: statusCfg.color, background: statusCfg.bg, borderColor: statusCfg.border }}>
              {statusCfg.label}
            </span>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <h2 className="text-sm font-bold text-white mt-2.5 leading-snug">{alert.title}</h2>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
          <Clock className="w-3 h-3" />
          {absTime(alert.created_at)}
          <span>·</span>
          <span title={absTime(alert.created_at)}>{relTime(alert.created_at)}</span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Risk score */}
        <div className="stat-card p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Risk Score</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-mono" style={{ color: sev.color }}>{alert.risk_score}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.05]">
              <div className="h-full rounded-full" style={{
                width: `${alert.risk_score}%`,
                background: `linear-gradient(90deg, ${sev.color}55, ${sev.color})`,
              }} />
            </div>
            <span className="text-[11px] text-slate-600">/100</span>
          </div>
        </div>

        {/* Summary */}
        <section>
          <SectionHeader icon={FileText} label="Summary" />
          <p className="text-sm text-slate-400 leading-relaxed mt-2">{alert.description}</p>
        </section>

        {/* Affected assets */}
        <section>
          <SectionHeader icon={Database} label="Affected Assets" />
          <div className="mt-2 space-y-1.5">
            {alert.affected_assets.map((a) => (
              <div key={a} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <span className="text-xs font-mono text-slate-300">{a}</span>
                <button onClick={() => { navigator.clipboard?.writeText(a).catch(() => {}); toast.success("Copied"); }}
                  className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-purple-300 transition-all">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* MITRE mapping */}
        <section>
          <SectionHeader icon={Layers} label="MITRE ATT&CK" />
          <div className="mt-2 flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)" }}>
              <Target className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white font-mono">{alert.mitre_id}</p>
              <p className="text-[11px] text-slate-400">{alert.mitre_name}</p>
            </div>
          </div>
        </section>

        {/* CVE */}
        {alert.cve && (
          <section>
            <SectionHeader icon={Shield} label="CVE Reference" />
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/[0.06] border border-red-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-sm font-mono font-bold text-red-300">{alert.cve}</span>
            </div>
          </section>
        )}

        {/* Playbook */}
        <section>
          <SectionHeader icon={GitBranch} label="Playbook Actions" />
          <div className="mt-2 space-y-1.5">
            {[
              "Isolate affected systems from network",
              "Collect memory dump and disk image",
              "Review access logs for lateral movement",
              "Reset credentials for affected accounts",
              "Notify incident response team",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white/[0.01] border border-white/[0.03]">
                <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                  style={{ background: "rgba(139,92,246,0.12)", color: "#a855f7", border: "1px solid rgba(139,92,246,0.2)" }}>
                  {i + 1}
                </span>
                <span className="text-xs text-slate-400 leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline */}
        <section>
          <SectionHeader icon={Activity} label="Timeline" />
          <div className="mt-2 space-y-2 pl-4 relative">
            <div className="absolute left-1.5 top-1 bottom-1 w-px" style={{ background: "rgba(139,92,246,0.08)" }} />
            {[
              { label: "Alert created", time: alert.created_at, color: sev.color },
              { label: "Auto-enrichment completed", time: alert.updated_at, color: "#a855f7" },
              { label: `Assigned to ${alert.assignee}`, time: alert.updated_at, color: "#3b82f6" },
            ].map((ev, i) => (
              <div key={i} className="relative flex items-start gap-2">
                <div className="absolute -left-[14px] top-1.5 w-2 h-2 rounded-full"
                  style={{ background: ev.color, boxShadow: `0 0 6px ${ev.color}55` }} />
                <div>
                  <p className="text-xs text-slate-300">{ev.label}</p>
                  <p className="text-[10px] text-slate-600 font-mono">{absTime(ev.time)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Action footer */}
      <div className="px-5 py-4 shrink-0 space-y-2" style={{ borderTop: "1px solid rgba(139,92,246,0.08)" }}>
        <button onClick={() => onStatusChange(alert.id, "investigating")}
          className="w-full h-9 rounded-lg text-sm font-semibold text-white btn-brand flex items-center justify-center gap-2">
          <ChevronsUp className="w-4 h-4" /> Escalate to Incident
        </button>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Acknowledge", icon: Check, status: "investigating", color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15" },
            { label: "Resolve",     icon: Ban,   status: "resolved",       color: "text-slate-300  bg-white/[0.02]      border-white/[0.06]    hover:bg-white/[0.04]" },
          ].map(({ label, icon: Icon, status, color }) => (
            <button key={label} onClick={() => onStatusChange(alert.id, status)}
              className={cn("h-9 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5", color)}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
        {[
          { label: "Mark False Positive", icon: Shield, status: "false_positive" },
          { label: "Download Evidence",   icon: Download, status: null },
        ].map(({ label, icon: Icon, status }) => (
          <button key={label} onClick={() => status ? onStatusChange(alert.id, status) : toast.info("Preparing download…")}
            className="w-full h-8 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-300 bg-white/[0.01] border border-white/[0.04] hover:bg-white/[0.03] transition-all flex items-center justify-center gap-1.5">
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
        {alert.source_url && (
          <a href={alert.source_url} target="_blank" rel="noopener noreferrer"
            className="w-full h-8 rounded-lg text-xs font-medium text-purple-300 bg-purple-500/[0.05] border border-purple-500/15 hover:bg-purple-500/10 transition-all flex items-center justify-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" /> View Source
          </a>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-purple-400" />
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
  );
}

// ─── Alert list item ──────────────────────────────────────────────────────────

function AlertListItem({
  alert,
  selected,
  checked,
  onSelect,
  onCheck,
}: {
  alert: DemoAlert;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onCheck: () => void;
}) {
  const sev = getSev(alert.severity);
  const statusCfg = getStatusCfg(alert.status);

  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative flex items-start gap-3 px-3 py-3 cursor-pointer transition-all group",
        selected
          ? "bg-purple-500/[0.07] border-l-2"
          : "border-l-2 border-transparent hover:bg-white/[0.02]",
      )}
      style={selected ? { borderLeftColor: sev.color } : {}}
    >
      {/* Unread dot */}
      {alert.unread && !selected && (
        <span className="absolute top-3.5 left-0.5 w-1.5 h-1.5 rounded-full"
          style={{ background: sev.color, boxShadow: `0 0 6px ${sev.color}` }} />
      )}

      {/* Checkbox */}
      <div onClick={(e) => e.stopPropagation()} className="mt-0.5">
        <Checkbox checked={checked} onChange={onCheck} />
      </div>

      {/* Severity dot */}
      <div className="w-2 h-2 rounded-full shrink-0 mt-1.5"
        style={{ background: sev.color, boxShadow: `0 0 6px ${sev.color}66` }} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-semibold leading-snug line-clamp-2 transition-colors",
          selected ? "text-white" : "text-slate-300 group-hover:text-white")}>
          {alert.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border tracking-wider uppercase"
            style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}>
            {sev.label}
          </span>
          <span className="text-[10px] text-slate-600 truncate">{MODULE_LABELS[alert.module]}</span>
          <span className="text-[10px] text-slate-600 ml-auto">{relTime(alert.created_at)}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold border"
            style={{ color: statusCfg.color, background: statusCfg.bg, borderColor: statusCfg.border }}>
            {statusCfg.label}
          </span>
          {alert.assignee !== "Unassigned" && (
            <span className="text-[10px] text-slate-600">{alert.assignee}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type TabKey = "all" | "open" | "mine" | "resolved" | "ignored";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "open",     label: "Open" },
  { key: "mine",     label: "Assigned to me" },
  { key: "resolved", label: "Resolved" },
  { key: "ignored",  label: "Ignored" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const;

export default function AlertsPage() {
  const [orgId, setOrgIdState] = useState("");
  const [apiAlerts, setApiAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiTotal, setApiTotal] = useState(0);
  const [apiFilters, setApiFilters] = useState({ severity: "", module: "", status: "", page: 1 });

  // UI state
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [severities, setSeverities] = useState<string[]>([]);
  const [mods, setMods] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const demoAlerts = useMemo(() => generateDemoAlerts(), []);

  useEffect(() => { setOrgIdState(getOrgId()); }, []);

  const fetchAlerts = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await api.getAlerts(orgId, apiFilters);
      setApiAlerts(res.data ?? []);
      setApiTotal(res.total ?? 0);
    } catch {
      setApiAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, apiFilters]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleStatusChange = async (alertId: string, status: string) => {
    if (apiAlerts.length > 0) {
      try {
        await api.updateAlertStatus(orgId, alertId, status);
        setApiAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status } : a)));
        toast.success(`Alert marked as ${status}`);
      } catch {
        toast.error("Failed to update alert");
      }
    } else {
      setSelectedId(null);
      toast.success(`Alert marked as ${status}`);
    }
  };

  // Merge real API alerts into DemoAlert shape
  const allAlerts: DemoAlert[] = useMemo(() => {
    if (apiAlerts.length > 0) {
      return apiAlerts.map((a, i) => ({
        ...a,
        assignee: DEMO_ASSIGNEES[i % DEMO_ASSIGNEES.length],
        unread: i < 5,
        affected_assets: [`asset-${i}.example.com`],
        mitre_id: MITRE_IDS[i % MITRE_IDS.length],
        mitre_name: MITRE_NAMES[i % MITRE_NAMES.length],
        cve: null,
      }));
    }
    return demoAlerts;
  }, [apiAlerts, demoAlerts]);

  const filtered = useMemo(() => {
    let rows = allAlerts;
    if (tab === "open") rows = rows.filter((a) => a.status === "open" || a.status === "investigating");
    if (tab === "mine") rows = rows.filter((a) => a.assignee === "Alice Chen");
    if (tab === "resolved") rows = rows.filter((a) => a.status === "resolved");
    if (tab === "ignored") rows = rows.filter((a) => a.status === "false_positive");
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((a) => a.title.toLowerCase().includes(q) || a.module.includes(q));
    }
    if (severities.length > 0) rows = rows.filter((a) => severities.includes(a.severity));
    if (mods.length > 0) rows = rows.filter((a) => mods.includes(a.module));
    return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allAlerts, tab, search, severities, mods]);

  const tabCounts = useMemo(() => ({
    all: allAlerts.length,
    open: allAlerts.filter((a) => a.status === "open" || a.status === "investigating").length,
    mine: allAlerts.filter((a) => a.assignee === "Alice Chen").length,
    resolved: allAlerts.filter((a) => a.status === "resolved").length,
    ignored: allAlerts.filter((a) => a.status === "false_positive").length,
  }), [allAlerts]);

  const kpis = useMemo(() => ({
    open: allAlerts.filter((a) => a.status === "open").length,
    unassigned: allAlerts.filter((a) => a.assignee === "Unassigned").length,
    avgRespHrs: 4.2,
    breachImminent: allAlerts.filter((a) => a.severity === "critical" && a.assignee === "Unassigned").length,
  }), [allAlerts]);

  const selectedAlert = useMemo(() => filtered.find((a) => a.id === selectedId) ?? null, [filtered, selectedId]);
  const checkedIds = Object.keys(checked).filter((k) => checked[k]);
  const hasFilters = search || severities.length > 0 || mods.length > 0;
  const clearFilters = () => { setSearch(""); setSeverities([]); setMods([]); };

  const toggleSev = (s: string) =>
    setSeverities((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);
  const toggleMod = (m: string) =>
    setMods((p) => p.includes(m) ? p.filter((x) => x !== m) : [...p, m]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "j") {
        const idx = filtered.findIndex((a) => a.id === selectedId);
        const next = filtered[idx + 1];
        if (next) setSelectedId(next.id);
      }
      if (e.key === "k") {
        const idx = filtered.findIndex((a) => a.id === selectedId);
        const prev = filtered[idx - 1];
        if (prev) setSelectedId(prev.id);
      }
      if (e.key === "e" && selectedId) { toast.info("Escalated"); }
      if (e.key === "c" && selectedId) { handleStatusChange(selectedId, "resolved"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selectedId]);

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(236,72,153,0.1))", border: "1px solid rgba(139,92,246,0.25)" }}>
            <Bell className="w-5 h-5 text-purple-300" />
            {kpis.open > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1"
                style={{ background: "#ef4444", boxShadow: "0 0 8px #ef4444" }}>
                {kpis.open}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Alert Center</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-300 font-bold tracking-wider">LIVE</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Triage, assign, and resolve security alerts across all detection modules</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => toast.info("Opening rule configuration…")}
            className="h-9 px-4 rounded-lg text-sm font-medium text-slate-300 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:text-white transition-all flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Configure rules
          </button>
          <button onClick={() => toast.success("Exporting alerts…")}
            className="h-9 px-4 rounded-lg text-sm font-semibold text-white btn-brand flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Open Alerts",       value: kpis.open,           accent: "#10b981", icon: Activity },
          { label: "Unassigned",        value: kpis.unassigned,     accent: "#f97316", icon: Users },
          { label: "Avg Response",      value: `${kpis.avgRespHrs}h`, accent: "#3b82f6", icon: Clock },
          { label: "Breach Imminent",   value: kpis.breachImminent, accent: "#ef4444", icon: AlertTriangle },
        ].map(({ label, value, accent, icon: Icon }) => (
          <div key={label} className="stat-card p-4 flex items-center gap-3 overflow-hidden relative">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${accent}14`, border: `1px solid ${accent}33` }}>
              <Icon className="w-4 h-4" style={{ color: accent }} />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-semibold">{label}</p>
              <p className="text-xl font-bold font-mono text-white leading-tight mt-0.5">{value}</p>
            </div>
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.04] blur-xl"
              style={{ background: accent, transform: "translate(30%, -30%)" }} />
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "rgba(139,92,246,0.08)" }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("relative px-4 h-10 flex items-center gap-2 text-sm font-medium transition-all",
              tab === key ? "text-white" : "text-slate-500 hover:text-slate-300")}>
            {label}
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold",
              tab === key ? "bg-purple-500/15 text-purple-300" : "bg-white/[0.04] text-slate-500")}>
              {tabCounts[key]}
            </span>
            {tab === key && (
              <div className="absolute left-0 right-0 bottom-[-1px] h-[2px] rounded-full"
                style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="card-enterprise p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search alerts…"
              className="w-full h-9 pl-10 pr-4 rounded-lg bg-white/[0.02] border border-purple-500/[0.08] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/20 transition-all" />
          </div>
          {SEVERITY_OPTIONS.map((s) => {
            const cfg = getSev(s);
            return (
              <button key={s} onClick={() => toggleSev(s)}
                className={cn("h-9 px-3 rounded-lg text-[11px] font-semibold border transition-all",
                  severities.includes(s) ? "opacity-100" : "opacity-50 hover:opacity-80")}
                style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
                {cfg.label}
              </button>
            );
          })}
          {MODULES.slice(0, 3).map((m) => (
            <button key={m} onClick={() => toggleMod(m)}
              className={cn("h-9 px-3 rounded-lg text-[11px] font-semibold border transition-all",
                mods.includes(m)
                  ? "bg-purple-500/15 text-purple-200 border-purple-500/30"
                  : "bg-white/[0.02] text-slate-500 border-white/[0.04] hover:text-slate-300 hover:bg-white/[0.04]")}>
              {MODULE_LABELS[m]}
            </button>
          ))}
          {hasFilters && (
            <button onClick={clearFilters}
              className="h-9 px-3 rounded-lg text-xs text-slate-400 hover:text-white bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all flex items-center gap-1.5">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: "1px solid rgba(139,92,246,0.05)" }}>
          <Filter className="w-3 h-3 text-slate-600" />
          <span className="text-[11px] text-slate-500">
            <span className="text-purple-300 font-semibold">{filtered.length}</span> alerts
            {apiAlerts.length === 0 && <span className="ml-1.5 text-slate-600">· demo data</span>}
          </span>
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {checkedIds.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl animate-fade-up"
          style={{ background: "linear-gradient(90deg,rgba(139,92,246,0.08),rgba(236,72,153,0.05))", border: "1px solid rgba(139,92,246,0.25)" }}>
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs font-bold">
              {checkedIds.length}
            </span>
            <span className="text-sm text-slate-200">alert{checkedIds.length > 1 ? "s" : ""} selected</span>
          </div>
          <div className="flex items-center gap-2">
            {[
              { label: "Assign",           icon: Users,        color: "text-blue-300 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20" },
              { label: "Escalate",         icon: ChevronsUp,   color: "text-red-300 bg-red-500/10 border-red-500/20 hover:bg-red-500/20" },
              { label: "Mark FP",          icon: Shield,       color: "text-purple-300 bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20" },
              { label: "Close",            icon: Check,        color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20" },
              { label: "Export",           icon: Download,     color: "text-slate-400 bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:text-white" },
            ].map(({ label, icon: Icon, color }) => (
              <button key={label} onClick={() => { toast.info(label); setChecked({}); }}
                className={cn("h-8 px-3 rounded-md text-xs font-semibold border transition-all flex items-center gap-1.5", color)}>
                <Icon className="w-3 h-3" /> {label}
              </button>
            ))}
            <button onClick={() => setChecked({})}
              className="h-8 w-8 rounded-md flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.04] transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Master/detail layout ── */}
      <div className="flex gap-0 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.08)", minHeight: 600 }}>
        {/* Left list */}
        <div className="w-[380px] shrink-0 flex flex-col overflow-hidden"
          style={{ borderRight: "1px solid rgba(139,92,246,0.06)", background: "rgba(17,13,26,0.6)" }}>
          {/* List header */}
          <div className="px-3 py-2.5 flex items-center justify-between shrink-0"
            style={{ borderBottom: "1px solid rgba(139,92,246,0.06)", background: "rgba(7,4,11,0.4)" }}>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={filtered.length > 0 && filtered.every((a) => checked[a.id])}
                onChange={() => {
                  const all = filtered.every((a) => checked[a.id]);
                  const next: Record<string, boolean> = {};
                  if (!all) filtered.forEach((a) => { next[a.id] = true; });
                  setChecked(next);
                }}
              />
              <span className="text-[11px] text-slate-500 font-mono">{filtered.length} alerts</span>
            </div>
            <button onClick={() => fetchAlerts()}
              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-purple-300 transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List body */}
          <div className="flex-1 overflow-y-auto divide-y divide-purple-500/[0.04]">
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-2">
                <InfinityLoader size={20} />
                <span className="text-xs text-slate-500">Loading…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Inbox className="w-8 h-8 text-slate-700" />
                <p className="text-xs text-slate-500">No alerts match filters</p>
                {hasFilters && <button onClick={clearFilters} className="text-xs text-purple-300 hover:underline">Clear filters</button>}
              </div>
            ) : (
              filtered.map((alert) => (
                <AlertListItem
                  key={alert.id}
                  alert={alert}
                  selected={selectedId === alert.id}
                  checked={!!checked[alert.id]}
                  onSelect={() => setSelectedId(alert.id)}
                  onCheck={() => setChecked((p) => ({ ...p, [alert.id]: !p[alert.id] }))}
                />
              ))
            )}
          </div>
        </div>

        {/* Right detail */}
        <div className="flex-1 overflow-hidden" style={{ background: "rgba(13,10,20,0.8)" }}>
          <AlertDetail
            alert={selectedAlert}
            onClose={() => setSelectedId(null)}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>

      {/* ── Keyboard shortcuts footer ── */}
      <div className="flex items-center justify-center gap-4 py-2">
        {[
          { key: "J / K", desc: "Navigate" },
          { key: "E",     desc: "Escalate" },
          { key: "C",     desc: "Close" },
        ].map(({ key, desc }) => (
          <div key={key} className="flex items-center gap-1.5">
            <kbd className="px-2 py-0.5 rounded text-[10px] font-bold font-mono text-slate-400 bg-white/[0.04] border border-white/[0.08]">{key}</kbd>
            <span className="text-[11px] text-slate-600">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
