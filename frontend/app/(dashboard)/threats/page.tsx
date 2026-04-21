"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { api, getOrgId, type Alert } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow, format, subDays, subHours, subMinutes } from "date-fns";
import {
  Activity, Search, SlidersHorizontal, RefreshCw, ExternalLink,
  ChevronDown, X, Copy, AlertTriangle, Crosshair, Users, TrendingUp,
  Shield, Zap, Clock, Eye, GitBranch, Radio, Filter,
  ArrowUpRight, Target, Globe, Database, Lock,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

// ─── Demo data ────────────────────────────────────────────────────────────────

const ACTORS = [
  { name: "APT29 (Cozy Bear)", count: 47, trend: "+12%", origin: "RU" },
  { name: "FIN7", count: 38, trend: "+8%", origin: "UA" },
  { name: "Lazarus Group", count: 31, trend: "+21%", origin: "KP" },
  { name: "Scattered Spider", count: 27, trend: "+5%", origin: "UK" },
  { name: "APT41 (Double Dragon)", count: 22, trend: "-3%", origin: "CN" },
];

const CAMPAIGNS = [
  { name: "Operation GhostNet", victims: 34, lastSeen: "2h ago", severity: "critical", module: "dark_web" },
  { name: "SolarFlare Campaign", victims: 19, lastSeen: "6h ago", severity: "high", module: "credential" },
  { name: "Volt Typhoon Wave 3", victims: 12, lastSeen: "1d ago", severity: "high", module: "surface_web" },
];

const MITRE_TACTICS = [
  "Initial Access", "Execution", "Persistence", "Privilege Escalation",
  "Defense Evasion", "Credential Access", "Discovery", "Lateral Movement",
  "Collection", "Exfiltration", "Impact", "Command & Control",
];

const MODULES = ["dark_web", "brand", "data_leak", "surface_web", "credential", "cert_monitor"];

const MODULE_LABELS: Record<string, string> = {
  dark_web: "Dark Web",
  brand: "Brand",
  data_leak: "Data Leak",
  surface_web: "Surface Web",
  credential: "Credential",
  cert_monitor: "Certificate",
};

const IOC_POOL = [
  "192.168.14.229", "10.0.0.57", "45.77.123.14", "103.21.244.0",
  "evil-domain.ru", "c2-server.xyz", "update-microsoft.cc", "cdn-secure.net",
  "d41d8cd98f00b204e9800998ecf8427e", "5f4dcc3b5aa765d61d8327deb882cf99",
  "CVE-2024-21762", "CVE-2024-3400", "CVE-2024-1709", "CVE-2023-46805",
  "john.doe@acme.com", "admin@target-corp.com",
];

const DEMO_TITLES = [
  "APT29 phishing campaign targeting financial sector employees",
  "FIN7 POS malware variant detected in retail network",
  "Lazarus Group cryptocurrency exchange breach confirmed",
  "Scattered Spider vishing attack against IT helpdesk",
  "APT41 supply chain compromise via software update mechanism",
  "Credential stuffing attack against SaaS platform detected",
  "Dark web forum posts selling org domain credentials",
  "New ransomware strain targeting healthcare organizations",
  "BGP hijacking attempt detected for organization prefix",
  "Exposed AWS S3 bucket containing customer PII found",
  "Typosquatting domain registered mimicking corporate brand",
  "Certificate issued for lookalike phishing domain",
  "Cobalt Strike beacon C2 communication detected",
  "Malicious npm package impersonating internal SDK",
  "Stealer log dump includes employee credentials",
  "Brute force attack against VPN concentrator",
  "Threat actor advertising org data on Telegram channel",
  "Zero-day exploit for enterprise VPN being traded",
  "Watering hole attack targeting sector conference website",
  "Insider threat indicator: abnormal data exfiltration pattern",
  "DNS rebinding attack infrastructure deployed",
  "Malvertising campaign serving exploit kits to users",
  "Critical RCE in widely-used open source library",
  "Phishing kit mimicking org login portal deployed",
  "Data broker exposing employee personal information",
];

function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateDemoThreats(): Alert[] {
  const rnd = seedRand(0xdeadbeef);
  const now = new Date("2026-04-21T12:00:00Z");
  return Array.from({ length: 25 }, (_, i) => {
    const r = rnd;
    const hoursAgo = Math.floor(rnd() * 720);
    const sev = (() => {
      const v = rnd();
      if (v < 0.12) return "critical";
      if (v < 0.35) return "high";
      if (v < 0.70) return "medium";
      return "low";
    })();
    const mod = MODULES[Math.floor(rnd() * MODULES.length)];
    const actor = rnd() > 0.4 ? ACTORS[Math.floor(rnd() * ACTORS.length)].name : null;
    const mitre = MITRE_TACTICS[Math.floor(rnd() * MITRE_TACTICS.length)];
    const iocs = [
      IOC_POOL[Math.floor(rnd() * IOC_POOL.length)],
      IOC_POOL[Math.floor(rnd() * IOC_POOL.length)],
      IOC_POOL[Math.floor(rnd() * IOC_POOL.length)],
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);
    const score = Math.round(
      sev === "critical" ? 80 + rnd() * 20 :
      sev === "high" ? 60 + rnd() * 20 :
      sev === "medium" ? 35 + rnd() * 25 :
      10 + rnd() * 25
    );
    return {
      id: `demo-${i}`,
      org_id: "demo",
      asset_id: null,
      module: mod,
      severity: sev,
      title: DEMO_TITLES[i % DEMO_TITLES.length],
      description: `Threat intelligence indicates active exploitation attempts. Affected systems require immediate investigation. Actor TTPs match known ${sev}-severity playbook.`,
      source_url: rnd() > 0.5 ? "https://example.com/report" : "",
      raw_data: {
        actor,
        mitre_tactic: mitre,
        iocs,
      },
      risk_score: score,
      status: rnd() > 0.6 ? "open" : rnd() > 0.5 ? "investigating" : "resolved",
      tags: [mitre.toLowerCase().replace(/ /g, "_"), mod],
      created_at: new Date(now.getTime() - hoursAgo * 3600000).toISOString(),
      updated_at: new Date(now.getTime() - Math.floor(rnd() * hoursAgo) * 3600000).toISOString(),
    };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEV_CONFIG = {
  critical: { label: "Critical", color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", dot: "bg-red-500" },
  high:     { label: "High",     color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)", dot: "bg-orange-500" },
  medium:   { label: "Medium",   color: "#eab308", bg: "rgba(234,179,8,0.08)",  border: "rgba(234,179,8,0.2)",  dot: "bg-yellow-500" },
  low:      { label: "Low",      color: "#3b82f6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)", dot: "bg-blue-500" },
  info:     { label: "Info",     color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.2)", dot: "bg-slate-500" },
};

function getSev(s: string) {
  return SEV_CONFIG[s as keyof typeof SEV_CONFIG] ?? SEV_CONFIG.info;
}

function relativeTime(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); }
  catch { return "recently"; }
}

function absoluteTime(iso: string) {
  try { return format(new Date(iso), "MMM d, yyyy HH:mm"); }
  catch { return iso; }
}

function groupByDay(threats: Alert[]): [string, Alert[]][] {
  const map = new Map<string, Alert[]>();
  for (const t of threats) {
    try {
      const key = format(new Date(t.created_at), "EEEE, MMMM d");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    } catch { /* skip */ }
  }
  return Array.from(map.entries());
}

// ─── Radar SVG ────────────────────────────────────────────────────────────────

function ThreatRadar({ threats }: { threats: Alert[] }) {
  const [sweep, setSweep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSweep((s) => (s + 2) % 360), 30);
    return () => clearInterval(id);
  }, []);

  const modCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of threats) c[t.module] = (c[t.module] ?? 0) + 1;
    return c;
  }, [threats]);

  const axes = Object.keys(MODULE_LABELS);
  const n = axes.length;
  const cx = 90, cy = 90, R = 70;
  const rings = [0.25, 0.5, 0.75, 1];
  const maxVal = Math.max(...axes.map((m) => modCounts[m] ?? 0), 1);

  const point = (idx: number, frac: number) => {
    const angle = (idx / n) * 2 * Math.PI - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * R * frac,
      y: cy + Math.sin(angle) * R * frac,
    };
  };

  const dataPoints = axes.map((m, i) => point(i, Math.max(0.05, (modCounts[m] ?? 0) / maxVal)));
  const polyPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";

  const sweepRad = (sweep / 180) * Math.PI;
  const sx = cx + Math.cos(sweepRad) * R;
  const sy = cy + Math.sin(sweepRad) * R;

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <defs>
          <radialGradient id="radar-sweep" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="poly-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {rings.map((r) => (
          <polygon
            key={r}
            points={axes.map((_, i) => { const p = point(i, r); return `${p.x},${p.y}`; }).join(" ")}
            fill="none"
            stroke="rgba(139,92,246,0.1)"
            strokeWidth="1"
          />
        ))}
        {axes.map((_, i) => {
          const p = point(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(139,92,246,0.08)" strokeWidth="1" />;
        })}
        <path d={polyPath} fill="url(#poly-fill)" stroke="rgba(139,92,246,0.5)" strokeWidth="1.5" />
        {/* Sweep */}
        <path
          d={`M${cx},${cy} L${sx},${sy} A${R},${R} 0 0,1 ${cx + Math.cos(sweepRad - 0.4) * R},${cy + Math.sin(sweepRad - 0.4) * R} Z`}
          fill="url(#radar-sweep)"
        />
        <line x1={cx} y1={cy} x2={sx} y2={sy} stroke="#8b5cf6" strokeWidth="1.5" opacity="0.7" />
        <circle cx={cx} cy={cy} r="3" fill="#8b5cf6" />
        {axes.map((m, i) => {
          const p = point(i, 1.18);
          return (
            <text key={m} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              fontSize="7.5" fill="rgba(148,163,184,0.8)" fontFamily="monospace">
              {MODULE_LABELS[m]}
            </text>
          );
        })}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#ec4899" opacity="0.8" />
        ))}
      </svg>
    </div>
  );
}

