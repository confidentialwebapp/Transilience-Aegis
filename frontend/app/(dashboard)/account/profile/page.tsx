"use client";

import { User, Mail, Phone, Briefcase, Save } from "lucide-react";
import { PageHeader } from "@/components/platform";

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        title="Profile"
        description="Personal details associated with your Transilience account. Used in audit logs, assigned cases, and email notifications."
      />
      <div className="rounded-xl p-6 max-w-3xl"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)", border: "1px solid rgba(255,255,255,0.15)" }}>
            K
          </div>
          <div>
            <p className="text-[16px] font-bold text-white">Karthik</p>
            <p className="text-[12px] text-slate-400">Analyst · Transilience</p>
          </div>
          <button className="ml-auto px-3 py-1.5 rounded-lg text-[11px] font-semibold text-purple-300 hover:text-white transition-all"
            style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.20)" }}>
            Change avatar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field icon={User} label="Full name" value="Karthik" />
          <Field icon={Briefcase} label="Job title" value="Threat Intel Analyst" />
          <Field icon={Mail} label="Email" value="fde@transilienceai.com" />
          <Field icon={Phone} label="Phone" value="+91 98765 43210" />
        </div>
        <button className="mt-6 flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
          <Save className="w-3.5 h-3.5" /> Save changes
        </button>
      </div>
    </>
  );
}

function Field({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</label>
      <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}>
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <input defaultValue={value} className="flex-1 bg-transparent border-none outline-none text-[12px] text-slate-200" />
      </div>
    </div>
  );
}
