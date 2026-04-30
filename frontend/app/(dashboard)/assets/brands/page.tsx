"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { genBrands } from "@/lib/mock-data";

export default function BrandsAssetsPage() {
  const brands = genBrands();
  return (
    <>
      <PageHeader
        title="Brands"
        description="The roster of brands monitored across the Transilience platform. Each brand has its own takedown rules, severity calibration, and reporting view."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Plus className="w-3 h-3" /> Add Brand
          </button>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {brands.map((b) => (
          <Link
            key={b.name}
            href={`/asm/whitelist`}
            className="rounded-xl p-4 transition-all hover:border-purple-500/30"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white"
                style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
              >
                {b.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-slate-200 truncate">{b.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{b.country}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-purple-500/[0.08]">
              <span className="text-[10px] text-slate-500">Added {b.added}</span>
              {b.monitoring ? (
                <span className="text-[10px] font-bold text-emerald-400 tracking-wider">MONITORED</span>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 tracking-wider">PAUSED</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
