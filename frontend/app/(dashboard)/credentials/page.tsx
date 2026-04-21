"use client";

import { useMemo, useState, useEffect } from "react";
import {
  KeyRound, Search as SearchIcon, SlidersHorizontal, Info, Share2, Download,
  Check, Ban, ChevronLeft, ChevronRight, ChevronDown, Loader2, FileCheck2,
  HelpCircle, Trash2, Sparkles, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import FiltersDrawer, { DEFAULT_FILTERS, FilterState } from "@/components/credentials/FiltersDrawer";
import DetailsDrawer from "@/components/credentials/DetailsDrawer";
import OnboardingTour from "@/components/credentials/OnboardingTour";
import { Credential, generateCredentials, TOTAL_DB_RESULTS } from "@/components/credentials/demoData";

const SEARCH_TYPES = [
  { value: "domain_email", label: "Domain of Email" },
  { value: "email", label: "Exact Email" },
  { value: "username", label: "Username" },
  { value: "domain", label: "Domain" },
  { value: "ip", label: "IP Address" },
];

const PAGE_SIZE = 15;

export default function CredentialsPage() {
  const [activeTab, setActiveTab] = useState<"tenant" | "global">("tenant");
  const [searchType, setSearchType] = useState("domain_email");
  const [searchTypeOpen, setSearchTypeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [activeCred, setActiveCred] = useState<Credential | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => {
      setCreds(generateCredentials(250));
      setLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  // Show tour automatically on first visit (per-browser)
  useEffect(() => {
    try {
      if (!localStorage.getItem("creds_tour_v1")) {
        setTimeout(() => {
          setTourOpen(true);
          localStorage.setItem("creds_tour_v1", "1");
        }, 900);
      }
    } catch {}
  }, []);

  const filtered = useMemo(() => {
    let rows = creds;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) => r.identity.toLowerCase().includes(q));
    }
    rows = rows.filter((r) => filters.statuses[r.status]);
    if (filters.source !== "all") {
      const map: Record<string, string> = {
        combolists: "Combolists",
        stealer_logs: "Stealer Logs",
        data_breaches: "Data Breaches",
        paste_sites: "Paste Sites",
        telegram_leaks: "Telegram Leaks",
      };
      rows = rows.filter((r) => r.source === map[filters.source]);
    }
    if (filters.dateImported !== "all") {
      const days = filters.dateImported === "7d" ? 7 : filters.dateImported === "30d" ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      rows = rows.filter((r) => new Date(r.importedAt) >= cutoff);
    }
    return rows;
  }, [creds, searchQuery, filters]);

  const totalCount = activeTab === "global"
    ? TOTAL_DB_RESULTS
    : searchQuery || filters !== DEFAULT_FILTERS
    ? filtered.length
    : TOTAL_DB_RESULTS;

  const pageStart = (page - 1) * PAGE_SIZE;
  const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const allOnPageChecked = paged.length > 0 && paged.every((c) => selected[c.id]);

  const toggleAllOnPage = () => {
    const next = { ...selected };
    const state = !allOnPageChecked;
    paged.forEach((c) => {
      next[c.id] = state;
    });
    setSelected(next);
  };

  const toggleRow = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  const markStatus = (ids: string[], status: Credential["status"]) => {
    setCreds((prev) => prev.map((c) => (ids.includes(c.id) ? { ...c, status } : c)));
    const label = status === "remediated" ? "remediated" : "ignored";
    toast.success(`${ids.length} credential${ids.length > 1 ? "s" : ""} marked as ${label}`);
    setSelected({});
  };

  const exportCsv = () => {
    const ids = selectedIds.length > 0 ? selectedIds : paged.map((c) => c.id);
    const rows = creds.filter((c) => ids.includes(c.id));
    const header = ["imported_at", "identity", "password", "source", "status", "risk_score"];
    const body = rows.map((c) =>
      [c.importedAt, c.identity, c.password, c.source, c.status, c.riskScore].join(",")
    );
    const csv = [header.join(","), ...body].join("\n");
    if (typeof window !== "undefined") {
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `credentials-export-${Date.now()}.csv`;
      a.click();
    }
    toast.success(`Exported ${rows.length} credentials`);
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(236,72,153,0.12))",
              border: "1px solid rgba(139,92,246,0.25)",
            }}>
            <KeyRound className="w-5 h-5 text-purple-300" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"
              style={{ boxShadow: "0 0 10px #10b981" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">
                Credentials Browser
              </h1>
              <button
                onClick={() => {
                  setTourStep(0);
                  setTourOpen(true);
                }}
                title="Start guided tour"
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 hover:text-purple-300 transition-colors"
              >
                <Info className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-300 font-semibold tracking-wider">LIVE</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Search, triage, and remediate leaked credentials across your attack surface
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              toast.success("Share link copied to clipboard");
              try {
                navigator.clipboard?.writeText(window.location.href);
              } catch {}
            }}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={exportCsv}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b" data-tour="tour-tabs"
        style={{ borderColor: "rgba(139,92,246,0.08)" }}>
        {[
          { k: "tenant" as const, label: "Tenant Feed", icon: Users, badge: null },
          { k: "global" as const, label: "Global Search", icon: Sparkles, badge: "CORE+" },
        ].map(({ k, label, icon: Icon, badge }) => (
          <button
            key={k}
            onClick={() => setActiveTab(k)}
            data-tour={k === "global" ? "tour-global-search" : undefined}
            className={cn(
              "relative px-4 h-10 flex items-center gap-2 text-sm font-medium transition-all",
              activeTab === k ? "text-white" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {badge && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/25 tracking-wider">
                {badge}
              </span>
            )}
            {activeTab === k && (
              <div
                className="absolute left-0 right-0 bottom-[-1px] h-[2px] rounded-full"
                style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Results Found" value={totalCount.toLocaleString()} accent="purple" spark />
        <StatCard label="New (Untriaged)" value={creds.filter((c) => c.status === "new").length.toLocaleString()} accent="emerald" />
        <StatCard label="Remediated" value={creds.filter((c) => c.status === "remediated").length.toLocaleString()} accent="blue" />
        <StatCard label="Avg Risk Score" value={`${Math.round(creds.reduce((a, c) => a + c.riskScore, 0) / Math.max(1, creds.length))}`} accent="red" suffix="/100" />
      </div>

      {/* Search row */}
      <div className="card-enterprise p-3 md:p-4">
        <div className="flex gap-2 items-stretch">
          <div className="relative">
            <button
              onClick={() => setSearchTypeOpen(!searchTypeOpen)}
              className="h-11 px-3 pr-8 rounded-lg text-sm text-slate-300 bg-white/[0.02] border border-purple-500/[0.08] hover:border-purple-500/20 transition-all flex items-center gap-2 min-w-[170px]"
            >
              {SEARCH_TYPES.find((t) => t.value === searchType)?.label}
              <ChevronDown className="w-3.5 h-3.5 ml-auto text-slate-500" />
            </button>
            {searchTypeOpen && (
              <div className="absolute left-0 top-full mt-1 w-full min-w-[200px] rounded-lg overflow-hidden z-30 animate-fade-up"
                style={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.15)" }}>
                {SEARCH_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => {
                      setSearchType(t.value);
                      setSearchTypeOpen(false);
                    }}
                    className={cn(
                      "block w-full text-left px-3 py-2 text-sm hover:bg-white/[0.03] transition-colors",
                      searchType === t.value ? "text-purple-300 bg-purple-500/[0.06]" : "text-slate-400"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex-1" data-tour="tour-search">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Type your search term (e.g. domain.com)"
              className="w-full h-11 pl-10 pr-4 rounded-lg bg-white/[0.02] border border-purple-500/[0.08] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/25 transition-all"
            />
          </div>

          <button
            onClick={() => toast.info(`Searching ${activeTab === "global" ? "Flare global database" : "tenant feed"}…`)}
            className="h-11 px-5 rounded-lg text-sm font-semibold text-white btn-brand flex items-center gap-2"
          >
            <SearchIcon className="w-4 h-4" />
            Search
          </button>

          <button
            onClick={() => setFiltersOpen(true)}
            data-tour="tour-filters"
            className="h-11 px-4 rounded-lg text-sm font-medium text-slate-300 bg-white/[0.02] border border-purple-500/[0.08] hover:border-purple-500/25 hover:text-white transition-all flex items-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden md:inline">Filters</span>
          </button>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid rgba(139,92,246,0.05)" }}>
          <div className="flex items-center gap-2" data-tour="tour-results-count">
            <FileCheck2 className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-slate-400">
              <span className="text-purple-300 font-bold font-mono">
                {totalCount.toLocaleString()}
              </span>{" "}
              results found
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-600">Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}</span>
            <button
              onClick={() => {
                setSearchQuery("");
                setFilters(DEFAULT_FILTERS);
                setPage(1);
              }}
              className="text-[11px] text-slate-500 hover:text-purple-300 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl animate-fade-up"
          style={{
            background: "linear-gradient(90deg,rgba(139,92,246,0.08),rgba(236,72,153,0.05))",
            border: "1px solid rgba(139,92,246,0.25)",
          }}>
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs font-bold">
              {selectedIds.length}
            </span>
            <span className="text-sm text-slate-200">
              credential{selectedIds.length > 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => markStatus(selectedIds, "remediated")}
              className="h-8 px-3 rounded-md text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
            >
              <Check className="w-3 h-3" /> Remediate
            </button>
            <button
              onClick={() => markStatus(selectedIds, "ignored")}
              className="h-8 px-3 rounded-md text-xs font-semibold text-slate-400 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:text-white transition-all flex items-center gap-1.5"
            >
              <Ban className="w-3 h-3" /> Ignore
            </button>
            <button
              onClick={exportCsv}
              className="h-8 px-3 rounded-md text-xs font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-1.5"
            >
              <Download className="w-3 h-3" /> Export
            </button>
            <button
              onClick={() => setSelected({})}
              className="h-8 w-8 rounded-md flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.04] transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card-enterprise overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
            <p className="text-xs text-slate-500">Loading credentials feed…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <HelpCircle className="w-10 h-10 text-slate-700" />
            <p className="text-sm text-slate-400">No credentials match your filters.</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setFilters(DEFAULT_FILTERS);
              }}
              className="text-xs text-purple-300 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500"
                    style={{ background: "rgba(255,255,255,0.015)", borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
                    <th className="pl-4 pr-2 py-3 w-10">
                      <Checkbox checked={allOnPageChecked} onChange={toggleAllOnPage} />
                    </th>
                    <th className="px-3 py-3 w-[130px]">Imported At</th>
                    <th className="px-3 py-3">Identity</th>
                    <th className="px-3 py-3">Password</th>
                    <th className="px-3 py-3 w-[140px]">Source</th>
                    <th className="px-3 py-3 w-[80px]">Status</th>
                    <th className="px-3 py-3 w-[100px] text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c, idx) => (
                    <tr
                      key={c.id}
                      data-tour={idx === 0 ? "tour-credential-row" : undefined}
                      onClick={() => setActiveCred(c)}
                      className={cn(
                        "cursor-pointer transition-colors group",
                        selected[c.id] ? "bg-purple-500/[0.04]" : idx % 2 === 0 ? "bg-white/[0.01]" : "bg-transparent",
                        "hover:bg-purple-500/[0.05]"
                      )}
                      style={{ borderBottom: "1px solid rgba(139,92,246,0.04)" }}
                    >
                      <td
                        className="pl-4 pr-2 py-3 w-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(c.id);
                        }}
                      >
                        <Checkbox checked={!!selected[c.id]} onChange={() => toggleRow(c.id)} />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400 font-mono">{c.importedAt}</td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "text-sm text-slate-200 font-mono tracking-tight",
                            !revealedIds[c.id] && "blur-[5px] select-none"
                          )}
                        >
                          {c.identity}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "text-sm text-red-300/90 font-mono tracking-tight",
                            !revealedIds[c.id] && "blur-[5px] select-none"
                          )}
                        >
                          {c.password}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <SourceBadge source={c.source} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusDot status={c.status} />
                      </td>
                      <td className="px-3 py-3 w-[100px] text-right pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() =>
                              setRevealedIds((s) => ({ ...s, [c.id]: !s[c.id] }))
                            }
                            title={revealedIds[c.id] ? "Hide" : "Reveal"}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-purple-300 hover:bg-purple-500/10 transition-all"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                          <button
                            onClick={() => markStatus([c.id], "remediated")}
                            title="Mark Remediated"
                            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => markStatus([c.id], "ignored")}
                            title="Ignore"
                            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition-all"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}>
              <p className="text-[11px] text-slate-500">
                Page <span className="text-slate-200 font-semibold">{page}</span> of{" "}
                <span className="text-slate-200 font-semibold">{totalPages}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  if (n > totalPages) return null;
                  return (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={cn(
                        "w-8 h-8 rounded-md text-xs font-semibold transition-all",
                        n === page
                          ? "text-white btn-brand"
                          : "text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white hover:bg-white/[0.05]"
                      )}
                    >
                      {n}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Drawers & Tour */}
      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onApply={(f) => {
          setFilters(f);
          setPage(1);
        }}
        spotlightStep={tourOpen ? tourStep + 1 : 0}
      />

      <DetailsDrawer
        credential={activeCred}
        onClose={() => setActiveCred(null)}
        onMarkRemediated={(id) => {
          markStatus([id], "remediated");
          setActiveCred(null);
        }}
        onIgnore={(id) => {
          markStatus([id], "ignored");
          setActiveCred(null);
        }}
        spotlightStep={tourOpen ? tourStep + 1 : 0}
      />

      <OnboardingTour
        open={tourOpen}
        step={tourStep}
        setStep={setTourStep}
        onClose={() => {
          setTourOpen(false);
          setTourStep(0);
        }}
      />
    </div>
  );
}

