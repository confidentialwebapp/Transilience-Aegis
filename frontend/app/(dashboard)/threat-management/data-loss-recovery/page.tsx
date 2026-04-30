"use client";

import { useMemo, useState } from "react";
import { CheckCircle, Clock, AlertCircle, XCircle, ShieldOff, Hash, Award, FileText, Calendar, Activity } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, KPICard, StatusPill, SeverityBar } from "@/components/platform";
import type { Column, SeverityLevel } from "@/components/platform";
import { useDlrRecords, useTenantId, type DlrRecordRow, shortHash } from "@/lib/realtime";
import { BRANDS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type ThreatLevel = "High" | "Moderate" | "Low";

interface DlrDisplay {
  id: string;
  hash: string;
  status: "RECOVERED" | "WAITING" | "RECOVERY_FAILED";
  statusLabel: string;
  type: string;
  subtype: string;
  file: string;
  brand: string;
  email: string;
  threatLevel: ThreatLevel;
  added: string;
  classes: string[];
}

function deriveType(classes: string[]): { type: string; subtype: string } {
  const lower = classes.map((c) => c.toLowerCase());
  if (lower.some((c) => c.includes("password"))) return { type: "Login Credentials", subtype: "Bank Account / Mailbox" };
  if (lower.some((c) => c.includes("email") || c.includes("name") || c.includes("phone") || c.includes("address"))) {
    return { type: "Personal Identifiable Information (PII)", subtype: "Customer Data" };
  }
  return { type: "Technical Info / Data", subtype: "Misc" };
}

function deriveThreat(classes: string[]): ThreatLevel {
  const lower = classes.map((c) => c.toLowerCase());
  if (lower.some((c) => c.includes("password"))) return "High";
  if (lower.length > 2) return "Moderate";
  return "Low";
}

function toDisplay(r: DlrRecordRow): DlrDisplay {
  const classes = r.data_classes ?? [];
  const { type, subtype } = deriveType(classes);
  return {
    id: r.id,
    hash: shortHash(r.id),
    status: r.status,
    statusLabel: r.status === "RECOVERY_FAILED" ? "RECOVERY FAILED" : r.status,
    type,
    subtype,
    file: r.breach_name ?? "Unknown breach",
    brand: "—",
    email: r.affected_email ?? "",
    threatLevel: deriveThreat(classes),
    added: new Date(r.added_at).toLocaleString(),
    classes,
  };
}

export default function DLRPage() {
  const tenantId = useTenantId();
  const { data: rawRecords, loading } = useDlrRecords(tenantId);

  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"cases" | "records">("cases");
  const pageSize = 100;

  const records: DlrDisplay[] = useMemo(() => rawRecords.map(toDisplay), [rawRecords]);
  const counts = useMemo(() => {
    const recovered = records.filter((r) => r.status === "RECOVERED").length;
    const waiting = records.filter((r) => r.status === "WAITING").length;
    const failed = records.filter((r) => r.status === "RECOVERY_FAILED").length;
    return { recovered, waiting, open: 0, failed, notAuthorised: 0 };
  }, [records]);

  const visible = tab === "cases" ? records : records.filter((r) => r.status === "RECOVERED");
  const total = visible.length;
  const startIdx = (page - 1) * pageSize;
  const rows = visible.slice(startIdx, startIdx + pageSize);

  const cols: Column<DlrDisplay>[] = [
    {
      key: "case",
      header: "Case ID",
      render: (r) => (
        <div>
          <p className="text-[12px] font-mono text-purple-300 font-semibold">DLR#{r.hash}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{r.added}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <StatusPill status={r.statusLabel} />
        </div>
      ),
    },
    {
      key: "type",
      header: "Incident Type / Sub Type",
      render: (r) => (
        <div className="leading-snug max-w-[300px]">
          <p className="text-[12px] text-slate-200 font-semibold">{r.type}</p>
          <p className="text-[10.5px] text-slate-500">{r.subtype}</p>
          <p className="text-[11px] text-purple-300 mt-1 italic truncate">{r.file}</p>
          {r.email && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{r.email}</p>}
        </div>
      ),
    },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
    {
      key: "threat",
      header: "Threat Level",
      render: (r) => {
        const sev: SeverityLevel = r.threatLevel === "High" ? "Critical" : r.threatLevel === "Moderate" ? "Moderate" : "Low";
        return <SeverityBar level={sev} />;
      },
    },
  ];

  const livePill = (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider"
      style={{
        background: "rgba(16,185,129,0.10)",
        color: "#6ee7b7",
        border: "1px solid rgba(16,185,129,0.30)",
      }}
    >
      <Activity className="w-2.5 h-2.5 animate-pulse" />
      {loading ? "LIVE · CONNECTING…" : records.length > 0 ? `LIVE · ${records.length} RECORDS` : "LIVE · NO RECORDS YET"}
    </span>
  );

  return (
    <>
      <div className="flex items-center gap-3 mb-2">{livePill}</div>
      <PageHeader
        title="Data Loss Recovery"
        description="Track threats discovered on the dark web, illicit forums, paste sites, and Telegram channels. Recovered records are returned to the rightful owner."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <KPICard label="Recovered" value={counts.recovered} accent="green" icon={CheckCircle} />
        <KPICard label="Waiting (CRR)" value={counts.waiting} accent="amber" icon={Clock} />
        <KPICard label="Open" value={counts.open} accent="slate" icon={AlertCircle} />
        <KPICard label="Recovery Failed" value={counts.failed} accent="red" icon={XCircle} />
        <KPICard label="Recovery Not Authorised" value={counts.notAuthorised} accent="purple" icon={ShieldOff} />
      </div>

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <FilterSelect label="Client" options={BRANDS} />
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Incident Type" options={["Login Credentials", "Personal Identifiable Information (PII)", "Technical Info / Data"]} />
          <FilterSelect label="Sub Type" options={["Bank Account", "Corporate Mailbox", "Source Code", "PAN / SSN"]} />
          <FilterSelect label="Status" options={["RECOVERED", "WAITING", "OPEN", "RECOVERY FAILED"]} />
          <FilterSelect label="Threat Level / Severity" options={["High", "Moderate", "Low"]} />
          <FilterInput icon={Hash} placeholder="ID" />
          <FilterInput icon={FileText} placeholder="File / Breach Name" />
          <FilterInput icon={Award} placeholder="Affected Property" />
          <FilterInput icon={Calendar} placeholder="Date From (YYYY-MM-DD)" />
          <FilterInput icon={Calendar} placeholder="Date To (YYYY-MM-DD)" />
          <FilterSelect label="Action Taken by Client" options={["All", "Yes", "No"]} />
          <FilterSelect label="Sort By" options={["Added Date (Descending)", "Added Date (Ascending)", "Threat Level"]} />
        </div>
      </FilterCard>

      <div
        className="flex items-center gap-1 mb-3 p-1 rounded-lg w-fit"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        {(["cases", "records"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={cn(
              "px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-all",
              tab === t ? "text-white" : "text-slate-400 hover:text-white"
            )}
            style={tab === t ? { background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" } : undefined}
          >
            {t === "cases" ? "DLR Case" : "Recovered Records"}
          </button>
        ))}
      </div>

      <DataTable<DlrDisplay>
        columns={cols}
        rows={rows}
        totalEntries={total}
        pageSize={pageSize}
        page={page}
        onPageChange={setPage}
        selectable
        emptyText={loading ? "Loading…" : "No data available."}
      />
    </>
  );
}
