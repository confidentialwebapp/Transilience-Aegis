"use client";

import { useState } from "react";
import {
  X, Copy, Eye, EyeOff, ShieldCheck, ShieldAlert, Check, ExternalLink,
  Search, BarChart3, Clock, History, Tag, Activity, User2, Key,
} from "lucide-react";
import { Credential } from "./demoData";
import { cn } from "@/lib/utils";

interface Props {
  credential: Credential | null;
  onClose: () => void;
  onMarkRemediated: (id: string) => void;
  onIgnore: (id: string) => void;
  spotlightStep?: number;
}

const FAKE_EVENTS = [
  { at: "2025-05-05 14:22", actor: "Sarah Chen", action: "Credential discovered in Combolist dump #4421" },
  { at: "2025-05-05 14:31", actor: "System", action: "Auto-tagged as New — matches tenant identifier" },
  { at: "2025-05-06 09:10", actor: "Analyst Bot", action: "Password policy check: fails complexity requirement" },
];

export default function DetailsDrawer({
  credential,
  onClose,
  onMarkRemediated,
  onIgnore,
  spotlightStep = 0,
}: Props) {
  const [tab, setTab] = useState<"overview" | "events">("overview");
  const [revealPw, setRevealPw] = useState(false);
  const [revealId, setRevealId] = useState(false);
  const [urlQuery, setUrlQuery] = useState("");

  if (!credential) return null;

  const c = credential;
  const blurred = "blur-[5px] select-none";
  const verified = c.verified === "verified";

  const copy = (t: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(t).catch(() => {});
    }
  };

  const filteredUrls = c.urls.filter((u) => u.toLowerCase().includes(urlQuery.toLowerCase()));

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <aside
        className={cn(
          "fixed top-0 right-0 bottom-0 w-full max-w-[520px] z-50 flex flex-col animate-slide-in",
          spotlightStep === 5 && "glow-purple"
        )}
        style={{
          background: "linear-gradient(180deg, #120d1c 0%, #0a0712 100%)",
          borderLeft: "1px solid rgba(139,92,246,0.14)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
              <Key className="w-3.5 h-3.5 text-purple-300" />
            </div>
            <h3 className="text-[15px] font-semibold text-white truncate">Credential Details</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.04]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-3 gap-1 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
          {(["overview", "events"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium capitalize transition-all",
                tab === t ? "text-white" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {t}
              {tab === t && (
                <div
                  className="absolute left-0 right-0 bottom-[-1px] h-[2px] rounded-full"
                  style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === "overview" ? (
            <>
              {/* Status banner */}
              <div className="flex items-center gap-3 p-3 rounded-xl"
                style={{
                  background: c.status === "remediated"
                    ? "rgba(139,92,246,0.06)"
                    : c.status === "ignored"
                    ? "rgba(100,116,139,0.06)"
                    : "rgba(16,185,129,0.06)",
                  border: "1px solid " + (c.status === "remediated"
                    ? "rgba(139,92,246,0.2)"
                    : c.status === "ignored"
                    ? "rgba(100,116,139,0.2)"
                    : "rgba(16,185,129,0.2)"),
                }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/[0.03]">
                  <Activity className="w-4 h-4 text-slate-300" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Current status</p>
                  <p className="text-sm font-semibold text-white capitalize">{c.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Risk</p>
                  <p className={cn(
                    "text-sm font-bold",
                    c.riskScore >= 80 ? "text-red-400" : c.riskScore >= 60 ? "text-orange-400" : "text-yellow-400"
                  )}>{c.riskScore}/100</p>
                </div>
              </div>

              {/* Identity & Password */}
              <section>
                <h4 className="text-[11px] font-semibold text-slate-400 tracking-[0.12em] uppercase mb-3 flex items-center gap-2">
                  <User2 className="w-3 h-3" /> Identity and Password
                </h4>
                <div className="rounded-xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.06)" }}>
                  <Field label="Date">
                    <span className="text-sm text-slate-200 font-mono">{c.importedAt}</span>
                  </Field>
                  <Field label="Identity">
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className={cn(
                        "text-sm text-slate-200 font-mono truncate",
                        !revealId && blurred
                      )}>{c.identity}</span>
                      <button onClick={() => setRevealId(!revealId)} className="icon-btn">
                        {revealId ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => copy(c.identity)} className="icon-btn">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Field>
                  <Field label="Password" last>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <span className={cn(
                        "text-sm text-red-300 font-mono truncate",
                        !revealPw && blurred
                      )}>{c.password}</span>
                      <button onClick={() => setRevealPw(!revealPw)} className="icon-btn">
                        {revealPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => copy(c.password)} className="icon-btn">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Field>
                </div>
              </section>

              {/* Source */}
              <section>
                <h4 className="text-[11px] font-semibold text-slate-400 tracking-[0.12em] uppercase mb-3 flex items-center gap-2">
                  <Tag className="w-3 h-3" /> Source
                </h4>
                <div className="rounded-xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.06)" }}>
                  <Field label="Source">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {c.source}
                    </span>
                  </Field>
                  <Field label="Description">
                    <span className="text-sm text-slate-400 text-right max-w-[60%] truncate">
                      {c.description || "—"}
                    </span>
                  </Field>
                  <Field label="Leaked At">
                    <span className="text-sm text-slate-200 font-mono">{c.leakedAt || "—"}</span>
                  </Field>
                  <Field label="Breached At">
                    <span className="text-sm text-slate-200 font-mono">{c.breachedAt || "—"}</span>
                  </Field>
                  <Field label="PII Tags" last>
                    {c.piiTags && c.piiTags.length > 0 ? (
                      <div className="flex gap-1 flex-wrap justify-end">
                        {c.piiTags.map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-300 border border-orange-500/20">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-600">—</span>
                    )}
                  </Field>
                </div>
              </section>

              {/* Verify Credentials */}
              <section>
                <h4 className="text-[11px] font-semibold text-slate-400 tracking-[0.12em] uppercase mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" /> Verify Credentials
                </h4>
                <div className="rounded-xl p-4"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.06)" }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/15 to-cyan-500/15 border border-blue-500/20 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                        <rect x="1" y="1" width="14" height="14" fill="#f25022" />
                        <rect x="17" y="1" width="14" height="14" fill="#7fba00" />
                        <rect x="1" y="17" width="14" height="14" fill="#00a4ef" />
                        <rect x="17" y="17" width="14" height="14" fill="#ffb900" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-200 font-medium">Microsoft Entra ID</p>
                      <p className="text-[11px] text-slate-500">Connected identity provider</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg mb-3"
                    style={{ background: "rgba(0,0,0,0.2)" }}>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500">Credential Status</span>
                    <span className={cn(
                      "flex items-center gap-1.5 text-[12px] font-semibold",
                      verified ? "text-emerald-300" : "text-red-400"
                    )}>
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        verified ? "bg-emerald-400" : "bg-red-500 animate-pulse"
                      )} />
                      {verified ? "Verified" : "Not Verified"}
                    </span>
                  </div>

                  <button className="w-full h-10 rounded-lg text-sm font-semibold text-white btn-brand flex items-center justify-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> Verify
                  </button>
                </div>
              </section>

              {/* URLs */}
              <section>
                <h4 className="text-[11px] font-semibold text-slate-400 tracking-[0.12em] uppercase mb-3 flex items-center gap-2">
                  <ExternalLink className="w-3 h-3" /> URLs
                </h4>
                <div className="rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.06)" }}>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                    <input
                      value={urlQuery}
                      onChange={(e) => setUrlQuery(e.target.value)}
                      placeholder="Search in URLs below"
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-purple-500/20"
                    />
                  </div>
                  {filteredUrls.length > 0 ? (
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                      {filteredUrls.map((u) => (
                        <li key={u}>
                          <a
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.01] hover:bg-white/[0.03] transition-colors text-xs text-slate-400 hover:text-purple-300 border border-transparent hover:border-purple-500/10"
                          >
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{u}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <BarChart3 className="w-8 h-8 text-slate-700 mb-2" />
                      <p className="text-[11px] text-slate-600">No URL available</p>
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section>
              <h4 className="text-[11px] font-semibold text-slate-400 tracking-[0.12em] uppercase mb-3 flex items-center gap-2">
                <History className="w-3 h-3" /> Activity History
              </h4>
              <div className="relative pl-5 space-y-4">
                <div className="absolute left-[5px] top-1 bottom-1 w-[2px] bg-purple-500/15" />
                {FAKE_EVENTS.map((e, i) => (
                  <div key={i} className="relative">
                    <div
                      className="absolute -left-[18px] top-1.5 w-3 h-3 rounded-full border-2 border-[#0a0712]"
                      style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}
                    />
                    <div className="rounded-lg p-3 border border-white/[0.04] bg-white/[0.02]">
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-1">
                        <Clock className="w-3 h-3" />
                        <span className="font-mono">{e.at}</span>
                        <span>·</span>
                        <span className="text-purple-300">{e.actor}</span>
                      </div>
                      <p className="text-xs text-slate-300">{e.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center gap-2 p-4 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(139,92,246,0.08)" }}
        >
          <button
            onClick={() => onIgnore(c.id)}
            className="flex-1 h-10 rounded-lg text-sm font-medium text-slate-400 bg-white/[0.02] border border-white/[0.04] hover:text-white hover:bg-white/[0.04] transition-all flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" /> Ignore
          </button>
          <button
            onClick={() => onMarkRemediated(c.id)}
            className="flex-1 h-10 rounded-lg text-sm font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" /> Mark Remediated
          </button>
        </div>
      </aside>

      <style jsx>{`
        .icon-btn {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgb(148 163 184);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(139, 92, 246, 0.08);
          transition: all 0.15s;
        }
        .icon-btn:hover {
          color: white;
          background: rgba(139, 92, 246, 0.1);
          border-color: rgba(139, 92, 246, 0.25);
        }
      `}</style>
    </>
  );
}

function Field({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 gap-4"
      style={last ? undefined : { borderBottom: "1px solid rgba(139,92,246,0.05)" }}
    >
      <span className="text-[11px] text-slate-500 uppercase tracking-wider flex-shrink-0">{label}</span>
      <div className="flex items-center min-w-0">{children}</div>
    </div>
  );
}