// ─── Donut ────────────────────────────────────────────────────────────────────

function SeverityDonut({ threats }: { threats: Alert[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const data = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of threats) c[t.severity] = (c[t.severity] ?? 0) + 1;
    return (["critical", "high", "medium", "low"] as const)
      .filter((s) => c[s])
      .map((s) => ({ name: getSev(s).label, value: c[s], color: getSev(s).color }));
  }, [threats]);

  if (data.length === 0 || !mounted) return null;

  return (
    <ResponsiveContainer width="100%" height={140}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={38} outerRadius={58}
          paddingAngle={3} dataKey="value" strokeWidth={0}>
          {data.map((d) => <Cell key={d.name} fill={d.color} fillOpacity={0.85} />)}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 8, fontSize: 12 }}
          itemStyle={{ color: "#e2e8f0" }}
          labelStyle={{ color: "#a855f7" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Threat Card ──────────────────────────────────────────────────────────────

function ThreatCard({ threat, onClick }: { threat: Alert; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const sev = getSev(threat.severity);
  const actor = threat.raw_data?.actor as string | null;
  const mitre = threat.raw_data?.mitre_tactic as string | null;
  const iocs = (threat.raw_data?.iocs as string[] | null) ?? [];

  const copyIOC = (ioc: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(ioc).catch(() => {});
    toast.success("IOC copied");
  };

  return (
    <div
      className={cn(
        "relative card-enterprise cursor-pointer transition-all duration-200 overflow-hidden group",
        hovered && "border-purple-500/20"
      )}
      style={{ borderLeft: `3px solid ${sev.color}` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* Risk bar top */}
      <div className="absolute top-0 right-0 w-1 h-full opacity-20" style={{ background: sev.color }} />

      <div className="p-4">
        {/* Row 1: badges + score */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase"
              style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}>
              {sev.label}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-purple-500/[0.06] text-purple-300 border-purple-500/20 tracking-wide">
              {MODULE_LABELS[threat.module] ?? threat.module}
            </span>
            {mitre && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium border bg-cyan-500/[0.06] text-cyan-300 border-cyan-500/20 tracking-wide hidden sm:inline">
                {mitre}
              </span>
            )}
          </div>
          {/* Risk score bar */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[11px] font-mono font-bold" style={{ color: sev.color }}>
              {threat.risk_score}
            </span>
            <div className="w-20 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${threat.risk_score}%`,
                background: `linear-gradient(90deg, ${sev.color}88, ${sev.color})`,
              }} />
            </div>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-slate-100 mt-2.5 leading-snug line-clamp-2 group-hover:text-white transition-colors">
          {threat.title}
        </h3>

        {/* Actor + time */}
        <div className="flex items-center gap-3 mt-2">
          {actor && (
            <div className="flex items-center gap-1.5 text-[11px] text-orange-300/80">
              <Target className="w-3 h-3" />
              {actor}
            </div>
          )}
          <div className="flex items-center gap-1 text-[11px] text-slate-500 ml-auto group/time">
            <Clock className="w-3 h-3" />
            <span className="group-hover/time:hidden">{relativeTime(threat.created_at)}</span>
            <span className="hidden group-hover/time:inline">{absoluteTime(threat.created_at)}</span>
          </div>
        </div>

        {/* IOCs */}
        {iocs.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-600 uppercase tracking-wider">IOCs:</span>
            {iocs.slice(0, 3).map((ioc) => (
              <button
                key={ioc}
                onClick={(e) => copyIOC(ioc, e)}
                className="group/ioc flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-white/[0.03] border border-white/[0.05] hover:border-purple-500/25 hover:text-purple-200 transition-all"
              >
                {ioc.length > 20 ? ioc.slice(0, 20) + "…" : ioc}
                <Copy className="w-2.5 h-2.5 opacity-0 group-hover/ioc:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover quick-actions */}
      <div className={cn(
        "absolute bottom-0 right-0 flex items-center gap-1 px-3 py-2 transition-all duration-200",
        hovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}>
        {[
          { icon: Eye, label: "View", color: "text-purple-300 hover:bg-purple-500/10" },
          { icon: Crosshair, label: "Triage", color: "text-orange-300 hover:bg-orange-500/10" },
          { icon: ArrowUpRight, label: "Escalate", color: "text-red-300 hover:bg-red-500/10" },
          { icon: Copy, label: "Copy IOC", color: "text-slate-400 hover:bg-white/[0.05]" },
        ].map(({ icon: Icon, label, color }) => (
          <button
            key={label}
            title={label}
            onClick={(e) => { e.stopPropagation(); toast.info(label); }}
            className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", color)}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function ThreatDrawer({ threat, onClose }: { threat: Alert | null; onClose: () => void }) {
  if (!threat) return null;
  const sev = getSev(threat.severity);
  const actor = threat.raw_data?.actor as string | null;
  const mitre = threat.raw_data?.mitre_tactic as string | null;
  const iocs = (threat.raw_data?.iocs as string[] | null) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40 backdrop-blur-sm" />
      <div
        className="w-full max-w-[520px] h-full overflow-y-auto animate-slide-in"
        style={{ background: "#0d0a14", borderLeft: "1px solid rgba(139,92,246,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{ background: "#0d0a14", borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded text-[10px] font-bold border uppercase tracking-wider"
              style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}>
              {sev.label}
            </span>
            <span className="text-xs text-slate-500">{MODULE_LABELS[threat.module] ?? threat.module}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white leading-snug">{threat.title}</h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">{threat.description}</p>
          </div>

          {/* Risk score */}
          <div className="stat-card p-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Risk Score</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold font-mono" style={{ color: sev.color }}>{threat.risk_score}</span>
              <div className="flex-1 h-2 rounded-full bg-white/[0.05]">
                <div className="h-full rounded-full" style={{ width: `${threat.risk_score}%`, background: `linear-gradient(90deg, ${sev.color}66, ${sev.color})` }} />
              </div>
              <span className="text-xs text-slate-500">/100</span>
            </div>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Detected", value: absoluteTime(threat.created_at) },
              { label: "Status", value: threat.status },
              { label: "MITRE Tactic", value: mitre ?? "Unknown" },
              { label: "Actor", value: actor ?? "Unknown" },
            ].map(({ label, value }) => (
              <div key={label} className="card-enterprise p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm text-slate-200 font-medium capitalize">{value}</p>
              </div>
            ))}
          </div>

          {/* IOCs */}
          {iocs.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Indicators of Compromise</p>
              <div className="space-y-2">
                {iocs.map((ioc) => (
                  <div key={ioc} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-sm font-mono text-slate-300">{ioc}</span>
                    <button
                      onClick={() => { navigator.clipboard?.writeText(ioc).catch(() => {}); toast.success("Copied"); }}
                      className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-purple-300 hover:bg-purple-500/10 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <button className="h-10 rounded-lg text-sm font-semibold text-white btn-brand flex items-center justify-center gap-2"
              onClick={() => toast.info("Escalated to incident")}>
              <ArrowUpRight className="w-4 h-4" /> Escalate to Incident
            </button>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Assign", icon: Users },
                { label: "Mark FP", icon: Shield },
              ].map(({ label, icon: Icon }) => (
                <button key={label} onClick={() => toast.info(label)}
                  className="h-9 rounded-lg text-sm font-medium text-slate-300 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:text-white transition-all flex items-center justify-center gap-2">
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
            {threat.source_url && (
              <a href={threat.source_url} target="_blank" rel="noopener noreferrer"
                className="h-9 rounded-lg text-sm font-medium text-purple-300 bg-purple-500/[0.06] border border-purple-500/20 hover:bg-purple-500/10 transition-all flex items-center justify-center gap-2">
                <ExternalLink className="w-3.5 h-3.5" /> View Source
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const;
const DATE_PRESETS = ["1h", "24h", "7d", "30d"] as const;

export default function ThreatsPage() {
  const [orgId, setOrgIdState] = useState("");
  const [apiThreats, setApiThreats] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severities, setSeverities] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<string>("7d");
  const [selected, setSelected] = useState<Alert | null>(null);
  const [newIndicator, setNewIndicator] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const demoThreats = useMemo(() => generateDemoThreats(), []);

  useEffect(() => { setOrgIdState(getOrgId()); }, []);

  useEffect(() => {
    if (!orgId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getAlerts(orgId, { module: modules[0], severity: severities[0] });
        setApiThreats(res.data ?? []);
      } catch {
        setApiThreats([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orgId, lastRefresh, modules, severities]);

  // Simulate new threat arriving every 45s
  useEffect(() => {
    const id = setInterval(() => {
      setNewIndicator(true);
      setTimeout(() => setNewIndicator(false), 4000);
    }, 45000);
    return () => clearInterval(id);
  }, []);

  const threats = useMemo(() => (apiThreats.length > 0 ? apiThreats : demoThreats), [apiThreats, demoThreats]);

  const filtered = useMemo(() => {
    let rows = threats;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((t) => t.title.toLowerCase().includes(q) || t.module.includes(q));
    }
    if (severities.length > 0) rows = rows.filter((t) => severities.includes(t.severity));
    if (modules.length > 0) rows = rows.filter((t) => modules.includes(t.module));
    if (dateRange) {
      const now = Date.now();
      const hrs = dateRange === "1h" ? 1 : dateRange === "24h" ? 24 : dateRange === "7d" ? 168 : 720;
      rows = rows.filter((t) => new Date(t.created_at).getTime() >= now - hrs * 3600000);
    }
    return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [threats, search, severities, modules, dateRange]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
    for (const t of threats) {
      c.total++;
      if (t.severity in c) (c as Record<string, number>)[t.severity]++;
    }
    const today = format(new Date(), "yyyy-MM-dd");
    const todayCount = threats.filter((t) => t.created_at.startsWith(today)).length;
    return { ...c, today: todayCount };
  }, [threats]);

  const toggleSev = (s: string) =>
    setSeverities((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  const toggleMod = (m: string) =>
    setModules((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  const clearFilters = () => { setSearch(""); setSeverities([]); setModules([]); setDateRange("7d"); };
  const hasFilters = search || severities.length > 0 || modules.length > 0;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,rgba(239,68,68,0.15),rgba(249,115,22,0.1))", border: "1px solid rgba(239,68,68,0.25)" }}>
            <Activity className="w-5 h-5 text-red-300" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" style={{ boxShadow: "0 0 10px #ef4444" }} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Threat Feed</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/[0.08] border border-red-500/20">
                <span className="status-critical animate-pulse" style={{ width: 6, height: 6 }} />
                <span className="text-[10px] text-red-300 font-bold tracking-wider">LIVE</span>
              </div>
              {/* KPI chips */}
              {(["critical", "high", "medium", "low"] as const).map((s) => {
                const cfg = getSev(s);
                const n = counts[s];
                if (!n) return null;
                return (
                  <button key={s} onClick={() => toggleSev(s)}
                    className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all",
                      severities.includes(s) ? "opacity-100" : "opacity-70 hover:opacity-100"
                    )}
                    style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                    {n} {cfg.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Real-time threat intelligence stream across all monitored attack surface</p>
          </div>
        </div>
        <button onClick={() => { setLastRefresh(Date.now()); toast.success("Feed refreshed"); }}
          className="h-9 px-4 rounded-lg text-sm font-medium text-slate-300 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:text-white transition-all flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Threats", value: counts.total, accent: "#a855f7", spark: true },
          { label: "Critical", value: counts.critical, accent: "#ef4444" },
          { label: "New Today", value: counts.today, accent: "#10b981" },
          { label: "Avg Risk Score",
            value: threats.length
              ? Math.round(threats.reduce((a, t) => a + t.risk_score, 0) / threats.length)
              : 0,
            accent: "#f97316", suffix: "/100" },
        ].map(({ label, value, accent, suffix, spark }) => (
          <div key={label} className="stat-card p-4 overflow-hidden relative">
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">{label}</p>
            <div className="flex items-baseline gap-1 mt-2">
              <p className="text-[24px] font-bold font-mono text-white leading-none">{value}</p>
              {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
            </div>
            {spark && (
              <svg className="absolute bottom-0 right-0 w-28 h-10 opacity-60" viewBox="0 0 120 40" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`sg-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={accent} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 30 L10 26 L20 28 L30 18 L40 22 L50 14 L60 20 L70 10 L80 16 L90 8 L100 12 L110 6 L120 8 L120 40 L0 40 Z"
                  fill={`url(#sg-${label})`} />
                <path d="M0 30 L10 26 L20 28 L30 18 L40 22 L50 14 L60 20 L70 10 L80 16 L90 8 L100 12 L110 6 L120 8"
                  stroke={accent} strokeWidth="1.5" fill="none" />
              </svg>
            )}
            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="card-enterprise p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search threats..."
              className="w-full h-9 pl-10 pr-4 rounded-lg bg-white/[0.02] border border-purple-500/[0.08] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/20 transition-all"
            />
          </div>
          {/* Date presets */}
          <div className="flex items-center gap-1">
            {DATE_PRESETS.map((p) => (
              <button key={p} onClick={() => setDateRange(p)}
                className={cn("h-9 px-3 rounded-lg text-xs font-semibold transition-all",
                  dateRange === p
                    ? "text-white btn-brand"
                    : "text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white hover:bg-white/[0.04]"
                )}>
                {p}
              </button>
            ))}
          </div>
          {/* Severity chips */}
          {SEVERITY_OPTIONS.map((s) => {
            const cfg = getSev(s);
            return (
              <button key={s} onClick={() => toggleSev(s)}
                className={cn("h-9 px-3 rounded-lg text-[11px] font-semibold border transition-all",
                  severities.includes(s)
                    ? "opacity-100"
                    : "opacity-50 hover:opacity-80"
                )}
                style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
                {cfg.label}
              </button>
            );
          })}
          {/* Module chips */}
          {MODULES.slice(0, 4).map((m) => (
            <button key={m} onClick={() => toggleMod(m)}
              className={cn("h-9 px-3 rounded-lg text-[11px] font-semibold border transition-all",
                modules.includes(m)
                  ? "bg-purple-500/15 text-purple-200 border-purple-500/30"
                  : "bg-white/[0.02] text-slate-500 border-white/[0.04] hover:text-slate-300 hover:bg-white/[0.04]"
              )}>
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
            Showing <span className="text-purple-300 font-semibold">{filtered.length}</span> of <span className="text-slate-300">{threats.length}</span> threats
            {apiThreats.length === 0 && <span className="ml-1.5 text-slate-600">· demo data</span>}
          </span>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ─── Left: feed (2/3) ─── */}
        <div className="lg:col-span-2 space-y-4">
          {/* New threat indicator */}
          {newIndicator && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl animate-fade-up"
              style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: "0 0 8px #10b981" }} />
              <span className="text-xs text-emerald-300 font-medium">New threat intelligence received</span>
              <span className="ml-auto text-[10px] text-emerald-400/60">just now</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
              <p className="text-xs text-slate-500">Loading threat intelligence…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card-enterprise flex flex-col items-center justify-center py-16 gap-3">
              <Globe className="w-10 h-10 text-slate-700" />
              <p className="text-sm text-slate-400">No threats match your filters</p>
              <button onClick={clearFilters} className="text-xs text-purple-300 hover:underline">Clear filters</button>
            </div>
          ) : (
            grouped.map(([day, dayThreats]) => (
              <div key={day} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest whitespace-nowrap">{day}</span>
                  <div className="flex-1 h-px" style={{ background: "rgba(139,92,246,0.08)" }} />
                  <span className="text-[10px] text-slate-600 font-mono">{dayThreats.length} events</span>
                </div>
                <div className="relative space-y-2 pl-5">
                  {/* Timeline line */}
                  <div className="absolute left-1.5 top-2 bottom-2 w-px" style={{ background: "rgba(139,92,246,0.1)" }} />
                  {dayThreats.map((t) => {
                    const sev = getSev(t.severity);
                    return (
                      <div key={t.id} className="relative">
                        <div className="absolute -left-[14px] top-4 w-2.5 h-2.5 rounded-full border-2"
                          style={{ background: sev.color, borderColor: "#07040B", boxShadow: `0 0 8px ${sev.color}66` }} />
                        <ThreatCard threat={t} onClick={() => setSelected(t)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ─── Right: sidebar (1/3) ─── */}
        <div className="space-y-4">
          {/* Threat Radar */}
          <div className="card-enterprise p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-slate-200">Threat Radar</span>
              </div>
              <span className="text-[10px] text-slate-600 font-mono">by module</span>
            </div>
            <ThreatRadar threats={threats} />
          </div>

          {/* Severity donut */}
          <div className="card-enterprise p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-slate-200">Severity Distribution</span>
              </div>
            </div>
            <SeverityDonut threats={threats} />
            <div className="flex items-center justify-center gap-3 mt-1 flex-wrap">
              {(["critical", "high", "medium", "low"] as const).map((s) => {
                const cfg = getSev(s);
                const n = threats.filter((t) => t.severity === s).length;
                if (!n) return null;
                return (
                  <div key={s} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                    <span className="text-[10px] text-slate-500">{cfg.label} <span className="text-slate-300">{n}</span></span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Threat Actors */}
          <div className="card-enterprise p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-slate-200">Top Threat Actors</span>
            </div>
            <div className="space-y-2.5">
              {ACTORS.map((actor, i) => (
                <div key={actor.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-600 w-3">{i + 1}</span>
                      <span className="text-xs text-slate-300 font-medium">{actor.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("text-[10px] font-semibold", actor.trend.startsWith("+") ? "text-red-400" : "text-emerald-400")}>
                        {actor.trend}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{actor.count}</span>
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.04]">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${(actor.count / ACTORS[0].count) * 100}%`,
                      background: `linear-gradient(90deg, rgba(139,92,246,0.4), rgba(236,72,153,0.6))`,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Campaigns */}
          <div className="card-enterprise p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold text-slate-200">Active Campaigns</span>
            </div>
            <div className="space-y-2">
              {CAMPAIGNS.map((c) => {
                const sev = getSev(c.severity);
                return (
                  <div key={c.name} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-purple-500/15 transition-all cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200">{c.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase"
                        style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}>
                        {sev.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Database className="w-3 h-3" />{c.victims} victims
                      </span>
                      <span className="text-[11px] text-slate-600">{c.lastSeen}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      <ThreatDrawer threat={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
