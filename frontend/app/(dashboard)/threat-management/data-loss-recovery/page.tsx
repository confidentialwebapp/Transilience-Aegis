"use client";

import { useMemo, useState } from "react";
import { CheckCircle, Clock, AlertCircle, XCircle, ShieldOff, Hash, Award, FileText, Calendar } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, KPICard, StatusPill, SeverityBar } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genDlr, type DlrRow, BRANDS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function DLRPage() {
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"cases" | "records">("cases");
  const pageSize = 100;
  const total = 17365;
  const rows = useMemo<DlrRow[]>(
    () => genDlr(Math.min(pageSize, total - (page - 1) * pageSize), (page - 1) * pageSize),
    [page]
  );

  const cols: Column<DlrRow>[] = [
    {
      key: "case",
      header: "Case ID",
      render: (r) => (
        <div>
          <p className="text-[12px] font-mono text-purple-300 font-semibold">{r.id}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{r.added}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <StatusPill status={r.status} />
          {r.actionTaken && <span className="text-[9.5px] text-emerald-400 font-semibold">(Action Taken)</span>}
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
        </div>
      ),
    },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
    { key: "threat", header: "Threat Level", render: (r) => <SeverityBar level={r.threatLevel === "High" ? "Critical" : r.threatLevel === "Moderate" ? "Moderate" : "Low"} /> },
  ];

  return (
    <>
      <PageHeader
        title="Data Loss Recovery"
        description="Track threats discovered on the dark web, illicit forums, paste sites, and Telegram channels. Recovered records are returned to the rightful owner."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <KPICard label="Recovered" value={24134} accent="green" icon={CheckCircle} />
        <KPICard label="Waiting (CRR)" value={184} accent="amber" icon={Clock} />
        <KPICard label="Open" value={0} accent="slate" icon={AlertCircle} />
        <KPICard label="Recovery Failed" value={19} accent="red" icon={XCircle} />
        <KPICard label="Recovery Not Authorised" value={43} accent="purple" icon={ShieldOff} />
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
            onClick={() => setTab(t)}
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

      {tab === "cases" ? (
        <DataTable<DlrRow>
          columns={cols}
          rows={rows}
          totalEntries={total}
          pageSize={pageSize}
          page={page}
          onPageChange={setPage}
          selectable
        />
      ) : (
        <DataTable<DlrRow>
          columns={cols}
          rows={rows.filter((r) => r.status === "RECOVERED")}
          totalEntries={24134}
          pageSize={pageSize}
          page={page}
          onPageChange={setPage}
          selectable
        />
      )}
    </>
  );
}
