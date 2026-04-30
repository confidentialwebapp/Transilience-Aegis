"use client";

import { useState } from "react";
import { Plus, ChevronRight, Globe, Award, AlertTriangle, FileText, Upload } from "lucide-react";
import { PageHeader, FilterSelect } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const TYPES = [
  "Phishing — Phishing site",
  "Phishing — Other",
  "Brand Abuse — Fake Website",
  "Brand Abuse — Chatroom",
  "Brand Abuse — Claim of Association",
  "Brand Abuse — Download Site",
  "Brand Abuse — Other",
  "Social Media — Instagram",
  "Social Media — Facebook",
  "Social Media — Twitter",
  "Social Media — YouTube",
  "Social Media — Telegram",
  "Social Media — Vimeo",
  "Email",
  "Executive — Whatsapp",
  "Executive — Twitter",
  "Executive — Other",
];

export default function ReportNewCasePage() {
  const [step, setStep] = useState(1);
  const [type, setType] = useState("");
  const [brand, setBrand] = useState("");
  const [url, setUrl] = useState("");
  const [severity, setSeverity] = useState("");
  const [description, setDescription] = useState("");

  return (
    <>
      <PageHeader
        title="Report New Case"
        description="Submit a new takedown or monitoring case. Provide as much context as possible — the SOC will triage within SLA."
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {["Type", "Target", "Severity", "Review"].map((label, i) => {
          const num = i + 1;
          const active = step === num;
          const done = step > num;
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all flex-shrink-0",
                  done ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" :
                    active ? "text-white" :
                    "bg-slate-800/50 text-slate-500 border border-slate-700/50"
                )}
                style={active ? { background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" } : undefined}
              >
                {num}
              </div>
              <span className={cn("text-[12px] font-semibold whitespace-nowrap", active || done ? "text-slate-200" : "text-slate-500")}>
                {label}
              </span>
              {num < 4 && <div className="flex-1 h-px" style={{ background: done ? "rgba(16,185,129,0.30)" : "rgba(139,92,246,0.10)" }} />}
            </div>
          );
        })}
      </div>

      <div
        className="rounded-xl p-6 max-w-2xl"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        {step === 1 && (
          <>
            <h3 className="text-[14px] font-bold text-white mb-4">What kind of case are you reporting?</h3>
            <FilterSelect label="Incident Type" options={TYPES} value={type} onChange={setType} />
          </>
        )}
        {step === 2 && (
          <>
            <h3 className="text-[14px] font-bold text-white mb-4">Target</h3>
            <div className="space-y-3">
              <FilterSelect icon={Award} label="Affected Brand" options={BRANDS} value={brand} onChange={setBrand} />
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}
              >
                <Globe className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Offending URL or handle"
                  className="flex-1 bg-transparent border-none outline-none text-[12px] text-slate-200 placeholder:text-slate-600"
                />
              </div>
              <button
                className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-[11.5px] font-semibold text-slate-400 hover:text-white transition-all"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(139,92,246,0.20)" }}
              >
                <Upload className="w-3.5 h-3.5" /> Attach screenshots / evidence
              </button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h3 className="text-[14px] font-bold text-white mb-4">Severity</h3>
            <FilterSelect icon={AlertTriangle} label="Severity" options={["Critical", "Substantial", "Moderate", "Low"]} value={severity} onChange={setSeverity} />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the threat — what content is on the page, evidence of capture, related cases…"
              className="w-full mt-3 px-3 py-2 rounded-lg text-[12px] text-slate-200 placeholder:text-slate-600 outline-none resize-y min-h-[120px]"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}
            />
          </>
        )}
        {step === 4 && (
          <>
            <h3 className="text-[14px] font-bold text-white mb-4">Review</h3>
            <div className="space-y-2 text-[12px]">
              <Field label="Type" value={type || "—"} />
              <Field label="Brand" value={brand || "—"} />
              <Field label="URL" value={url || "—"} />
              <Field label="Severity" value={severity || "—"} />
              <Field label="Description" value={description || "—"} />
            </div>
            <div className="mt-4 px-3 py-2 rounded-lg text-[11px] text-emerald-300"
              style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.20)" }}>
              By submitting, you confirm the case is genuine and the targets are not your own assets. Misuse will result in suspension.
            </div>
          </>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
          <button
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold text-slate-400 hover:text-white disabled:opacity-30 transition-all"
          >
            Back
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11.5px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          ) : (
            <button
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11.5px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
            >
              <Plus className="w-3 h-3" /> Submit Case
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold w-24">{label}</span>
      <span className="text-slate-200 break-all">{value}</span>
    </div>
  );
}
