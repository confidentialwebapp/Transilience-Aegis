"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getOrgId } from "@/lib/api";
import { useAlerts } from "@/hooks/useAlerts";
import { createClient } from "@/lib/supabase/client";
import { CommandPalette } from "@/components/CommandPalette";
import {
  LayoutDashboard, AlertTriangle, Box, Bell, Search as SearchIcon,
  Settings, ChevronLeft, ChevronRight, Menu, Scan,
  Bug, Building2, Network, Eye, Skull, Fingerprint, Brain, Activity,
  Radio, FileText, Radar, LogOut, User, ChevronDown, BarChart3, KeyRound,
  Command, Zap, Sparkles, ArrowRight, HelpCircle, Keyboard, Gift, Sun, Moon,
  Check, X, Shield, Target, Globe as GlobeIcon, Plus, MessageSquare,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    title: "COMMAND CENTER",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badge: null },
      { href: "/investigate", label: "Investigate", icon: Scan, badge: null },
    ],
  },
  {
    title: "THREAT INTELLIGENCE",
    items: [
      { href: "/threats", label: "Threat Feed", icon: Radio, badge: null },
      { href: "/cve", label: "CVE Intelligence", icon: Bug, badge: null },
      { href: "/threat-actors", label: "Threat Actors", icon: Skull, badge: null },
      { href: "/dark-web", label: "Dark Web Monitor", icon: Eye, badge: "LIVE" },
      { href: "/intel", label: "IOC Lookup", icon: Fingerprint, badge: null },
      { href: "/graph", label: "Link Graph", icon: Network, badge: "NEW" },
    ],
  },
  {
    title: "ATTACK SURFACE",
    items: [
      { href: "/attack-surface", label: "Surface Map", icon: Radar, badge: null },
      { href: "/infrastructure", label: "Infra Monitor", icon: Network, badge: null },
      { href: "/recon", label: "OSINT Recon", icon: Target, badge: null },
      { href: "/scan", label: "Active Scanners", icon: Zap, badge: "NEW" },
      { href: "/osint", label: "Username OSINT", icon: User, badge: "NEW" },
      { href: "/assets", label: "Asset Inventory", icon: Box, badge: null },
      { href: "/scan-review", label: "Scan Review", icon: FileText, badge: null },
    ],
  },
  {
    title: "DIGITAL RISK",
    items: [
      { href: "/alerts", label: "Alert Center", icon: AlertTriangle, badge: null },
      { href: "/profile", label: "Customer Watchlist", icon: Skull, badge: "NEW" },
      { href: "/researcher-feed", label: "Researcher Feed", icon: Radio, badge: "NEW" },
      { href: "/credentials", label: "Credentials", icon: KeyRound, badge: "99+" },
      { href: "/exposure", label: "Exposure", icon: BarChart3, badge: null },
      { href: "/vendors", label: "Supply Chain", icon: Building2, badge: null },
      { href: "/transilience-ai", label: "Transilience AI", icon: Brain, badge: "AI" },
    ],
  },
  {
    title: "DEVELOPER",
    items: [
      { href: "/docs", label: "API Docs", icon: FileText, badge: "NEW" },
      { href: "/api-keys", label: "API Keys", icon: KeyRound, badge: "NEW" },
      { href: "/webhooks", label: "Webhooks", icon: Zap, badge: "NEW" },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { href: "/audit", label: "Audit Log", icon: HelpCircle, badge: "NEW" },
      { href: "/settings", label: "Settings", icon: Settings, badge: null },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Command Center",
  "/investigate": "Investigate",
  "/threats": "Threat Feed",
  "/cve": "CVE Intelligence",
  "/threat-actors": "Threat Actors",
  "/dark-web": "Dark Web Monitor",
  "/intel": "IOC Lookup",
  "/graph": "Link Graph",
  "/attack-surface": "Surface Map",
  "/infrastructure": "Infra Monitor",
  "/recon": "OSINT Recon",
  "/scan": "Active Scanners",
  "/osint": "Username OSINT",
  "/assets": "Asset Inventory",
  "/scan-review": "Scan Review",
  "/alerts": "Alert Center",
  "/profile": "Customer Watchlist",
  "/researcher-feed": "Researcher Feed",
  "/credentials": "Credentials",
  "/exposure": "Exposure",
  "/vendors": "Supply Chain",
  "/transilience-ai": "Transilience AI",
  "/docs": "API Docs",
  "/api-keys": "API Keys",
  "/webhooks": "Webhooks",
  "/audit": "Audit Log",
  "/settings": "Settings",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgId, setOrgIdState] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifTab, setNotifTab] = useState<"all" | "unread" | "mentions">("all");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [pipelineRate, setPipelineRate] = useState(14);
  const [liveEventCount, setLiveEventCount] = useState(0);
  const [now, setNow] = useState<Date>(new Date());
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOrgIdState(getOrgId()); }, []);
  const { unreadCount, clearUnread } = useAlerts(orgId);

  // Load user session
  useEffect(() => {
    const loadUser = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserEmail(session.user.email || "");
          setUserName(session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User");
          // Cache user id for useUserStorage() on settings + other pages
          try { localStorage.setItem("tai_user_id", session.user.id); } catch {}
        }
      } catch {}
    };
    loadUser();
  }, []);

  // Close user menu + notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Command palette keyboard shortcut (Cmd/Ctrl+K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setCmdOpen(false);
        setShowNotifications(false);
        setShowUserMenu(false);
      }
      // Quick "/" opens command palette too
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Pipeline live rate + clock
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      setPipelineRate((r) => Math.max(6, Math.min(60, r + (Math.random() - 0.45) * 3)));
      setLiveEventCount((c) => c + Math.floor(Math.random() * 3));
    }, 1500);
    return () => clearInterval(id);
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      localStorage.removeItem("tai_org_id");
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#07040B" }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 flex flex-col border-r transition-all duration-300",
        collapsed ? "w-[68px]" : "w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )} style={{ background: "#0d0a14", borderColor: "rgba(139,92,246,0.06)" }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16" style={{ borderBottom: "1px solid rgba(139,92,246,0.06)" }}>
          <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center">
            <Image src="/logo.png" alt="Transilience AI" width={36} height={36} className="object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-[15px] font-bold text-gradient-brand tracking-tight">Transilience</span>
              <span className="text-[9px] font-semibold tracking-[0.2em] -mt-0.5" style={{ color: "rgba(139,92,246,0.5)" }}>THREAT INTELLIGENCE</span>
            </div>
          )}
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <div className="px-3 mb-1.5">
                  <span className="text-[10px] font-semibold tracking-[0.15em]" style={{ color: "#4a3870" }}>{section.title}</span>
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group relative",
                        active
                          ? "text-purple-300"
                          : "text-slate-500 hover:text-slate-300"
                      )}
                      style={active ? { background: "rgba(139,92,246,0.08)" } : undefined}
                    >
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: "linear-gradient(180deg, #8b5cf6, #ec4899)" }} />
                      )}
                      <item.icon className={cn("w-[18px] h-[18px] flex-shrink-0", active ? "text-purple-400" : "text-slate-600 group-hover:text-slate-400")} />
                      {!collapsed && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {item.label === "Alert Center" && unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/20">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                          {item.badge === "LIVE" && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              LIVE
                            </span>
                          )}
                          {item.badge === "AI" && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              AI
                            </span>
                          )}
                          {item.badge === "99+" && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500/15 text-red-300 border border-red-500/25">
                              99+
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* System status */}
        {!collapsed && (
          <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}>
            <div className="flex items-center gap-2 px-2 py-2 rounded-lg" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.1)" }}>
              <div className="status-live" />
              <span className="text-[11px] font-medium" style={{ color: "rgba(16,185,129,0.8)" }}>All Systems Operational</span>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center h-10 text-slate-600 hover:text-slate-400 transition-colors"
          style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navbar */}
        <header className="flex items-center gap-3 h-14 px-3 lg:px-5 backdrop-blur-xl z-30 relative"
          style={{ background: "rgba(13,10,20,0.85)", borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
          {/* Mobile menu */}
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-slate-500 hover:text-slate-300">
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumbs */}
          <nav className="hidden md:flex items-center gap-1.5 text-[12px] min-w-0">
            <Link href="/dashboard" className="flex items-center gap-1 text-slate-500 hover:text-purple-300 transition-colors shrink-0">
              <LayoutDashboard className="w-3 h-3" /> Dashboard
            </Link>
            {pathname !== "/" && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-700" />
                <span className="text-slate-300 font-medium truncate">
                  {PAGE_TITLES[pathname] ?? pathname.replace(/^\//, "").replace(/-/g, " ")}
                </span>
              </>
            )}
          </nav>

          {/* Search / Cmd+K trigger */}
          <button
            onClick={() => setCmdOpen(true)}
            className="flex-1 max-w-[440px] h-9 pl-3 pr-2 rounded-lg flex items-center gap-2 text-[12px] text-slate-500 hover:text-slate-300 transition-all group"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.08)" }}
          >
            <SearchIcon className="w-3.5 h-3.5 group-hover:text-purple-300 transition-colors" />
            <span className="flex-1 text-left truncate">Search threats, CVEs, IOCs, actors…</span>
            <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-slate-500 rounded font-mono"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,100,120,0.2)" }}>
              <Command className="w-2.5 h-2.5" /> K
            </kbd>
          </button>

          {/* Right cluster */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Clock */}
            <div className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-mono text-[11px] text-slate-500 tabular-nums"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.06)" }}>
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              <span className="text-slate-700">UTC{now.getTimezoneOffset() === 0 ? "" : (now.getTimezoneOffset() < 0 ? "+" : "-") + Math.abs(now.getTimezoneOffset() / 60)}</span>
            </div>

            {/* Pipeline status — clickable */}
            <button
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg group hover:bg-white/[0.03] transition-all"
              style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)" }}
              title="Ingest pipeline"
            >
              <div className="relative">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider">Pipeline</span>
                <span className="text-[11px] text-emerald-300 font-bold font-mono">{Math.round(pipelineRate)}/min</span>
              </div>
            </button>

            {/* Quick action: New investigation */}
            <Link
              href="/investigate"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-purple-200 hover:text-white transition-all"
              style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}
            >
              <Plus className="w-3 h-3" />
              <span>Investigate</span>
            </Link>

            {/* Notifications */}
            <div className="relative" ref={notifMenuRef}>
              <button
                onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
                className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]"
              >
                <Bell className="w-[18px] h-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full bg-red-500 text-white animate-pulse"
                    style={{ boxShadow: "0 0 0 2px #0d0a14" }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification panel */}
              {showNotifications && (
                <div
                  className="absolute right-0 top-full mt-2 w-[380px] rounded-xl overflow-hidden shadow-2xl z-50 animate-fade-up"
                  style={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.2)" }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-3"
                    style={{ borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Bell className="w-4 h-4 text-purple-300" />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-white">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-red-500/15 text-red-300 border border-red-500/25">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => { clearUnread(); }}
                      className="text-[10px] text-purple-300 hover:text-purple-200 font-semibold"
                    >
                      Mark all read
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex px-3 pt-2 gap-1 border-b border-purple-500/[0.08]">
                    {(["all", "unread", "mentions"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setNotifTab(t)}
                        className={cn(
                          "relative px-3 py-2 text-[11px] font-semibold capitalize transition-all",
                          notifTab === t ? "text-white" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        {t}
                        {notifTab === t && (
                          <div className="absolute left-0 right-0 bottom-[-1px] h-[2px] rounded-full"
                            style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Notification items */}
                  <div className="max-h-[400px] overflow-y-auto">
                    {[
                      { sev: "critical", icon: AlertTriangle, color: "#ef4444", title: "CVE-2024-3400 actively exploited", desc: "Palo Alto GlobalProtect — 14 assets potentially affected", time: "2m ago", unread: true, href: "/cve" },
                      { sev: "high", icon: KeyRound, color: "#3b82f6", title: "Credential leak match", desc: "27 credentials for your domain in new combolist", time: "18m ago", unread: true, href: "/credentials" },
                      { sev: "high", icon: Skull, color: "#ec4899", title: "LockBit claimed victim in your industry", desc: "Healthcare provider listed on leak site", time: "1h ago", unread: true, href: "/threat-actors" },
                      { sev: "medium", icon: Eye, color: "#a855f7", title: "Brand mention on dark web forum", desc: "Thread: \"buying access to Transilience clients\"", time: "3h ago", unread: true, href: "/dark-web" },
                      { sev: "medium", icon: Building2, color: "#10b981", title: "Vendor score dropped", desc: "Cloudflare: A → B (DNS anomaly)", time: "6h ago", unread: false, href: "/vendors" },
                      { sev: "info", icon: Radar, color: "#06b6d4", title: "Attack surface scan completed", desc: "7 new subdomains discovered", time: "12h ago", unread: false, href: "/attack-surface" },
                    ]
                      .filter((n) => notifTab === "all" || (notifTab === "unread" && n.unread) || (notifTab === "mentions" && n.title.includes("mention")))
                      .map((n, i) => (
                        <Link
                          key={i}
                          href={n.href}
                          onClick={() => setShowNotifications(false)}
                          className="flex items-start gap-2.5 p-3 hover:bg-white/[0.02] transition-colors border-b border-purple-500/[0.04] relative group"
                        >
                          {n.unread && (
                            <span className="absolute left-1 top-5 w-1 h-1 rounded-full bg-purple-400" />
                          )}
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: `${n.color}15`, border: `1px solid ${n.color}30` }}
                          >
                            <n.icon className="w-3.5 h-3.5" style={{ color: n.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={cn("text-[12px] font-medium", n.unread ? "text-white" : "text-slate-400")}>
                                {n.title}
                              </p>
                              <span
                                className="px-1 py-0 text-[8px] font-bold rounded uppercase tracking-wider"
                                style={{ background: `${n.color}15`, color: n.color, border: `1px solid ${n.color}25` }}
                              >
                                {n.sev}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-1">{n.desc}</p>
                            <p className="text-[9.5px] text-slate-600 mt-0.5 font-mono">{n.time}</p>
                          </div>
                        </Link>
                      ))}
                  </div>

                  {/* Footer */}
                  <div className="p-2.5 text-center" style={{ borderTop: "1px solid rgba(139,92,246,0.08)" }}>
                    <Link
                      href="/alerts"
                      onClick={() => setShowNotifications(false)}
                      className="text-[11px] font-semibold text-purple-300 hover:text-purple-200 flex items-center justify-center gap-1"
                    >
                      View all in Alert Center <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Help */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden sm:block p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]"
              title="Help & shortcuts"
            >
              <HelpCircle className="w-[18px] h-[18px]" />
            </button>

            {/* User Menu */}
            <div className="relative pl-1.5 ml-0.5" style={{ borderLeft: "1px solid rgba(139,92,246,0.08)" }} ref={userMenuRef}>
              <button
                onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/[0.04] transition-all"
              >
                <div className="relative w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                  style={{
                    background: "linear-gradient(135deg, rgba(139,92,246,0.4), rgba(236,72,153,0.3))",
                    border: "1px solid rgba(139,92,246,0.4)",
                  }}>
                  {userName ? userName[0].toUpperCase() : "U"}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0d0a14]" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-200">{userName || "User"}</p>
                  <p className="text-[10px] text-slate-500">Analyst · Transilience</p>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-500 hidden sm:block" />
              </button>

              {/* User dropdown — larger, richer */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl overflow-hidden shadow-2xl z-50 animate-fade-up"
                  style={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.2)" }}>
                  {/* User card */}
                  <div className="relative p-4"
                    style={{
                      background: "linear-gradient(135deg,rgba(139,92,246,0.1),rgba(236,72,153,0.05))",
                      borderBottom: "1px solid rgba(139,92,246,0.12)",
                    }}>
                    <div className="flex items-center gap-3">
                      <div className="relative w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                        style={{
                          background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                          border: "1px solid rgba(255,255,255,0.15)",
                        }}>
                        {userName ? userName[0].toUpperCase() : "U"}
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#110d1a]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{userName || "User"}</p>
                        <p className="text-[11px] text-slate-400 truncate">{userEmail || "demo@transilience.ai"}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="px-1.5 py-0 text-[9px] font-bold rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25 uppercase tracking-wider">
                            Analyst
                          </span>
                          <span className="text-[9px] text-slate-600">·</span>
                          <span className="text-[9.5px] text-slate-500">Transilience Org</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="p-1.5">
                    <Link href="/settings" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
                      <User className="w-3.5 h-3.5" /> <span className="flex-1">Profile & Settings</span>
                      <kbd className="text-[9px] text-slate-600 font-mono">⌘,</kbd>
                    </Link>
                    <Link href="/settings" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
                      <Shield className="w-3.5 h-3.5" /> <span className="flex-1">Security & 2FA</span>
                    </Link>
                    <button onClick={() => { setShowUserMenu(false); setCmdOpen(true); }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all w-full text-left">
                      <Keyboard className="w-3.5 h-3.5" /> <span className="flex-1">Keyboard shortcuts</span>
                      <kbd className="text-[9px] text-slate-600 font-mono">⌘K</kbd>
                    </button>
                  </div>

                  <div className="p-1.5 border-t border-purple-500/[0.08]">
                    <Link href="/settings" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
                      <Building2 className="w-3.5 h-3.5" /> <span className="flex-1">Switch organization</span>
                      <ChevronRight className="w-3 h-3 text-slate-600" />
                    </Link>
                    <a href="https://github.com/confidentialwebapp/Transilience-Aegis" target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
                      <HelpCircle className="w-3.5 h-3.5" /> <span className="flex-1">Help & documentation</span>
                    </a>
                    <button className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all w-full text-left">
                      <Gift className="w-3.5 h-3.5 text-amber-300" />
                      <span className="flex-1">What&apos;s new</span>
                      <span className="px-1.5 py-0 text-[9px] font-bold rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">NEW</span>
                    </button>
                  </div>

                  <div className="p-1.5 border-t border-purple-500/[0.08]">
                    <button onClick={handleLogout}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/[0.08] transition-all w-full text-left">
                      <LogOut className="w-3.5 h-3.5" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Command Palette — Cmd+K overlay */}
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-grid-pattern">
          <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

