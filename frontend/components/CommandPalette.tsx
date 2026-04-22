"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search, LayoutDashboard, Radio, AlertTriangle, Bug, Skull, Eye,
  Fingerprint, Radar, Network, Target, Zap, User, Box, FileText,
  KeyRound, BarChart3, Building2, Brain, Settings, Scan, Plus,
  Sparkles, Keyboard, ArrowRight, HelpCircle, MessageSquare,
  Activity, Globe, Shield, Hash, RefreshCw, Send, Command,
  TrendingUp, Clock, ChevronRight,
} from "lucide-react";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  section: "Navigate" | "Actions" | "Quick queries" | "Help";
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  href?: string;
  shortcut?: string;
  onSelect?: () => void;
  badge?: string;
  badgeColor?: string;
}

// ----------------------------------------------------------------
// All palette items — stable reference (defined outside component)
// ----------------------------------------------------------------
const ALL_ITEMS: PaletteItem[] = [
  // Navigate
  { id: "nav-dashboard",       section: "Navigate", icon: LayoutDashboard, label: "Dashboard",            description: "Command center overview",            href: "/dashboard",        shortcut: "G D" },
  { id: "nav-investigate",     section: "Navigate", icon: Scan,            label: "Investigate",          description: "Deep-dive investigation workspace",   href: "/investigate",      shortcut: "G I" },
  { id: "nav-threats",         section: "Navigate", icon: Radio,           label: "Threat Feed",          description: "Live intelligence stream",            href: "/threats" },
  { id: "nav-cve",             section: "Navigate", icon: Bug,             label: "CVE Intelligence",     description: "NIST NVD + exploit tracking",         href: "/cve" },
  { id: "nav-threat-actors",   section: "Navigate", icon: Skull,           label: "Threat Actors",        description: "APT groups, ransomware gangs",        href: "/threat-actors" },
  { id: "nav-dark-web",        section: "Navigate", icon: Eye,             label: "Dark Web Monitor",     description: "Paste sites, forums, leak sites",     href: "/dark-web",         badge: "LIVE", badgeColor: "#10b981" },
  { id: "nav-intel",           section: "Navigate", icon: Fingerprint,     label: "IOC Lookup",           description: "12-source threat intel in one query", href: "/intel" },
  { id: "nav-surface",         section: "Navigate", icon: Radar,           label: "Surface Map",          description: "External attack surface overview",    href: "/attack-surface" },
  { id: "nav-infra",           section: "Navigate", icon: Network,         label: "Infra Monitor",        description: "Infrastructure health & anomalies",   href: "/infrastructure" },
  { id: "nav-recon",           section: "Navigate", icon: Target,          label: "OSINT Recon",          description: "Open-source intelligence gathering",  href: "/recon" },
  { id: "nav-scan",            section: "Navigate", icon: Zap,             label: "Active Scanners",      description: "Kali tools on Modal serverless",      href: "/scan",             badge: "NEW", badgeColor: "#8b5cf6" },
  { id: "nav-osint",           section: "Navigate", icon: User,            label: "Username OSINT",       description: "Cross-platform username lookup",      href: "/osint",            badge: "NEW", badgeColor: "#8b5cf6" },
  { id: "nav-assets",          section: "Navigate", icon: Box,             label: "Asset Inventory",      description: "Managed assets and risk scores",      href: "/assets" },
  { id: "nav-alerts",          section: "Navigate", icon: AlertTriangle,   label: "Alert Center",         description: "All detection alerts",                href: "/alerts",           shortcut: "G A" },
  { id: "nav-profile",         section: "Navigate", icon: Skull,           label: "Customer Watchlist",   description: "Ransomware & dark web monitoring",    href: "/profile",          badge: "NEW", badgeColor: "#8b5cf6" },
  { id: "nav-researcher-feed", section: "Navigate", icon: Radio,           label: "Researcher Feed",      description: "8 curated Telegram intel channels",   href: "/researcher-feed",  badge: "NEW", badgeColor: "#8b5cf6" },
  { id: "nav-credentials",     section: "Navigate", icon: KeyRound,        label: "Credentials",          description: "Leaked credential exposure",          href: "/credentials",      badge: "99+", badgeColor: "#ef4444" },
  { id: "nav-exposure",        section: "Navigate", icon: BarChart3,       label: "Exposure",             description: "Risk posture and scoring",            href: "/exposure" },
  { id: "nav-vendors",         section: "Navigate", icon: Building2,       label: "Supply Chain",         description: "Third-party vendor risk",             href: "/vendors" },
  { id: "nav-ai",              section: "Navigate", icon: Brain,           label: "Transilience AI",      description: "AI-powered threat analysis",          href: "/transilience-ai",  badge: "AI",  badgeColor: "#a855f7" },
  { id: "nav-settings",        section: "Navigate", icon: Settings,        label: "Settings",             description: "API keys, notifications, integrations", href: "/settings",        shortcut: "⌘ ," },

  // Actions
  { id: "act-investigate",     section: "Actions",  icon: Plus,            label: "New investigation",    description: "Start a deep-dive workspace",         href: "/investigate" },
  { id: "act-add-asset",       section: "Actions",  icon: Box,             label: "Add asset",            description: "Register a new monitored asset",      href: "/assets" },
  { id: "act-watchlist",       section: "Actions",  icon: Shield,          label: "Create watchlist profile", description: "Monitor a brand or domain 24/7", href: "/profile" },
  { id: "act-poll-feed",       section: "Actions",  icon: RefreshCw,       label: "Poll researcher feeds now", description: "Fetch latest posts from all channels", href: "/researcher-feed" },
  { id: "act-subdomain-scan",  section: "Actions",  icon: Globe,           label: "Run subdomain scan",   description: "Enumerate subdomains with subfinder", href: "/scan" },
  { id: "act-send-digest",     section: "Actions",  icon: Send,            label: "Send digest now",      description: "Trigger instant watchlist email digest", href: "/profile" },
  { id: "act-ask-ai",          section: "Actions",  icon: Sparkles,        label: "Ask Transilience AI",  description: "Natural language threat analysis",    href: "/transilience-ai" },

  // Quick queries
  { id: "q-critical-cves",     section: "Quick queries", icon: Bug,       label: "Critical CVEs this week", description: "CVSS 9.0+ with active exploitation",  href: "/cve" },
  { id: "q-ransomware",        section: "Quick queries", icon: Skull,     label: "Active ransomware groups", description: "Currently active gangs and victims", href: "/threat-actors" },
  { id: "q-dark-web",         section: "Quick queries", icon: Eye,        label: "Recent dark web mentions", description: "Mentions from the last 24 hours",   href: "/dark-web" },
  { id: "q-alerts",            section: "Quick queries", icon: AlertTriangle, label: "My alerts (last 24h)", description: "Unread high/critical detections",   href: "/alerts" },

  // Help
  { id: "help-shortcuts",      section: "Help",     icon: Keyboard,        label: "Keyboard shortcuts",   description: "View all available shortcuts" },
  { id: "help-support",        section: "Help",     icon: MessageSquare,   label: "Contact support",      description: "Get help from the team" },
  { id: "help-docs",           section: "Help",     icon: HelpCircle,      label: "Documentation",        description: "Guides and API reference" },
];

