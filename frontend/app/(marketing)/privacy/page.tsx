"use client";

import { useState, useEffect, useRef } from "react";
import { type Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  Lock,
  Eye,
  Trash2,
  Download,
  Bell,
  Mail,
  Database,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | TAI-AEGIS by Transilience AI",
  description:
    "How we collect, use, and protect your data. Written in plain English — not legal boilerplate.",
};

// ─── TOC sections ─────────────────────────────────────────────────────────────

const TOC_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "what-we-collect", label: "What we collect" },
  { id: "what-we-dont", label: "What we don't collect" },
  { id: "how-we-use", label: "How we use data" },
  { id: "retention", label: "Data retention" },
  { id: "your-rights", label: "Your rights" },
  { id: "sub-processors", label: "Sub-processors" },
  { id: "cookies", label: "Cookies" },
  { id: "updates", label: "Policy updates" },
  { id: "contact", label: "Contact" },
];

// ─── Primitives ───────────────────────────────────────────────────────────────

function Section({
  id,
  icon: Icon,
  iconColor,
  title,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
      <div className="flex items-start gap-4 mb-5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${iconColor}15`, border: `1px solid ${iconColor}28` }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <h2 className="text-xl font-bold text-white leading-tight">{title}</h2>
      </div>
      <div className="pl-0 lg:pl-13 prose-custom">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 leading-relaxed mb-4">{children}</p>;
}

function Ul({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ul className="space-y-2 mb-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
          <span className="text-sm text-slate-400 leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NoticeBox({
  variant,
  children,
}: {
  variant: "info" | "warning" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    info: { bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.15)", icon: <Eye className="w-4 h-4 text-blue-400 shrink-0" /> },
    warning: { bg: "rgba(234,179,8,0.06)", border: "rgba(234,179,8,0.15)", icon: <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" /> },
    success: { bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.15)", icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> },
  };
  const s = styles[variant];
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3 mb-4"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      {s.icon}
      <div className="text-sm text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}

// ─── Sticky TOC hook ──────────────────────────────────────────────────────────

function useTOCActive(ids: string[]) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { rootMargin: "-20% 0px -70% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [ids]);

  return active;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrivacyPage() {
  const tocIds = TOC_SECTIONS.map((s) => s.id);
  const activeSection = useTOCActive(tocIds);
  const lastUpdated = "April 22, 2026";

  return (
    <div className="animate-fade-up">
      {/* Ambient glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(139,92,246,0.05) 0%, transparent 65%)" }}
      />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-20 pb-14 text-center">
        <div className="max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 border"
            style={{ background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.2)" }}
          >
            <Lock className="w-3 h-3 text-purple-400" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-purple-300">
              Privacy Policy
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.08] tracking-tight mb-5">
            <span className="text-gradient-brand">Your data,</span>
            <span className="text-white"> your control</span>
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed mb-4">
            Written in plain English. We tell you exactly what we collect, why, and how long
            we keep it. No dark patterns. No vague language.
          </p>
          <p className="text-xs text-slate-600">
            Last updated: <span className="text-slate-400">{lastUpdated}</span>
            &nbsp;&middot;&nbsp;
            Governing entity: Transilience AI, India
          </p>
        </div>
      </section>

      {/* ── MAIN LAYOUT ──────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="flex gap-12 relative">

          {/* ── CONTENT ─────────────────────────────────────────────────── */}
          <article className="flex-1 min-w-0">

            {/* Overview */}
            <section id="overview" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <Shield className="w-4 h-4 text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Overview</h2>
              </div>
              <P>
                Transilience AI (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;AEGIS&rdquo;) operates
                the TAI-AEGIS threat intelligence platform. This policy explains what personal
                data we collect when you use our service, why we collect it, how long we keep it,
                and what rights you have.
              </P>
              <NoticeBox variant="success">
                <strong>Short version:</strong> We collect your email, your watchlist configuration,
                and activity logs needed to operate the service. We do not sell your data, serve
                you ads, or use third-party tracking pixels.
              </NoticeBox>
              <P>
                This policy applies to all users of aegis.transilience.ai and the AEGIS API.
                If you are using AEGIS as part of a managed service agreement, your
                organisation&apos;s DPA supersedes this policy where in conflict.
              </P>
            </section>

            {/* What we collect */}
            <section id="what-we-collect" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <Database className="w-4 h-4 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">What we collect</h2>
              </div>
              <P>
                We collect the minimum data necessary to deliver the service. Here is everything
                we store about you:
              </P>
              <div className="space-y-3 mb-5">
                {[
                  {
                    label: "Account email",
                    detail: "Required to create and authenticate your account. Used to send digest alerts and service notifications. Never shared with third parties for marketing.",
                    color: "#3b82f6",
                  },
                  {
                    label: "Customer / watchlist profile data",
                    detail: "The organisations you monitor — their names, domains, keywords, sectors, and countries. This data is yours; we process it solely to match against threat feeds on your behalf.",
                    color: "#8b5cf6",
                  },
                  {
                    label: "IOC queries",
                    detail: "IP addresses, domains, and hashes you submit for enrichment. Logged for rate-limiting, abuse detection, and result caching. Not linked to your identity in any external system.",
                    color: "#a855f7",
                  },
                  {
                    label: "Scanner invocations",
                    detail: "Which tools you run, against which domains, and when. Retained for 90 days for abuse detection and billing purposes.",
                    color: "#ec4899",
                  },
                  {
                    label: "Email digest send logs",
                    detail: "Which digests were sent, to which address, and whether they were opened (via Resend delivery receipts). Retained for 7 days.",
                    color: "#10b981",
                  },
                  {
                    label: "Authentication metadata",
                    detail: "Login timestamps and IP addresses, retained for 90 days for security audit purposes.",
                    color: "#f97316",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl p-4"
                    style={{ background: `${item.color}06`, border: `1px solid ${item.color}15` }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                      <span className="text-sm font-semibold text-slate-200">{item.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed pl-3.5">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* What we don't collect */}
            <section id="what-we-dont" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <Eye className="w-4 h-4 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">What we don&apos;t collect</h2>
              </div>
              <NoticeBox variant="success">
                We believe in minimal data collection. The following is an explicit list of things
                we <strong>do not</strong> do.
              </NoticeBox>
              <Ul
                items={[
                  "No PII of YOUR customers — we monitor organisations, not their individual employees. We do not store names, phone numbers, or addresses of people inside the organisations you watch.",
                  "No behavioural tracking pixels — we do not embed third-party analytics (Google Analytics, Mixpanel, Segment) on any AEGIS page.",
                  "No third-party advertising cookies — we run no ad networks, retargeting, or lookalike audience programs.",
                  "No sale of data — we do not sell, rent, or trade your data to third parties under any circumstances.",
                  "No location tracking — we do not store GPS coordinates or device location.",
                  "No biometric data — we do not collect fingerprints, voice data, or facial recognition data.",
                  "No sensitive personal data about the subjects of your watchlist — we aggregate publicly available threat intelligence; we do not enrich profiles with sensitive personal attributes.",
                ]}
              />
            </section>

            {/* How we use data */}
            <section id="how-we-use" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.2)" }}>
                  <Users className="w-4 h-4 text-pink-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">How we use your data</h2>
              </div>
              <P>
                We use the data we collect for exactly three purposes, and nothing else:
              </P>
              <Ul
                items={[
                  <span key="1"><strong className="text-slate-200">Service delivery:</strong> matching your watchlist against threat feeds, enriching IOCs, running scanners, and sending digest alerts.</span>,
                  <span key="2"><strong className="text-slate-200">Security and abuse prevention:</strong> detecting unauthorised access, rate-limit enforcement, and investigating reported abuse.</span>,
                  <span key="3"><strong className="text-slate-200">Service communications:</strong> sending you alerts you have opted into, product update emails, and this privacy policy update notices.</span>,
                ]}
              />
              <NoticeBox variant="info">
                We do not perform automated decision-making or profiling on your personal data that
                produces legal or similarly significant effects.
              </NoticeBox>
            </section>

            {/* Data retention */}
            <section id="retention" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.2)" }}>
                  <Bell className="w-4 h-4 text-yellow-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Data retention</h2>
              </div>
              <P>
                We retain data for the shortest period necessary. Here are our specific retention
                windows:
              </P>
              <div className="card-enterprise overflow-hidden mb-4">
                <div
                  className="grid grid-cols-2 gap-0 border-b px-5 py-2.5"
                  style={{ borderColor: "rgba(139,92,246,0.1)", background: "rgba(139,92,246,0.04)" }}
                >
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Data type</span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Retention period</span>
                </div>
                {[
                  ["Account email", "Indefinitely, until account deletion"],
                  ["Watchlist / customer profiles", "Indefinitely, until you delete them or close your account"],
                  ["Activity & access logs", "90 days"],
                  ["IOC query logs", "90 days"],
                  ["Scanner invocation logs", "90 days"],
                  ["Email digest send logs", "7 days"],
                  ["Authentication session tokens", "30 days (sliding)"],
                  ["Deleted account data", "Purged within 30 days of account deletion"],
                ].map(([type, period], i, arr) => (
                  <div
                    key={type}
                    className="grid grid-cols-2 gap-0 border-b px-5 py-3 hover:bg-white/[0.015] transition-colors"
                    style={{
                      borderColor: "rgba(139,92,246,0.05)",
                      ...(i === arr.length - 1 ? { borderBottom: "none" } : {}),
                    }}
                  >
                    <span className="text-xs text-slate-300">{type}</span>
                    <span className="text-xs text-slate-400 font-mono">{period}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Your rights */}
            <section id="your-rights" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <Globe className="w-4 h-4 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Your rights (GDPR &amp; CCPA)</h2>
              </div>
              <P>
                Depending on your location, you have the following rights over your personal data.
                We honour these requests for all users regardless of jurisdiction — not just EU and
                California residents.
              </P>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {[
                  { icon: Eye, label: "Right of access", detail: "Request a copy of all personal data we hold about you.", color: "#3b82f6" },
                  { icon: Trash2, label: "Right to erasure", detail: "Request deletion of your account and all associated personal data.", color: "#ef4444" },
                  { icon: Download, label: "Right to portability", detail: "Export your watchlist data and account info in JSON or CSV format.", color: "#8b5cf6" },
                  { icon: Lock, label: "Right to rectification", detail: "Correct any inaccurate personal data we hold.", color: "#10b981" },
                  { icon: Bell, label: "Right to object", detail: "Opt out of any processing based on legitimate interests.", color: "#f97316" },
                  { icon: Shield, label: "CCPA opt-out", detail: 'We don\'t sell data, but you may request "Do Not Sell" confirmation.', color: "#ec4899" },
                ].map(({ icon: Icon, label, detail, color }) => (
                  <div
                    key={label}
                    className="rounded-xl p-4 flex items-start gap-3"
                    style={{ background: `${color}07`, border: `1px solid ${color}18` }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 mb-0.5">{label}</div>
                      <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <NoticeBox variant="info">
                To exercise any of these rights, email{" "}
                <a href="mailto:privacy@transilienceai.com" className="text-purple-400 hover:text-purple-300 underline">
                  privacy@transilienceai.com
                </a>{" "}
                from your account email. We respond within 30 days. We do not charge a fee for reasonable requests.
              </NoticeBox>
            </section>

            {/* Sub-processors */}
            <section id="sub-processors" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <Database className="w-4 h-4 text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Sub-processors</h2>
              </div>
              <P>
                We use a limited set of third-party sub-processors to operate the service. Each
                sub-processor is contractually obligated to protect your data in accordance with
                applicable law. A full list with their roles and certifications is maintained on
                our Security page.
              </P>
              <Link
                href="/security#sub-processors"
                className="inline-flex items-center gap-2 btn-brand px-4 py-2.5 rounded-lg text-sm font-semibold"
              >
                View sub-processors on the Security page
              </Link>
            </section>

            {/* Cookies */}
            <section id="cookies" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <Lock className="w-4 h-4 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Cookies &amp; local storage</h2>
              </div>
              <P>
                We use a minimal set of cookies and local storage keys, all strictly necessary
                for the service to function.
              </P>
              <Ul
                items={[
                  "Session authentication token — stored as a secure, HttpOnly cookie, 30-day expiry.",
                  "User preferences (theme, density, reduce-motion) — stored in localStorage under tai:<uid>:prefs, never sent to our servers.",
                  "No third-party cookies — we embed no analytics, advertising, or social media SDKs that set their own cookies.",
                ]}
              />
              <NoticeBox variant="success">
                Because we set no third-party cookies and use no behavioural tracking, you will
                never see a cookie consent banner on AEGIS. There is nothing to consent to.
              </NoticeBox>
            </section>

            {/* Policy updates */}
            <section id="updates" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.2)" }}>
                  <Bell className="w-4 h-4 text-yellow-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Policy updates</h2>
              </div>
              <P>
                We will notify you by email at least 30 days before any material change to this
                policy takes effect. The notification will include a clear description of what
                is changing and why. Continued use of the service after the effective date
                constitutes acceptance of the revised policy.
              </P>
              <NoticeBox variant="warning">
                If you disagree with a policy change, you may close your account at any time
                before the effective date and receive a pro-rated refund of any prepaid fees.
              </NoticeBox>
            </section>

            {/* Contact */}
            <section id="contact" className="scroll-mt-24 py-10">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.2)" }}>
                  <Mail className="w-4 h-4 text-pink-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Contact</h2>
              </div>
              <P>
                For any privacy-related queries, data subject requests, or DPA inquiries:
              </P>
              <div
                className="rounded-xl p-5 inline-flex flex-col gap-2"
                style={{ background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.15)" }}
              >
                <div className="text-sm font-semibold text-white">Transilience AI — Privacy Team</div>
                <a
                  href="mailto:privacy@transilienceai.com"
                  className="text-sm text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  privacy@transilienceai.com
                </a>
                <p className="text-xs text-slate-500">We respond to all privacy requests within 30 days.</p>
              </div>
            </section>

          </article>

          {/* ── STICKY RIGHT-RAIL TOC (lg+) ─────────────────────────────── */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-3">
                On this page
              </p>
              <nav className="space-y-0.5">
                {TOC_SECTIONS.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block px-3 py-1.5 rounded-lg text-xs transition-all duration-200"
                    style={
                      activeSection === section.id
                        ? {
                            background: "rgba(139,92,246,0.1)",
                            color: "#c084fc",
                            borderLeft: "2px solid rgba(139,92,246,0.6)",
                          }
                        : {
                            color: "#64748b",
                          }
                    }
                  >
                    {section.label}
                  </a>
                ))}
              </nav>
              <div className="mt-6 pt-5 border-t" style={{ borderColor: "rgba(139,92,246,0.08)" }}>
                <Link
                  href="/security"
                  className="block text-xs text-slate-500 hover:text-slate-300 transition-colors mb-1.5"
                >
                  Security page
                </Link>
                <Link
                  href="/terms"
                  className="block text-xs text-slate-500 hover:text-slate-300 transition-colors mb-1.5"
                >
                  Terms of Service
                </Link>
                <a
                  href="mailto:privacy@transilienceai.com"
                  className="block text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  privacy@transilienceai.com
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
