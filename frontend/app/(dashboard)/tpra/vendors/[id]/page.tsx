"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, ChevronDown, Mail, ArrowLeft, Plus } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { PageHeader, StatusPill, EmptyState } from "@/components/platform";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "compliance", label: "Compliance" },
  { key: "vulns", label: "Vulnerabilities (12)" },
  { key: "discovered", label: "Discovered Assets (47)" },
  { key: "defaced", label: "Suspected Defaced" },
  { key: "cves", label: "CVEs" },
  { key: "questionnaire", label: "Questionnaire" },
  { key: "darkweb", label: "Darkweb" },
] as const;

type Tab = (typeof TABS)[number]["key"];

const COMPLIANCE_DETAILS = [
  {
    type: "ISO 27001",
    isCompliant: "UNVERIFIED",
    description:
      "Vendor has not provided a current ISO 27001 certificate. Public disclosures and partner attestations are insufficient to confirm an active certification within the past 12 months.",
  },
  {
    type: "SOC 2 Type II",
    isCompliant: "UNVERIFIED",
    description:
      "No SOC 2 Type II report has been received. Recommend requesting the latest SOC 2 from the vendor's trust portal or via the standard NDA process.",
  },
  {
    type: "PCI DSS",
    isCompliant: "UNVERIFIED",
    description:
      "Vendor processes cardholder data on behalf of clients but PCI DSS attestation of compliance has not been verified for the current scope.",
  },
];

const KEY_PEOPLE = [
  { name: "Karthik Raja", role: "Managing Director" },
  { name: "Priya Iyer", role: "Business Development Manager" },
  { name: "Rohit Mehta", role: "Chief Information Security Officer" },
];

const EXEC_BOARD = [
  {
    name: "Karthik Raja",
    role: "Managing Director",
    expanded: true,
    yearsWith: 8,
    background: "20+ years across financial services, technology consulting, and enterprise sales. Founding member of the company in 2017.",
    education: "B.Tech, IIT Madras; MBA, INSEAD.",
    responsibilities: "Overall strategic direction, board reporting, investor relations, P&L ownership.",
    previous: "Director at Major Bank (5y), Senior Consultant at Big-4 (4y).",
    certifications: "CISSP, CISM, ISO 27001 Lead Auditor.",
  },
  {
    name: "Priya Iyer",
    role: "Business Development Manager",
    expanded: false,
  },
  {
    name: "Rohit Mehta",
    role: "Chief Information Security Officer",
    expanded: false,
  },
];

const TREND = Array.from({ length: 30 }, (_, i) => ({
  d: i,
  v: 30 + Math.sin(i / 3) * 12 + Math.random() * 8,
}));