// ----- inline mini components -----

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "w-4 h-4 rounded flex items-center justify-center transition-all",
        checked
          ? "bg-gradient-to-br from-purple-500 to-pink-500 border-transparent shadow-[0_0_0_1px_rgba(139,92,246,0.5)]"
          : "bg-white/[0.02] border border-white/[0.12] hover:border-purple-500/40"
      )}
      aria-checked={checked}
      role="checkbox"
    >
      {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
    </button>
  );
}

function StatCard({
  label,
  value,
  accent,
  suffix,
  spark,
}: {
  label: string;
  value: string;
  accent: "purple" | "emerald" | "blue" | "red";
  suffix?: string;
  spark?: boolean;
}) {
  const colors = {
    purple: "#a855f7",
    emerald: "#10b981",
    blue: "#3b82f6",
    red: "#ef4444",
  }[accent];
  return (
    <div className="stat-card p-4 overflow-hidden relative">
      <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">{label}</p>
      <div className="flex items-baseline gap-1 mt-2">
        <p className="text-[24px] font-bold font-mono text-white leading-none">{value}</p>
        {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
      </div>
      {spark && (
        <svg className="absolute bottom-0 right-0 w-28 h-10 opacity-60" viewBox="0 0 120 40" preserveAspectRatio="none">
          <defs>
            <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors} stopOpacity="0.5" />
              <stop offset="100%" stopColor={colors} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 30 L10 26 L20 28 L30 22 L40 24 L50 18 L60 20 L70 14 L80 16 L90 10 L100 12 L110 8 L120 10 L120 40 L0 40 Z"
            fill="url(#spark-grad)"
          />
          <path
            d="M0 30 L10 26 L20 28 L30 22 L40 24 L50 18 L60 20 L70 14 L80 16 L90 10 L100 12 L110 8 L120 10"
            stroke={colors}
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      )}
      <div
        className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ background: colors, boxShadow: `0 0 8px ${colors}` }}
      />
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    "Stealer Logs": "bg-orange-500/10 text-orange-300 border-orange-500/20",
    "Combolists": "bg-blue-500/10 text-blue-300 border-blue-500/20",
    "Data Breaches": "bg-red-500/10 text-red-300 border-red-500/20",
    "Paste Sites": "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
    "Telegram Leaks": "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  };
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wide",
        colors[source] || "bg-white/5 text-slate-300 border-white/10"
      )}
    >
      {source}
    </span>
  );
}

function StatusDot({ status }: { status: Credential["status"] }) {
  const map = {
    new: { label: "New", color: "#10b981" },
    ignored: { label: "Ignored", color: "#64748b" },
    remediated: { label: "Remediated", color: "#a855f7" },
  }[status];
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: map.color, boxShadow: `0 0 6px ${map.color}` }}
      />
      <span className="text-[11px] text-slate-400 capitalize">{map.label}</span>
    </div>
  );
}
