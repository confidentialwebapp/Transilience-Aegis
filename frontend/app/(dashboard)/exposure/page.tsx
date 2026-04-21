"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { getOrgId } from "@/lib/api";
import { toast } from "sonner";
import {
  Shield, TrendingUp, TrendingDown, Minus, Download, Share2,
  AlertTriangle, ChevronRight, RefreshCw, Loader2,
  Globe, KeyRound, Eye, Cpu, GitBranch, Tag,
  BarChart3, Info, ExternalLink, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
  BarChart, Bar, Cell,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

async function apiFetch(path: string) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId() },
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// ---- Demo data ----
const DEMO_SCORE = 724;
const DEMO_GRADE = "B+";
const DEMO_PERCENTILE = 71;
const DEMO_TREND = +18;

const DEMO_BREAKDOWN = [
  { key: "attack_surface", label: "Attack Surface", score: 810, grade: "A−", change: +12, driver: "2 new subdomains discovered this week", icon: Globe, color: "#8b5cf6" },
  { key: "credentials", label: "Credentials", score: 650, grade: "B", change: -8, driver: "14 new credential leaks detected", icon: KeyRound, color: "#ec4899" },
  { key: "dark_web", label: "Dark Web Exposure", score: 720, grade: "B+", change: +5, driver: "No new forum mentions this week", icon: Eye, color: "#ef4444" },
  { key: "patching", label: "Patching Cadence", score: 770, grade: "B+", change: +22, driver: "CVE backlog reduced by 34%", icon: Cpu, color: "#f97316" },
  { key: "supply_chain", label: "Supply Chain", score: 690, grade: "B−", change: -4, driver: "3 vendors flagged with new findings", icon: GitBranch, color: "#eab308" },
  { key: "brand", label: "Brand Protection", score: 755, grade: "B+", change: +3, driver: "Typosquatting domain registered", icon: Tag, color: "#3b82f6" },
];

const DEMO_FINDINGS = [
  { id: 1, severity: "critical", title: "14 employee credentials exposed in Stealer Log dump", category: "Credentials", cta: "Remediate Now" },
  { id: 2, severity: "high", title: "3 vendors with unpatched critical CVEs (CVE-2024-1234, CVE-2024-5678)", category: "Supply Chain", cta: "Review Vendors" },
  { id: 3, severity: "high", title: "SSL certificate expiring in 12 days for api.yourdomain.com", category: "Attack Surface", cta: "Renew Cert" },
  { id: 4, severity: "medium", title: "Brand domain typosquat yourdomian.com registered 3 days ago", category: "Brand", cta: "Investigate" },
  { id: 5, severity: "low", title: "2 GitHub repositories with hardcoded API keys (low severity)", category: "Credentials", cta: "Review Code" },
];

const DEMO_TREND_DATA = [
  { date: "Mar 22", score: 648 },
  { date: "Mar 25", score: 661 },
  { date: "Mar 28", score: 655 },
  { date: "Apr 1", score: 678 },
  { date: "Apr 4", score: 692 },
  { date: "Apr 7", score: 687 },
  { date: "Apr 10", score: 705 },
  { date: "Apr 13", score: 699 },
  { date: "Apr 16", score: 718 },
  { date: "Apr 19", score: 724 },
];

const DEMO_PEERS = [
  { name: "You", score: 724, highlight: true },
  { name: "Industry Avg", score: 618, highlight: false },
  { name: "Industry Leaders", score: 851, highlight: false },
  { name: "Bottom 25%", score: 432, highlight: false },
];

function scoreToGradeColor(score: number) {
  if (score >= 800) return { color: "#10b981", label: "Excellent" };
  if (score >= 700) return { color: "#3b82f6", label: "Good" };
  if (score >= 600) return { color: "#eab308", label: "Fair" };
  if (score >= 500) return { color: "#f97316", label: "Poor" };
  return { color: "#ef4444", label: "Critical" };
}

