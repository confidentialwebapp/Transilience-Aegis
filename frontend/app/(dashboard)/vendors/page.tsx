"use client";

import { InfinityLoader } from "@/components/InfinityLoader";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { getOrgId } from "@/lib/api";
import { toast } from "sonner";
import {
  Building2, Plus, Search, Shield,
  ChevronLeft, ChevronRight, Scan, Trash2,
  X, Download, AlertTriangle, TrendingDown,
  TrendingUp, ExternalLink, Filter, RefreshCw,
  Eye, Globe, KeyRound, Tag,
  GitBranch, Cpu, CheckCircle2, Clock,
  ChevronDown
} from "lucide-react";
import {
  LineChart, Line, ResponsiveContainer, Tooltip,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

async function apiFetch(path: string, options: RequestInit = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId(), ...(options.headers ?? {}) },
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// ── Demo Data ────────────────────────────────────────────────────────────────
interface Vendor {
  id: string;
  name: string;
  domain: string;
  industry: string;
  country: string;
  flag: string;
  score: number;
  grade: string;
  tier: "critical" | "high" | "medium" | "low";
  access: "Read" | "Write" | "Admin";
  breach: string | null;
  assessed: string;
  certs: string[];
  trend: number[];
  categories: Array<{ label: string; score: number; icon: string }>;
}

const DEMO_VENDORS: Vendor[] = [
  {
    id: "v1", name: "Okta", domain: "okta.com", industry: "Identity & IAM", country: "USA", flag: "🇺🇸",
    score: 88, grade: "A", tier: "critical", access: "Admin", breach: null, assessed: "Apr 18, 2024",
    certs: ["SOC2", "ISO27001", "FedRAMP"],
    trend: [82, 84, 83, 86, 87, 88, 88],
    categories: [
      { label: "Network", score: 90, icon: "Globe" }, { label: "Credentials", score: 85, icon: "KeyRound" },
      { label: "Patching", score: 92, icon: "Cpu" }, { label: "Dark Web", score: 88, icon: "Eye" },
      { label: "Supply Chain", score: 84, icon: "GitBranch" }, { label: "Brand", score: 91, icon: "Tag" },
    ],
  },
  {
    id: "v2", name: "Salesforce", domain: "salesforce.com", industry: "CRM / SaaS", country: "USA", flag: "🇺🇸",
    score: 91, grade: "A+", tier: "critical", access: "Admin", breach: null, assessed: "Apr 16, 2024",
    certs: ["SOC2", "ISO27001", "PCI-DSS"],
    trend: [89, 90, 91, 91, 90, 91, 91],
    categories: [
      { label: "Network", score: 94, icon: "Globe" }, { label: "Credentials", score: 89, icon: "KeyRound" },
      { label: "Patching", score: 93, icon: "Cpu" }, { label: "Dark Web", score: 90, icon: "Eye" },
      { label: "Supply Chain", score: 92, icon: "GitBranch" }, { label: "Brand", score: 89, icon: "Tag" },
    ],
  },
  {
    id: "v3", name: "Cloudflare", domain: "cloudflare.com", industry: "CDN / Security", country: "USA", flag: "🇺🇸",
    score: 95, grade: "A+", tier: "high", access: "Admin", breach: null, assessed: "Apr 20, 2024",
    certs: ["SOC2", "ISO27001"],
    trend: [93, 94, 94, 95, 95, 95, 95],
    categories: [
      { label: "Network", score: 98, icon: "Globe" }, { label: "Credentials", score: 94, icon: "KeyRound" },
      { label: "Patching", score: 96, icon: "Cpu" }, { label: "Dark Web", score: 93, icon: "Eye" },
      { label: "Supply Chain", score: 95, icon: "GitBranch" }, { label: "Brand", score: 96, icon: "Tag" },
    ],
  },
  {
    id: "v4", name: "AWS", domain: "aws.amazon.com", industry: "Cloud Infrastructure", country: "USA", flag: "🇺🇸",
    score: 93, grade: "A+", tier: "critical", access: "Admin", breach: null, assessed: "Apr 19, 2024",
    certs: ["SOC2", "ISO27001", "FedRAMP", "PCI-DSS"],
    trend: [91, 92, 92, 93, 93, 93, 93],
    categories: [
      { label: "Network", score: 95, icon: "Globe" }, { label: "Credentials", score: 92, icon: "KeyRound" },
      { label: "Patching", score: 94, icon: "Cpu" }, { label: "Dark Web", score: 90, icon: "Eye" },
      { label: "Supply Chain", score: 93, icon: "GitBranch" }, { label: "Brand", score: 94, icon: "Tag" },
    ],
  },
  {
    id: "v5", name: "GitHub", domain: "github.com", industry: "DevOps / Source Control", country: "USA", flag: "🇺🇸",
    score: 82, grade: "A−", tier: "high", access: "Write", breach: "Jan 2024", assessed: "Apr 14, 2024",
    certs: ["SOC2"],
    trend: [86, 85, 84, 82, 82, 82, 82],
    categories: [
      { label: "Network", score: 84, icon: "Globe" }, { label: "Credentials", score: 78, icon: "KeyRound" },
      { label: "Patching", score: 86, icon: "Cpu" }, { label: "Dark Web", score: 80, icon: "Eye" },
      { label: "Supply Chain", score: 83, icon: "GitBranch" }, { label: "Brand", score: 82, icon: "Tag" },
    ],
  },
  {
    id: "v6", name: "Slack", domain: "slack.com", industry: "Communications", country: "USA", flag: "🇺🇸",
    score: 78, grade: "B+", tier: "medium", access: "Write", breach: null, assessed: "Apr 10, 2024",
    certs: ["SOC2", "ISO27001"],
    trend: [75, 76, 77, 78, 78, 78, 78],
    categories: [
      { label: "Network", score: 80, icon: "Globe" }, { label: "Credentials", score: 76, icon: "KeyRound" },
      { label: "Patching", score: 82, icon: "Cpu" }, { label: "Dark Web", score: 74, icon: "Eye" },
      { label: "Supply Chain", score: 79, icon: "GitBranch" }, { label: "Brand", score: 78, icon: "Tag" },
    ],
  },
  {
    id: "v7", name: "Zendesk", domain: "zendesk.com", industry: "Customer Support", country: "USA", flag: "🇺🇸",
    score: 72, grade: "B", tier: "medium", access: "Write", breach: "Oct 2023", assessed: "Apr 8, 2024",
    certs: ["SOC2"],
    trend: [74, 74, 73, 72, 72, 72, 72],
    categories: [
      { label: "Network", score: 74, icon: "Globe" }, { label: "Credentials", score: 68, icon: "KeyRound" },
      { label: "Patching", score: 76, icon: "Cpu" }, { label: "Dark Web", score: 70, icon: "Eye" },
      { label: "Supply Chain", score: 73, icon: "GitBranch" }, { label: "Brand", score: 71, icon: "Tag" },
    ],
  },
  {
    id: "v8", name: "Atlassian", domain: "atlassian.com", industry: "DevOps / Collaboration", country: "AUS", flag: "🇦🇺",
    score: 81, grade: "A−", tier: "high", access: "Write", breach: null, assessed: "Apr 12, 2024",
    certs: ["SOC2", "ISO27001"],
    trend: [79, 80, 80, 81, 81, 81, 81],
    categories: [
      { label: "Network", score: 83, icon: "Globe" }, { label: "Credentials", score: 79, icon: "KeyRound" },
      { label: "Patching", score: 84, icon: "Cpu" }, { label: "Dark Web", score: 78, icon: "Eye" },
      { label: "Supply Chain", score: 81, icon: "GitBranch" }, { label: "Brand", score: 82, icon: "Tag" },
    ],
  },
  {
    id: "v9", name: "MongoDB", domain: "mongodb.com", industry: "Database / Cloud", country: "USA", flag: "🇺🇸",
    score: 68, grade: "C+", tier: "high", access: "Admin", breach: "Dec 2023", assessed: "Apr 5, 2024",
    certs: ["SOC2"],
    trend: [74, 72, 70, 69, 68, 68, 68],
    categories: [
      { label: "Network", score: 70, icon: "Globe" }, { label: "Credentials", score: 62, icon: "KeyRound" },
      { label: "Patching", score: 72, icon: "Cpu" }, { label: "Dark Web", score: 64, icon: "Eye" },
      { label: "Supply Chain", score: 68, icon: "GitBranch" }, { label: "Brand", score: 70, icon: "Tag" },
    ],
  },
  {
    id: "v10", name: "Snowflake", domain: "snowflake.com", industry: "Data Warehouse", country: "USA", flag: "🇺🇸",
    score: 75, grade: "B", tier: "medium", access: "Read", breach: null, assessed: "Apr 15, 2024",
    certs: ["SOC2", "ISO27001"],
    trend: [73, 74, 74, 75, 75, 75, 75],
    categories: [
      { label: "Network", score: 77, icon: "Globe" }, { label: "Credentials", score: 72, icon: "KeyRound" },
      { label: "Patching", score: 79, icon: "Cpu" }, { label: "Dark Web", score: 73, icon: "Eye" },
      { label: "Supply Chain", score: 75, icon: "GitBranch" }, { label: "Brand", score: 76, icon: "Tag" },
    ],
  },
  {
    id: "v11", name: "Datadog", domain: "datadoghq.com", industry: "Monitoring / Observability", country: "USA", flag: "🇺🇸",
    score: 86, grade: "A", tier: "medium", access: "Read", breach: null, assessed: "Apr 17, 2024",
    certs: ["SOC2", "ISO27001"],
    trend: [84, 85, 85, 86, 86, 86, 86],
    categories: [
      { label: "Network", score: 88, icon: "Globe" }, { label: "Credentials", score: 84, icon: "KeyRound" },
      { label: "Patching", score: 89, icon: "Cpu" }, { label: "Dark Web", score: 84, icon: "Eye" },
      { label: "Supply Chain", score: 86, icon: "GitBranch" }, { label: "Brand", score: 87, icon: "Tag" },
    ],
  },
  {
    id: "v12", name: "Stripe", domain: "stripe.com", industry: "Payments / FinTech", country: "USA", flag: "🇺🇸",
    score: 90, grade: "A+", tier: "critical", access: "Write", breach: null, assessed: "Apr 21, 2024",
    certs: ["SOC2", "PCI-DSS", "ISO27001"],
    trend: [88, 89, 89, 90, 90, 90, 90],
    categories: [
      { label: "Network", score: 92, icon: "Globe" }, { label: "Credentials", score: 89, icon: "KeyRound" },
      { label: "Patching", score: 93, icon: "Cpu" }, { label: "Dark Web", score: 88, icon: "Eye" },
      { label: "Supply Chain", score: 90, icon: "GitBranch" }, { label: "Brand", score: 91, icon: "Tag" },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 90) return "#10b981";
  if (s >= 80) return "#3b82f6";
  if (s >= 70) return "#eab308";
  if (s >= 60) return "#f97316";
  return "#ef4444";
}
const TIER_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/25",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/25",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25",
  low: "bg-blue-500/10 text-blue-300 border-blue-500/20",
};
const ACCESS_STYLES: Record<string, string> = {
  Admin: "bg-red-500/8 text-red-300 border-red-500/20",
  Write: "bg-orange-500/8 text-orange-300 border-orange-500/20",
  Read: "bg-emerald-500/8 text-emerald-300 border-emerald-500/20",
};
const CERT_COLORS: Record<string, string> = {
  SOC2: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  ISO27001: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  FedRAMP: "bg-green-500/10 text-green-300 border-green-500/20",
  "PCI-DSS": "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
};

function MiniSparkline({ data }: { data: number[] }) {
  const chartData = data.map((v, i) => ({ i, v }));
  const delta = data[data.length - 1] - data[0];
  return (
    <div className="w-16 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
          <Line type="monotone" dataKey="v" stroke={delta >= 0 ? "#10b981" : "#ef4444"}
            strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MiniGaugeRing({ score }: { score: number }) {
  const size = 44;
  const r = 18;
  const cx = size / 2;
  const cy = size / 2;
  const arc = 2 * Math.PI * r * 0.75;
  const progress = (score / 100) * arc;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4"
        strokeDasharray={`${arc} ${2 * Math.PI * r}`} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${progress} ${2 * Math.PI * r}`} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}60)` }} />
    </svg>
  );
}

