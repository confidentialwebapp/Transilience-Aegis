"use client";

import { useEffect, useState } from "react";
import { Users, Shield } from "lucide-react";
import { PageHeader } from "@/components/platform";
import { fetchClientUsers } from "@/lib/derived";

export default function ClientUsersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientUsers().then((j) => { setItems(j.items || []); setNote(j.note || ""); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Client Users"
        description="User accounts on this CreditAccessGrameen tenant — sourced from Supabase Auth. Every row is a real authenticated identity; not synthesised."
      />
      {items.length === 0 && note && (
        <div className="px-3 py-3 mb-3 rounded-lg text-[11.5px] text-slate-400" style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.15)" }}>
          {note}
        </div>
      )}
      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(139,92,246,0.03)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <table className="w-full text-[12.5px]">
          <thead style={{ background: "rgba(139,92,246,0.05)" }}>
            <tr className="text-left text-[10px] font-semibold tracking-[0.1em] uppercase text-slate-500">
              <th className="px-3 py-2.5">Email</th>
              <th className="px-3 py-2.5">Role</th>
              <th className="px-3 py-2.5">Client</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">2FA</th>
              <th className="px-3 py-2.5">Last Sign In</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No users yet — invite via Supabase Auth.</td></tr>
            ) : items.map((u) => (
              <tr key={u.id} className="border-t border-purple-500/[0.06] hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 text-slate-200 font-mono"><Users className="w-3 h-3 inline mr-1.5 text-purple-300" />{u.email}</td>
                <td className="px-3 py-2.5 text-slate-400">{u.role}</td>
                <td className="px-3 py-2.5 text-slate-400">{u.client}</td>
                <td className="px-3 py-2.5">
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded uppercase"
                    style={{ background: u.status === "ACTIVE" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: u.status === "ACTIVE" ? "#6ee7b7" : "#fca5a5" }}>
                    {u.status}
                  </span>
                </td>
                <td className="px-3 py-2.5">{u.twoFactor ? <Shield className="w-3.5 h-3.5 text-emerald-400" /> : <span className="text-[10px] text-slate-600">off</span>}</td>
                <td className="px-3 py-2.5 text-slate-500 text-[11px] font-mono">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
