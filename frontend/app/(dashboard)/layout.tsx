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
import { TransilienceDock } from "@/components/TransilienceDock";
import { TopMegaMenu } from "@/components/platform/TopMegaMenu";
import { ClientSelector } from "@/components/platform/ClientSelector";
import { SIDEBAR_SECTIONS, PAGE_TITLES } from "@/lib/navigation";
import { useAdminCheck } from "@/lib/admin";
import {
  Bell, Search as SearchIcon, ChevronLeft, ChevronRight, Menu, Activity,
  LogOut, User, ChevronDown, Command, HelpCircle, Keyboard, Gift, Shield,
  Building2, Plus, ArrowRight, Lock, RotateCcw, UserCog, FileLock, Globe,
  AlertTriangle, KeyRound, Skull, Eye, Radar, LayoutDashboard,
} from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin } = useAdminCheck();
  // Filter the sidebar — non-admins should not see the ADMIN section.
  // Admin-only routes still get a server-side guard via /admin/layout.tsx.
  const visibleSections = isAdmin
    ? SIDEBAR_SECTIONS
    : SIDEBAR_SECTIONS.filter((s) => s.title !== "ADMIN");
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
  const [now, setNow] = useState<Date>(new Date());
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOrgIdState(getOrgId()); }, []);
  const { unreadCount, clearUnread } = useAlerts(orgId);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserEmail(session.user.email || "");
          setUserName(session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User");
          try { localStorage.setItem("tai_user_id", session.user.id); } catch {}
        }
      } catch {}
    };
    loadUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      setPipelineRate((r) => Math.max(6, Math.min(60, r + (Math.random() - 0.45) * 3)));
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
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#07040B" }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar (left navigation rail) */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 flex flex-col border-r transition-all duration-300",
        collapsed ? "w-[72px]" : "w-64",
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
              <span className="text-[9px] font-semibold tracking-[0.2em] -mt-0.5" style={{ color: "rgba(139,92,246,0.5)" }}>DIGITAL RISK PROTECTION</span>
            </div>
          )}
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3.5 sidebar-scroll">
          {visibleSections.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <div className="px-3 mb-1.5">
                  <span className="text-[9.5px] font-semibold tracking-[0.13em]" style={{ color: "#4a3870" }}>
                    {section.title}
                  </span>
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-all duration-200 group relative",
                        active ? "text-purple-300" : "text-slate-500 hover:text-slate-300"
                      )}
                      style={active ? { background: "rgba(139,92,246,0.08)" } : undefined}
                    >
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                          style={{ background: "linear-gradient(180deg, #8b5cf6, #ec4899)" }} />
                      )}
                      <Icon className={cn("w-[17px] h-[17px] flex-shrink-0", active ? "text-purple-400" : "text-slate-600 group-hover:text-slate-400")} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.label === "Incidents" && unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/20">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                          {item.badge === "LIVE" && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                              LIVE
                            </span>
                          )}
                          {item.badge === "NEW" && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              NEW
                            </span>
                          )}
                          {item.badge === "AI" && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              AI
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
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium" style={{ color: "rgba(16,185,129,0.8)" }}>All Systems Operational</span>
            </div>
          </div>
        )}

        {/* Logout in rail (matches spec: bottom of rail = logout) */}
        <div className="px-2 pb-2" style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[12.5px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/[0.06] transition-all"
            title="Sign out"
          >
            <LogOut className="w-[17px] h-[17px] flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center h-9 text-slate-600 hover:text-slate-400 transition-colors"
          style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navbar (header) */}
        <header className="flex items-center gap-3 h-14 px-3 lg:px-5 backdrop-blur-xl z-30 relative"
          style={{ background: "rgba(13,10,20,0.85)", borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
          {/* Mobile menu */}
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-slate-500 hover:text-slate-300">
            <Menu className="w-5 h-5" />
          </button>

          {/* Primary nav (megamenu) */}
          <TopMegaMenu />

          {/* Search trigger */}
          <button
            onClick={() => setCmdOpen(true)}
            className="ml-auto flex-1 max-w-[320px] h-9 pl-3 pr-2 rounded-lg flex items-center gap-2 text-[12px] text-slate-500 hover:text-slate-300 transition-all group"
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
          <div className="flex items-center gap-1.5">
            {/* Pipeline status */}
            <div className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
              style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)" }}>
              <div className="relative">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-[8.5px] text-slate-500 uppercase tracking-wider">Pipeline</span>
                <span className="text-[10.5px] text-emerald-300 font-bold font-mono">{Math.round(pipelineRate)}/min</span>
              </div>
            </div>

            {/* Client Selector */}
            <ClientSelector />

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
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-[380px] rounded-xl overflow-hidden shadow-2xl z-50 animate-fade-up"
                  style={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <div className="flex items-center justify-between p-3" style={{ borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-purple-300" />
                      <h3 className="text-sm font-semibold text-white">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-red-500/15 text-red-300 border border-red-500/25">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </div>
                    <button onClick={() => clearUnread()} className="text-[10px] text-purple-300 hover:text-purple-200 font-semibold">
                      Mark all read
                    </button>
                  </div>
                  <div className="flex px-3 pt-2 gap-1 border-b border-purple-500/[0.08]">
                    {(["all", "unread", "mentions"] as const).map((t) => (
                      <button key={t} onClick={() => setNotifTab(t)}
                        className={cn(
                          "relative px-3 py-2 text-[11px] font-semibold capitalize transition-all",
                          notifTab === t ? "text-white" : "text-slate-500 hover:text-slate-300"
                        )}>
                        {t}
                        {notifTab === t && (
                          <div className="absolute left-0 right-0 bottom-[-1px] h-[2px] rounded-full"
                            style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {[
                      { sev: "critical", icon: AlertTriangle, color: "#ef4444", title: "Phishing site live for 3h", desc: "secure-creditaccessgrameen-login.com — registered 14m ago", time: "2m ago", unread: true, href: "/threat-management/incidents" },
                      { sev: "high", icon: KeyRound, color: "#3b82f6", title: "Credential leak match", desc: "27 credentials for your domain in new combolist", time: "18m ago", unread: true, href: "/threat-management/data-loss-recovery" },
                      { sev: "high", icon: Skull, color: "#ec4899", title: "LockBit claimed victim in your industry", desc: "Healthcare provider listed on leak site", time: "1h ago", unread: true, href: "/cti/threat-actors" },
                      { sev: "medium", icon: Eye, color: "#a855f7", title: "Brand mention on dark web forum", desc: "Thread: \"buying access to your customer\"", time: "3h ago", unread: true, href: "/cti/advisory" },
                      { sev: "medium", icon: Building2, color: "#10b981", title: "Vendor score dropped", desc: "Cloudflare: A → B (DNS anomaly)", time: "6h ago", unread: false, href: "/tpra/vendors" },
                      { sev: "info", icon: Radar, color: "#06b6d4", title: "Attack surface scan completed", desc: "7 new subdomains discovered", time: "12h ago", unread: false, href: "/asm/asset-monitoring" },
                    ]
                      .filter((n) => notifTab === "all" || (notifTab === "unread" && n.unread) || (notifTab === "mentions" && n.title.includes("mention")))
                      .map((n, i) => (
                        <Link key={i} href={n.href} onClick={() => setShowNotifications(false)}
                          className="flex items-start gap-2.5 p-3 hover:bg-white/[0.02] transition-colors border-b border-purple-500/[0.04] relative group">
                          {n.unread && <span className="absolute left-1 top-5 w-1 h-1 rounded-full bg-purple-400" />}
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: `${n.color}15`, border: `1px solid ${n.color}30` }}>
                            <n.icon className="w-3.5 h-3.5" style={{ color: n.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={cn("text-[12px] font-medium", n.unread ? "text-white" : "text-slate-400")}>{n.title}</p>
                              <span className="px-1 py-0 text-[8px] font-bold rounded uppercase tracking-wider"
                                style={{ background: `${n.color}15`, color: n.color, border: `1px solid ${n.color}25` }}>
                                {n.sev}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-1">{n.desc}</p>
                            <p className="text-[9.5px] text-slate-600 mt-0.5 font-mono">{n.time}</p>
                          </div>
                        </Link>
                      ))}
                  </div>
                  <div className="p-2.5 text-center" style={{ borderTop: "1px solid rgba(139,92,246,0.08)" }}>
                    <Link href="/threat-management/incidents" onClick={() => setShowNotifications(false)}
                      className="text-[11px] font-semibold text-purple-300 hover:text-purple-200 flex items-center justify-center gap-1">
                      View all incidents <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Help */}
            <Link href="/knowledge/user-guide" className="hidden sm:block p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]" title="Help">
              <HelpCircle className="w-[18px] h-[18px]" />
            </Link>

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
                  {userName ? userName[0].toUpperCase() : "K"}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0d0a14]" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-200">{userName || "Karthik"}</p>
                  <p className="text-[10px] text-slate-500">Analyst · Transilience</p>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-500 hidden sm:block" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl overflow-hidden shadow-2xl z-50 animate-fade-up"
                  style={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.2)" }}>
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
                        {userName ? userName[0].toUpperCase() : "K"}
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#110d1a]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{userName || "Karthik"}</p>
                        <p className="text-[11px] text-slate-400 truncate">{userEmail || "fde@transilienceai.com"}</p>
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

                  <div className="p-1.5">
                    <Link href="/account/profile" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
                      <User className="w-3.5 h-3.5" /> <span className="flex-1">Profile</span>
                    </Link>
                    <Link href="/account/2fa" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
                      <Shield className="w-3.5 h-3.5" /> <span className="flex-1">2FA</span>
                    </Link>
                    <Link href="/account/reset-password" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
                      <Lock className="w-3.5 h-3.5" /> <span className="flex-1">Reset Password</span>
                    </Link>
                    <Link href="/account/user-policy" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
                      <UserCog className="w-3.5 h-3.5" /> <span className="flex-1">User Based Policy</span>
                    </Link>
                    <Link href="/account/org-policy" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
                      <FileLock className="w-3.5 h-3.5" /> <span className="flex-1">Organization Policy</span>
                    </Link>
                    <Link href="/account/timezone" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
                      <Globe className="w-3.5 h-3.5" /> <span className="flex-1">Timezone Setting</span>
                    </Link>
                  </div>

                  <div className="p-1.5 border-t border-purple-500/[0.08]">
                    <button onClick={() => { setShowUserMenu(false); setCmdOpen(true); }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all w-full text-left">
                      <Keyboard className="w-3.5 h-3.5" /> <span className="flex-1">Keyboard shortcuts</span>
                      <kbd className="text-[9px] text-slate-600 font-mono">⌘K</kbd>
                    </button>
                    <Link href="/knowledge/user-guide" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all">
                      <HelpCircle className="w-3.5 h-3.5" /> <span className="flex-1">Help & documentation</span>
                    </Link>
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

        {/* Command Palette */}
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

        {/* Transilience AI Dock */}
        <TransilienceDock />

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
