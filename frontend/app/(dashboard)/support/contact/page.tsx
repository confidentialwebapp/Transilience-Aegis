"use client";

import { useState } from "react";
import { Mail, Phone, MessageSquare, Building2, Send, Clock } from "lucide-react";
import { PageHeader, FilterInput, FilterSelect } from "@/components/platform";

export default function ContactPage() {
  const [topic, setTopic] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  return (
    <>
      <PageHeader
        title="Contact Us"
        description="Reach the Transilience SOC, customer success, sales, and partnership teams. Critical incidents — call the 24×7 line."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="rounded-xl p-5"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
          <h3 className="text-[14px] font-bold text-white mb-4">Send a message</h3>
          <div className="space-y-3">
            <FilterSelect label="Topic" options={["Incident escalation", "Account / billing", "Feature request", "Bug report", "Security disclosure", "Other"]} value={topic} onChange={setTopic} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FilterInput placeholder="Your name" value={name} onChange={setName} />
              <FilterInput icon={Mail} placeholder="you@example.com" value={email} onChange={setEmail} />
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What can we help with?"
              className="w-full px-3 py-2 rounded-lg text-[12px] text-slate-200 placeholder:text-slate-600 outline-none resize-y min-h-[140px]"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}
            />
            <button
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
            >
              <Send className="w-3.5 h-3.5" /> Send message
            </button>
          </div>
        </div>

        <aside className="space-y-3">
          <Tile icon={Phone} title="24×7 SOC hotline" value="+1 (415) 555-0199" subtitle="Critical incidents only" accent="#ef4444" />
          <Tile icon={Mail} title="Customer Success" value="success@transilience.ai" subtitle="Onboarding & adoption" accent="#a855f7" />
          <Tile icon={MessageSquare} title="Live chat" value="Open chat" subtitle="Mon–Fri, 9–18 UTC" accent="#3b82f6" />
          <Tile icon={Building2} title="Headquarters" value="Bengaluru, India" subtitle="Mon–Fri, 9:30–18:30 IST" accent="#10b981" />
          <Tile icon={Clock} title="Status page" value="status.transilience.ai" subtitle="Live incident & maintenance feed" accent="#f59e0b" />
        </aside>
      </div>
    </>
  );
}

function Tile({ icon: Icon, title, value, subtitle, accent }: { icon: React.ComponentType<{ className?: string }>; title: string; value: string; subtitle: string; accent: string }) {
  return (
    <div className="rounded-xl p-3.5 flex items-start gap-3"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}1A`, border: `1px solid ${accent}33` }}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{title}</p>
        <p className="text-[12.5px] font-bold text-slate-200 mt-0.5 break-all">{value}</p>
        <p className="text-[10.5px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}
