"use client";

import { Shield, Smartphone, Key, Check } from "lucide-react";
import { PageHeader, StatusPill } from "@/components/platform";

const METHODS = [
  { name: "Authenticator app", description: "TOTP via Google Authenticator, 1Password, Authy, etc.", enabled: true, icon: Smartphone },
  { name: "Hardware key", description: "WebAuthn / FIDO2 — YubiKey, Titan, Solo.", enabled: false, icon: Key },
  { name: "SMS one-time code", description: "Fallback only. Not recommended due to SIM-swap risk.", enabled: false, icon: Smartphone },
];

export default function TwoFactorPage() {
  return (
    <>
      <PageHeader
        title="Two-Factor Authentication"
        description="Strengthen your sign-in with a second factor. Required for Admin role; recommended for all users."
      />
      <div className="rounded-xl p-5 mb-4 flex items-center gap-3"
        style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.20)" }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.30)" }}>
          <Shield className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-bold text-emerald-300">2FA is enabled</p>
          <p className="text-[11.5px] text-emerald-400/80">Authenticator app verified on 12 Mar 2026.</p>
        </div>
        <StatusPill status="ACTIVE" />
      </div>

      <div className="space-y-2 max-w-3xl">
        {METHODS.map((m) => (
          <div key={m.name} className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.20)" }}>
              <m.icon className="w-5 h-5 text-purple-300" />
            </div>
            <div className="flex-1">
              <p className="text-[12.5px] font-semibold text-slate-200">{m.name}</p>
              <p className="text-[11px] text-slate-500">{m.description}</p>
            </div>
            {m.enabled ? (
              <button className="text-[11.5px] font-semibold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.20)" }}>
                Disable
              </button>
            ) : (
              <button className="text-[11.5px] font-semibold text-white px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
                Enable
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 rounded-xl max-w-3xl"
        style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.10)" }}>
        <h3 className="text-[12.5px] font-bold text-white mb-2">Recovery codes</h3>
        <p className="text-[11.5px] text-slate-400 mb-3">
          Generate single-use backup codes to access your account if you lose your second factor.
        </p>
        <button className="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold text-purple-300 hover:text-white transition-all"
          style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.20)" }}>
          <Check className="w-3 h-3 inline mr-1" /> Generate new codes
        </button>
      </div>
    </>
  );
}
