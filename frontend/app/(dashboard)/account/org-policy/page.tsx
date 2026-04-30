"use client";

import { useState } from "react";
import { FileLock, Shield } from "lucide-react";
import { PageHeader, Toggle, FilterSelect } from "@/components/platform";

export default function OrgPolicyPage() {
  const [prefs, setPrefs] = useState({
    requireMfa: true,
    enforceSso: false,
    blockDataExport: false,
    auditLogRetention90: true,
  });
  const toggle = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  return (
    <>
      <PageHeader
        title="Organization Policy"
        description="Tenant-wide policies that apply to every user. Editable by Admin role only."
      />

      <div className="rounded-xl p-3 mb-4 max-w-3xl flex items-center gap-3"
        style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.20)" }}>
        <Shield className="w-4 h-4 text-amber-400" />
        <p className="text-[11.5px] text-amber-200">
          Changes here apply to every user in the tenant. Audited and logged.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden max-w-3xl"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
        <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
          <FileLock className="w-3.5 h-3.5 text-purple-300" />
          <span className="text-[11px] font-bold tracking-[0.13em] uppercase text-slate-400">Security policies</span>
        </div>
        <div className="divide-y divide-purple-500/[0.05]">
          <Row title="Require 2FA for all users" description="Block sign-in until 2FA is enrolled." on={prefs.requireMfa} onChange={() => toggle("requireMfa")} />
          <Row title="Enforce SSO" description="Disable password login. SSO only via your IdP." on={prefs.enforceSso} onChange={() => toggle("enforceSso")} />
          <Row title="Block data export" description="Prevents downloading recovered records as files. API access still works under audit." on={prefs.blockDataExport} onChange={() => toggle("blockDataExport")} />
          <Row title="90-day audit log retention" description="Off → falls back to default 30-day retention." on={prefs.auditLogRetention90} onChange={() => toggle("auditLogRetention90")} />
        </div>
      </div>

      <div className="mt-4 max-w-3xl rounded-xl p-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
        <h3 className="text-[12.5px] font-bold text-white mb-3">Default user role</h3>
        <FilterSelect label="Default role for new invites" options={["Read-Only", "Analyst", "Admin"]} />
      </div>
    </>
  );
}

function Row({ title, description, on, onChange }: { title: string; description: string; on: boolean; onChange?: () => void }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1">
        <p className="text-[12.5px] font-semibold text-slate-200">{title}</p>
        <p className="text-[11px] text-slate-500">{description}</p>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}
