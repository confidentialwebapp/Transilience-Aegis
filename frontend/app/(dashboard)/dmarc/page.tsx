"use client";

import { useState } from "react";
import { Calendar, Building2, Globe, Mail } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable } from "@/components/platform";
import type { Column } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const POLICY_DATA = [
  { name: "Accepted", value: 14820, color: "#10b981" },
  { name: "Quarantine", value: 1842, color: "#f59e0b" },
  { name: "Rejected", value: 312, color: "#ef4444" },
];
const SPF_DATA = [
  { name: "SPF Pass", value: 13800, color: "#10b981" },
  { name: "SPF Fail", value: 1900, color: "#ef4444" },
  { name: "SPF Unknown", value: 1274, color: "#94a3b8" },
];
const DKIM_DATA = [
  { name: "DKIM Pass", value: 14010, color: "#10b981" },
  { name: "DKIM Fail", value: 1500, color: "#ef4444" },
  { name: "DKIM Unknown", value: 1464, color: "#94a3b8" },
];

const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
function progressData(scale: number) {
  return MONTHS.map((m, i) => ({
    month: m,
    pass: Math.round(8000 + Math.sin(i / 1.5) * 2500 + i * 200) * scale,
    fail: Math.round(1500 - Math.sin(i / 1.5) * 600) * scale,
  }));
}

const TOP_SOURCES = [
  { server: "google.com", volume: 8420, pct: 49.3 },
  { server: "outlook.com", volume: 4210, pct: 24.6 },
  { server: "amazonses.com", volume: 1820, pct: 10.6 },
  { server: "sendgrid.net", volume: 1200, pct: 7.0 },
  { server: "mailgun.org", volume: 540, pct: 3.2 },
];
const UNKNOWN_SOURCES = [
  { server: "mail.suspicious-relay.cn", volume: 412, pct: 26.1 },
  { server: "smtp.unknown-host.ru", volume: 280, pct: 17.7 },
  { server: "mx.bulk-mailer.io", volume: 220, pct: 13.9 },
];

interface ServerRow {
  name: string;
  volume: number;
  compliance: number;
  spf: "Pass" | "Fail";
  dkim: "Pass" | "Fail";
}

const CAPABLE_SERVERS: ServerRow[] = [
  { name: "google.com", volume: 8420, compliance: 99.8, spf: "Pass", dkim: "Pass" },
  { name: "outlook.com", volume: 4210, compliance: 98.4, spf: "Pass", dkim: "Pass" },
  { name: "amazonses.com", volume: 1820, compliance: 97.2, spf: "Pass", dkim: "Pass" },
  { name: "sendgrid.net", volume: 1200, compliance: 96.5, spf: "Pass", dkim: "Pass" },
  { name: "mailgun.org", volume: 540, compliance: 94.8, spf: "Pass", dkim: "Pass" },
];

const THREAT_SERVERS: ServerRow[] = [
  { name: "mail.suspicious-relay.cn", volume: 412, compliance: 12.4, spf: "Fail", dkim: "Fail" },
  { name: "smtp.unknown-host.ru", volume: 280, compliance: 8.1, spf: "Fail", dkim: "Fail" },
  { name: "mx.bulk-mailer.io", volume: 220, compliance: 18.6, spf: "Pass", dkim: "Fail" },
];