export default function VendorDetailPage() {
  const params = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("compliance");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "Karthik Raja": true });

  return (
    <>
      <Link
        href="/tpra/vendors"
        className="inline-flex items-center gap-1 text-[11.5px] text-slate-500 hover:text-purple-300 mb-3 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" /> Back to Vendors
      </Link>

      <PageHeader
        title="Vendor Risk Review"
        description="Detailed third-party risk assessment, compliance posture, discovered assets, and dark-web exposure for the selected vendor."
      />

      {/* Header card */}
      <div
        className="rounded-xl p-4 mb-4 flex items-center gap-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
        >
          C
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-white">Cloudflare</h2>
          <p className="text-[11.5px] text-slate-400 flex items-center gap-1.5 mt-0.5">
            <Mail className="w-3 h-3" /> security@cloudflare.com
          </p>
        </div>
        <div className="hidden md:block w-48 h-12">
          <ResponsiveContainer>
            <AreaChart data={TREND}>
              <defs>
                <linearGradient id="vendorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="#a855f7" strokeWidth={1.5} fill="url(#vendorGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Risk Score</p>
          <p className="text-[20px] font-bold text-emerald-400 tabular-nums">20%</p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 mb-4 p-1 rounded-lg overflow-x-auto"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-all whitespace-nowrap",
              tab === t.key ? "text-white" : "text-slate-400 hover:text-white"
            )}
            style={tab === t.key ? { background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" } : undefined}
          >
            {t.label}
          </button>
        ))}
        <button
          className="px-3 py-1.5 rounded-md text-[11.5px] font-semibold text-slate-400 hover:text-white transition-all flex items-center gap-1"
        >
          More <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {tab === "compliance" && (
        <div className="space-y-4">
          {/* Compliance Details */}
          <Section title="Compliance Details">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgba(139,92,246,0.15)" }}>
                    <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Type</th>
                    <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Is Compliant</th>
                    <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPLIANCE_DETAILS.map((c) => (
                    <tr key={c.type} className="border-b" style={{ borderColor: "rgba(139,92,246,0.06)" }}>
                      <td className="py-3 px-3 text-slate-200 font-semibold">{c.type}</td>
                      <td className="py-3 px-3"><StatusPill status={c.isCompliant} /></td>
                      <td className="py-3 px-3 text-slate-400 leading-relaxed max-w-2xl">{c.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Corporate Structure */}
          <Section title="Corporate Structure">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Parent Company" value="Cloudflare, Inc." />
              <Field label="Subsidiaries" value="Cloudflare Workers Ltd, Cloudflare D1 Inc." />
              <Field label="Divisions" value="Application Services, Network Services, Zero Trust" />
              <Field label="International Presence" value="50+ countries" />
              <Field label="No. of employees" value="3,800" />
              <div className="md:col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Organizational Hierarchy</p>
                <p className="text-[12px] text-slate-300 leading-relaxed">
                  Reports to Board of Directors → Chief Executive Officer → Executive Leadership Team. The
                  CISO reports directly to the CEO with dotted-line reporting to the Audit Committee. Engineering and
                  Product reports through the Chief Product Officer.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Key Decision Makers</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {KEY_PEOPLE.map((p) => (
                  <div
                    key={p.name}
                    className="rounded-lg px-3 py-2"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.10)" }}
                  >
                    <p className="text-[12px] font-semibold text-slate-200">{p.name}</p>
                    <p className="text-[10.5px] text-slate-500">{p.role}</p>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Certificate of Incorporation */}
          <Section title="Certificate of Incorporation">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Certificate Number" value="C0987654" />
              <Field label="Incorporation Date" value="2009-07-01" />
              <Field label="State / Country" value="Delaware, USA" />
              <Field label="Corporate Status" value="Active" />
              <Field label="Registration Authority" value="Delaware Division of Corporations" />
              <Field label="Registered Address" value="101 Townsend St, San Francisco, CA 94107" />
            </div>
          </Section>

          {/* Legal Structure Ownership */}
          <Section title="Legal Structure Ownership">
            <EmptyState />
          </Section>

          {/* Executive Board Profiles */}
          <Section title="Executive Board Profiles">
            <div className="space-y-2">
              {EXEC_BOARD.map((p) => {
                const open = expanded[p.name] ?? p.expanded;
                return (
                  <div
                    key={p.name}
                    className="rounded-lg overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
                  >
                    <button
                      onClick={() => setExpanded((m) => ({ ...m, [p.name]: !open }))}
                      className="w-full flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
                          style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.4), rgba(236,72,153,0.3))" }}
                        >
                          {p.name[0]}
                        </div>
                        <div className="text-left">
                          <p className="text-[12.5px] font-semibold text-slate-200">{p.name}</p>
                          <p className="text-[10.5px] text-slate-500">{p.role}</p>
                        </div>
                      </div>
                      {open ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Plus className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    {open && p.background && (
                      <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                        <Field label="Years with company" value={`${p.yearsWith}y`} />
                        <Field label="Professional Background" value={p.background!} multiline />
                        <Field label="Education" value={p.education!} />
                        <Field label="Key Responsibilities" value={p.responsibilities!} multiline />
                        <Field label="Previous Experience" value={p.previous!} multiline />
                        <Field label="Professional Certifications" value={p.certifications!} multiline />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Other reports */}
          {["Investor Report", "Public Stock Exchange Reports", "Shareholder Report", "Revenue"].map((title) => (
            <Section key={title} title={title}>
              <EmptyState />
            </Section>
          ))}
        </div>
      )}

      {tab !== "compliance" && (
        <Section title={TABS.find((t) => t.key === tab)?.label || ""}>
          <EmptyState description={`Vendor ${params.id} — no data ingested for this section yet.`} />
        </Section>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.10)" }}
    >
      <div className="px-4 py-2.5 border-b" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
        <h3 className="text-[13px] font-bold text-white tracking-tight">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
      <p className={cn("text-[12.5px] text-slate-200 mt-0.5", multiline && "leading-relaxed")}>{value}</p>
    </div>
  );
}
