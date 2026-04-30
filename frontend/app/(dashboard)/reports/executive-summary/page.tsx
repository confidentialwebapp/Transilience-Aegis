"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, FileBadge, Download, Activity } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, Pagination } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

interface LiveRun {
  id: string;
  brand: string | null;
  service: string | null;
  finding_count: number | null;
  completed_at: string | null;
  started_at: string;
}

function fmtTs(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface LedgerRow {
  title: string;
  generatedAt: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function makeReports(): LedgerRow[] {
  const rows: LedgerRow[] = [];
  // 227 entries — produced monthly per brand for the last ~24 months
  for (let i = 0; i < 227; i++) {
    const brand = BRANDS[i % BRANDS.length];
    const monthIdx = i % 12;
    const yearOffset = Math.floor(i / 12) % 3; // covers 2024, 2025, 2026
    const year = 2026 - yearOffset;
    const monthName = MONTHS[monthIdx];
    const lastDay = new Date(year, monthIdx + 1, 0).getDate();
    const seedHour = (i * 13) % 12;
    const seedMin = (i * 17) % 60;
    const seedSec = (i * 29) % 60;
    const ts = `${(monthIdx + 1).toString().padStart(2, "0")}/${lastDay}/${year} ${seedHour.toString().padStart(2, "0")}:${seedMin.toString().padStart(2, "0")}:${seedSec.toString().padStart(2, "0")} AM`;
    rows.push({
      title: `${brand} - Executive Summary Report - ${monthName} 1 ${year} to ${monthName} ${lastDay} ${year}`,
      generatedAt: ts,
    });
  }
  return rows;
}

const ALL = makeReports();

export default function ExecutiveSummaryReport() {
  const [page, setPage] = useState(1);
  const perPage = 50;
  const totalPages = Math.ceil(ALL.length / perPage);
  const visible = useMemo(() => ALL.slice((page - 1) * perPage, page * perPage), [page]);

  // Latest 10 completed scan_runs across all tenants the user can read
  const [liveRuns, setLiveRuns] = useState<LiveRun[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const fetchRuns = async () => {
      const { data } = await supabase
        .from("scan_runs")
        .select("id, brand, service, finding_count, completed_at, started_at")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(10);
      if (!cancelled) {
        setLiveRuns((data ?? []) as LiveRun[]);
        setLiveLoading(false);
      }
    };
    void fetchRuns();
    const ch = supabase
      .channel("exec-summary-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "scan_runs" }, () => void fetchRuns())
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Executive Summary Report"
        description="Complete summary report of all major services (Incident, Monitoring, Darkweb, WSS, etc.) — generated monthly per brand. The library of every executive summary ever produced for this tenant."
      />

      {/* LIVE banner — most recent 10 completed scan runs as downloadable PDFs */}
      <div
        className="rounded-xl overflow-hidden mb-4"
        style={{
          background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(139,92,246,0.04))",
          border: "1px solid rgba(16,185,129,0.25)",
        }}
      >
        <div className="px-4 py-2.5 flex items-center gap-2 border-b" style={{ borderColor: "rgba(16,185,129,0.20)" }}>
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold tracking-[0.13em] uppercase text-emerald-300">
            Live · Latest scan reports populate here as scans complete
          </span>
          {liveLoading && <span className="text-[10px] text-slate-500 italic ml-auto">connecting…</span>}
        </div>
        {liveRuns.length === 0 && !liveLoading ? (
          <div className="px-4 py-3 text-[11.5px] text-slate-500 italic">
            No completed scan runs yet. Trigger one from <Link href="/admin/scan" className="text-purple-300 hover:text-purple-200">Admin → Run Scan</Link>.
          </div>
        ) : (
          <div className="divide-y divide-emerald-500/[0.10]">
            {liveRuns.map((run) => (
              <a
                key={run.id}
                href={`/api/report/${run.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="grid grid-cols-[1fr_140px_180px] items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.30)" }}
                  >
                    <FileBadge className="w-3.5 h-3.5 text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-slate-200 truncate group-hover:text-emerald-200">
                      {run.brand ?? "Unknown brand"} — Brand Risk Report
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {run.service ?? "scan"} · {(run.finding_count ?? 0)} findings
                    </p>
                  </div>
                </div>
                <span className="text-[10.5px] text-slate-500 font-mono tabular-nums text-right">{fmtTs(run.completed_at)}</span>
                <span className="text-[10.5px] text-emerald-300 font-semibold inline-flex items-center justify-end gap-1">
                  Download PDF <Download className="w-3 h-3" />
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Brand" options={BRANDS} />
          <FilterSelect label="Year" options={["2026", "2025", "2024"]} />
          <FilterInput icon={Calendar} placeholder="From" />
          <FilterInput icon={Calendar} placeholder="To" />
        </div>
      </FilterCard>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <div className="px-4 py-2.5 border-b grid grid-cols-[1fr_240px]" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
          <span className="text-[10px] font-bold tracking-[0.13em] uppercase text-slate-400">Report Title</span>
          <span className="text-[10px] font-bold tracking-[0.13em] uppercase text-slate-400 text-right">Generated</span>
        </div>
        <div className="divide-y divide-purple-500/[0.05]">
          {visible.map((r, i) => (
            <button
              key={`${page}-${i}`}
              className="w-full grid grid-cols-[1fr_240px] items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(168,85,247,0.10)", border: "1px solid rgba(168,85,247,0.25)" }}
                >
                  <FileBadge className="w-3.5 h-3.5 text-purple-300" />
                </div>
                <span className="text-[12.5px] text-slate-200 group-hover:text-purple-200 truncate">{r.title}</span>
              </div>
              <div className="flex items-center justify-end gap-3">
                <span className="text-[11px] text-slate-500 font-mono tabular-nums">{r.generatedAt}</span>
                <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-300" />
              </div>
            </button>
          ))}
        </div>
        <div
          className="flex items-center justify-between px-4 py-2.5 border-t"
          style={{ borderColor: "rgba(139,92,246,0.10)", background: "rgba(255,255,255,0.015)" }}
        >
          <span className="text-[11px] text-slate-500">
            Showing <span className="text-slate-300 font-medium">{(page - 1) * perPage + 1}</span> to{" "}
            <span className="text-slate-300 font-medium">{Math.min(page * perPage, ALL.length)}</span> of{" "}
            <span className="text-slate-300 font-medium">{ALL.length}</span> entries
          </span>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>
    </>
  );
}
