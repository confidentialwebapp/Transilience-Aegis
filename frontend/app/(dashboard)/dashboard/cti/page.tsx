"use client";

import Link from "next/link";
import { Radio, Bug, Shield, Wifi, Skull, Brain, ChevronRight } from "lucide-react";
import { PageHeader, KPICard } from "@/components/platform";
import { MonthlyLineChart } from "@/components/platform/ReportChart";

const FEEDS = [
  { href: "/cti/ioc-feed", label: "IOC Feed", count: "4,350,667", icon: Radio },
  { href: "/cti/cves", label: "CVEs", count: "330,162", icon: Bug },
  { href: "/cti/malware", label: "Malware", count: "823,294", icon: Shield },
  { href: "/cti/tor-nodes", label: "TOR Nodes", count: "2,346", icon: Wifi },
  { href: "/cti/threat-actors", label: "Threat Actors", count: "7,166", icon: Skull },
  { href: "/cti/advisory", label: "Advisories", count: "10,149", icon: Brain },
];

export default function CtiDashboard() {
  return (
    <>
      <PageHeader
        title="Cyber Threat Intelligence Dashboard"
        description="Feed health and indicator volumes across all Transilience intelligence streams."
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {FEEDS.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="rounded-xl px-4 py-3 flex flex-col gap-1 transition-all hover:border-purple-500/30 group"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-1"
              style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.20)" }}
            >
              <f.icon className="w-4 h-4 text-purple-300" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{f.label}</p>
            <p className="text-[18px] font-bold text-white tabular-nums">{f.count}</p>
            <p className="text-[10px] text-purple-300 group-hover:text-purple-200 mt-1 flex items-center gap-1">
              Open <ChevronRight className="w-3 h-3" />
            </p>
          </Link>
        ))}
      </div>
      <MonthlyLineChart
        title="Indicator volume — last 12 months"
        series={[
          { name: "Indicators", data: [3.2, 3.4, 3.6, 3.7, 3.9, 4.0, 4.1, 4.15, 4.2, 4.28, 4.35], color: "#a855f7" },
        ]}
        yMax={5}
      />
    </>
  );
}
