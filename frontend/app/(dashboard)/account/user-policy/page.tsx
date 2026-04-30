"use client";

import { useState } from "react";
import { UserCog } from "lucide-react";
import { PageHeader, Toggle } from "@/components/platform";

export default function UserPolicyPage() {
  const [prefs, setPrefs] = useState({
    showCriticalToasts: true,
    showSubstantialToasts: true,
    showModerateToasts: false,
    soundOnCritical: true,
    autoOpenAssistant: false,
    keepFiltersAcrossPages: true,
  });

  const toggle = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const ROWS: { key: keyof typeof prefs; title: string; description: string }[] = [
    { key: "showCriticalToasts", title: "Critical alerts toast", description: "Show in-app toasts for incoming Critical-severity alerts." },
    { key: "showSubstantialToasts", title: "Substantial alerts toast", description: "Show in-app toasts for Substantial-severity alerts." },
    { key: "showModerateToasts", title: "Moderate alerts toast", description: "Disabled by default — keeps the inbox quieter." },
    { key: "soundOnCritical", title: "Sound on Critical", description: "Play a short alert tone when a Critical alert arrives." },
    { key: "autoOpenAssistant", title: "Auto-open Assistant", description: "Open the AI Assistant dock when a new Critical alert lands." },
    { key: "keepFiltersAcrossPages", title: "Persistent filters", description: "Carry filters between modules where keys overlap." },
  ];

  return (
    <>
      <PageHeader
        title="User Based Policy"
        description="Personal preferences that override organisational defaults — alerts, sound, AI dock behaviour, and filter memory."
      />
      <div className="rounded-xl overflow-hidden max-w-3xl"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
        <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
          <UserCog className="w-3.5 h-3.5 text-purple-300" />
          <span className="text-[11px] font-bold tracking-[0.13em] uppercase text-slate-400">User preferences</span>
        </div>
        <div className="divide-y divide-purple-500/[0.05]">
          {ROWS.map((r) => (
            <div key={r.key} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-slate-200">{r.title}</p>
                <p className="text-[11px] text-slate-500">{r.description}</p>
              </div>
              <Toggle on={prefs[r.key]} onChange={() => toggle(r.key)} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
