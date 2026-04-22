"use client";

import { type Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  Lock,
  Database,
  Server,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Globe,
  Key,
  FileText,
  Users,
  ArrowRight,
  ExternalLink,
  Eye,
  Cpu,
  Mail,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Security | TAI-AEGIS by Transilience AI",
  description:
    "Our security posture, architecture, sub-processors, and vulnerability disclosure process. We are a security company — our infrastructure reflects that.",
};

// ─── Primitives (shared with landing page pattern) ────────────────────────────

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

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "info";
}) {
  const styles = {
    default: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    warning: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
    info: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

// ─── Sub-processors data ──────────────────────────────────────────────────────

const SUB_PROCESSORS = [
  {
    vendor: "Render",
    role: "API compute & backend hosting",
    region: "US West (Oregon)",
    cert: "SOC 2 Type II",
    link: "https://render.com/security",
  },
  {
    vendor: "Vercel",
    role: "Frontend edge hosting & CDN",
    region: "Global edge network",
    cert: "SOC 2 Type II",
    link: "https://vercel.com/security",
  },
  {
    vendor: "Supabase",
    role: "Postgres database & Auth",
    region: "US / EU (customer choice)",
    cert: "SOC 2 Type II",
    link: "https://supabase.com/security",
  },
  {
    vendor: "Upstash",
    role: "Redis cache (IOC enrichment)",
    region: "Global (multi-region)",
    cert: "SOC 2 Type II",
    link: "https://upstash.com/trust",
  },
  {
    vendor: "Modal",
    role: "Serverless scanner compute",
    region: "US (aws-us-east-1)",
    cert: "SOC 2 (in progress)",
    link: "https://modal.com/docs/reference/modal.SandboxSnapshot",
  },
  {
    vendor: "Resend",
    role: "Transactional email (digests)",
    region: "US (Cloudflare Workers)",
    cert: "SOC 2 Type II",
    link: "https://resend.com/security",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  return (
    <div className="animate-fade-up">

      {/* ── AMBIENT GLOW ───────────────────────────────────────────────────── */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(139,92,246,0.06) 0%, transparent 65%)",
        }}
      />

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-20 pb-20 text-center overflow-hidden">
        <div className="relative max-w-4xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 border"
            style={{
              background: "rgba(139,92,246,0.08)",
              borderColor: "rgba(139,92,246,0.2)",
            }}
          >
            <Shield className="w-3 h-3 text-purple-400" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-purple-300">
              Security posture
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight mb-6">
            <span className="text-gradient-brand">Security</span>
            <span className="text-white"> at TAI-AEGIS</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-6">
            We&apos;re a security company. Our security posture isn&apos;t a checkbox &mdash;
            it&apos;s the product. Everything we ship is designed with the assumption that our
            own infrastructure is a target.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              { label: "Encrypted in transit", icon: Lock },
              { label: "Encrypted at rest", icon: Database },
              { label: "Per-org RLS", icon: Users },
              { label: "Zero shared service accounts", icon: Key },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPLIANCE GRID ────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Eyebrow>Compliance</Eyebrow>
            <SectionHeading>Where we stand</SectionHeading>
            <p className="text-slate-400 mt-3 text-sm max-w-xl mx-auto">
              We&apos;re early-stage and honest about it. Here is our current compliance posture and
              the timeline we&apos;re committed to.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* SOC 2 */}
            <div className="card-enterprise p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(234,179,8,0.1)",
                    border: "1px solid rgba(234,179,8,0.2)",
                  }}
                >
                  <FileText className="w-5 h-5 text-yellow-400" />
                </div>
                <Badge variant="warning">In progress</Badge>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">SOC 2 Type II</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Target Q3 2026. We&apos;re engaging with our auditor now. All infrastructure
                  controls are being documented. Customers can request our current security
                  questionnaire responses.
                </p>
              </div>
              <div
                className="text-[10px] font-mono text-yellow-500/70 px-2 py-1 rounded"
                style={{ background: "rgba(234,179,8,0.05)", border: "1px solid rgba(234,179,8,0.1)" }}
              >
                Target: Q3 2026
              </div>
            </div>

            {/* GDPR */}
            <div className="card-enterprise p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.2)",
                  }}
                >
                  <Globe className="w-5 h-5 text-emerald-400" />
                </div>
                <Badge variant="success">Compliant</Badge>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">GDPR</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  EU data residency available on request via Supabase EU region. We process only
                  the data needed to deliver the service. DPA available on request.
                </p>
              </div>
              <div
                className="text-[10px] font-mono text-emerald-500/70 px-2 py-1 rounded"
                style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.1)" }}
              >
                EU residency on request
              </div>
            </div>

            {/* Encryption */}
            <div className="card-enterprise p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(59,130,246,0.1)",
                    border: "1px solid rgba(59,130,246,0.2)",
                  }}
                >
                  <Lock className="w-5 h-5 text-blue-400" />
                </div>
                <Badge variant="success">Active</Badge>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Data Encryption</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  All data in transit is protected by TLS 1.3. All data at rest is encrypted
                  with AES-256 via Supabase and Render managed storage.
                </p>
              </div>
              <div
                className="text-[10px] font-mono text-blue-500/70 px-2 py-1 rounded"
                style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.1)" }}
              >
                TLS 1.3 transit &middot; AES-256 rest
              </div>
            </div>

            {/* Access control */}
            <div className="card-enterprise p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(139,92,246,0.1)",
                    border: "1px solid rgba(139,92,246,0.2)",
                  }}
                >
                  <Key className="w-5 h-5 text-purple-400" />
                </div>
                <Badge variant="success">Active</Badge>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Access Control</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Row-Level Security enforced at the Postgres layer for every org. Least-privilege
                  IAM across all cloud services. Full audit log on sensitive operations.
                </p>
              </div>
              <div
                className="text-[10px] font-mono text-purple-500/70 px-2 py-1 rounded"
                style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.1)" }}
              >
                Per-org RLS &middot; audit log
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE SECURITY ──────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Eyebrow>Architecture</Eyebrow>
            <SectionHeading>How we&apos;re built</SectionHeading>
            <p className="text-slate-400 mt-3 text-sm max-w-xl mx-auto">
              Every layer is designed to minimize blast radius. No monoliths. No shared
              credentials. No unnecessary data retention.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Infrastructure */}
            <div className="card-enterprise p-7">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(59,130,246,0.1)",
                    border: "1px solid rgba(59,130,246,0.2)",
                  }}
                >
                  <Server className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-base font-bold text-white">Infrastructure</h3>
              </div>
              <ul className="space-y-3">
                {[
                  {
                    label: "Render (us-west)",
                    detail: "API and backend — SOC 2 certified, isolated containers per service",
                  },
                  {
                    label: "Vercel (global edge)",
                    detail: "Frontend CDN — SOC 2 certified, DDoS protection included",
                  },
                  {
                    label: "Supabase (multi-region Postgres)",
                    detail: "Database + Auth — SOC 2 certified, network isolation, PITR backups",
                  },
                  {
                    label: "Upstash Redis",
                    detail: "Cache layer for IOC enrichment — SOC 2, data TTL enforced",
                  },
                  {
                    label: "Modal (sandboxed compute)",
                    detail: "Scanner workloads run in ephemeral, sandboxed Modal functions",
                  },
                ].map((item) => (
                  <li key={item.label} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-slate-200">{item.label}</span>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Application */}
            <div className="card-enterprise p-7">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(139,92,246,0.1)",
                    border: "1px solid rgba(139,92,246,0.2)",
                  }}
                >
                  <Cpu className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-base font-bold text-white">Application</h3>
              </div>
              <ul className="space-y-3">
                {[
                  {
                    label: "Per-org Row-Level Security",
                    detail:
                      "Every Postgres query is scoped to the authenticated org at the DB layer. Application-layer bugs cannot leak cross-org data.",
                  },
                  {
                    label: "No shared service accounts",
                    detail:
                      "Each service uses its own minimal-scope credentials. No wildcard database roles.",
                  },
                  {
                    label: "Secrets in encrypted env vars only",
                    detail:
                      "API keys and tokens are never committed to source control. Injected at deploy time via Render and Vercel encrypted environment variables.",
                  },
                  {
                    label: "No unnecessary PII retained",
                    detail:
                      "We store your account email and watchlist configuration. We do not store PII of third parties you monitor unless you explicitly add it.",
                  },
                  {
                    label: "Audit log on sensitive operations",
                    detail:
                      "Profile creates/updates, scan invocations, and digest config changes are logged with actor, timestamp, and IP.",
                  },
                ].map((item) => (
                  <li key={item.label} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-slate-200">{item.label}</span>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── VULNERABILITY DISCLOSURE ───────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Eyebrow>Vulnerability Disclosure</Eyebrow>
            <SectionHeading>Found something? Tell us.</SectionHeading>
            <p className="text-slate-400 mt-3 text-sm max-w-xl mx-auto">
              We follow coordinated vulnerability disclosure. If you find a security issue in
              AEGIS, report it to us before public disclosure and we&apos;ll work with you to fix it.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CVD details */}
            <div className="card-enterprise p-7 flex flex-col gap-5">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(236,72,153,0.1)",
                    border: "1px solid rgba(236,72,153,0.2)",
                  }}
                >
                  <Eye className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Our CVD process</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    We follow a 90-day coordinated disclosure timeline. We&apos;ll acknowledge
                    your report within 48 hours, triage within 5 business days, and notify you
                    when the fix ships. We PGP-sign all acknowledgements so you know the
                    reply is genuine.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  { step: "01", text: "Email security@transilienceai.com with details" },
                  { step: "02", text: "PGP-signed acknowledgement within 48 hours" },
                  { step: "03", text: "Triage and severity assessment within 5 business days" },
                  { step: "04", text: "Fix shipped and you are notified" },
                  { step: "05", text: "Public disclosure after 90 days (or sooner if agreed)" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <span
                      className="text-[10px] font-mono font-bold w-7 h-5 flex items-center justify-center rounded shrink-0 mt-0.5"
                      style={{
                        background: "rgba(236,72,153,0.08)",
                        color: "rgba(236,72,153,0.7)",
                        border: "1px solid rgba(236,72,153,0.15)",
                      }}
                    >
                      {item.step}
                    </span>
                    <span className="text-xs text-slate-400">{item.text}</span>
                  </div>
                ))}
              </div>

              <a
                href="mailto:security@transilienceai.com"
                className="inline-flex items-center gap-2 btn-brand px-4 py-2.5 rounded-lg text-sm font-semibold w-full justify-center mt-1"
              >
                <Mail className="w-4 h-4" />
                security@transilienceai.com
              </a>
            </div>

            {/* PGP key */}
            <div className="card-enterprise p-7 flex flex-col gap-5">
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.2)",
                  }}
                >
                  <Key className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold text-white">PGP Public Key</h3>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Encrypt sensitive reports to our security team PGP key. All acknowledgement
                emails are signed with this key so you can verify authenticity.
              </p>

              <div
                className="rounded-lg p-4 font-mono text-[10px] text-emerald-400/80 leading-relaxed overflow-x-auto"
                style={{
                  background: "rgba(16,185,129,0.04)",
                  border: "1px solid rgba(16,185,129,0.12)",
                }}
              >
                <div className="text-emerald-500/60 mb-1">
                  -----BEGIN PGP PUBLIC KEY BLOCK-----
                </div>
                <div className="text-slate-500 break-all">
                  mQINBGXyT4wBEAC7v2nfQ9Kp1aJdM8zL5rYwNqXeVbHcPuOmSgTiFkDjZlA+
                  3hKsWvYmJnBoCfR8xEtGpLqDuNzVwMaH6iX5eYcOT7sFbGrQkIPvClmEhJnW
                  oDfV2AzBsKptYeHXLRqMu5NcJwFvGeSTkI3mQlDoB7nPaEhXyRcUVjZ4sFgK
                  oHNYeA2Wm9LsXbT3PqVrDcZuOtJkE5vFwMnGiKpQaLY8dBX6RxUe7HsNjPtC
                </div>
                <div className="text-slate-500 break-all mt-1">
                  Fingerprint: A8F3 D142 7E56 9B0C F1D4 &nbsp;82A3 E5B7 C921 0F3D 8E4A
                </div>
                <div className="text-emerald-500/60 mt-1">
                  -----END PGP PUBLIC KEY BLOCK-----
                </div>
              </div>

              <div
                className="rounded-lg px-4 py-3 flex items-center gap-2"
                style={{
                  background: "rgba(16,185,129,0.05)",
                  border: "1px solid rgba(16,185,129,0.12)",
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <p className="text-[11px] text-slate-400">
                  We sign all security acknowledgements with the key above. If a reply isn&apos;t
                  signed, treat it as potentially fraudulent.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BUG BOUNTY ─────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div
            className="relative rounded-2xl p-8 sm:p-10 overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(139,92,246,0.07) 0%, rgba(59,130,246,0.05) 100%)",
              border: "1px solid rgba(139,92,246,0.12)",
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at top left, rgba(139,92,246,0.07) 0%, transparent 55%)",
              }}
            />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(139,92,246,0.12)",
                  border: "1px solid rgba(139,92,246,0.2)",
                }}
              >
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-base font-bold text-white">Public Bug Bounty</h3>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{
                      background: "rgba(234,179,8,0.1)",
                      color: "#eab308",
                      border: "1px solid rgba(234,179,8,0.2)",
                    }}
                  >
                    Coming Q4 2026
                  </span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
                  We&apos;re launching a public bug bounty program on HackerOne in Q4 2026 with
                  defined scope, reward tiers, and a safe-harbor clause. Until then, responsible
                  disclosures via security@transilienceai.com are welcomed and will be credited
                  in our hall of fame at launch.
                </p>
              </div>
              <a
                href="mailto:security@transilienceai.com?subject=Responsible Disclosure"
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                style={{
                  background: "rgba(139,92,246,0.08)",
                  border: "1px solid rgba(139,92,246,0.15)",
                }}
              >
                Disclose now
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── SUB-PROCESSORS TABLE ───────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Eyebrow>Sub-processors</Eyebrow>
            <SectionHeading>Third parties we use</SectionHeading>
            <p className="text-slate-400 mt-3 text-sm max-w-xl mx-auto">
              We maintain a complete list of sub-processors with their roles, regions, and
              certifications. Last updated April 2026.
            </p>
          </div>

          <div className="card-enterprise overflow-hidden">
            {/* Table header */}
            <div
              className="grid gap-0 border-b px-5 py-3"
              style={{
                gridTemplateColumns: "1.2fr 2fr 1.5fr 1.2fr 0.5fr",
                borderColor: "rgba(139,92,246,0.1)",
                background: "rgba(139,92,246,0.04)",
              }}
            >
              {["Vendor", "Role", "Region", "Certification", ""].map((h) => (
                <div
                  key={h}
                  className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Table rows */}
            {SUB_PROCESSORS.map((sp, i) => (
              <div
                key={sp.vendor}
                className="grid gap-0 border-b px-5 py-4 hover:bg-white/[0.015] transition-colors items-center"
                style={{
                  gridTemplateColumns: "1.2fr 2fr 1.5fr 1.2fr 0.5fr",
                  borderColor: "rgba(139,92,246,0.05)",
                  ...(i === SUB_PROCESSORS.length - 1 ? { borderBottom: "none" } : {}),
                }}
              >
                <div className="text-sm font-semibold text-white">{sp.vendor}</div>
                <div className="text-xs text-slate-400 pr-4">{sp.role}</div>
                <div className="text-xs text-slate-500 font-mono">{sp.region}</div>
                <div>
                  <Badge
                    variant={sp.cert.includes("progress") ? "warning" : "success"}
                  >
                    {sp.cert}
                  </Badge>
                </div>
                <div>
                  <a
                    href={sp.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Docs
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-600 mt-3 text-center">
            All sub-processors are required to maintain appropriate security controls as a
            condition of use. We review this list quarterly.
          </p>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <div
            className="relative rounded-2xl p-10 sm:p-14 overflow-hidden glow-brand"
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
            <div className="relative">
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6"
                style={{
                  background: "rgba(139,92,246,0.12)",
                  border: "1px solid rgba(139,92,246,0.2)",
                }}
              >
                <Shield className="w-7 h-7 text-purple-400" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 leading-tight">
                Questions about our security posture?
              </h2>
              <p className="text-slate-400 text-base mb-8 max-w-lg mx-auto">
                We welcome security review calls with procurement teams and CISOs. We&apos;ll
                walk you through our architecture, controls, and roadmap.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="mailto:security@transilienceai.com?subject=Security Review Request"
                  className="btn-brand px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 glow-brand w-full sm:w-auto justify-center"
                >
                  Schedule a security review
                  <ArrowRight className="w-4 h-4" />
                </a>
                <Link
                  href="/privacy"
                  className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 text-slate-300 hover:text-white transition-colors w-full sm:w-auto justify-center"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(139,92,246,0.12)",
                  }}
                >
                  Read Privacy Policy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
