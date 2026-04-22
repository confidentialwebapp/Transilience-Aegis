"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Shield,
  Eye,
  Skull,
  Radio,
  Radar,
  Brain,
  Zap,
  AlertTriangle,
  Globe,
  Mail,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Menu,
  X,
  Github,
  ExternalLink,
  Lock,
  Database,
  Network,
  Search,
  Bell,
  Target,
  Activity,
  ChevronRight,
  Users,
  Clock,
  DollarSign,
} from "lucide-react";

// ─── Mini reusable primitives ──────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-purple-400 mb-3">
      {children}
    </p>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl sm:text-4xl font-bold text-gradient-brand leading-tight">
      {children}
    </h2>
  );
}

// ─── Dashboard mock preview card ──────────────────────────────────────────

function DashboardPreview() {
  const alerts = [
    {
      group: "LockBit 3.0",
      victim: "Acme Health Corp",
      sector: "Healthcare",
      country: "US",
      severity: "critical",
      matched: "sector:Healthcare · domain:acmehealth.com",
      ts: "2 min ago",
    },
    {
      group: "BlackCat / ALPHV",
      victim: "Ridgeway Financial",
      sector: "Finance",
      country: "GB",
      severity: "high",
      matched: "sector:Finance · keyword:ridgeway",
      ts: "18 min ago",
    },
    {
      group: "Cl0p",
      victim: "NovaTech Manufacturing",
      sector: "Manufacturing",
      country: "DE",
      severity: "medium",
      matched: "sector:Manufacturing",
      ts: "1 hr ago",
    },
  ];

  const severityStyle: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/25",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/25",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  };

  return (
    <div
      className="w-full max-w-2xl mx-auto rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(17,13,26,0.97) 0%, rgba(7,4,11,0.99) 100%)",
        border: "1px solid rgba(139,92,246,0.18)",
        boxShadow: "0 0 60px rgba(139,92,246,0.08), 0 40px 80px rgba(0,0,0,0.6)",
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: "rgba(139,92,246,0.1)", background: "rgba(13,10,20,0.8)" }}
      >
        <span className="w-3 h-3 rounded-full bg-red-500/70" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
        <span className="ml-3 text-xs text-slate-500 font-mono">aegis.transilience.ai — Ransomware Watchlist</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="status-live inline-block" />
          <span className="text-[10px] text-emerald-400 font-medium">LIVE</span>
        </div>
      </div>

      {/* Header row */}
      <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "rgba(139,92,246,0.06)" }}>
        <div className="flex items-center gap-2">
          <Skull className="w-4 h-4 text-red-400" />
          <span className="text-xs font-semibold text-slate-300">Ransomware Victim Matches</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
            3 new
          </span>
        </div>
        <span className="text-[10px] text-slate-600 font-mono">Updated 2 min ago</span>
      </div>

      {/* Alert rows */}
      <div className="divide-y" style={{ borderColor: "rgba(139,92,246,0.05)" }}>
        {alerts.map((a, i) => (
          <div key={i} className="px-4 py-3 hover:bg-white/[0.015] transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${severityStyle[a.severity]}`}
                  >
                    {a.severity.toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold text-white truncate">{a.victim}</span>
                  <span className="text-[10px] text-slate-500">{a.country}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-slate-500">
                    by <span className="text-purple-400 font-medium">{a.group}</span>
                  </span>
                  <span className="text-[10px] text-slate-600">·</span>
                  <span className="text-[10px] font-mono text-slate-500 truncate">matched: {a.matched}</span>
                </div>
              </div>
              <span className="text-[10px] text-slate-600 whitespace-nowrap shrink-0">{a.ts}</span>
            </div>
          </div>
        ))}
      </div>

      {/* IOC strip */}
      <div
        className="px-4 py-2.5 flex items-center gap-4 border-t"
        style={{ borderColor: "rgba(139,92,246,0.08)", background: "rgba(139,92,246,0.03)" }}
      >
        <div className="flex items-center gap-1.5">
          <Database className="w-3 h-3 text-purple-500" />
          <span className="text-[10px] text-slate-500 font-mono">12 sources enriched</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-emerald-500" />
          <span className="text-[10px] text-slate-500 font-mono">VirusTotal · AbuseIPDB · Shodan +9</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const handleGetStarted = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      window.location.href = `/register?email=${encodeURIComponent(emailInput.trim())}`;
    } else {
      window.location.href = "/register";
    }
  };

  return (
    <div className="min-h-screen bg-grid-pattern" style={{ background: "#07040B" }}>

      {/* ── STICKY HEADER ────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14"
        style={{
          background: "rgba(7,4,11,0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(139,92,246,0.1)",
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/logo.png" alt="Transilience AI" width={28} height={28} className="object-contain" />
          <span className="text-sm font-bold text-white hidden xs:inline">
            Transilience <span className="text-gradient-brand">AEGIS</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-xs text-slate-400 hover:text-white transition-colors font-medium tracking-wide">
            Features
          </a>
          <a href="#pricing" className="text-xs text-slate-400 hover:text-white transition-colors font-medium tracking-wide">
            Pricing
          </a>
          <a href="#how-it-works" className="text-xs text-slate-400 hover:text-white transition-colors font-medium tracking-wide">
            How it works
          </a>
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/login"
            className="px-4 py-1.5 text-xs text-slate-300 hover:text-white transition-colors font-medium"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="btn-brand px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
          >
            Get started free
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1.5 text-slate-400 hover:text-white transition-colors"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-x-0 top-14 z-40 px-4 py-4 md:hidden"
          style={{
            background: "rgba(13,10,20,0.97)",
            borderBottom: "1px solid rgba(139,92,246,0.1)",
            backdropFilter: "blur(16px)",
          }}
        >
          <nav className="flex flex-col gap-1">
            {["#features", "#pricing", "#how-it-works"].map((href) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors font-medium capitalize"
              >
                {href.replace("#", "").replace("-", " ")}
              </a>
            ))}
            <div className="border-t mt-2 pt-3" style={{ borderColor: "rgba(139,92,246,0.1)" }}>
              <Link href="/login" className="block px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors font-medium">
                Sign in
              </Link>
              <Link href="/register" className="block mt-1 px-3 py-2.5 btn-brand rounded-lg text-sm font-semibold text-center">
                Get started free
              </Link>
            </div>
          </nav>
        </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="pt-14">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="relative px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center overflow-hidden">
          {/* Ambient glow blobs */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, rgba(139,92,246,0.08) 0%, transparent 70%)",
            }}
          />

          <div className="relative max-w-4xl mx-auto animate-fade-up">
            {/* Beta pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 border"
              style={{ background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.2)" }}>
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-purple-300">
                New · Free Beta
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight mb-6">
              <span className="text-gradient-brand">Threat intelligence</span>
              <br />
              <span className="text-white">built for the mid-market</span>
            </h1>

            {/* Subhead */}
            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
              Real-time monitoring of ransomware leak sites, dark-web channels, and 50+ intel
              sources — at SMB pricing. Know what threat actors are saying about your company
              before they hit.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
              <Link
                href="/register"
                className="btn-brand px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 glow-brand w-full sm:w-auto justify-center"
              >
                Start free trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 text-slate-300 hover:text-white transition-colors w-full sm:w-auto justify-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.12)" }}
              >
                <Eye className="w-4 h-4" />
                See live demo
              </Link>
            </div>

            {/* Trust pills */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              {["Free during beta", "No credit card", "Setup in 2 minutes"].map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-slate-500">{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="relative max-w-2xl mx-auto mt-16 animate-fade-up">
            <DashboardPreview />
            {/* Reflection fade */}
            <div
              className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
              style={{ background: "linear-gradient(to top, #07040B, transparent)" }}
            />
          </div>
        </section>

        {/* ── PROBLEM / THE GAP ────────────────────────────────────────── */}
        <section className="px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14 animate-fade-up">
              <Eyebrow>The Gap</Eyebrow>
              <SectionHeading>CTI is broken for everyone except Fortune 500</SectionHeading>
              <p className="text-slate-400 mt-4 text-base max-w-2xl mx-auto">
                Threat intelligence exists. You just can&apos;t afford it, staff it, or scale it — until now.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  stat: "30+",
                  label: "Days late",
                  body: "Most companies hear about their breach from the news, not their security tool. Average detection lag: 30+ days.",
                  color: "#ef4444",
                  icon: AlertTriangle,
                },
                {
                  stat: "$50k+",
                  label: "Per year",
                  body: "Enterprise CTI platforms cost $30k–$100k/yr — out of reach for the 99% of companies that aren&apos;t Fortune 500.",
                  color: "#f97316",
                  icon: DollarSign,
                },
                {
                  stat: "1 FTE",
                  label: "Required",
                  body: "Free tools work but require a dedicated CTI analyst on staff to use them — a $120k+/yr hire.",
                  color: "#eab308",
                  icon: Users,
                },
                {
                  stat: "5",
                  label: "Max clients",
                  body: "Manual monitoring of dozens of intel sources doesn&apos;t scale past 5 customers without automation.",
                  color: "#8b5cf6",
                  icon: Network,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.stat} className="stat-card p-5 animate-fade-up">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                      style={{ background: `${item.color}18`, border: `1px solid ${item.color}30` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <div className="font-mono text-3xl font-bold mb-1" style={{ color: item.color }}>
                      {item.stat}
                    </div>
                    <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                      {item.label}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
        <section id="how-it-works" className="px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14 animate-fade-up">
              <Eyebrow>How it works</Eyebrow>
              <SectionHeading>From signup to first alert in under 5 minutes</SectionHeading>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {[
                {
                  num: "01",
                  icon: Target,
                  title: "Add your assets",
                  body: "Enter your domains, brand keywords, sectors, and target countries. Takes 2 minutes — no scripts, no agents, no vendor calls.",
                  color: "#8b5cf6",
                },
                {
                  num: "02",
                  icon: Radar,
                  title: "AEGIS watches 24/7",
                  body: "We continuously match every new ransomware victim, dark-web post, and leaked credential against your watchlist across 50+ sources.",
                  color: "#a855f7",
                },
                {
                  num: "03",
                  icon: Bell,
                  title: "Get instant alerts",
                  body: "Email digest or Telegram push the moment a match fires. Daily/weekly threat briefs for context. Severity-rated so you triage fast.",
                  color: "#ec4899",
                },
              ].map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.num} className="relative flex flex-col gap-4">
                    <div className="card-enterprise p-6 flex-1 animate-fade-up">
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{
                            background: `${step.color}15`,
                            border: `1px solid ${step.color}30`,
                          }}
                        >
                          <Icon className="w-5 h-5" style={{ color: step.color }} />
                        </div>
                        <span
                          className="font-mono text-3xl font-black"
                          style={{ color: `${step.color}25` }}
                        >
                          {step.num}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">{step.body}</p>
                    </div>
                    {/* Connector chevron */}
                    {i < 2 && (
                      <div className="hidden md:flex absolute top-1/2 -right-4 -translate-y-1/2 z-10">
                        <ChevronRight className="w-5 h-5 text-purple-500/40" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FEATURES GRID ────────────────────────────────────────────── */}
        <section id="features" className="px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14 animate-fade-up">
              <Eyebrow>Everything you need</Eyebrow>
              <SectionHeading>One platform. Every CTI source you&apos;d want.</SectionHeading>
              <p className="text-slate-400 mt-4 text-base max-w-2xl mx-auto">
                Eight production-grade capabilities, unified. No duct tape, no spreadsheets.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  icon: Skull,
                  color: "#ef4444",
                  title: "Ransomware Victim Watchlist",
                  desc: "Live feed from ransomware.live matched against your sector, domain, and keyword profile.",
                  bullets: ["100+ active ransomware groups tracked", "Instant match alerts via email + Telegram", "Historical victim database"],
                },
                {
                  icon: Radio,
                  color: "#a855f7",
                  title: "Researcher Intelligence Feed",
                  desc: "Curated feed of 8 elite security Telegram channels — vx-underground, CISA Cyber, DarkFeed, and more.",
                  bullets: ["Full-text search across all channels", "IOC extraction (IPs, hashes, domains)", "Real-time ingestion, no delay"],
                },
                {
                  icon: Database,
                  color: "#3b82f6",
                  title: "Multi-Source IOC Enrichment",
                  desc: "One IP, domain, or hash query returns a merged verdict from 12+ sources, cached in Redis.",
                  bullets: ["VirusTotal · AbuseIPDB · GreyNoise · Shodan", "OTX · Netlas · Censys + 6 more", "Sub-second response from cache"],
                },
                {
                  icon: Radar,
                  color: "#f97316",
                  title: "Active Attack Surface Scanners",
                  desc: "Subfinder, dnstwist, nmap, theHarvester, and nuclei running on Modal serverless compute.",
                  bullets: ["Scales to zero — pay-per-second billing", "Typosquat detection for brand protection", "Nuclei vulnerability templates"],
                },
                {
                  icon: Brain,
                  color: "#10b981",
                  title: "MITRE ATT&CK Threat Actors",
                  desc: "100+ tracked threat groups mapped to ATT&CK tactics, techniques, and procedures.",
                  bullets: ["Group aliases, targets, and TTPs", "Country-of-origin attribution", "CVE and malware family linkage"],
                },
                {
                  icon: Mail,
                  color: "#ec4899",
                  title: "Email Threat Digests",
                  desc: "Daily or weekly threat briefs delivered via Resend — curated, severity-ranked, and actionable.",
                  bullets: ["Configurable per customer profile", "Includes matched victims + new IOCs", "Unsubscribe and frequency controls"],
                },
                {
                  icon: Globe,
                  color: "#06b6d4",
                  title: "Maltego Transforms",
                  desc: "8 native transforms exposing AEGIS data inside Maltego desktop for power analysts.",
                  bullets: ["IOC enrichment pivot transforms", "Threat actor relationship graphs", "One-click install from Transform Hub"],
                },
                {
                  icon: Zap,
                  color: "#eab308",
                  title: "Real-Time Dark Web Monitoring",
                  desc: "Continuous monitoring of paste sites, leak forums, and ransomware leak portals.",
                  bullets: ["Stealer log credential exposure alerts", "Brand mention detection", "Data leak categorization by type"],
                },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="card-enterprise p-5 flex flex-col gap-3 animate-fade-up group">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${f.color}15`, border: `1px solid ${f.color}28` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: f.color }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white mb-1.5">{f.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed mb-3">{f.desc}</p>
                      <ul className="space-y-1">
                        {f.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                            <span className="text-[11px] text-slate-500">{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── COMPARISON TABLE ─────────────────────────────────────────── */}
        <section className="px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14 animate-fade-up">
              <Eyebrow>vs the incumbents</Eyebrow>
              <SectionHeading>How AEGIS compares</SectionHeading>
              <p className="text-slate-400 mt-4 text-base">
                Flare-grade coverage. SMB-grade pricing.
              </p>
            </div>

            <div className="card-enterprise overflow-hidden animate-fade-up">
              {/* Table header */}
              <div
                className="grid grid-cols-4 gap-0 border-b"
                style={{ borderColor: "rgba(139,92,246,0.1)" }}
              >
                <div className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Feature</div>
                {[
                  { name: "TAI-AEGIS", highlight: true },
                  { name: "Flare", highlight: false },
                  { name: "Recorded Future", highlight: false },
                ].map((col) => (
                  <div
                    key={col.name}
                    className="p-4 text-xs font-bold text-center"
                    style={
                      col.highlight
                        ? {
                            color: "#a855f7",
                            background: "rgba(139,92,246,0.06)",
                            borderLeft: "1px solid rgba(139,92,246,0.12)",
                            borderRight: "1px solid rgba(139,92,246,0.12)",
                          }
                        : { color: "#64748b" }
                    }
                  >
                    {col.name}
                    {col.highlight && (
                      <span className="block text-[9px] text-emerald-400 font-semibold mt-0.5 uppercase tracking-widest">
                        You are here
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Table rows */}
              {[
                ["Ransomware victim watchlist", "check", "check", "check"],
                ["Dark web / Telegram monitoring", "check", "check", "partial"],
                ["IOC enrichment (12+ sources)", "check", "partial", "check"],
                ["Active attack surface scanners", "check", "cross", "cross"],
                ["Maltego transforms", "check", "cross", "check"],
                ["MITRE ATT&CK actor tracking", "check", "partial", "check"],
                ["Email + Telegram digest alerts", "check", "check", "partial"],
                ["Pricing", "aegis-price", "flare-price", "rf-price"],
                ["Setup time", "2 minutes", "Days", "Weeks"],
                ["Self-serve signup", "check", "cross", "cross"],
              ].map((row, ri) => {
                const feature = row[0];
                const cells = row.slice(1);
                const renderCell = (val: string, isAegis: boolean) => {
                  if (val === "check")
                    return <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />;
                  if (val === "partial")
                    return <span className="text-yellow-400 text-lg mx-auto block text-center leading-none">~</span>;
                  if (val === "cross")
                    return <X className="w-4 h-4 text-red-400/60 mx-auto" />;
                  if (val === "aegis-price")
                    return (
                      <span className="text-[11px] font-bold text-emerald-400 font-mono text-center block">
                        $0 beta<br />
                        <span className="text-emerald-600">$99/mo after</span>
                      </span>
                    );
                  if (val === "flare-price")
                    return <span className="text-[11px] text-slate-500 font-mono text-center block">$25k+/yr</span>;
                  if (val === "rf-price")
                    return <span className="text-[11px] text-slate-500 font-mono text-center block">$50k+/yr</span>;
                  return (
                    <span className={`text-xs text-center block ${isAegis ? "text-emerald-400 font-semibold" : "text-slate-500"}`}>
                      {val}
                    </span>
                  );
                };

                return (
                  <div
                    key={ri}
                    className="grid grid-cols-4 gap-0 border-b transition-colors hover:bg-white/[0.012]"
                    style={{ borderColor: "rgba(139,92,246,0.05)" }}
                  >
                    <div className="p-3.5 text-xs text-slate-300 flex items-center">{feature}</div>
                    {cells.map((cell, ci) => (
                      <div
                        key={ci}
                        className="p-3.5 flex items-center justify-center"
                        style={
                          ci === 0
                            ? { background: "rgba(139,92,246,0.04)", borderLeft: "1px solid rgba(139,92,246,0.08)", borderRight: "1px solid rgba(139,92,246,0.08)" }
                            : {}
                        }
                      >
                        {renderCell(cell, ci === 0)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── PRICING ──────────────────────────────────────────────────── */}
        <section id="pricing" className="px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14 animate-fade-up">
              <Eyebrow>Pricing</Eyebrow>
              <SectionHeading>Free during beta. Honest pricing after.</SectionHeading>
              <p className="text-slate-400 mt-4 text-base max-w-xl mx-auto">
                No gotchas. No per-seat nonsense. One price, everything included.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
              {/* Free Beta */}
              <div className="card-enterprise p-6 flex flex-col gap-5 animate-fade-up">
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Free Beta</div>
                  <div className="flex items-end gap-1.5 mb-1">
                    <span className="text-4xl font-extrabold text-white">$0</span>
                    <span className="text-slate-500 text-sm mb-1">/mo</span>
                  </div>
                  <p className="text-xs text-emerald-400 font-medium">Available now</p>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {[
                    "All features, no limits",
                    "Customer watchlist profiles",
                    "Ransomware victim alerts",
                    "IOC enrichment (12+ sources)",
                    "Researcher intelligence feed",
                    "Active scanners (Modal)",
                    "Email digest alerts",
                    "Maltego transforms",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="block text-center py-2.5 rounded-lg font-semibold text-sm transition-colors text-slate-300 hover:text-white"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.12)" }}
                >
                  Get started
                </Link>
              </div>

              {/* Pro — highlighted */}
              <div
                className="relative flex flex-col gap-5 p-6 rounded-2xl animate-fade-up glow-brand"
                style={{
                  background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(168,85,247,0.06) 50%, rgba(236,72,153,0.06) 100%)",
                  border: "1px solid rgba(139,92,246,0.25)",
                }}
              >
                {/* Badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="btn-brand px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-lg">
                    Most Popular
                  </span>
                </div>
                <div className="pt-2">
                  <div className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">Pro</div>
                  <div className="flex items-end gap-1.5 mb-1">
                    <span className="text-4xl font-extrabold text-white">$99</span>
                    <span className="text-slate-500 text-sm mb-1">/mo</span>
                  </div>
                  <p className="text-xs text-purple-400 font-medium">Coming soon</p>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {[
                    "Everything in Free Beta",
                    "Unlimited customer profiles",
                    "Priority alert processing",
                    "Custom alert thresholds",
                    "Slack + webhook integrations",
                    "API access (rate-limited)",
                    "Priority email support",
                    "SLA: 99.5% uptime",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="text-xs text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  disabled
                  className="block text-center py-2.5 rounded-lg font-semibold text-sm text-slate-500 cursor-not-allowed"
                  style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)" }}
                >
                  Notify me when available
                </button>
              </div>

              {/* Enterprise */}
              <div className="card-enterprise p-6 flex flex-col gap-5 animate-fade-up">
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Enterprise</div>
                  <div className="flex items-end gap-1.5 mb-1">
                    <span className="text-4xl font-extrabold text-white">Custom</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Contact for pricing</p>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {[
                    "Everything in Pro",
                    "Custom data source integrations",
                    "Dedicated account manager",
                    "On-prem deployment option",
                    "SSO / SAML 2.0",
                    "Custom SLA terms",
                    "Quarterly threat briefings",
                    "White-label reporting",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-xs text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="mailto:fde@transilienceai.com?subject=AEGIS Enterprise Inquiry"
                  className="block text-center py-2.5 rounded-lg font-semibold text-sm text-slate-300 hover:text-white transition-colors"
                  style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}
                >
                  Contact sales
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────────────── */}
        <section className="px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-3xl mx-auto">
            <div
              className="relative rounded-2xl p-10 sm:p-14 text-center overflow-hidden glow-brand animate-fade-up"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(168,85,247,0.07) 40%, rgba(236,72,153,0.07) 100%)",
                border: "1px solid rgba(139,92,246,0.2)",
              }}
            >
              {/* Bg glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.12) 0%, transparent 60%)",
                }}
              />

              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6"
                  style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <Shield className="w-7 h-7 text-purple-400" />
                </div>

                <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 leading-tight">
                  Start protecting your brand today
                </h2>
                <p className="text-slate-400 text-base mb-8 max-w-lg mx-auto">
                  Your first ransomware match alert hits within 24 hours of setup.
                </p>

                <form onSubmit={handleGetStarted} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-6">
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(139,92,246,0.15)",
                    }}
                  />
                  <button
                    type="submit"
                    className="btn-brand px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shrink-0"
                  >
                    Get started free
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <p className="text-[11px] text-slate-600">
                  Free forever during beta &nbsp;·&nbsp; No credit card &nbsp;·&nbsp; 2 min setup
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <footer
          className="px-4 sm:px-6 lg:px-8 py-12 border-t"
          style={{ borderColor: "rgba(139,92,246,0.08)" }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
              {/* Brand column */}
              <div className="col-span-2 md:col-span-1">
                <Link href="/" className="flex items-center gap-2.5 mb-3">
                  <Image src="/logo.png" alt="Transilience AI" width={24} height={24} className="object-contain" />
                  <span className="text-sm font-bold text-white">
                    Transilience <span className="text-gradient-brand">AEGIS</span>
                  </span>
                </Link>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                  Flare-grade threat intelligence at SMB pricing. Built for the 99% of companies that aren&apos;t Fortune 500.
                </p>
                <a
                  href="https://github.com/confidentialwebapp/Transilience-Aegis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Product */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Product</h4>
                <ul className="space-y-2">
                  {[
                    { label: "Features", href: "#features" },
                    { label: "Pricing", href: "#pricing" },
                    { label: "Maltego Transforms", href: "#features" },
                    { label: "API Docs", href: "#" },
                    { label: "Changelog", href: "#" },
                  ].map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Company</h4>
                <ul className="space-y-2">
                  {[
                    { label: "About", href: "#" },
                    { label: "Blog", href: "#" },
                    { label: "Careers", href: "#" },
                    { label: "Contact", href: "mailto:fde@transilienceai.com" },
                  ].map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Legal</h4>
                <ul className="space-y-2">
                  {[
                    { label: "Privacy Policy", href: "#" },
                    { label: "Terms of Service", href: "#" },
                    { label: "Security", href: "#" },
                    { label: "Cookie Policy", href: "#" },
                  ].map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div
              className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t"
              style={{ borderColor: "rgba(139,92,246,0.07)" }}
            >
              <p className="text-[11px] text-slate-600">
                &copy; 2026 Transilience AI &mdash; Built with paranoia.
              </p>
              <div className="flex items-center gap-1.5">
                <span className="status-live inline-block" />
                <span className="text-[11px] text-slate-600">All systems operational</span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
