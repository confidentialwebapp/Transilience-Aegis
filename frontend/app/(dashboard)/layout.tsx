"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getOrgId } from "@/lib/api";
import { useAlerts } from "@/hooks/useAlerts";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, AlertTriangle, Box, Bell, Search as SearchIcon,
  Settings, ChevronLeft, ChevronRight, Database, Menu, Scan,
  Bug, Building2, Network, Eye, Skull, Fingerprint, Brain, Activity,
  Radio, FileText, Radar, LogOut, User, ChevronDown, BarChart3, KeyRound,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    title: "COMMAND CENTER",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, badge: null },
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
    ],
  },
  {
    title: "ATTACK SURFACE",
    items: [
      { href: "/attack-surface", label: "Surface Map", icon: Radar, badge: null },
      { href: "/infrastructure", label: "Infra Monitor", icon: Network, badge: null },
      { href: "/assets", label: "Asset Inventory", icon: Box, badge: null },
      { href: "/scan-review", label: "Scan Review", icon: FileText, badge: null },
    ],
  },
  {
    title: "DIGITAL RISK",
    items: [
      { href: "/alerts", label: "Alert Center", icon: AlertTriangle, badge: null },
      { href: "/credentials", label: "Credentials", icon: KeyRound, badge: "99+" },
      { href: "/exposure", label: "Exposure", icon: BarChart3, badge: null },
      { href: "/vendors", label: "Supply Chain", icon: Building2, badge: null },
      { href: "/transilience-ai", label: "Transilience AI", icon: Brain, badge: "AI" },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, badge: null },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgId, setOrgIdState] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
        }
      } catch {}
    };
    loadUser();
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
        <header className="flex items-center gap-4 h-14 px-4 lg:px-6 backdrop-blur-xl z-30"
          style={{ background: "rgba(13,10,20,0.8)", borderBottom: "1px solid rgba(139,92,246,0.06)" }}>
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-slate-500 hover:text-slate-300">
            <Menu className="w-5 h-5" />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-2xl">
            <div className="relative group">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-purple-400 transition-colors" />
              <input
                type="text"
                placeholder="Search threats, IOCs, CVEs, assets..."
                className="w-full pl-10 pr-4 py-2 rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.06)" }}
              />
              <kbd className="hidden sm:inline absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] text-slate-600 rounded font-mono" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,100,120,0.2)" }}>/</kbd>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Pipeline status */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.06)" }}>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-slate-500 font-medium">Pipeline</span>
              <span className="text-[11px] text-emerald-400 font-bold">ACTIVE</span>
            </div>

            {/* Notifications */}
            <button onClick={clearUnread} className="relative p-2 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/[0.02]">
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full bg-red-500 text-white" style={{ boxShadow: "0 0 0 2px #0d0a14" }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* User Menu */}
            <div className="relative pl-2" style={{ borderLeft: "1px solid rgba(139,92,246,0.06)" }} ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/[0.02] transition-all"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-purple-300 text-sm font-bold"
                  style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.15))", border: "1px solid rgba(139,92,246,0.1)" }}>
                  {userName ? userName[0].toUpperCase() : "U"}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-medium text-slate-300">{userName || "User"}</p>
                  <p className="text-[10px] text-slate-600">{userEmail || "Not signed in"}</p>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-600 hidden sm:block" />
              </button>

              {/* Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden shadow-2xl z-50 animate-fade-up"
                  style={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.12)" }}>
                  <div className="p-3" style={{ borderBottom: "1px solid rgba(139,92,246,0.06)" }}>
                    <p className="text-xs font-medium text-slate-300">{userName || "User"}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{userEmail || "demo@transilience.ai"}</p>
                  </div>
                  <div className="p-1">
                    <Link href="/settings" onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.03] transition-all">
                      <User className="w-3.5 h-3.5" /> Profile & Settings
                    </Link>
                    <button onClick={handleLogout}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/[0.05] transition-all w-full text-left">
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

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
