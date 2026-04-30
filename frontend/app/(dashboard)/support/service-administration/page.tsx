"use client";

import { Wrench, Zap, Shield, Bell, KeyRound, Globe } from "lucide-react";
import { PageHeader, KPICard, StatusPill } from "@/components/platform";

const SERVICES = [
  { name: "Ingest Pipeline", state: "ACTIVE", uptime: "99.99%", region: "us-east-1" },
  { name: "TAXII Feed Server", state: "ACTIVE", uptime: "99.97%", region: "us-east-1" },
  { name: "Threat Intel API", state: "ACTIVE", uptime: "99.98%", region: "global" },
  { name: "DLR Operatives Workspace", state: "ACTIVE", uptime: "99.92%", region: "eu-west-1" },
  { name: "DMARC Aggregator", state: "ACTIVE", uptime: "99.95%", region: "us-east-1" },
  { name: "WSS Scanner Fleet", state: "ACTIVE", uptime: "99.91%", region: "global" },
];

export default function ServiceAdministrationPage() {
  return (
    <>
      <PageHeader
        title="Service Administration"
        description="Live status of platform services, scheduled maintenance, and operational windows."
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="All systems" value="Operational" accent="green" icon={Shield} />
        <KPICard label="Open incidents" value={0} accent="green" icon={Bell} />
        <KPICard label="Active services" value={SERVICES.length} accent="purple" icon={Zap} />
        <KPICard label="Last maintenance" value="14d ago" accent="slate" icon={Wrench} />
      </div>

      <div className="rounded-xl overflow-hidden mb-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
        <div className="px-4 py-2.5 border-b" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
          <h3 className="text-[12px] font-bold text-white tracking-tight">Service status</h3>
        </div>
        <div className="divide-y divide-purple-500/[0.05]">
          {SERVICES.map((s) => (
            <div key={s.name} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[12.5px] font-semibold text-slate-200">{s.name}</span>
                <span className="text-[10px] text-slate-500 font-mono px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.10)" }}>
                  {s.region}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-emerald-400 tabular-nums">{s.uptime}</span>
                <StatusPill status="ACTIVE" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl p-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
          <h3 className="text-[12px] font-bold text-white mb-3">Upcoming maintenance</h3>
          <div className="space-y-2">
            {[
              { date: "12 May 2026 02:00 UTC", desc: "TAXII server rolling restart — no downtime expected." },
              { date: "20 May 2026 14:00 UTC", desc: "Sandbox cluster scale-up. Brief detonation queue delays." },
            ].map((m) => (
              <div key={m.date} className="flex gap-3 px-3 py-2 rounded-lg"
                style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)" }}>
                <Wrench className="w-3.5 h-3.5 text-purple-300 mt-0.5 flex-shrink-0" />
                <div className="text-[11.5px]">
                  <p className="font-semibold text-purple-200">{m.date}</p>
                  <p className="text-slate-400">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
          <h3 className="text-[12px] font-bold text-white mb-3">Quick admin links</h3>
          <ul className="space-y-1.5 text-[12px]">
            <li>
              <a className="flex items-center gap-2 text-slate-300 hover:text-white" href="/management/client-users">
                <KeyRound className="w-3.5 h-3.5" /> Manage user access
              </a>
            </li>
            <li>
              <a className="flex items-center gap-2 text-slate-300 hover:text-white" href="/management/subscription">
                <Globe className="w-3.5 h-3.5" /> Subscription & API keys
              </a>
            </li>
            <li>
              <a className="flex items-center gap-2 text-slate-300 hover:text-white" href="/account/org-policy">
                <Shield className="w-3.5 h-3.5" /> Organization policy
              </a>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
