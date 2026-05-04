"use client";

import { useEffect, useState } from "react";
import { CreditCard, Calendar, Activity, Layers } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchSubscription } from "@/lib/derived";

export default function SubscriptionPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-[12px] text-slate-500 italic py-12 text-center">Loading…</p>;
  if (!data) return <p className="text-[12px] text-slate-500 italic py-12 text-center">Could not load subscription details.</p>;

  const seatPct = Math.round((100 * data.seat_used) / Math.max(1, data.seat_total));
  const creditPct = Math.round((100 * data.scan_credits_remaining) / Math.max(1, data.scan_credits_total));

  return (
    <>
      <PageHeader title="Plan & Billing" description="Subscription details and module entitlements for this tenant." />

      <div className="rounded-xl p-5 mb-4"
        style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.04))", border: "1px solid rgba(139,92,246,0.18)" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase">Active Plan</p>
            <h2 className="text-2xl font-semibold text-white mt-1">{data.plan}</h2>
            <p className="text-[12.5px] text-slate-400 mt-1">{data.tier}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.13em] uppercase text-slate-500">Renews</p>
            <p className="text-[14px] text-white font-semibold mt-0.5">{data.renewal_date}</p>
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full"
              style={{ background: "rgba(16,185,129,0.10)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.25)" }}>
              {data.billing_status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <Stat label="Seat Usage" value={`${data.seat_used} / ${data.seat_total}`} pct={seatPct} icon={CreditCard} />
        <Stat label="Scan Credits Left" value={`${data.scan_credits_remaining} / ${data.scan_credits_total}`} pct={creditPct} icon={Activity} />
        <Stat label="Modules Enabled" value={data.modules_enabled.length} icon={Layers} />
      </div>

      <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase mb-2">Modules Enabled</p>
        <div className="flex flex-wrap gap-1.5">
          {data.modules_enabled.map((m: string) => (
            <span key={m} className="px-2 py-1 rounded-md text-[11px] text-slate-300 font-mono"
              style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
              {m}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, pct, icon: Icon }: any) {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)" }}>
      <div className="flex items-center gap-2 mb-1.5"><Icon className="w-3.5 h-3.5 text-purple-300" />
        <p className="text-[10px] tracking-[0.13em] uppercase text-slate-500">{label}</p>
      </div>
      <p className="text-xl font-bold text-white font-mono tabular-nums">{value}</p>
      {pct !== undefined && (
        <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.1)" }}>
          <div className="h-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
        </div>
      )}
    </div>
  );
}