function CircleGauge({
  score, maxScore = 1000, size = 200, strokeWidth = 12, grade,
}: {
  score: number; maxScore?: number; size?: number; strokeWidth?: number; grade?: string;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const arc = 2 * Math.PI * r * 0.75; // 270deg arc
  const progress = (score / maxScore) * arc;
  const rotation = 135; // start from bottom-left
  const { color, label } = scoreToGradeColor(score);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: `rotate(${rotation}deg)` }}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth}
          strokeDasharray={`${arc} ${2 * Math.PI * r}`}
          strokeLinecap="round" />
        {/* Progress */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${progress} ${2 * Math.PI * r}`}
          strokeLinecap="round"
          style={{
            transition: "stroke-dasharray 1.8s cubic-bezier(0.4,0,0.2,1)",
            filter: `drop-shadow(0 0 8px ${color}60)`,
          }}
        />
        {/* Tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const angle = (t * 270 - 135) * (Math.PI / 180);
          const x1 = cx + (r - strokeWidth / 2 - 6) * Math.cos(angle);
          const y1 = cy + (r - strokeWidth / 2 - 6) * Math.sin(angle);
          const x2 = cx + (r + strokeWidth / 2 + 4) * Math.cos(angle);
          const y2 = cy + (r + strokeWidth / 2 + 4) * Math.sin(angle);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />;
        })}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {grade && (
          <span className="text-4xl font-black tracking-tight" style={{ color, lineHeight: 1 }}>
            {grade}
          </span>
        )}
        <span className="text-[13px] font-bold text-slate-300 font-mono">{score.toLocaleString()}</span>
        <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color }}>
          {label}
        </span>
      </div>
    </div>
  );
}

function MiniGauge({ score, maxScore = 1000, size = 48 }: { score: number; maxScore?: number; size?: number }) {
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const arc = 2 * Math.PI * r * 0.75;
  const progress = (score / maxScore) * arc;
  const { color } = scoreToGradeColor(score);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3.5"
        strokeDasharray={`${arc} ${2 * Math.PI * r}`} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="3.5"
        strokeDasharray={`${progress} ${2 * Math.PI * r}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1.5s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 4px ${color}60)` }} />
    </svg>
  );
}

const SEV_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/25",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/25",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25",
  low: "bg-blue-500/10 text-blue-300 border-blue-500/25",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.2)" }}>
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className="font-bold text-white">{payload[0].value}</p>
    </div>
  );
};

export default function ExposurePage() {
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [breakdown, setBreakdown] = useState(DEMO_BREAKDOWN);
  const [lastUpdated, setLastUpdated] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [scoreData, bdData] = await Promise.all([
        apiFetch("/api/v1/exposure/score"),
        apiFetch("/api/v1/exposure/breakdown"),
      ]);
      if (scoreData?.score) setScore(scoreData.score);
      else setScore(DEMO_SCORE);
      if (bdData?.categories?.length) setBreakdown(bdData.categories);
      else setBreakdown(DEMO_BREAKDOWN);
    } catch {
      setScore(DEMO_SCORE);
      setBreakdown(DEMO_BREAKDOWN);
    }
    setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const refresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 animate-fade-up">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(236,72,153,0.1))", border: "1px solid rgba(139,92,246,0.2)" }}>
          <Shield className="w-7 h-7 text-purple-400 animate-pulse" />
        </div>
        <p className="text-sm text-slate-400">Computing exposure score…</p>
        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
      </div>
    );
  }

  const displayScore = score || DEMO_SCORE;
  const { color: scoreColor } = scoreToGradeColor(displayScore);
  const trend = DEMO_TREND;

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(236,72,153,0.12))", border: "1px solid rgba(139,92,246,0.25)" }}>
            <Shield className="w-5 h-5 text-purple-300" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: "0 0 10px #10b981" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Exposure Score</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-300 font-semibold tracking-wider">LIVE</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Last updated {lastUpdated || "—"} · Your security posture vs industry benchmarks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={refreshing}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all disabled:opacity-50">
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </button>
          <button onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Snapshot link copied"); }}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all">
            <Share2 className="w-4 h-4" />
          </button>
          <button onClick={() => toast.info("Generating PDF report…")}
            className="h-9 px-4 rounded-lg text-sm font-semibold text-white btn-brand flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* ── Hero Score Card ─────────────────────────────────── */}
      <div className="card-enterprise p-8 glow-brand relative overflow-hidden">
        {/* Background glow orb */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(600px circle at 50% 50%, ${scoreColor}06, transparent 70%)`,
        }} />
        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-10">
          {/* Gauge */}
          <div className="flex-shrink-0">
            <CircleGauge score={displayScore} grade={DEMO_GRADE} size={220} strokeWidth={14} />
          </div>

          {/* Metrics column */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full">
            {/* Percentile */}
            <div className="flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Industry Percentile</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-white">{DEMO_PERCENTILE}<span className="text-xl text-slate-400">th</span></span>
              </div>
              <p className="text-[11px] text-slate-500">Better than {DEMO_PERCENTILE}% of peers</p>
              {/* Percentile bar */}
              <div className="h-1.5 rounded-full mt-2 bg-white/[0.04] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${DEMO_PERCENTILE}%`, background: `linear-gradient(90deg, #8b5cf6, ${scoreColor})` }} />
              </div>
            </div>

            {/* 30d Trend */}
            <div className="flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">30-Day Trend</p>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-4xl font-black", trend >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {trend >= 0 ? "+" : ""}{trend}
                </span>
                {trend >= 0
                  ? <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                  : <ArrowDownRight className="w-5 h-5 text-red-400" />}
              </div>
              <p className="text-[11px] text-slate-500">Points {trend >= 0 ? "gained" : "lost"} this month</p>
            </div>

            {/* Risk level */}
            <div className="flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Risk Level</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: scoreColor, boxShadow: `0 0 12px ${scoreColor}` }} />
                <span className="text-2xl font-black" style={{ color: scoreColor }}>
                  {scoreToGradeColor(displayScore).label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Score range: 0 – 1000</p>
              <div className="threat-bar mt-2 rounded-full" />
              <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
                <span>Critical</span><span>Fair</span><span>Excellent</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Breakdown Grid ─────────────────────────────────── */}
      <div>
        <h2 className="text-[13px] font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          Score Breakdown
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {breakdown.map((cat) => {
            const Icon = cat.icon || Shield;
            const { color } = scoreToGradeColor(cat.score);
            return (
              <div key={cat.key} className="card-enterprise p-4 flex flex-col gap-3 group cursor-default hover:border-purple-500/20 transition-all">
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${cat.color}15`, border: `1px solid ${cat.color}25` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
                  </div>
                  <MiniGauge score={cat.score} size={40} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-medium leading-tight">{cat.label}</p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-black" style={{ color }}>{cat.grade}</span>
                    <span className="text-[10px] font-mono text-slate-500">{cat.score}</span>
                  </div>
                </div>
                <div className={cn("flex items-center gap-1 text-[10px] font-semibold",
                  cat.change > 0 ? "text-emerald-400" : cat.change < 0 ? "text-red-400" : "text-slate-500")}>
                  {cat.change > 0 ? <TrendingUp className="w-3 h-3" /> : cat.change < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {cat.change > 0 ? "+" : ""}{cat.change} pts
                </div>
                <p className="text-[9px] text-slate-600 leading-tight line-clamp-2 mt-auto">{cat.driver}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Top findings */}
        <div className="lg:col-span-2 card-enterprise p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-slate-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              What&apos;s Hurting Your Score
            </h2>
            <button className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {DEMO_FINDINGS.map((f) => (
              <div key={f.id}
                className="flex items-center gap-3 p-3 rounded-xl group transition-all hover:bg-white/[0.025]"
                style={{ border: "1px solid rgba(255,255,255,0.03)" }}>
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border flex-shrink-0", SEV_STYLES[f.severity])}>
                  {f.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200 truncate">{f.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{f.category}</p>
                </div>
                <button
                  onClick={() => toast.info(`Opening: ${f.cta}`)}
                  className="flex-shrink-0 h-7 px-3 rounded-lg text-[10px] font-semibold text-purple-300 bg-purple-500/[0.08] border border-purple-500/20 hover:bg-purple-500/20 transition-all opacity-0 group-hover:opacity-100">
                  {f.cta}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Peer comparison */}
        <div className="card-enterprise p-5">
          <h2 className="text-[13px] font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            Peer Comparison
          </h2>
          <div className="space-y-3">
            {DEMO_PEERS.map((p) => {
              const { color } = scoreToGradeColor(p.score);
              const pct = (p.score / 1000) * 100;
              return (
                <div key={p.name}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={cn("text-xs font-semibold", p.highlight ? "text-white" : "text-slate-400")}>
                      {p.name}
                    </span>
                    <span className="text-xs font-bold font-mono" style={{ color: p.highlight ? color : undefined }}>
                      {p.score}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.03] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${pct}%`,
                        background: p.highlight
                          ? `linear-gradient(90deg,#8b5cf6,${color})`
                          : "rgba(255,255,255,0.08)",
                      }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Based on anonymized data from 2,400+ organizations in your industry. Updated weekly.
            </p>
          </div>
        </div>
      </div>

      {/* ── 30d Trend Chart ────────────────────────────────── */}
      <div className="card-enterprise p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[13px] font-semibold text-slate-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            30-Day Score Trend
          </h2>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            +{DEMO_TREND} pts this month
          </div>
        </div>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={DEMO_TREND_DATA} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis domain={[600, 780]} tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="score" stroke="url(#lineGrad)" strokeWidth={2.5}
                dot={false} activeDot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
