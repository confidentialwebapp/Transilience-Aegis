"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Globe, Hash, Award, AlertTriangle, ToggleLeft, Inbox } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill, SeverityBar } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genIncidents, type IncidentRow, BRANDS } from "@/lib/mock-data";

export default function IncidentsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const total = 1520;
  const rows = useMemo<IncidentRow[]>(
    () => genIncidents(Math.min(pageSize, total - (page - 1) * pageSize), (page - 1) * pageSize),
    [page]
  );

  const cols: Column<IncidentRow>[] = [
    {
      key: "case",
      header: "Case ID",
      width: "240px",
      render: (r) => (
        <div className="leading-snug">
          <p className="text-[12px] font-mono text-purple-300 font-semibold">CASE : {r.caseHash}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Added: {r.addedAt}</p>
          <p className="text-[10px] text-slate-500">Opened: {r.openedAt}</p>
          {r.closedAt && <p className="text-[10px] text-slate-500">Closed: {r.closedAt}</p>}
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "type",
      header: "Type / URL",
      render: (r) => (
        <div className="leading-snug max-w-[280px]">
          <p className="text-[11px] text-slate-400">{r.type}</p>
          <a className="text-[12px] text-purple-300 hover:text-purple-200 truncate block" href="#">{r.url}</a>
        </div>
      ),
    },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-300">{r.brand}</span> },
    { key: "threat", header: "Threat", render: (r) => <SeverityBar level={r.severity} /> },
    {
      key: "uptime",
      header: "Uptime (hh:mm)",
      align: "right",
      render: (r) => {
        const h = Math.floor(r.uptimeMin / 60);
        const m = r.uptimeMin % 60;
        return <span className="font-mono text-[12px] text-slate-300">{h.toString().padStart(2, "0")}:{m.toString().padStart(2, "0")}</span>;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Incidents"
        description="Master list of all infringing or malicious content approved for takedown. Each actionable threat carries a unique case ID, lifecycle status, and uptime tracking."
      />

      <FilterCard
        rightSlot={
          <Link href="/case-manager/reported-by-clients" className="text-[11px] font-semibold text-purple-300 hover:text-purple-200 flex items-center gap-1">
            <Inbox className="w-3 h-3" /> Reported Incidents
          </Link>
        }
        onSearch={() => {}}
        onReset={() => {}}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput icon={Globe} placeholder="Multiple URLs" helper="paste multiple entries separated by commas" />
          <FilterInput icon={Hash} placeholder="Multiple Case IDs" helper="paste multiple entries separated by commas" />
          <FilterSelect icon={Award} label="Brand" options={BRANDS} />
          <FilterSelect icon={AlertTriangle} label="Threat Level" options={["Critical", "Substantial", "Moderate", "Low"]} />
          <FilterSelect icon={ToggleLeft} label="Status" options={["OPEN", "CLOSED", "WAITING", "ON HOLD"]} />
          <FilterSelect icon={Hash} label="Incident Type" options={["Phishing", "Brand Abuse", "Social Media", "Email", "Executive"]} />
        </div>
      </FilterCard>

      <DataTable<IncidentRow>
        columns={cols}
        rows={rows}
        totalEntries={total}
        pageSize={pageSize}
        page={page}
        onPageChange={setPage}
        selectable
      />
    </>
  );
}
