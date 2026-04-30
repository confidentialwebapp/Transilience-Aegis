"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ShieldAlert, Lock, ArrowLeft } from "lucide-react";
import { useAdminCheck, setAdminCache } from "@/lib/admin";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading, email } = useAdminCheck();

  useEffect(() => {
    if (!loading) setAdminCache(isAdmin);
  }, [loading, isAdmin]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 max-w-3xl">
        <div className="h-8 w-48 rounded-md animate-pulse" style={{ background: "rgba(139,92,246,0.10)" }} />
        <div className="h-32 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }} />
        <div className="h-64 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        className="max-w-2xl mx-auto rounded-2xl p-8 text-center"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(239,68,68,0.20)" }}
      >
        <div
          className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.30)" }}
        >
          <Lock className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="text-[20px] font-bold text-white mb-2">Access Denied</h1>
        <p className="text-[12.5px] text-slate-400 max-w-md mx-auto leading-relaxed">
          The admin console is restricted to authorised operators. If you believe you should have
          access, ask your workspace owner to add{" "}
          <span className="text-purple-300 font-mono">{email ?? "your account"}</span> to the admin
          allowlist.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 mt-6 px-4 py-2 rounded-lg text-[12px] font-semibold text-white transition-all"
          style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg mb-4 w-fit"
        style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}
      >
        <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
        <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-red-300">Admin Console</span>
        <span className="text-[10px] text-slate-500">·</span>
        <span className="text-[10.5px] text-slate-400">{email}</span>
      </div>
      {children}
    </div>
  );
}
