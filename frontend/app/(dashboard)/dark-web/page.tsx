"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getOrgId } from "@/lib/api";
import { toast } from "sonner";
import {
  Eye, Search, Loader2, Radio, Globe, FileText, MessageSquare,
  Lock, Database, Skull, ChevronLeft, ChevronRight, RefreshCw,
  ExternalLink, Clock, SlidersHorizontal, Download, BookmarkPlus,
  AlertTriangle, X, ChevronDown, ChevronUp, TrendingUp, Shield,
  Hash, Zap, ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Org-Id": getOrgId(),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DarkWebAlert {
  id: string;
  title: string;
  description?: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  module: string;
  source_url?: string;
  created_at: string;
  risk_score: number;
  platform?: string;
  actor_handle?: string;
  snippet?: string;
  sentiment?: "negative" | "neutral" | "positive";
  mentions_count?: number;
  first_seen?: string;
  source_category?: string;
}

interface DemoFeedItem {
  id: string;
  title: string;
  snippet: string;
  platform: string;
  source_category: string;
  actor_handle: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  sentiment: "negative" | "neutral" | "positive";
  onion_url: string;
  first_seen: string;
  mentions_count: number;
  risk_score: number;
  module: string;
  thread_context?: string;
  created_at: string;
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_FEED: DemoFeedItem[] = [
  {
    id: "dw-001", title: "Alleged database dump from FinanceCorpDB — 2.1M records",
    snippet: "Full SQL dump including plaintext passwords, emails, and SSNs. Verified by 3 users. Sample attached.",
    platform: "RaidForums Mirror", source_category: "leaks", actor_handle: "d4rk_trader",
    severity: "critical", sentiment: "negative", onion_url: "raidf0rum5xk3j2l.onion/threads/89234",
    first_seen: "2026-04-18T06:12:00Z", mentions_count: 47, risk_score: 94,
    module: "data_leak", thread_context: "Thread title: [RELEASE] Finance Corp full user DB dump — 2,143,892 records\n\nSeller posting 3rd verified dump this month. Sample shows bcrypt + cleartext combo. Data includes SSNs, DOBs, home addresses. Telegram escrow available.",
    created_at: "2026-04-18T06:12:00Z",
  },
  {
    id: "dw-002", title: "New credential stealer log bundle — targeting banking sector",
    snippet: "Fresh RedLine batch, 14k+ credentials from banking portals including Chase, Wells Fargo, Citibank logins.",
    platform: "XSS.is", source_category: "credentials", actor_handle: "st3al_king",
    severity: "critical", sentiment: "negative", onion_url: "xss4rumf7p2k1.onion/marketplace/19023",
    first_seen: "2026-04-19T14:30:00Z", mentions_count: 89, risk_score: 97,
    module: "credential", thread_context: "Fresh RedLine stealer logs from April batch. 14,221 credentials from US banking portals. All verified live as of 2026-04-17. Includes MFA bypass notes.",
    created_at: "2026-04-19T14:30:00Z",
  },
  {
    id: "dw-003", title: "LockBit 3.0 claims attack on MedGroup Healthcare — data pending release",
    snippet: "LockBit operators posted countdown timer. 72 hours before 400GB of patient data goes public.",
    platform: "LockBit Leak Site", source_category: "ransomware", actor_handle: "LockBit_Admin",
    severity: "critical", sentiment: "negative", onion_url: "lockbit3753b.onion/victims/medgroup-2026",
    first_seen: "2026-04-20T09:00:00Z", mentions_count: 212, risk_score: 99,
    module: "ransomware", thread_context: "MedGroup Healthcare — 400GB of patient records, internal comms, billing data. Ransom: $4.2M. Countdown: 68h 14m remaining. Files include PII, PHI, insurance claims.",
    created_at: "2026-04-20T09:00:00Z",
  },
  {
    id: "dw-004", title: "Telegram channel sharing corporate VPN credentials",
    snippet: "Active channel with 8.2k subscribers posting Pulse Secure, FortiVPN, and Cisco AnyConnect credentials daily.",
    platform: "Telegram", source_category: "telegram", actor_handle: "@vp_n_sh0p",
    severity: "high", sentiment: "negative", onion_url: "t.me/vpn_sh0p_official",
    first_seen: "2026-04-15T11:00:00Z", mentions_count: 341, risk_score: 88,
    module: "dark_web", thread_context: "Channel posting fresh VPN credentials every 6-8 hours. Focuses on Fortune 500 targets. Admin offers 'premium tier' with working 2FA codes.",
    created_at: "2026-04-15T11:00:00Z",
  },
  {
    id: "dw-005", title: "Paste — internal API keys for cloud infra provider",
    snippet: "Anonymous paste containing 23 AWS keys and 7 GCP service account JSONs. Origin unknown.",
    platform: "GhostBin", source_category: "paste", actor_handle: "anonymous",
    severity: "high", sentiment: "negative", onion_url: "ghst4b1n9x2p.onion/p/8f4kd2",
    first_seen: "2026-04-21T02:47:00Z", mentions_count: 12, risk_score: 82,
    module: "dark_web", thread_context: "Plain text paste with 23 AWS access key pairs and 7 GCP JSON files. Keys appear active — no expiry set. One key has S3 full access on prod bucket.",
    created_at: "2026-04-21T02:47:00Z",
  },
  {
    id: "dw-006", title: "ALPHV/BlackCat posts data from logistics firm after failed negotiation",
    snippet: "300GB of internal docs, customer manifests, and financial records released after ransom talks collapse.",
    platform: "ALPHV Leak Site", source_category: "ransomware", actor_handle: "ALPHV_Operator",
    severity: "critical", sentiment: "negative", onion_url: "alphvmmm4y6y5sc.onion/leak/translog-intl",
    first_seen: "2026-04-17T17:25:00Z", mentions_count: 178, risk_score: 96,
    module: "ransomware", thread_context: "TransLog International — ransom negotiations broke down at $2.8M. Full 300GB data release active. Includes CEO emails, customer lists, bank account details.",
    created_at: "2026-04-17T17:25:00Z",
  },
  {
    id: "dw-007", title: "Forum thread: 0-day exploit for popular enterprise VPN being auctioned",
    snippet: "Seller claiming pre-auth RCE on a top-5 enterprise VPN. Proof-of-concept shared in private. Asking $180k.",
    platform: "Exploit.in", source_category: "forums", actor_handle: "0x_v3nd0r",
    severity: "high", sentiment: "negative", onion_url: "expl01t1nf9k2x.onion/market/vuln-92",
    first_seen: "2026-04-16T08:50:00Z", mentions_count: 63, risk_score: 91,
    module: "dark_web", thread_context: "Auction thread for CVE-pending pre-auth RCE in a widely deployed enterprise VPN solution. PoC shared with 2 verified buyers. Escrow via Monero only. Ends in 48h.",
    created_at: "2026-04-16T08:50:00Z",
  },
  {
    id: "dw-008", title: "Play ransomware lists 4 new victims including government agency",
    snippet: "Play group added 4 new victims to their leak site, including a state-level government agency.",
    platform: "Play Leak Site", source_category: "ransomware", actor_handle: "Play_Operator",
    severity: "critical", sentiment: "negative", onion_url: "playb1og3k2nq.onion/victims/april-batch",
    first_seen: "2026-04-20T16:00:00Z", mentions_count: 99, risk_score: 95,
    module: "ransomware", thread_context: "April batch — 4 new victims. Includes: StateGov Agency (120GB), RetailCo (45GB), InsuranceFirm (89GB), LegalPartners (22GB). All countdown timers active.",
    created_at: "2026-04-20T16:00:00Z",
  },
  {
    id: "dw-009", title: "Paste: Employee directory with emails from tech company",
    snippet: "7,400 employee records including email, title, department, and internal Slack usernames.",
    platform: "Pastebin", source_category: "paste", actor_handle: "leakbot_auto",
    severity: "medium", sentiment: "neutral", onion_url: "pasteb1n.com/hXkPq92s",
    first_seen: "2026-04-19T20:10:00Z", mentions_count: 8, risk_score: 55,
    module: "dark_web", thread_context: "Auto-posted by scraper bot. 7,400 employee records. No passwords — useful for spearphishing recon. Appears to be from a US tech company based on email domains.",
    created_at: "2026-04-19T20:10:00Z",
  },
  {
    id: "dw-010", title: "Akira ransomware targets legal firm — 220GB data threatened",
    snippet: "Akira claims to have exfiltrated 220GB from a mid-size legal firm. Client privileged data included.",
    platform: "Akira Leak Site", source_category: "ransomware", actor_handle: "Akira_Team",
    severity: "critical", sentiment: "negative", onion_url: "akiraifon4kf.onion/posts/lawfirm-2026",
    first_seen: "2026-04-18T13:45:00Z", mentions_count: 144, risk_score: 98,
    module: "ransomware", thread_context: "Legal firm with Fortune 100 clients. Data includes privileged communications, M&A documents, client case files. Ransom: $3.5M. 96h remaining on timer.",
    created_at: "2026-04-18T13:45:00Z",
  },
  {
    id: "dw-011", title: "Credential market listing: 50k combo list targeting healthcare portals",
    snippet: "Fresh combo list for patient portal and EHR system logins. 50,232 entries with country filtering.",
    platform: "Genesis Market Clone", source_category: "credentials", actor_handle: "c0mb0_king_99",
    severity: "high", sentiment: "negative", onion_url: "gen3sis5p2kx.onion/shop/listing/4423",
    first_seen: "2026-04-20T07:00:00Z", mentions_count: 57, risk_score: 85,
    module: "credential", thread_context: "Verified combo list: 50,232 entries for healthcare patient portals and EHR systems. Includes Epic, Cerner, and Athena logins. 38% validated live.",
    created_at: "2026-04-20T07:00:00Z",
  },
  {
    id: "dw-012", title: "New threat actor 'NullSector' announces campaigns against energy sector",
    snippet: "Unverified group claiming partnership with state actors. Published methodology doc targeting SCADA.",
    platform: "BreachForums", source_category: "forums", actor_handle: "NullSector_Ops",
    severity: "high", sentiment: "negative", onion_url: "breachf0rum5xk.onion/threads/nullsector-intro",
    first_seen: "2026-04-13T22:00:00Z", mentions_count: 203, risk_score: 78,
    module: "dark_web", thread_context: "Introduction post from new threat actor group. Claims 6-month preparation. Targeting power grid SCADA systems in NATO countries. Released partial methodology showing ICS/OT attack vectors.",
    created_at: "2026-04-13T22:00:00Z",
  },
];

const DEMO_RANSOMWARE_TICKER = [
  { name: "LockBit 3.0", victims: 47, status: "active", url: "lockbit3753b.onion" },
  { name: "ALPHV/BlackCat", victims: 31, status: "active", url: "alphvmmm4y6y5sc.onion" },
  { name: "Play", victims: 28, status: "active", url: "playb1og3k2nq.onion" },
  { name: "Akira", victims: 22, status: "active", url: "akiraifon4kf.onion" },
  { name: "Medusa Blog", victims: 19, status: "active", url: "medusaw6hjj.onion" },
  { name: "8Base", victims: 17, status: "active", url: "8base4m3k.onion" },
  { name: "BlackBasta", victims: 14, status: "active", url: "blackbastaa.onion" },
  { name: "Royal", victims: 11, status: "active", url: "royalhq2p.onion" },
  { name: "Cl0p", victims: 9, status: "intermittent", url: "clop2cjvd.onion" },
  { name: "RansomHub", victims: 23, status: "active", url: "ransomhub7p.onion" },
];

const DEMO_ONION_DOMAINS = [
  { domain: "darkf0rumx93k2l.onion", category: "Forum", trend: "up", visits: "12.4k" },
  { domain: "pastes7k3p2m.onion", category: "Paste", trend: "up", visits: "8.1k" },
  { domain: "credsh0p5n1q.onion", category: "Market", trend: "down", visits: "6.7k" },
  { domain: "leakbl0g8x2y.onion", category: "Leaks", trend: "up", visits: "19.3k" },
  { domain: "xss9k2m4p.onion", category: "Forum", trend: "stable", visits: "5.2k" },
];

const BRAND_SPARK = [14, 19, 22, 18, 30, 28, 35, 31, 40, 38, 45, 52, 49, 58, 62, 55, 67, 71, 69, 78, 74, 82, 79, 88, 94, 91, 98, 102, 97, 108];

// ─── Source categories ────────────────────────────────────────────────────────

const SOURCE_CATS = [
  { id: "forums", label: "Dark Web Forums", icon: MessageSquare, color: "#a855f7", border: "rgba(168,85,247,0.2)", bg: "rgba(168,85,247,0.06)", count: 4, last: "2h ago" },
  { id: "paste", label: "Paste Sites", icon: FileText, color: "#f97316", border: "rgba(249,115,22,0.2)", bg: "rgba(249,115,22,0.06)", count: 2, last: "41m ago" },
  { id: "leaks", label: "Data Leak Sites", icon: Database, color: "#ef4444", border: "rgba(239,68,68,0.2)", bg: "rgba(239,68,68,0.06)", count: 1, last: "1d ago" },
  { id: "credentials", label: "Credential Markets", icon: Lock, color: "#eab308", border: "rgba(234,179,8,0.2)", bg: "rgba(234,179,8,0.06)", count: 2, last: "20m ago" },
  { id: "telegram", label: "Telegram Channels", icon: Radio, color: "#3b82f6", border: "rgba(59,130,246,0.2)", bg: "rgba(59,130,246,0.06)", count: 1, last: "6h ago" },
  { id: "ransomware", label: "Ransomware Feeds", icon: Skull, color: "#dc2626", border: "rgba(220,38,38,0.25)", bg: "rgba(220,38,38,0.07)", count: 4, last: "7m ago" },
];

const FEED_TABS = [
  { id: "all", label: "All" },
  { id: "forums", label: "Forums" },
  { id: "paste", label: "Paste" },
  { id: "leaks", label: "Leaks" },
  { id: "credentials", label: "Credentials" },
  { id: "telegram", label: "Telegram" },
  { id: "ransomware", label: "Ransomware" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskOnion(url: string) {
  const clean = url.replace(/^https?:\/\//, "");
  const firstPart = clean.slice(0, 8);
  const rest = clean.includes(".onion") ? ".onion" + (clean.split(".onion")[1] || "") : "";
  return `${firstPart}…${rest}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function severityConfig(s: string) {
  const map: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    critical: { label: "CRITICAL", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/25", dot: "#ef4444" },
    high:     { label: "HIGH",     color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/25", dot: "#f97316" },
    medium:   { label: "MEDIUM",   color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/25", dot: "#eab308" },
    low:      { label: "LOW",      color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25", dot: "#3b82f6" },
    info:     { label: "INFO",     color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", dot: "#64748b" },
  };
  return map[s] || map.info;
}

function sentimentConfig(s: string) {
  if (s === "negative") return { label: "Negative", cls: "text-red-400 bg-red-500/10 border-red-500/20" };
  if (s === "positive") return { label: "Positive", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
  return { label: "Neutral", cls: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
}

function sourceCatConfig(cat: string) {
  const match = SOURCE_CATS.find((s) => s.id === cat);
  return match || { color: "#a855f7", bg: "rgba(168,85,247,0.06)", border: "rgba(168,85,247,0.2)" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DarkWebPage() {
  const [alerts, setAlerts] = useState<DarkWebAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revealedUrls, setRevealedUrls] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("7d");
  const [lastUpdated] = useState(new Date());
  const [tickerOffset, setTickerOffset] = useState(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ticker animation
  useEffect(() => {
    tickerRef.current = setInterval(() => {
      setTickerOffset((prev) => (prev + 1) % DEMO_RANSOMWARE_TICKER.length);
    }, 3500);
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), per_page: "20", module: "dark_web" });
      if (searchQuery) params.set("search", searchQuery);
      const data = await apiFetch(`/api/v1/alerts/?${params}`);
      if (data.data && data.data.length > 0) {
        setAlerts(data.data);
        setTotal(data.total || 0);
      } else {
        setAlerts([]);
        setTotal(0);
      }
    } catch {
      setAlerts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch("/api/v1/alerts/stats");
      setStats(data);
    } catch {}
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Use demo data when API returns empty
  const feedItems: DemoFeedItem[] = alerts.length > 0
    ? alerts.map((a) => ({
        id: a.id, title: a.title, snippet: a.description || "",
        platform: a.platform || "Unknown", source_category: a.module || "dark_web",
        actor_handle: a.actor_handle || "anonymous", severity: a.severity,
        sentiment: a.sentiment || "negative",
        onion_url: a.source_url || "unknown.onion", first_seen: a.created_at,
        mentions_count: a.mentions_count || 1, risk_score: a.risk_score,
        module: a.module, created_at: a.created_at,
      }))
    : DEMO_FEED;

  const filteredFeed = feedItems.filter((item) => {
    if (activeTab !== "all" && item.source_category !== activeTab) return false;
    if (selectedSource && item.source_category !== selectedSource) return false;
    if (sentimentFilter !== "all" && item.sentiment !== sentimentFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !item.snippet.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(total / 20);
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  const statCards = [
    { label: "Total Findings", value: (alerts.length > 0 ? total : DEMO_FEED.length).toLocaleString(), accent: "#a855f7", spark: true },
    { label: "Critical Alerts", value: (alerts.length > 0 ? alerts.filter((a) => a.severity === "critical").length : DEMO_FEED.filter((d) => d.severity === "critical").length).toString(), accent: "#ef4444" },
    { label: "Ransomware Posts", value: (alerts.length > 0 ? alerts.filter((a) => a.module === "ransomware").length : DEMO_FEED.filter((d) => d.source_category === "ransomware").length).toString(), accent: "#f97316" },
    { label: "Active Sources", value: "6", accent: "#10b981" },
  ];

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,rgba(239,68,68,0.15),rgba(168,85,247,0.12))", border: "1px solid rgba(239,68,68,0.25)" }}>
            <Eye className="w-5 h-5 text-red-300" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse"
              style={{ boxShadow: "0 0 10px #ef4444" }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Dark Web Monitor</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/[0.08] border border-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[10px] text-red-300 font-semibold tracking-wider">LIVE</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Deep &amp; dark web surveillance — updated {timeAgo(lastUpdated.toISOString())}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchAlerts(); fetchStats(); toast.success("Feed refreshed"); }}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => toast.success("Exported feed to CSV")}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all"
            title="Export"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className="stat-card p-4 overflow-hidden relative">
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">{s.label}</p>
            <div className="flex items-baseline gap-1 mt-2">
              <p className="text-[24px] font-bold font-mono text-white leading-none">{s.value}</p>
            </div>
            {s.spark && (
              <svg className="absolute bottom-0 right-0 w-28 h-10 opacity-50" viewBox="0 0 120 40" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`dw-spark-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.accent} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={s.accent} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {(() => {
                  const pts = BRAND_SPARK.slice(-16);
                  const min = Math.min(...pts), max = Math.max(...pts);
                  const norm = pts.map((v, j) => `${(j / (pts.length - 1)) * 120},${40 - ((v - min) / (max - min)) * 32}`);
                  const dLine = `M ${norm.join(" L ")}`;
                  const dArea = `${dLine} L 120,40 L 0,40 Z`;
                  return <>
                    <path d={dArea} fill={`url(#dw-spark-${i})`} />
                    <path d={dLine} stroke={s.accent} strokeWidth="1.5" fill="none" />
                  </>;
                })()}
              </svg>
            )}
            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: s.accent, boxShadow: `0 0 8px ${s.accent}` }} />
          </div>
        ))}
      </div>

      {/* ── Source Category Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {SOURCE_CATS.map((src) => {
          const Icon = src.icon;
          const isActive = selectedSource === src.id;
          return (
            <button
              key={src.id}
              onClick={() => setSelectedSource(isActive ? "" : src.id)}
              className={cn(
                "card-enterprise p-3.5 text-left transition-all group relative overflow-hidden",
                isActive && "glow-purple"
              )}
              style={isActive ? { borderColor: src.border, background: src.bg } : {}}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: src.bg, border: `1px solid ${src.border}` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: src.color }} />
                </div>
                <span className="text-[18px] font-bold font-mono" style={{ color: src.color }}>{src.count}</span>
              </div>
              <p className="text-[11px] font-semibold text-slate-300 leading-tight">{src.label}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">{src.last}</p>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: `linear-gradient(90deg, transparent, ${src.color}, transparent)` }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main 2-col layout ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* ── LEFT: Feed ────────────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Filter bar */}
          <div className="card-enterprise p-3 md:p-4">
            <div className="flex gap-2 items-stretch flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder="Search findings, actors, keywords…"
                  className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/[0.02] border border-purple-500/[0.08] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/25 transition-all"
                />
              </div>
              <select
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
                className="h-10 px-3 rounded-lg bg-white/[0.02] border border-purple-500/[0.08] text-sm text-slate-300 focus:outline-none focus:border-purple-500/25 transition-all"
              >
                <option value="all">All Sentiment</option>
                <option value="negative">Negative</option>
                <option value="neutral">Neutral</option>
                <option value="positive">Positive</option>
              </select>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="h-10 px-3 rounded-lg bg-white/[0.02] border border-purple-500/[0.08] text-sm text-slate-300 focus:outline-none focus:border-purple-500/25 transition-all"
              >
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
                <option value="30d">Last 30d</option>
                <option value="90d">Last 90d</option>
              </select>
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="h-10 px-4 rounded-lg text-sm font-medium text-slate-300 bg-white/[0.02] border border-purple-500/[0.08] hover:border-purple-500/25 hover:text-white transition-all flex items-center gap-2"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              <span className="text-purple-300 font-semibold font-mono">{filteredFeed.length}</span> findings matched
            </p>
          </div>

          {/* Bulk action bar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl animate-fade-up"
              style={{
                background: "linear-gradient(90deg,rgba(139,92,246,0.08),rgba(236,72,153,0.05))",
                border: "1px solid rgba(139,92,246,0.25)",
              }}>
              <span className="text-sm text-slate-200">
                <span className="text-purple-300 font-bold">{selectedIds.length}</span> selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.success(`Added ${selectedIds.length} to watchlist`)}
                  className="h-8 px-3 rounded-md text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center gap-1.5"
                >
                  <BookmarkPlus className="w-3 h-3" /> Watchlist
                </button>
                <button
                  onClick={() => toast.info(`Takedown request initiated for ${selectedIds.length} items`)}
                  className="h-8 px-3 rounded-md text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3 h-3" /> Request Takedown
                </button>
                <button
                  onClick={() => toast.success("Exported selection")}
                  className="h-8 px-3 rounded-md text-xs font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3 h-3" /> Export
                </button>
                <button
                  onClick={() => setSelected({})}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.04] transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Feed Tabs */}
          <div className="flex items-center gap-0.5 border-b overflow-x-auto"
            style={{ borderColor: "rgba(139,92,246,0.08)" }}>
            {FEED_TABS.map((t) => {
              const count = t.id === "all" ? filteredFeed.length : feedItems.filter((f) => f.source_category === t.id).length;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    "relative px-3.5 h-9 flex items-center gap-1.5 text-xs font-medium transition-all whitespace-nowrap",
                    activeTab === t.id ? "text-white" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {t.label}
                  {count > 0 && (
                    <span className={cn(
                      "px-1 min-w-[18px] h-4 rounded text-[9px] font-bold flex items-center justify-center",
                      activeTab === t.id ? "bg-purple-500/20 text-purple-300" : "bg-white/[0.04] text-slate-500"
                    )}>{count}</span>
                  )}
                  {activeTab === t.id && (
                    <div className="absolute left-0 right-0 bottom-[-1px] h-[2px] rounded-full"
                      style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Feed Cards */}
          <div className="card-enterprise overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-red-400" />
                <p className="text-xs text-slate-500">Scanning dark web sources…</p>
              </div>
            ) : filteredFeed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Globe className="w-10 h-10 text-slate-700" />
                <p className="text-sm text-slate-400">No findings match your filters.</p>
                <button onClick={() => { setSearchQuery(""); setActiveTab("all"); setSelectedSource(""); }}
                  className="text-xs text-purple-300 hover:underline">Clear filters</button>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "rgba(139,92,246,0.04)" }}>
                {filteredFeed.map((item) => {
                  const sev = severityConfig(item.severity);
                  const sent = sentimentConfig(item.sentiment);
                  const catCfg = sourceCatConfig(item.source_category);
                  const isExpanded = expandedId === item.id;
                  const isSelected = !!selected[item.id];
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "group transition-colors",
                        isSelected ? "bg-purple-500/[0.04]" : "hover:bg-white/[0.015]"
                      )}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <button
                            onClick={() => setSelected((s) => ({ ...s, [item.id]: !s[item.id] }))}
                            className={cn(
                              "mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all",
                              isSelected
                                ? "bg-gradient-to-br from-purple-500 to-pink-500"
                                : "bg-white/[0.02] border border-white/[0.12] hover:border-purple-500/40"
                            )}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-sm bg-white" />}
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {/* Badges row */}
                            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                              <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider border", sev.bg, sev.color, sev.border)}>
                                {sev.label}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium border"
                                style={{ color: catCfg.color, background: catCfg.bg, borderColor: catCfg.border }}>
                                {item.platform}
                              </span>
                              <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium border", sent.cls)}>
                                {sent.label}
                              </span>
                            </div>

                            {/* Title */}
                            <p className="text-sm font-semibold text-slate-200 leading-snug">
                              {searchQuery ? highlightMatch(item.title, searchQuery) : item.title}
                            </p>

                            {/* Snippet */}
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                              {searchQuery ? highlightMatch(item.snippet, searchQuery) : item.snippet}
                            </p>

                            {/* Meta row */}
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <span className="flex items-center gap-1 text-[10px] text-slate-600">
                                <Hash className="w-3 h-3" />
                                <span className="font-mono blur-[3px] hover:blur-0 transition-all cursor-pointer select-none">
                                  {item.actor_handle}
                                </span>
                              </span>
                              <span className="text-[10px] text-slate-600 font-mono">
                                {revealedUrls[item.id]
                                  ? item.onion_url
                                  : maskOnion(item.onion_url)}
                                <button
                                  onClick={() => setRevealedUrls((r) => ({ ...r, [item.id]: !r[item.id] }))}
                                  className="ml-1 text-purple-500 hover:text-purple-300 transition-colors"
                                >
                                  {revealedUrls[item.id] ? "hide" : "reveal"}
                                </button>
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-slate-600">
                                <Clock className="w-3 h-3" />{timeAgo(item.first_seen)}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-slate-600">
                                <Globe className="w-3 h-3" />{item.mentions_count} mentions
                              </span>
                              <span className="ml-auto text-[10px] font-bold font-mono"
                                style={{ color: item.risk_score >= 90 ? "#ef4444" : item.risk_score >= 70 ? "#f97316" : "#eab308" }}>
                                Risk {item.risk_score}
                              </span>
                            </div>
                          </div>

                          {/* Expand toggle */}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className="mt-0.5 w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] transition-all"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Expanded thread context */}
                        {isExpanded && item.thread_context && (
                          <div className="mt-3 ml-7 p-3 rounded-lg text-xs text-slate-400 font-mono leading-relaxed animate-fade-up"
                            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(139,92,246,0.08)" }}>
                            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2 font-sans font-semibold">Thread Context</p>
                            {item.thread_context}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}>
                <span className="text-[11px] text-slate-500">Page <span className="text-white font-semibold">{page}</span> of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white disabled:opacity-30 transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white disabled:opacity-30 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Sidebar ───────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Ransomware Ticker */}
          <div className="card-enterprise overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4 pb-3"
              style={{ borderBottom: "1px solid rgba(239,68,68,0.08)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" style={{ boxShadow: "0 0 8px #ef4444" }} />
              <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">Active Ransomware Leak Sites</p>
            </div>
            <div className="p-2 space-y-0.5">
              {DEMO_RANSOMWARE_TICKER.map((group, i) => {
                const relIdx = (i - tickerOffset + DEMO_RANSOMWARE_TICKER.length) % DEMO_RANSOMWARE_TICKER.length;
                const opacity = relIdx === 0 ? 1 : relIdx === 1 ? 0.75 : relIdx === 2 ? 0.55 : 0.35;
                return (
                  <div key={group.name} className="flex items-center justify-between px-2.5 py-2 rounded-lg transition-all"
                    style={{ opacity, background: relIdx === 0 ? "rgba(239,68,68,0.06)" : "transparent" }}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full",
                        group.status === "active" ? "bg-red-400" : "bg-yellow-400"
                      )}
                        style={{ boxShadow: group.status === "active" ? "0 0 6px #ef4444" : "0 0 6px #eab308" }} />
                      <span className="text-xs font-semibold text-slate-300">{group.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-red-400">{group.victims}</span>
                      <span className="text-[10px] text-slate-600">victims</span>
                      <button onClick={() => toast.info(`Opening ${maskOnion(group.url)}`)}
                        className="w-5 h-5 flex items-center justify-center text-slate-700 hover:text-purple-300 transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trending Onion Domains */}
          <div className="card-enterprise p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">Trending Onion Domains</p>
            </div>
            <div className="space-y-2">
              {DEMO_ONION_DOMAINS.map((d, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-slate-600 font-mono w-3 shrink-0">{i + 1}</span>
                    <span className="text-[11px] font-mono text-slate-400 truncate">{maskOnion(d.domain)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="text-[10px] text-slate-600 font-mono">{d.visits}</span>
                    {d.trend === "up" && <TrendingUp className="w-3 h-3 text-red-400" />}
                    {d.trend === "down" && <TrendingUp className="w-3 h-3 text-emerald-400 rotate-180" />}
                    {d.trend === "stable" && <div className="w-3 h-0.5 bg-slate-600 rounded" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Brand Mentions 30d Sparkline */}
          <div className="card-enterprise p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">Brand Mentions 30d</p>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold">+18% vs prev</span>
            </div>
            <svg className="w-full h-16" viewBox="0 0 300 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="brand-spark-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                </linearGradient>
              </defs>
              {(() => {
                const pts = BRAND_SPARK;
                const min = Math.min(...pts), max = Math.max(...pts);
                const coords = pts.map((v, i) =>
                  `${(i / (pts.length - 1)) * 300},${60 - ((v - min) / (max - min)) * 50}`
                );
                const dLine = `M ${coords.join(" L ")}`;
                const dArea = `${dLine} L 300,60 L 0,60 Z`;
                return <>
                  <path d={dArea} fill="url(#brand-spark-area)" />
                  <path d={dLine} stroke="#a855f7" strokeWidth="1.5" fill="none" />
                </>;
              })()}
            </svg>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-slate-600">Mar 22</span>
              <span className="text-[10px] text-slate-600">Apr 21</span>
            </div>
          </div>

          {/* Credentials Surfacing Counter */}
          <a href="/credentials"
            className="card-enterprise p-4 flex items-center justify-between group transition-all hover:border-purple-500/25 cursor-pointer block"
            style={{ textDecoration: "none" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <Lock className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Credentials Surfacing</p>
                <p className="text-xl font-bold font-mono text-red-400 leading-none mt-0.5">
                  {stats ? String((stats as Record<string, Record<string, number>>)?.by_module?.credential || 2847) : "2,847"}
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-purple-300 transition-colors" />
          </a>

          {/* Intelligence Summary */}
          <div className="card-enterprise p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">Intelligence Summary</p>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Critical findings", value: DEMO_FEED.filter((d) => d.severity === "critical").length, color: "#ef4444" },
                { label: "High severity", value: DEMO_FEED.filter((d) => d.severity === "high").length, color: "#f97316" },
                { label: "Medium severity", value: DEMO_FEED.filter((d) => d.severity === "medium").length, color: "#eab308" },
                { label: "Low / Info", value: DEMO_FEED.filter((d) => d.severity === "low" || d.severity === "info").length, color: "#3b82f6" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: row.color, boxShadow: `0 0 6px ${row.color}` }} />
                    <span className="text-[11px] text-slate-500">{row.label}</span>
                  </div>
                  <span className="text-[11px] font-bold font-mono" style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Highlight helper ─────────────────────────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/20 text-yellow-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
