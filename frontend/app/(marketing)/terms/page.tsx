"use client";

import { useState, useEffect } from "react";
import { type Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Lock,
  Globe,
  Bell,
  Mail,
  Ban,
  Zap,
  Scale,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service | TAI-AEGIS by Transilience AI",
  description:
    "Plain-English terms for using TAI-AEGIS. No wall of legalese. Know what you're agreeing to.",
};

// ─── TOC sections ─────────────────────────────────────────────────────────────

const TOC_SECTIONS = [
  { id: "summary", label: "Plain-English summary" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "availability", label: "Service availability" },
  { id: "pricing", label: "Pricing & cancellation" },
  { id: "termination", label: "Termination" },
  { id: "liability", label: "Limitation of liability" },
  { id: "law", label: "Governing law" },
  { id: "updates", label: "Updates to these terms" },
  { id: "contact", label: "Contact" },
];

// ─── Primitives ───────────────────────────────────────────────────────────────

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

function ProhibitedList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 mb-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <Ban className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
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
  variant: "info" | "warning" | "success" | "critical";
  children: React.ReactNode;
}) {
  const styles = {
    info: { bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.15)", icon: <Zap className="w-4 h-4 text-blue-400 shrink-0" /> },
    warning: { bg: "rgba(234,179,8,0.06)", border: "rgba(234,179,8,0.15)", icon: <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" /> },
    success: { bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.15)", icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> },
    critical: { bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.15)", icon: <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" /> },
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

export default function TermsPage() {
  const tocIds = TOC_SECTIONS.map((s) => s.id);
  const activeSection = useTOCActive(tocIds);
  const lastUpdated = "April 22, 2026";

  return (
    <div className="animate-fade-up">
      {/* Ambient glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(59,130,246,0.05) 0%, transparent 65%)" }}
      />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-20 pb-14 text-center">
        <div className="max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 border"
            style={{ background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.2)" }}
          >
            <FileText className="w-3 h-3 text-blue-400" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-blue-300">
              Terms of Service
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.08] tracking-tight mb-5">
            <span className="text-gradient-brand">Fair terms,</span>
            <span className="text-white"> plainly written</span>
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed mb-4">
            These are the terms that govern your use of TAI-AEGIS. We&apos;ve written them to be
            readable, not exhaustive. The spirit of these terms is: use AEGIS responsibly, pay
            if you use it commercially, and don&apos;t break things.
          </p>
          <p className="text-xs text-slate-600">
            Last updated: <span className="text-slate-400">{lastUpdated}</span>
            &nbsp;&middot;&nbsp;
            Governing law: India
            &nbsp;&middot;&nbsp;
            Version: 1.0
          </p>
        </div>
      </section>

      {/* ── MAIN LAYOUT ──────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="flex gap-12 relative">

          {/* ── CONTENT ─────────────────────────────────────────────────── */}
          <article className="flex-1 min-w-0">

            {/* Plain-English summary */}
            <section id="summary" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <Shield className="w-4 h-4 text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">What you&apos;re agreeing to</h2>
              </div>
              <NoticeBox variant="info">
                <strong>Plain-English summary (non-binding):</strong> By using AEGIS, you agree to
                use it only for lawful threat intelligence work on assets you own or have explicit
                permission to assess. Don&apos;t abuse it. Pay your bill. Cancel whenever. We keep the
                lights on at 99.5% uptime.
              </NoticeBox>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {[
                  {
                    icon: CheckCircle2,
                    color: "#10b981",
                    title: "You can",
                    items: [
                      "Monitor organisations you own or have written authorisation to monitor",
                      "Run scanners against domains in your own environment",
                      "Use AEGIS output in client security reports",
                      "Cancel at any time, no questions asked",
                      "Export your watchlist data whenever you want",
                    ],
                  },
                  {
                    icon: Ban,
                    color: "#ef4444",
                    title: "You cannot",
                    items: [
                      "Scan or monitor targets without permission",
                      "Resell AEGIS output as a standalone data product",
                      "Attempt to circumvent rate limits or extract raw data feeds",
                      "Use AEGIS to facilitate extortion, fraud, or illegal surveillance",
                      "Share your account credentials with people outside your organisation",
                    ],
                  },
                ].map(({ icon: Icon, color, title, items }) => (
                  <div
                    key={title}
                    className="rounded-xl p-4"
                    style={{ background: `${color}07`, border: `1px solid ${color}15` }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="w-4 h-4" style={{ color }} />
                      <span className="text-sm font-bold text-slate-200">{title}</span>
                    </div>
                    <ul className="space-y-1.5">
                      {items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Icon className="w-3 h-3 mt-0.5 shrink-0" style={{ color, opacity: 0.7 }} />
                          <span className="text-xs text-slate-400 leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* Acceptable use */}
            <section id="acceptable-use" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <Ban className="w-4 h-4 text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Acceptable use policy</h2>
              </div>
              <P>
                AEGIS is a threat intelligence platform designed for security professionals to
                protect their own organisations and their clients&apos; organisations. The following
                uses are strictly prohibited:
              </P>
              <ProhibitedList
                items={[
                  "Scanning, probing, or monitoring any target you do not own or have written authorisation to assess. This includes running subfinder, nmap, nuclei, or theHarvester against third-party infrastructure without permission.",
                  "Using AEGIS output to facilitate attacks, extortion, ransomware, or any other illegal activity.",
                  "Abusing the API or scanner infrastructure by circumventing rate limits, submitting bulk scans programmatically, or attempting to extract raw feed data.",
                  "Reselling or redistributing AEGIS data, alerts, or scan results as a standalone commercial product without a reseller agreement.",
                  "Using the service to monitor individuals rather than organisations, particularly in ways that constitute illegal surveillance.",
                  "Creating accounts with false identities or sharing account credentials outside your organisation.",
                  "Attempting to access other users&apos; data, probe our infrastructure, or reverse-engineer our proprietary algorithms.",
                ]}
              />
              <NoticeBox variant="critical">
                Violation of the acceptable use policy will result in immediate account
                suspension. We cooperate fully with law enforcement requests for accounts
                involved in illegal activity.
              </NoticeBox>
              <P>
                If you are a security researcher who wants to test AEGIS&apos;s own infrastructure,
                please use our responsible disclosure process at{" "}
                <a href="mailto:security@transilienceai.com" className="text-purple-400 hover:text-purple-300 underline">
                  security@transilienceai.com
                </a>{" "}
                rather than conducting unauthorised testing.
              </P>
            </section>

            {/* Service availability */}
            <section id="availability" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Service availability</h2>
              </div>
              <P>
                We aim for 99.5% monthly uptime across the AEGIS platform. This target includes
                the dashboard, API, and alert delivery pipeline, but excludes scheduled
                maintenance windows which we announce at least 24 hours in advance.
              </P>
              <div
                className="rounded-xl p-5 mb-4"
                style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)" }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: "Target uptime", value: "99.5%", sub: "monthly" },
                    { label: "Maintenance notice", value: "24 hrs", sub: "minimum advance notice" },
                    { label: "Incident comms", value: "Real-time", sub: "via status page" },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="text-center">
                      <div className="text-2xl font-bold text-emerald-400 font-mono">{value}</div>
                      <div className="text-xs font-semibold text-slate-300 mt-0.5">{label}</div>
                      <div className="text-[10px] text-slate-500">{sub}</div>
                    </div>
                  ))}
                </div>
              </div>
              <NoticeBox variant="warning">
                <strong>Limitation:</strong> We are not liable for outages, data loss, or service
                degradation. Our liability for any incident is limited to a pro-rated credit for
                the affected period, up to one month of your subscription fee. We are not liable
                for consequential, indirect, or incidental damages arising from service unavailability.
              </NoticeBox>
              <P>
                During the free beta period, we provide no uptime SLA. Paid plans at the Pro
                tier and above include the 99.5% SLA with credit provisions.
              </P>
            </section>

            {/* Pricing & cancellation */}
            <section id="pricing" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.2)" }}>
                  <DollarSign className="w-4 h-4 text-yellow-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Pricing &amp; cancellation</h2>
              </div>
              <Ul
                items={[
                  <span key="1"><strong className="text-slate-200">Free during beta:</strong> All features are available at no charge during the public beta. We will give at least 30 days notice before introducing paid plans.</span>,
                  <span key="2"><strong className="text-slate-200">Cancel anytime:</strong> There are no long-term contracts during beta or at launch. Monthly subscriptions can be cancelled at any time with immediate effect.</span>,
                  <span key="3"><strong className="text-slate-200">Pro-rated refunds:</strong> If you cancel a monthly subscription mid-cycle, we will refund the unused portion of your current billing period.</span>,
                  <span key="4"><strong className="text-slate-200">No enterprise lock-in:</strong> Annual plans, if introduced, will include a pro-rata exit clause allowing cancellation with 30 days notice.</span>,
                  <span key="5"><strong className="text-slate-200">Price changes:</strong> We will notify you 30 days in advance of any price increase. You may cancel before the new price takes effect.</span>,
                ]}
              />
              <NoticeBox variant="success">
                We will never auto-upgrade you to a higher tier without your explicit consent.
                Your plan and price are locked until you choose to change them.
              </NoticeBox>
            </section>

            {/* Termination */}
            <section id="termination" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <Lock className="w-4 h-4 text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Termination</h2>
              </div>
              <P>
                Either party may terminate the service relationship at any time.
              </P>
              <P>
                <strong className="text-slate-200">You can leave:</strong> Delete your account
                from the Settings page at any time. Your data will be purged within 30 days per
                our retention policy.
              </P>
              <P>
                <strong className="text-slate-200">We can suspend you:</strong> We reserve the
                right to suspend or terminate your account without notice if we determine, in
                good faith, that you have violated the acceptable use policy, engaged in fraudulent
                activity, or pose a risk to the integrity of our platform or other users.
              </P>
              <P>
                Where suspension is not due to an AUP violation (e.g., non-payment of a paid
                plan), we will give 7 days notice and attempt to resolve the issue before
                terminating access.
              </P>
              <NoticeBox variant="warning">
                Following termination for AUP violations, you will not be entitled to a refund
                of any prepaid fees.
              </NoticeBox>
            </section>

            {/* Liability */}
            <section id="liability" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <Scale className="w-4 h-4 text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Limitation of liability</h2>
              </div>
              <P>
                TAI-AEGIS is a threat intelligence tool, not a guarantee of security. The
                intelligence we surface is derived from publicly available and curated sources —
                it may be incomplete, delayed, or inaccurate.
              </P>
              <Ul
                items={[
                  "AEGIS is provided \"as is\" without any warranty of fitness for a particular purpose or guarantee of completeness.",
                  "Our total liability to you for any claim arising from your use of the service is capped at the amount you paid us in the 12 months preceding the claim.",
                  "We are not liable for indirect, consequential, special, or punitive damages, including loss of profits, data, or business arising from your reliance on AEGIS data.",
                  "We do not warrant that AEGIS will detect every threat, breach, or exposure. Threat intelligence is probabilistic, not deterministic.",
                ]}
              />
              <NoticeBox variant="info">
                Some jurisdictions do not allow limitations on implied warranties or exclusion of
                incidental/consequential damages. In such jurisdictions, our liability is limited to
                the maximum extent permitted by law.
              </NoticeBox>
            </section>

            {/* Governing law */}
            <section id="law" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <Globe className="w-4 h-4 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Governing law &amp; disputes</h2>
              </div>
              <P>
                These terms are governed by and construed in accordance with the laws of India.
                Transilience AI is incorporated and operates from India.
              </P>
              <P>
                Any disputes arising from these terms or your use of the service will first be
                subject to good-faith negotiation. If unresolved within 30 days, disputes will
                be submitted to binding arbitration in accordance with the Arbitration and
                Conciliation Act, 1996 (India), with arbitration seated in Bengaluru, Karnataka.
              </P>
              <NoticeBox variant="info">
                If you are an EU resident, you also have the right to lodge a complaint with your
                local data protection authority (for data-related disputes) regardless of this
                governing law clause.
              </NoticeBox>
            </section>

            {/* Updates */}
            <section id="updates" className="scroll-mt-24 py-10 border-b" style={{ borderColor: "rgba(139,92,246,0.07)" }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.2)" }}>
                  <Bell className="w-4 h-4 text-yellow-400" />
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">Updates to these terms</h2>
              </div>
              <P>
                We will notify you by email at least 30 days before any material change to these
                terms takes effect. The notification will clearly identify what is changing and why.
              </P>
              <P>
                Continued use of the service after the effective date constitutes acceptance of
                the revised terms. If you disagree, you may cancel your account before the
                effective date.
              </P>
              <P>
                Minor changes (typo fixes, clarifications that don&apos;t alter your rights or
                obligations) may be made without notice, but will be reflected in the
                &ldquo;last updated&rdquo; date at the top of this page.
              </P>
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
                For questions about these terms, billing disputes, or legal inquiries:
              </P>
              <div
                className="rounded-xl p-5 inline-flex flex-col gap-2"
                style={{ background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.15)" }}
              >
                <div className="text-sm font-semibold text-white">Transilience AI — Legal</div>
                <a
                  href="mailto:legal@transilienceai.com"
                  className="text-sm text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  legal@transilienceai.com
                </a>
                <p className="text-xs text-slate-500">We respond to legal inquiries within 10 business days.</p>
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
                            background: "rgba(59,130,246,0.1)",
                            color: "#93c5fd",
                            borderLeft: "2px solid rgba(59,130,246,0.5)",
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
                  href="/privacy"
                  className="block text-xs text-slate-500 hover:text-slate-300 transition-colors mb-1.5"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/security"
                  className="block text-xs text-slate-500 hover:text-slate-300 transition-colors mb-1.5"
                >
                  Security
                </Link>
                <a
                  href="mailto:legal@transilienceai.com"
                  className="block text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  legal@transilienceai.com
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