// Section display order
const SECTION_ORDER: PaletteItem["section"][] = ["Navigate", "Actions", "Quick queries", "Help"];

// Section accent colors
const SECTION_COLORS: Record<PaletteItem["section"], string> = {
  "Navigate":      "#8b5cf6",
  "Actions":       "#3b82f6",
  "Quick queries": "#f97316",
  "Help":          "#10b981",
};

// ----------------------------------------------------------------
// Keyboard shortcut help table (shown when "Keyboard shortcuts" selected)
// ----------------------------------------------------------------
const SHORTCUT_HINTS = [
  { keys: ["⌘", "K"],  label: "Open command palette" },
  { keys: ["/"],        label: "Open command palette (anywhere)" },
  { keys: ["↑", "↓"],  label: "Navigate items" },
  { keys: ["↵"],        label: "Select / navigate" },
  { keys: ["Esc"],      label: "Close palette" },
  { keys: ["⌘", ","],  label: "Open settings" },
  { keys: ["G", "D"],  label: "Go to Dashboard" },
  { keys: ["G", "A"],  label: "Go to Alert Center" },
  { keys: ["G", "I"],  label: "Go to Investigate" },
];

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------
function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn("inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400", className)}
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.12)" }}
    >
      {children}
    </kbd>
  );
}

