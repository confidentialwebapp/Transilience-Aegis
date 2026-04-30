"use client";

import { useState } from "react";
import { Lock, Check, X } from "lucide-react";
import { PageHeader } from "@/components/platform";

export default function ResetPasswordPage() {
  const [pw, setPw] = useState("");
  const checks = [
    { label: "At least 12 characters", pass: pw.length >= 12 },
    { label: "Contains a number", pass: /\d/.test(pw) },
    { label: "Contains a symbol", pass: /[^A-Za-z0-9]/.test(pw) },
    { label: "Mixed case", pass: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
  ];

  return (
    <>
      <PageHeader
        title="Reset Password"
        description="Choose a strong, unique password. Transilience uses bcrypt with a high cost factor and never stores your password in plaintext."
      />
      <div className="rounded-xl p-5 max-w-lg"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
        <PwField label="Current password" />
        <PwField label="New password" value={pw} onChange={setPw} />
        <PwField label="Confirm new password" />
        <div className="mt-3 space-y-1">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-[11px]">
              {c.pass ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <X className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span className={c.pass ? "text-emerald-300" : "text-slate-500"}>{c.label}</span>
            </div>
          ))}
        </div>
        <button className="mt-5 w-full px-3 py-2 rounded-lg text-[12px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
          Update password
        </button>
      </div>
    </>
  );
}

function PwField({ label, value, onChange }: { label: string; value?: string; onChange?: (v: string) => void }) {
  return (
    <div className="mb-3">
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</label>
      <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <Lock className="w-3.5 h-3.5 text-slate-500" />
        <input
          type="password"
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-[12px] text-slate-200"
        />
      </div>
    </div>
  );
}
