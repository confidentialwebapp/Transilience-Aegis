"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Globe,
  Mail,
  Radar,
  Skull,
  Database,
  Zap,
  Shield,
  CheckCircle2,
  ArrowRight,
  Bell,
  Tag,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChangeTag = "new" | "improved" | "fix" | "security" | "infra";

interface ChangelogEntry {
  date: string;
  version: string;
  name: string;
  summary: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor: string;
  accentColor: string;
  tags: ChangeTag[];
  items: string[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const ENTRIES: ChangelogEntry[] = [
  {
    date: "April 22, 2026",
    version: "v0.6.0",
    name: "Marketing site",
    summary:
      "Public marketing pages are live. The platform now has a proper front door — landing page, security posture, privacy policy, terms of service, and this changelog. Dashboard moved to /dashboard.",
    icon: Globe,
    iconColor: "#8b5cf6",
    accentColor: "#8b5cf6",
    tags: ["new"],
    items: [
      "Public landing page at / with hero, features grid, comparison table, and pricing",
      "Security page at /security — compliance grid, architecture details, sub-processors table, CVD process",
      "Privacy policy at /privacy — plain-English, per-field retention windows, rights matrix",
      "Terms of service at /terms — acceptable use, cancellation terms, governing law",
      "Changelog at /changelog (this page)",
      "Shared marketing layout with sticky header and footer",
      "Dashboard route moved from / to /dashboard to make room for public landing",
      "Middleware updated to allow /security, /privacy, /terms, /changelog without auth",
    ],
  },
  {
    date: "April 22, 2026",
    version: "v0.5.0",
    name: "Email digest",
    summary:
      "Daily and weekly threat-brief emails, delivered via Resend. An hourly Modal cron job evaluates new matches and queues digests for each profile. Anti-bombardment guards prevent duplicate sends.",
    icon: Mail,
    iconColor: "#ec4899",
    accentColor: "#ec4899",
    tags: ["new"],
    items: [
      "Daily and weekly digest emails rendered via Resend with dark-themed HTML templates",
      "Modal hourly cron job: evaluates new ransomware matches and researcher feed posts per profile",
      "Anti-bombardment guard: no duplicate digest sent within the configured frequency window",
      "Per-profile send-now button in the dashboard for manual digest trigger",
      "Digest preview endpoint: GET /api/v1/digest/preview?profile_id=<id>",
      "POST /api/v1/digest/send — trigger immediate send for a profile",
      "GET /api/v1/digest/history — last 7 days of digest send logs",
      "GET /api/v1/digest/config and PATCH /api/v1/digest/config — frequency and recipient config",
      "Digest unsubscribe link in every email footer (one-click, no auth required)",
    ],
  },
  {
    date: "April 22, 2026",
    version: "v0.4.0",
    name: "Modal scanner mesh",
    summary:
      "Five Kali-Linux tools deployed as pay-per-second Modal serverless functions. Scales to zero between scans. $5/mo compute cap. GitHub Actions auto-deploy pipeline.",
    icon: Radar,
    iconColor: "#f97316",
    accentColor: "#f97316",
    tags: ["new", "infra"],
    items: [
      "subfinder: passive subdomain enumeration via 30+ OSINT sources",
      "dnstwist: typosquat domain detection for brand-protection monitoring",
      "nmap -sT (TCP-connect): port/service fingerprinting without CAP_NET_RAW requirement",
      "theHarvester: email, subdomain, and employee enumeration via public sources",
      "nuclei: vulnerability template scanning against discovered attack surface",
      "Each tool runs as an isolated Modal Function with scoped IAM and ephemeral filesystem",
      "$5/mo compute cap enforced via Modal spending limit — scans queue if cap is hit",
      "GitHub Actions workflow: push to main auto-deploys all Modal functions",
      "New /scan page in dashboard: run tools, view live stdout stream, download results",
      "New /osint page: pre-configured OSINT workflows combining multiple tools",
      "POST /api/v1/scan/run — accepts {tool, target, flags} and returns job_id",
      "GET /api/v1/scan/result/{job_id} — poll for output (SSE stream supported)",
    ],
  },
  {
    date: "April 22, 2026",
    version: "v0.3.0",
    name: "Customer Watchlist + Researcher Feed",
    summary:
      "Per-org watchlist matching against the ransomware.live victim feed. Eight curated public Telegram researcher channels scraped via the public web interface. New alerts module with match reasons.",
    icon: Skull,
    iconColor: "#ef4444",
    accentColor: "#ef4444",
    tags: ["new"],
    items: [
      "Customer profile schema: name, domains[], keywords[], sectors[], countries[]",
      "Ransomware.live victim feed ingested hourly and matched against all active profiles",
      "Match engine: exact domain match, keyword substring, sector/country cross-match",
      "Match reason string attached to every alert (e.g., sector:Healthcare · domain:acmehealth.com)",
      "8 curated public Telegram channels scraped via t.me/s/<handle>: vx-underground, DarkFeed, CISA Cyber, GBHackers, The Record by Recorded Future, Hackread, RedPacket Security, CyberSecurityNews",
      "Researcher feed full-text search with IOC extraction (IPs, hashes, domains)",
      "Alerts module: unified view of ransomware matches and researcher feed hits",
      "Per-alert severity scoring (critical/high/medium/low) based on match specificity",
      "Telegram bot @aegisdarkwebbot sends outbound push alerts for critical matches",
      "POST /api/v1/profiles — create profile, GET /api/v1/profiles — list org profiles",
      "GET /api/v1/alerts — paginated alert feed with filter by severity/profile/date",
    ],
  },
  {
    date: "April 22, 2026",
    version: "v0.2.0",
    name: "Multi-source IOC enrichment",
    summary:
      "Single-query IOC enrichment that fans out across 12 public and commercial intel APIs simultaneously, merges the results into a unified verdict, and caches in Redis. Sub-second responses for cached IOCs.",
    icon: Database,
    iconColor: "#3b82f6",
    accentColor: "#3b82f6",
    tags: ["new"],
    items: [
      "POST /api/v1/intel/enrich — accepts {ioc, type} where type is ip|domain|hash|url",
      "Fan-out across 12 sources: VirusTotal, AbuseIPDB, GreyNoise, Shodan, OTX (AlienVault), Netlas, DNSDumpster, ThreatMiner, IPinfo, URLScan.io, Censys, MalwareBazaar",
      "Unified verdict: malicious/suspicious/clean/unknown with confidence score",
      "Per-source raw response preserved in response envelope for analyst drill-down",
      "Upstash Redis cache: enrichment results TTL'd to 6 hours for IPs, 24 hours for domains/hashes",
      "Cache hit rate tracked per source — surfaced in the enrichment response",
      "Rate-limit-aware fan-out: each source has its own token bucket; requests queue on exhaustion",
      "Enrichment result page in dashboard: timeline view of all source responses",
    ],
  },
  {
    date: "April 22, 2026",
    version: "v0.1.0",
    name: "Telegram bot + Maltego TRX",
    summary:
      "The first public-facing integrations: @aegisdarkwebbot for outbound Telegram alerts, and 8 native Maltego transforms that expose AEGIS data inside the Maltego desktop pivot workflow.",
    icon: Zap,
    iconColor: "#eab308",
    accentColor: "#eab308",
    tags: ["new"],
    items: [
      "@aegisdarkwebbot: receive push alerts for critical and high-severity matches directly in Telegram",
      "Bot commands: /status, /alerts, /enrich <ioc>, /watchlist",
      "Maltego Transform Hub listing: 8 transforms installable via one-click TRX endpoint",
      "Transform: IP to threat intel (fan-out enrichment from AEGIS into Maltego graph)",
      "Transform: domain to subdomains (subfinder results)",
      "Transform: domain to typosquats (dnstwist results)",
      "Transform: hash to malware family (VirusTotal + MalwareBazaar)",
      "Transform: domain to ransomware victims (watchlist match lookup)",
      "Transform: threat actor to TTPs (MITRE ATT&CK mapping)",
      "Transform: IP to Shodan host data",
      "Transform: email to breach exposure (stealer log lookup)",
      "TRX server deployed on Render — /trx endpoint accepts Maltego XML and returns entity graph XML",
    ],
  },
];

// ─── Tag pill ─────────────────────────────────────────────────────────────────

function TagPill({ tag }: { tag: ChangeTag }) {
  const styles: Record<ChangeTag, string> = {
    new: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    improved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    fix: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    security: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    infra: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${styles[tag]}`}
    >
      {tag}
    </span>
  );
}

// ─── Subscribe form ───────────────────────────────────────────────────────────

function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    try {
      await fetch(`/api/v1/changelog/subscribe?email=${encodeURIComponent(email.trim())}`, {
        method: "POST",
      });
      setState("success");
    } catch {
      setState("error");
    }
  };

  return (
    <div
      className="relative rounded-2xl p-8 sm:p-10 overflow-hidden glow-brand"
      style={{
        background:
          "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(168,85,247,0.07) 40%, rgba(236,72,153,0.07) 100%)",
        border: "1px solid rgba(139,92,246,0.2)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.12) 0%, transparent 60%)",
        }}
      />
      <div className="relative text-center">
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5"
          style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}
        >
          <Bell className="w-6 h-6 text-purple-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Stay up to date</h3>
        <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
          Get a short email whenever we ship something new. No noise — just the changelog
          entries you&apos;re reading now.
        </p>

        {state === "success" ? (
          <div className="flex items-center justify-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-semibold">You&apos;re subscribed!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(139,92,246,0.15)",
              }}
              required
            />
            <button
              type="submit"
              disabled={state === "loading"}
              className="btn-brand px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {state === "loading" ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Subscribe
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {state === "error" && (
          <p className="text-xs text-red-400 mt-2">
            Something went wrong. Email us at{" "}
            <a href="mailto:hello@transilienceai.com" className="underline">
              hello@transilienceai.com
            </a>{" "}
            to subscribe manually.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Changelog card ───────────────────────────────────────────────────────────

function ChangelogCard({ entry }: { entry: ChangelogEntry }) {
  const { date, version, name, summary, icon: Icon, iconColor, accentColor, tags, items } = entry;

  return (
    <article className="relative flex gap-0 sm:gap-8">
      {/* Timeline spine (hidden on mobile) */}
      <div className="hidden sm:flex flex-col items-center shrink-0 pt-1">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 z-10"
          style={{
            background: `${accentColor}15`,
            border: `1px solid ${accentColor}30`,
            boxShadow: `0 0 20px ${accentColor}15`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>
        <div
          className="w-px flex-1 mt-3"
          style={{ background: `linear-gradient(to bottom, ${accentColor}20, transparent)` }}
        />
      </div>

      {/* Card body */}
      <div
        className="flex-1 min-w-0 rounded-2xl p-6 sm:p-7 mb-8 transition-all duration-300 hover:border-opacity-25"
        style={{
          background: "linear-gradient(135deg, rgba(17,13,26,0.9) 0%, rgba(13,10,20,0.95) 100%)",
          border: `1px solid ${accentColor}12`,
        }}
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            {/* Mobile icon */}
            <div
              className="sm:hidden w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}25` }}
            >
              <Icon className="w-4.5 h-4.5" style={{ color: iconColor }} />
            </div>
            <div>
              <p
                className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-1"
                style={{ color: `${accentColor}80` }}
              >
                {date}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">
                <span
                  className="font-mono text-sm font-bold mr-2 px-2 py-0.5 rounded"
                  style={{
                    background: `${accentColor}12`,
                    color: accentColor,
                    border: `1px solid ${accentColor}20`,
                  }}
                >
                  {version}
                </span>
                {name}
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        </div>

        {/* Summary */}
        <p className="text-sm text-slate-400 leading-relaxed mb-5">{summary}</p>

        {/* Divider */}
        <div
          className="border-t mb-5"
          style={{ borderColor: `${accentColor}10` }}
        />

        {/* Items */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-3 flex items-center gap-1.5">
            <Tag className="w-3 h-3" />
            What shipped
          </p>
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                  style={{ background: accentColor, opacity: 0.6 }}
                />
                <span className="text-xs text-slate-400 leading-relaxed font-mono">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChangelogPage() {
  return (
    <div className="animate-fade-up">
      {/* Ambient glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(139,92,246,0.06) 0%, transparent 65%)",
        }}
      />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 border"
            style={{ background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.2)" }}
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-purple-300">
              Changelog
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.08] tracking-tight mb-5">
            <span className="text-gradient-brand">Everything</span>
            <span className="text-white"> we&apos;ve shipped</span>
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed mb-4">
            A complete record of every feature, fix, and improvement in TAI-AEGIS.
            Most recent first. No marketing copy &mdash; just what changed.
          </p>

          {/* Stats strip */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-6">
            {[
              { label: "Releases", value: "6" },
              { label: "Features shipped", value: "50+" },
              { label: "Days to v0.6", value: "< 90" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-bold text-gradient-brand font-mono">{value}</div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIMELINE ─────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-3xl mx-auto">
          {/* Version jump links */}
          <div className="flex flex-wrap gap-2 mb-10 pb-6 border-b" style={{ borderColor: "rgba(139,92,246,0.08)" }}>
            <span className="text-[11px] text-slate-500 uppercase tracking-wider self-center mr-1">
              Jump to:
            </span>
            {ENTRIES.map((entry) => (
              <a
                key={entry.version}
                href={`#${entry.version}`}
                className="text-[11px] font-mono px-2.5 py-1 rounded-lg transition-colors"
                style={{
                  background: `${entry.accentColor}08`,
                  color: entry.accentColor,
                  border: `1px solid ${entry.accentColor}18`,
                }}
              >
                {entry.version}
              </a>
            ))}
          </div>

          {/* Entries */}
          <div>
            {ENTRIES.map((entry) => (
              <div key={entry.version} id={entry.version}>
                <ChangelogCard entry={entry} />
              </div>
            ))}
          </div>

          {/* Origin note */}
          <div
            className="text-center py-8 mt-4 rounded-2xl"
            style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.08)" }}
          >
            <Shield className="w-6 h-6 text-purple-500/40 mx-auto mb-2" />
            <p className="text-xs text-slate-600">
              TAI-AEGIS v0.1.0 &mdash; April 2026 &mdash; Transilience AI
            </p>
            <p className="text-[11px] text-slate-700 mt-1">
              Built with Next.js 14, Supabase, Modal, Render, and a healthy dose of paranoia.
            </p>
          </div>
        </div>
      </section>

      {/* ── SUBSCRIBE CTA ────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-2xl mx-auto">
          <SubscribeForm />
        </div>
      </section>
    </div>
  );
}