function Donut({ title, data, total }: { title: string; data: { name: string; value: number; color: string }[]; total?: string | number }) {
  const sum = data.reduce((s, d) => s + d.value, 0);
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
    >
      <h3 className="text-[12px] font-bold text-white tracking-tight mb-3">{title}</h3>
      <div className="flex items-center gap-4">
        <div className="w-28 h-28 relative">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={36} outerRadius={54} paddingAngle={2} stroke="none">
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[9px] uppercase tracking-wider text-slate-500">Total</span>
            <span className="text-[14px] font-bold text-white tabular-nums">
              {total ?? sum.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              <span className="flex-1 text-slate-300">{d.name}</span>
              <span className="tabular-nums text-slate-200 font-medium">{d.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Progress({ title, data }: { title: string; data: { month: string; pass: number; fail: number }[] }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
      <h3 className="text-[12px] font-bold text-white tracking-tight mb-3">{title}</h3>
      <div className="h-32">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
            <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
            <YAxis stroke="#64748b" fontSize={10} />
            <Tooltip contentStyle={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 8, fontSize: 11 }} />
            <Line type="monotone" dataKey="pass" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="fail" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SourcesCard({ title, rows }: { title: string; rows: { server: string; volume: number; pct: number }[] }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
      <div className="px-4 py-2.5 border-b" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
        <h3 className="text-[12px] font-bold text-white tracking-tight">{title}</h3>
      </div>
      <div className="divide-y divide-purple-500/[0.05]">
        {rows.map((r) => (
          <div key={r.server} className="px-4 py-2 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-slate-200 font-medium truncate">{r.server}</p>
              <div className="w-full h-1 rounded-full bg-purple-500/10 overflow-hidden mt-1">
                <div className="h-full rounded-full bg-purple-400" style={{ width: `${r.pct}%` }} />
              </div>
            </div>
            <div className="ml-3 text-right">
              <p className="text-[11.5px] font-bold text-white tabular-nums">{r.volume.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 tabular-nums">{r.pct}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DmarcPage() {
  const [tab, setTab] = useState<"capable" | "threat">("capable");

  const cols: Column<ServerRow>[] = [
    { key: "name", header: "Server Name", render: (r) => <span className="text-[12px] text-slate-200 font-mono">{r.name}</span> },
    { key: "volume", header: "Volume", align: "right", render: (r) => <span className="text-[12px] text-slate-300 tabular-nums">{r.volume.toLocaleString()}</span> },
    {
      key: "compliance",
      header: "DMARC Compliance",
      align: "right",
      render: (r) => (
        <span className={cn("text-[12px] font-bold tabular-nums", r.compliance >= 90 ? "text-emerald-400" : "text-red-400")}>
          {r.compliance}%
        </span>
      ),
    },
    {
      key: "spf",
      header: "SPF",
      align: "center",
      render: (r) => (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
          style={{
            background: r.spf === "Pass" ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)",
            color: r.spf === "Pass" ? "#6ee7b7" : "#fca5a5",
            border: r.spf === "Pass" ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(239,68,68,0.30)",
          }}
        >
          {r.spf}
        </span>
      ),
    },
    {
      key: "dkim",
      header: "DKIM",
      align: "center",
      render: (r) => (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
          style={{
            background: r.dkim === "Pass" ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)",
            color: r.dkim === "Pass" ? "#6ee7b7" : "#fca5a5",
            border: r.dkim === "Pass" ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(239,68,68,0.30)",
          }}
        >
          {r.dkim}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="DMARC MSS"
        description="Managed DMARC service. Summary of email volume with SPF and DKIM alignment, segmented by sending source and trust posture."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <FilterSelect icon={Building2} label="Clients" options={BRANDS} />
          <FilterSelect icon={Globe} label="Domains" options={["creditaccessgrameen.com", "creditaccessgrameen.com", "creditaccessgrameen.com"]} />
          <FilterInput icon={Calendar} placeholder="Start Date" helper="Date range cannot be exceeded more than 31 days" />
          <FilterInput icon={Calendar} placeholder="End Date" />
        </div>
      </FilterCard>

      {/* Donuts + progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        <Donut title="Policy Evaluated" data={POLICY_DATA} total="16,974" />
        <Progress title="DMARC Progress" data={progressData(1)} />
        <Donut title="SPF Status" data={SPF_DATA} total="16,974" />
        <Progress title="SPF Progress" data={progressData(0.95)} />
        <Donut title="DKIM Status" data={DKIM_DATA} total="16,974" />
        <Progress title="DKIM Progress" data={progressData(1.05)} />
      </div>

      {/* Sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <SourcesCard title="Top Sources" rows={TOP_SOURCES} />
        <SourcesCard title="Top Sources For Threat / Unknown" rows={UNKNOWN_SOURCES} />
      </div>

      {/* Server detail tabs */}
      <div
        className="flex items-center gap-1 mb-3 p-1 rounded-lg w-fit"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        {([
          { key: "capable", label: `SPF / DKIM Capable (${CAPABLE_SERVERS.length})` },
          { key: "threat", label: `Threat / Unknown (${THREAT_SERVERS.length})` },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-all",
              tab === t.key ? "text-white" : "text-slate-400 hover:text-white"
            )}
            style={tab === t.key ? { background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      <DataTable<ServerRow>
        columns={cols}
        rows={tab === "capable" ? CAPABLE_SERVERS : THREAT_SERVERS}
        rowAction={false}
      />
    </>
  );
}
