"use client";

import { useMemo, useState } from "react";
import { Globe, Hash, ChevronRight, Eye } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, Pagination, TagPill } from "@/components/platform";
import { genAdvisories, type AdvisoryRow } from "@/lib/mock-data";

const FACETS = {
  Categories: [
    ["Extortion and Threats", 3],
    ["Cyber Espionage", 6],
    ["Defacement", 489],
    ["Hacking", 289],
    ["Cyber Attack Announcement", 116],
    ["Exploit & Vulnerability", 273],
    ["Trojan/Virus/Malware/Spyware", 18],
    ["DDOS", 637],
    ["SQL Injection", 18],
    ["0-Day", 33],
    ["Remote Access Trojan", 4],
    ["Stealer Malware", 4],
    ["XSS", 1],
    ["Webshell", 6],
    ["Network Access", 203],
    ["Others", 1996],
  ],
  Industry: [
    ["Banking and Finance", 1328],
    ["Insurance", 413],
    ["Telecommunication", 593],
    ["Health", 762],
    ["Real Estate", 421],
    ["Airline", 426],
    ["Manufacturing", 601],
    ["Gaming", 400],
    ["Retail", 765],
    ["Information Technology", 972],
    ["Others", 6812],
  ],
  Region: [
    ["UK", 1291],
    ["US", 2292],
    ["Europe", 1308],
    ["North America", 960],
    ["South America", 922],
    ["Africa", 856],
    ["Middle East", 1764],
    ["Central Asia", 753],
    ["China", 755],
    ["South Asia", 3672],
    ["Australia", 966],
    ["Asia", 1398],
    ["Others", 2763],
  ],
} as const;

export default function CyberIntelAdvisoryPage() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const total = 10149;
  const rows = useMemo<AdvisoryRow[]>(
    () => genAdvisories(pageSize, (page - 1) * pageSize),
    [page]
  );

  return (
    <>
      <PageHeader
        title="Cyber Intel Advisory"
        description="Recently identified threats and dark web intel across the globe with potential impact on your industry, region, and brand portfolio."
      />

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterInput icon={Hash} placeholder="Keyword" />
          <FilterInput icon={Globe} placeholder="Region" />
          <FilterInput icon={Hash} placeholder="Date (YYYY-MM-DD)" />
        </div>
      </FilterCard>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Main feed */}
        <div className="space-y-3">
          {rows.map((adv) => (
            <article
              key={adv.id}
              className="rounded-xl p-4 transition-all hover:border-purple-500/30 group"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
            >
              <div className="flex gap-4">
                <div
                  className="w-32 h-20 rounded-lg flex-shrink-0 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.10))", border: "1px solid rgba(139,92,246,0.20)" }}
                >
                  <Eye className="w-6 h-6 text-purple-300/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TagPill label={adv.category} />
                    <TagPill label={adv.industry} />
                    <TagPill label={adv.region} />
                  </div>
                  <h3 className="text-[14px] font-semibold text-white mt-1.5 group-hover:text-purple-200 transition-colors">
                    {adv.title}
                  </h3>
                  <p className="text-[10.5px] text-slate-500 mt-1 font-mono">
                    {adv.date} | {adv.time}
                  </p>
                  <p className="text-[11.5px] text-slate-400 mt-1.5 leading-relaxed">{adv.summary}</p>
                  <button className="text-[11px] text-purple-300 hover:text-purple-200 font-semibold mt-1.5 inline-flex items-center gap-1">
                    read more <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </article>
          ))}

          <div
            className="flex items-center justify-between px-4 py-2.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.10)" }}
          >
            <span className="text-[11px] text-slate-500">
              Showing <span className="text-slate-300 font-medium">{(page - 1) * pageSize + 1}</span> to{" "}
              <span className="text-slate-300 font-medium">{Math.min(page * pageSize, total)}</span> of{" "}
              <span className="text-slate-300 font-medium">{total.toLocaleString()}</span> entries
            </span>
            <Pagination page={page} totalPages={Math.ceil(total / pageSize)} onChange={setPage} />
          </div>
        </div>

        {/* Facets sidebar */}
        <aside className="space-y-3">
          {(Object.entries(FACETS) as [string, readonly (readonly [string, number])[]][]).map(([title, items]) => (
            <div
              key={title}
              className="rounded-xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
            >
              <div className="px-3 py-2 border-b" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
                <span className="text-[10px] font-bold tracking-[0.13em] uppercase text-slate-400">{title}</span>
              </div>
              <div className="max-h-[260px] overflow-y-auto sidebar-scroll">
                {items.map(([label, count]) => (
                  <button
                    key={label}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[11.5px] text-slate-400 hover:text-white hover:bg-white/[0.03] transition-all text-left"
                  >
                    <span className="truncate">{label}</span>
                    <span className="text-[10.5px] font-mono text-slate-500 tabular-nums shrink-0 ml-2">({count})</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
