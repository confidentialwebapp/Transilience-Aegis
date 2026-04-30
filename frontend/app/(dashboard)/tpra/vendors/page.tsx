"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, Toggle } from "@/components/platform";
import type { Column } from "@/components/platform";
import { genVendors, type VendorRow, BRANDS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function VendorsListPage() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const rows = useMemo<VendorRow[]>(() => genVendors(28), []);
  const [statusMap, setStatusMap] = useState<Record<string, boolean>>({});

  const cols: Column<VendorRow>[] = [
    {
      key: "name",
      header: "Vendor Name",
      render: (r) => (
        <Link href={`/tpra/vendors/${r.id}`} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
          >
            {r.name[0]}
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-slate-200">{r.name}</p>
            <p className="text-[10.5px] text-slate-500">{r.email}</p>
          </div>
        </Link>
      ),
    },
    { key: "client", header: "Client", render: (r) => <span className="text-[12px] text-slate-300">{r.client}</span> },
    {
      key: "risk",
      header: "Risk Score",
      align: "right",
      render: (r) => (
        <div className="flex flex-col items-end gap-0.5 min-w-[60px]">
          <span
            className={cn(
              "text-[12px] font-bold tabular-nums",
              r.riskScore >= 70 ? "text-red-400" : r.riskScore >= 40 ? "text-amber-400" : "text-emerald-400"
            )}
          >
            {r.riskScore}%
          </span>
          <div className="w-14 h-1 rounded-full bg-purple-500/10 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${r.riskScore}%`,
                background: r.riskScore >= 70 ? "#ef4444" : r.riskScore >= 40 ? "#f59e0b" : "#10b981",
              }}
            />
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const on = statusMap[r.id] ?? r.status;
        return (
          <Toggle
            on={on}
            onChange={(v) => setStatusMap((m) => ({ ...m, [r.id]: v }))}
          />
        );
      },
    },
    { key: "added", header: "Added Date", render: (r) => <span className="text-[12px] text-slate-400">{r.added}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Third-Party Vendors"
        description="Central repository and management of third-party vendors. Risk scores combine surface-level posture, compliance signals, and continuous dark-web monitoring."
        rightSlot={
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
          >
            <Plus className="w-3 h-3" /> Add Vendor
          </button>
        }
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterInput icon={Building2} placeholder="Vendor name" />
          <FilterSelect label="Client" options={BRANDS} />
          <FilterSelect label="Risk band" options={["High (≥70%)", "Medium (40-69%)", "Low (<40%)"]} />
        </div>
      </FilterCard>

      <DataTable<VendorRow>
        columns={cols}
        rows={rows}
        totalEntries={rows.length}
        pageSize={pageSize}
        page={page}
        onPageChange={setPage}
      />
    </>
  );
}