function VendorInitial({ name, color }: { name: string; color: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
      style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}>
      {initials}
    </div>
  );
}

const TABS = ["All", "High Risk", "Recently Changed", "Watching"] as const;
type Tab = (typeof TABS)[number];

// ── Vendor Detail Drawer ──────────────────────────────────────────────────────
function VendorDrawer({
  vendor, onClose, onReassess, onRemove, scanning,
}: {
  vendor: Vendor; onClose: () => void; onReassess: (id: string) => void; onRemove: (id: string) => void; scanning: string | null;
}) {
  const color = scoreColor(vendor.score);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg h-full overflow-y-auto animate-slide-in"
        style={{ background: "#0d0a14", borderLeft: "1px solid rgba(139,92,246,0.15)" }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between p-5"
          style={{ background: "rgba(13,10,20,0.95)", borderBottom: "1px solid rgba(139,92,246,0.08)", backdropFilter: "blur(10px)" }}>
          <div className="flex items-center gap-3">
            <VendorInitial name={vendor.name} color={color} />
            <div>
              <h2 className="text-base font-bold text-white">{vendor.name}</h2>
              <a href={`https://${vendor.domain}`} target="_blank" rel="noreferrer"
                className="text-[11px] text-purple-400 hover:underline flex items-center gap-1">
                {vendor.domain} <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white rounded-lg hover:bg-white/[0.04] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Score hero */}
          <div className="flex items-center gap-5 p-4 rounded-xl"
            style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
            <div className="relative flex-shrink-0">
              <MiniGaugeRing score={vendor.score} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-black" style={{ color }}>{vendor.score}</span>
              </div>
            </div>
            <div>
              <div className="text-3xl font-black" style={{ color }}>{vendor.grade}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Risk score · Last assessed {vendor.assessed}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide", TIER_STYLES[vendor.tier])}>
                  {vendor.tier}
                </span>
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold border", ACCESS_STYLES[vendor.access])}>
                  {vendor.access} Access
                </span>
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          <div>
            <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-500 mb-3">Scorecard</h3>
            <div className="space-y-2">
              {vendor.categories.map(cat => {
                const c = scoreColor(cat.score);
                return (
                  <div key={cat.label} className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 w-24 flex-shrink-0">{cat.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${cat.score}%`, background: c }} />
                    </div>
                    <span className="text-[11px] font-bold w-6 text-right flex-shrink-0" style={{ color: c }}>{cat.score}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 90d trend */}
          <div>
            <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-500 mb-3">90-Day Score Trend</h3>
            <div className="h-20 card-enterprise p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vendor.trend.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 2, bottom: 2, left: -20 }}>
                  <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false}
                    activeDot={{ r: 3, fill: color, strokeWidth: 0 }} />
                  <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.15)", borderRadius: "8px", fontSize: "10px", color: "#e2e8f0" }}
                    formatter={(v: number) => [v, "Score"]} labelFormatter={() => ""} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Certifications */}
          <div>
            <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-500 mb-3">Certifications</h3>
            <div className="flex flex-wrap gap-2">
              {vendor.certs.map(cert => (
                <span key={cert} className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border", CERT_COLORS[cert] ?? "bg-white/5 text-slate-300 border-white/10")}>
                  <CheckCircle2 className="w-3 h-3" /> {cert}
                </span>
              ))}
            </div>
          </div>

          {/* Recent alerts */}
          <div>
            <h3 className="text-[11px] uppercase tracking-widest font-bold text-slate-500 mb-3">Recent Alerts</h3>
            <div className="space-y-2">
              {vendor.breach ? (
                <div className="flex items-start gap-2.5 p-3 rounded-xl"
                  style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] text-red-300 font-semibold">Breach detected — {vendor.breach}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Customer data potentially exposed. Review shared data scope.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 p-3 rounded-xl"
                  style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <p className="text-[11px] text-emerald-300">No incidents in last 90 days</p>
                </div>
              )}
              <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.06)" }}>
                <p className="text-[11px] text-slate-300 font-medium">New CVE affecting {vendor.name} infrastructure</p>
                <p className="text-[10px] text-slate-500 mt-0.5">CVE-2024-1234 · Medium severity · Patch available</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2" style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}>
            <button onClick={() => { onReassess(vendor.id); onClose(); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white btn-brand flex items-center justify-center gap-2">
              {scanning === vendor.id ? <InfinityLoader size={16} /> : <Scan className="w-4 h-4" />}
              Reassess
            </button>
            <button onClick={() => { if (confirm(`Remove ${vendor.name}?`)) { onRemove(vendor.id); onClose(); } }}
              className="py-2.5 px-4 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>(DEMO_VENDORS);
  const [liveStats, setLiveStats] = useState<{ total: number; critical: number; avg: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Vendor | null>(null);
  const [scanning, setScanning] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9;

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    apiFetch("/api/v1/vendors/stats/summary").then(d => {
      if (d) setLiveStats({ total: d.total, critical: d.critical, avg: d.avg_risk_score });
    });
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    let rows = vendors;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(v => v.name.toLowerCase().includes(q) || v.domain.includes(q) || v.industry.toLowerCase().includes(q));
    }
    if (tierFilter !== "all") rows = rows.filter(v => v.tier === tierFilter);
    if (activeTab === "High Risk") rows = rows.filter(v => v.tier === "critical" || v.tier === "high");
    if (activeTab === "Recently Changed") rows = rows.filter(v => v.trend[v.trend.length - 1] !== v.trend[v.trend.length - 2]);
    return rows;
  }, [vendors, search, tierFilter, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => ({
    total: liveStats?.total ?? vendors.length,
    highRisk: vendors.filter(v => v.tier === "critical" || v.tier === "high").length,
    breached: vendors.filter(v => v.breach).length,
    avg: liveStats?.avg ?? Math.round(vendors.reduce((a, v) => a + v.score, 0) / vendors.length),
  }), [vendors, liveStats]);

  const triggerScan = async (id: string) => {
    setScanning(id);
    await apiFetch(`/api/v1/vendors/${id}/scan?scan_type=full`, { method: "POST" });
    setTimeout(() => {
      setScanning(null);
      toast.success("Reassessment complete");
    }, 2000);
  };

  const removeVendor = (id: string) => {
    setVendors(prev => prev.filter(v => v.id !== id));
    toast.success("Vendor removed");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(236,72,153,0.12))", border: "1px solid rgba(139,92,246,0.25)" }}>
            <GitBranch className="w-5 h-5 text-purple-300" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: "0 0 10px #10b981" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Supply Chain Monitor</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-300 font-semibold tracking-wider">LIVE</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {stats.total} vendors monitored · {stats.highRisk} high risk
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => toast.info("Exporting vendor report…")}
            className="h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={() => setShowAdd(true)}
            className="h-9 px-4 rounded-lg text-sm font-semibold text-white btn-brand flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Vendor
          </button>
        </div>
      </div>

      {/* ── KPI Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Vendors", value: stats.total, color: "#a855f7", suffix: undefined },
          { label: "High Risk", value: stats.highRisk, color: "#ef4444", suffix: undefined },
          { label: "Breached (90d)", value: stats.breached, color: "#f97316", suffix: undefined },
          { label: "Avg Score", value: stats.avg, color: scoreColor(stats.avg), suffix: "/100" },
        ].map(s => (
          <div key={s.label} className="stat-card p-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{s.label}</p>
            <div className="flex items-baseline gap-1 mt-2">
              <p className="text-3xl font-black font-mono text-white">{s.value}</p>
              {s.suffix && <span className="text-xs text-slate-500">{s.suffix}</span>}
            </div>
            <div className="h-0.5 mt-3 rounded-full" style={{ background: `${s.color}25` }}>
              <div className="h-full rounded-full" style={{ width: "100%", background: `linear-gradient(90deg,${s.color}60,${s.color})` }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs + Filters ────────────────────────────────────────────── */}
      <div className="card-enterprise p-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-3 flex-wrap" style={{ borderBottom: "1px solid rgba(139,92,246,0.08)", paddingBottom: "0.75rem" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setPage(1); }}
              className={cn("relative px-4 h-9 flex items-center gap-1.5 text-sm font-medium rounded-lg transition-all",
                activeTab === t ? "text-white bg-purple-500/[0.1] border border-purple-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]")}>
              {t}
              {t === "High Risk" && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">
                  {vendors.filter(v => v.tier === "critical" || v.tier === "high").length}
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search vendors, domains, industries…"
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.02] border border-purple-500/[0.08] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/25 transition-all" />
          </div>
          <select value={tierFilter} onChange={e => { setTierFilter(e.target.value); setPage(1); }}
            className="h-9 px-3 rounded-lg bg-white/[0.02] border border-purple-500/[0.08] text-sm text-slate-300 focus:outline-none focus:border-purple-500/25 transition-all">
            <option value="all">All Tiers</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-slate-400">{selectedIds.size} selected</span>
              <button onClick={() => { selectedIds.forEach(id => triggerScan(id)); setSelectedIds(new Set()); }}
                className="h-8 px-3 rounded-lg text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> Reassess All
              </button>
              <button onClick={() => toast.info("Exporting selected…")}
                className="h-8 px-3 rounded-lg text-xs font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-1.5">
                <Download className="w-3 h-3" /> Export
              </button>
              <button onClick={() => setSelectedIds(new Set())}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.04] transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Vendor Grid ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <InfinityLoader size={28} />
          <p className="text-xs text-slate-500">Loading vendor registry…</p>
        </div>
      ) : paged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 card-enterprise">
          <Building2 className="w-10 h-10 text-slate-700" />
          <p className="text-sm text-slate-400">No vendors match your filters.</p>
          <button onClick={() => { setSearch(""); setTierFilter("all"); setActiveTab("All"); }}
            className="text-xs text-purple-300 hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {paged.map(vendor => {
            const color = scoreColor(vendor.score);
            const isSelected = selectedIds.has(vendor.id);
            const trendDelta = vendor.trend[vendor.trend.length - 1] - vendor.trend[0];
            return (
              <div key={vendor.id}
                className={cn(
                  "card-enterprise p-4 group cursor-pointer relative transition-all hover:border-purple-500/20",
                  isSelected && "border-purple-500/30 bg-purple-500/[0.03]"
                )}
                onClick={() => setDetail(vendor)}>
                {/* Select checkbox */}
                <button
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onClick={e => { e.stopPropagation(); toggleSelect(vendor.id); }}>
                  <div className={cn("w-4 h-4 rounded flex items-center justify-center transition-all",
                    isSelected
                      ? "bg-gradient-to-br from-purple-500 to-pink-500 shadow-[0_0_0_1px_rgba(139,92,246,0.5)]"
                      : "bg-white/[0.02] border border-white/[0.12] hover:border-purple-500/40")}>
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>

                {/* Top row */}
                <div className="flex items-start gap-3 mb-3">
                  <VendorInitial name={vendor.name} color={color} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate">{vendor.name}</p>
                      <span className="text-sm">{vendor.flag}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{vendor.industry}</p>
                  </div>
                  <div className="relative flex-shrink-0">
                    <MiniGaugeRing score={vendor.score} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-black" style={{ color }}>{vendor.grade}</span>
                    </div>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center flex-wrap gap-1.5 mb-3">
                  <span className={cn("px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider", TIER_STYLES[vendor.tier])}>
                    {vendor.tier}
                  </span>
                  <span className={cn("px-2 py-0.5 rounded text-[9px] font-semibold border", ACCESS_STYLES[vendor.access])}>
                    {vendor.access}
                  </span>
                  {vendor.breach && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-red-500/10 text-red-400 border-red-500/25 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> Breach {vendor.breach}
                    </span>
                  )}
                </div>

                {/* Score + trend */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] text-slate-600">Risk Score</p>
                    <p className="text-xl font-black font-mono" style={{ color }}>{vendor.score}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <MiniSparkline data={vendor.trend} />
                    <div className={cn("flex items-center gap-0.5 text-[10px] font-semibold",
                      trendDelta >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {trendDelta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {trendDelta >= 0 ? "+" : ""}{trendDelta} 90d
                    </div>
                  </div>
                </div>

                {/* Assessed + certs */}
                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                    <Clock className="w-3 h-3" /> {vendor.assessed}
                  </div>
                  <div className="flex gap-1">
                    {vendor.certs.slice(0, 2).map(c => (
                      <span key={c} className={cn("px-1.5 py-0.5 rounded text-[9px] font-semibold border", CERT_COLORS[c] ?? "bg-white/5 text-slate-400 border-white/10")}>
                        {c}
                      </span>
                    ))}
                    {vendor.certs.length > 2 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/5 text-slate-400 border border-white/10">
                        +{vendor.certs.length - 2}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hover quick actions */}
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                  <button onClick={e => { e.stopPropagation(); setDetail(vendor); }}
                    className="h-7 px-2.5 rounded-lg text-[10px] font-semibold text-slate-300 bg-white/[0.06] border border-white/[0.08] hover:text-white hover:bg-white/[0.1] transition-all flex items-center gap-1">
                    <Eye className="w-3 h-3" /> View
                  </button>
                  <button onClick={e => { e.stopPropagation(); triggerScan(vendor.id); }}
                    disabled={scanning === vendor.id}
                    className="h-7 px-2.5 rounded-lg text-[10px] font-semibold text-purple-300 bg-purple-500/[0.1] border border-purple-500/25 hover:bg-purple-500/20 transition-all flex items-center gap-1">
                    {scanning === vendor.id ? <InfinityLoader size={12} /> : <Scan className="w-3 h-3" />} Reassess
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              return n <= totalPages ? (
                <button key={n} onClick={() => setPage(n)}
                  className={cn("w-8 h-8 rounded-md text-xs font-semibold transition-all",
                    n === page ? "text-white btn-brand" : "text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white hover:bg-white/[0.05]")}>
                  {n}
                </button>
              ) : null;
            })}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Vendor Detail Drawer ─────────────────────────────────────── */}
      {detail && (
        <VendorDrawer vendor={detail} onClose={() => setDetail(null)}
          onReassess={triggerScan} onRemove={removeVendor} scanning={scanning} />
      )}

      {/* ── Add Vendor Modal ──────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="rounded-2xl max-w-md w-full p-6 animate-fade-up" style={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.2)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">Add Vendor</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Connect to live API to add vendors. Demo mode active.</p>
            <button onClick={() => { toast.info("API integration required to add vendors"); setShowAdd(false); }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white btn-brand">
              Connect API
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
