"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchApiInfo } from "@/lib/derived";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

export default function ThreatIntelApiPage() {
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [version, setVersion] = useState("v1");

  useEffect(() => {
    fetchApiInfo().then((j) => { setEndpoints(j.endpoints || []); setVersion(j.version || "v1"); }).catch(() => {});
  }, []);

  return (
    <>
      <PageHeader
        title={`Threat Intel API (${version})`}
        description="Self-describing JSON API for every dashboard data source. Integrate this into your SIEM, SOAR, or own tooling — every endpoint accepts the X-Org-Id header and returns JSON."
      />

      <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.15)" }}>
        <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase mb-2">Base URL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[12px] text-slate-200 font-mono px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.35)" }}>
            {API_BASE}
          </code>
          <button onClick={() => navigator.clipboard.writeText(API_BASE)} className="px-2 py-2 rounded-lg text-slate-300 hover:text-white"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}>
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <table className="w-full text-[12.5px]">
          <thead style={{ background: "rgba(139,92,246,0.05)" }}>
            <tr className="text-left text-[10px] font-semibold tracking-[0.1em] uppercase text-slate-500">
              <th className="px-3 py-2.5">Method</th>
              <th className="px-3 py-2.5">Path</th>
              <th className="px-3 py-2.5">Description</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((e, i) => (
              <tr key={i} className="border-t border-purple-500/[0.06] hover:bg-white/[0.02]">
                <td className="px-3 py-2.5">
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider"
                    style={{
                      background: e.method === "POST" ? "rgba(249,115,22,0.15)" : "rgba(59,130,246,0.12)",
                      color: e.method === "POST" ? "#fdba74" : "#93c5fd",
                    }}>{e.method}</span>
                </td>
                <td className="px-3 py-2.5 text-purple-300 font-mono text-[11.5px]">{e.path}</td>
                <td className="px-3 py-2.5 text-slate-400">{e.desc}</td>
                <td className="px-3 py-2.5">
                  <button onClick={() => navigator.clipboard.writeText(`${API_BASE}${e.path}`)} className="text-slate-500 hover:text-purple-300">
                    <Copy className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <p className="text-[10px] font-semibold tracking-[0.13em] text-purple-300 uppercase mb-2">Example: list High-severity findings</p>
        <pre className="text-[11.5px] text-slate-200 font-mono px-3 py-2 rounded-lg overflow-x-auto" style={{ background: "rgba(0,0,0,0.35)" }}>{`curl -H "X-Org-Id: 00000000-0000-0000-0000-000000000001" \\
  "${API_BASE}/api/v1/findings?severity=Critical,High&limit=50"`}</pre>
      </div>
    </>
  );
}
