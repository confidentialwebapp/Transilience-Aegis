"use client";

import { CreditCard, Zap, Check, Crown, BadgeCheck } from "lucide-react";
import { PageHeader, KPICard, StatusPill } from "@/components/platform";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Starter",
    price: "$1,499",
    period: "month",
    features: ["Up to 3 brands", "10 monitored domains", "Basic incident workflow", "Email support"],
    current: false,
  },
  {
    name: "Professional",
    price: "$4,999",
    period: "month",
    features: ["Up to 25 brands", "Unlimited monitored domains", "Full takedown workflow", "ASM + WSS", "8×5 SOC support"],
    current: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "annual",
    features: ["Unlimited brands", "DLR + dark-web operatives", "Dedicated CSM", "24×7 SOC", "Custom integrations", "On-prem connectors"],
    current: false,
  },
];

const INVOICES = [
  { id: "INV-2026-04-001", amount: "$4,999.00", status: "PASS", date: "01 Apr 2026" },
  { id: "INV-2026-03-001", amount: "$4,999.00", status: "PASS", date: "01 Mar 2026" },
  { id: "INV-2026-02-001", amount: "$4,999.00", status: "PASS", date: "01 Feb 2026" },
  { id: "INV-2026-01-001", amount: "$4,999.00", status: "PASS", date: "01 Jan 2026" },
];

export default function SubscriptionPage() {
  return (
    <>
      <PageHeader
        title="Subscription"
        description="Plan, usage, billing history, and API limits for your Transilience tenant."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Plan" value="Professional" accent="purple" icon={Crown} />
        <KPICard label="Renewal" value="01 May 2026" accent="blue" icon={CreditCard} />
        <KPICard label="API Calls (mo)" value="48,210 / 100,000" accent="green" icon={Zap} />
        <KPICard label="Status" value="Active" accent="green" icon={BadgeCheck} />
      </div>

      <h3 className="text-[14px] font-bold text-white mb-3 mt-6">Plans</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={cn(
              "rounded-xl p-5 transition-all",
              p.current && "ring-2 ring-purple-500/50"
            )}
            style={{
              background: p.current
                ? "linear-gradient(135deg, rgba(139,92,246,0.10), rgba(236,72,153,0.05))"
                : "rgba(255,255,255,0.02)",
              border: "1px solid " + (p.current ? "rgba(139,92,246,0.40)" : "rgba(139,92,246,0.10)"),
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[16px] font-bold text-white">{p.name}</h4>
              {p.current && (
                <span className="px-2 py-0.5 text-[9.5px] font-bold rounded-full uppercase tracking-wider"
                  style={{ background: "rgba(139,92,246,0.20)", color: "#d8b4fe", border: "1px solid rgba(139,92,246,0.40)" }}>
                  Current
                </span>
              )}
            </div>
            <p className="text-[28px] font-bold text-white tabular-nums">
              {p.price}
              <span className="text-[12px] text-slate-500 font-medium">/{p.period}</span>
            </p>
            <ul className="space-y-2 mt-4">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[12px] text-slate-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              className={cn(
                "w-full mt-5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all",
                p.current ? "text-slate-500 cursor-not-allowed" : "text-white hover:opacity-90"
              )}
              style={
                p.current
                  ? { background: "rgba(255,255,255,0.04)" }
                  : { background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }
              }
              disabled={p.current}
            >
              {p.current ? "Current Plan" : "Upgrade"}
            </button>
          </div>
        ))}
      </div>

      <h3 className="text-[14px] font-bold text-white mb-3">Billing History</h3>
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
              <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Invoice</th>
              <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Date</th>
              <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
              <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {INVOICES.map((inv) => (
              <tr key={inv.id} className="border-b" style={{ borderColor: "rgba(139,92,246,0.05)" }}>
                <td className="px-4 py-3 font-mono text-purple-300">{inv.id}</td>
                <td className="px-4 py-3 text-slate-400">{inv.date}</td>
                <td className="px-4 py-3 text-right font-bold text-white tabular-nums">{inv.amount}</td>
                <td className="px-4 py-3"><StatusPill status="PASS" /></td>
                <td className="px-4 py-3 text-right">
                  <button className="text-[11px] font-semibold text-purple-300 hover:text-purple-200">Download</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
