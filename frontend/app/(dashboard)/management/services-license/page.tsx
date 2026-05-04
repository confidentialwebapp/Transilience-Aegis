"use client";

import { useEffect, useState } from "react";
import { Package, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchServicesLicense } from "@/lib/derived";

export default function ServicesLicensePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServicesLicense().then((j) => setItems(j.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Services (Subscription & License)"
        description="Active platform services on this tenant. Each row reflects a backend module bundle that's currently licensed and operational."
      />
      <div className="grid md:grid-cols-2 gap-3">
        {loading && <p className="text-[12px] text-slate-500 italic">Loading…</p>}
        {items.map((s) => (
          <div key={s.service} className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <Package className="w-4 h-4 text-emerald-300" />
                </div>
                <div>
                  <p className="text-[13.5px] font-semibold text-white">{s.service}</p>
                  <p className="text-[11px] text-slate-500 font-mono">Renews {s.renewal}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider"
                style={{ background: "rgba(16,185,129,0.10)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.25)" }}>
                <CheckCircle2 className="w-2.5 h-2.5" />{s.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
              {Object.entries(s).filter(([k]) => !["service","status","renewal"].includes(k)).map(([k, v]) => (
                <span key={k} className="px-2 py-1 rounded-md" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)" }}>
                  <span className="text-slate-500 uppercase tracking-wider text-[9.5px] mr-1.5">{k.replace(/_/g, " ")}</span>
                  <span className="font-mono">{String(v)}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