function ShortcutChip({ shortcut }: { shortcut: string }) {
  const parts = shortcut.split(" ");
  return (
    <span className="flex items-center gap-0.5 shrink-0">
      {parts.map((p, i) => <Kbd key={i}>{p}</Kbd>)}
    </span>
  );
}

function ShortcutsPanel() {
  return (
    <div className="py-2 px-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-3">Keyboard shortcuts</p>
      <div className="space-y-2">
        {SHORTCUT_HINTS.map((h, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="text-[12px] text-slate-400">{h.label}</span>
            <span className="flex items-center gap-0.5 shrink-0">
              {h.keys.map((k, ki) => <Kbd key={ki}>{k}</Kbd>)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Main CommandPalette component
// ----------------------------------------------------------------
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Auto-focus input when palette opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setShowShortcuts(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Filter items
  const filtered = query.trim()
    ? ALL_ITEMS.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        (item.description || "").toLowerCase().includes(query.toLowerCase()) ||
        item.section.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_ITEMS;

  // Group by section (maintain order)
  const grouped: Partial<Record<PaletteItem["section"], PaletteItem[]>> = {};
  SECTION_ORDER.forEach((sec) => {
    const list = filtered.filter((i) => i.section === sec);
    if (list.length) grouped[sec] = list;
  });

  // Flat list for index tracking
  const flat = SECTION_ORDER.flatMap((sec) => grouped[sec] ?? []);

  // Reset selection on query change
  useEffect(() => { setSelectedIdx(0); }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIdx]);

  const handleSelect = useCallback((item: PaletteItem) => {
    if (item.id === "help-shortcuts") {
      setShowShortcuts(true);
      return;
    }
    if (item.onSelect) {
      item.onSelect();
      onClose();
      return;
    }
    if (item.href) {
      router.push(item.href);
      onClose();
    }
  }, [router, onClose]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[selectedIdx];
      if (item) handleSelect(item);
    } else if (e.key === "Escape") {
      if (showShortcuts) {
        setShowShortcuts(false);
      } else {
        onClose();
      }
    }
  }, [flat, selectedIdx, handleSelect, showShortcuts, onClose]);

  if (!open) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-4 sm:pt-[12vh] pt-0"
      style={{ background: "rgba(4,2,10,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-[640px] rounded-2xl overflow-hidden shadow-2xl",
          "sm:animate-fade-up",
          // Full-screen on mobile
          "sm:h-auto h-full sm:rounded-2xl rounded-none flex flex-col"
        )}
        style={{
          background: "linear-gradient(180deg, #14102a 0%, #0c0818 100%)",
          border: "1px solid rgba(139,92,246,0.28)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.1), inset 0 1px 0 rgba(139,92,246,0.12)",
        }}
      >
        {/* Search header */}
        <div
          className="flex items-center gap-3 px-4 py-3.5 shrink-0"
          style={{ borderBottom: "1px solid rgba(139,92,246,0.1)" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}
          >
            <Command className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowShortcuts(false);
            }}
            onKeyDown={handleKey}
            placeholder="Search commands, pages, IOCs, actors…"
            className="flex-1 bg-transparent text-[14px] text-white placeholder-slate-600 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
            aria-label="Command palette search"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-[10px] text-slate-500 hover:text-slate-300 px-1.5 py-0.5 rounded transition-colors"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.08)" }}
                aria-label="Clear search"
              >
                clear
              </button>
            )}
            <Kbd>ESC</Kbd>
          </div>
        </div>

        {/* Results or shortcuts panel */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ maxHeight: "min(55vh, 500px)" }}
        >
          {showShortcuts ? (
            <ShortcutsPanel />
          ) : flat.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.1)" }}
              >
                <Search className="w-5 h-5 text-slate-600" />
              </div>
              <div className="text-center">
                <p className="text-[13px] text-slate-400 font-medium">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-[11px] text-slate-600 mt-1">Try searching for a page, action, or IOC type</p>
              </div>
            </div>
          ) : (
            <div className="p-1.5">
              {SECTION_ORDER.map((section) => {
                const list = grouped[section];
                if (!list?.length) return null;
                const sectionColor = SECTION_COLORS[section];
                return (
                  <div key={section} className="mb-1 last:mb-0">
                    {/* Section header */}
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <div
                        className="w-1 h-1 rounded-full"
                        style={{ background: sectionColor, boxShadow: `0 0 4px ${sectionColor}` }}
                      />
                      <span
                        className="text-[9.5px] font-bold uppercase tracking-[0.18em]"
                        style={{ color: `${sectionColor}99` }}
                      >
                        {section}
                      </span>
                    </div>

                    {/* Items */}
                    {list.map((item) => {
                      const idx = flat.indexOf(item);
                      const selected = idx === selectedIdx;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          ref={selected ? selectedRef : undefined}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIdx(idx)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-100",
                            selected
                              ? "text-white"
                              : "text-slate-400 hover:text-slate-200"
                          )}
                          style={selected ? {
                            background: `linear-gradient(90deg, ${sectionColor}18, ${sectionColor}08)`,
                            border: `1px solid ${sectionColor}25`,
                          } : {
                            border: "1px solid transparent",
                          }}
                          role="option"
                          aria-selected={selected}
                        >
                          {/* Icon */}
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all"
                            style={selected ? {
                              background: `${sectionColor}20`,
                              border: `1px solid ${sectionColor}35`,
                            } : {
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.05)",
                            }}
                          >
                            <Icon className="w-3.5 h-3.5" style={{ color: selected ? sectionColor : undefined }} />
                          </div>

                          {/* Label + description */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-[13px] font-medium truncate", selected ? "text-white" : "text-slate-300")}>
                                {item.label}
                              </span>
                              {item.badge && (
                                <span
                                  className="px-1.5 py-0 text-[8.5px] font-bold rounded-full uppercase tracking-wider shrink-0"
                                  style={{
                                    background: `${item.badgeColor}18`,
                                    color: item.badgeColor,
                                    border: `1px solid ${item.badgeColor}30`,
                                  }}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className={cn("text-[11px] truncate mt-0.5", selected ? "text-slate-400" : "text-slate-600")}>
                                {item.description}
                              </p>
                            )}
                          </div>

                          {/* Right side: shortcut or arrow */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.shortcut && !selected && (
                              <ShortcutChip shortcut={item.shortcut} />
                            )}
                            {selected && (
                              <div
                                className="w-5 h-5 rounded-md flex items-center justify-center"
                                style={{ background: `${sectionColor}20` }}
                              >
                                <ArrowRight className="w-3 h-3" style={{ color: sectionColor }} />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2.5 shrink-0"
          style={{ borderTop: "1px solid rgba(139,92,246,0.08)" }}
        >
          <div className="flex items-center gap-3 text-[10px] text-slate-600">
            <span className="flex items-center gap-1">
              <Kbd>↑↓</Kbd>
              <span className="ml-1">navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd>
              <span className="ml-1">open</span>
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <Kbd>ESC</Kbd>
              <span className="ml-1">close</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" style={{ boxShadow: "0 0 6px #8b5cf6" }} />
            <span>Transilience AEGIS</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Default export + standalone hook for wiring Cmd+K globally
// ----------------------------------------------------------------
export default CommandPalette;

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}
