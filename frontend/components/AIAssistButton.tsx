"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, X, Sparkles, Clock, DollarSign, Cpu, Check, AlertTriangle, Shield, Eye } from "lucide-react";
import { api, getOrgId, type SkillInvokeResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TriageAlertResult {
  tldr?: string;
  why_it_matters?: string;
  next_actions?: Array<{ action: string; priority: string; owner?: string }>;
  false_positive_likelihood?: "low" | "medium" | "high";
}

interface ExplainThreatActorResult {
  headline?: string;
  type?: string;
  motivation?: string;
  recent_activity?: string;
  what_to_do?: string[];
}

interface SuggestRemediationResult {
  block_now?: string[];
  investigate?: string[];
  monitor?: string[];
  false_positive_check?: string;
}

type KnownSkillResult = TriageAlertResult | ExplainThreatActorResult | SuggestRemediationResult;

// ── Helpers ────────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isTriageResult(skill: string, r: unknown): r is TriageAlertResult {
  return skill === "triage-alert" && isRecord(r);
}

function isExplainResult(skill: string, r: unknown): r is ExplainThreatActorResult {
  return skill === "explain-threat-actor" && isRecord(r);
}

function isRemediationResult(skill: string, r: unknown): r is SuggestRemediationResult {
  return skill === "suggest-remediation" && isRecord(r);
}

const FALSE_POS_COLOR: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  high: "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: "text-rose-300",
  high: "text-orange-300",
  medium: "text-amber-300",
  low: "text-emerald-300",
};

// ── Result renderers ────────────────────────────────────────────────────────────

function TriageResultView({ r }: { r: TriageAlertResult }) {
  return (
    <div className="space-y-4">
      {r.tldr && (
        <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
          <p className="text-[10px] text-purple-400 uppercase tracking-widest font-semibold mb-1.5">TL;DR</p>
          <p className="text-sm text-slate-200 leading-relaxed">{r.tldr}</p>
        </div>
      )}
      {r.why_it_matters && (
        <div className="rounded-xl p-4" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}>
          <p className="text-[10px] text-blue-400 uppercase tracking-widest font-semibold mb-1.5">Why it Matters</p>
          <p className="text-sm text-slate-300 leading-relaxed">{r.why_it_matters}</p>
        </div>
      )}
      {r.false_positive_likelihood && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">False positive likelihood:</span>
          <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide", FALSE_POS_COLOR[r.false_positive_likelihood])}>
            {r.false_positive_likelihood}
          </span>
        </div>
      )}
      {r.next_actions && r.next_actions.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">Next Actions</p>
          <div className="space-y-1.5">
            {r.next_actions.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <span className={cn("text-[11px] font-bold uppercase mt-0.5 w-14 shrink-0", PRIORITY_COLOR[a.priority?.toLowerCase()] ?? "text-slate-400")}>
                  {a.priority}
                </span>
                <p className="text-[12px] text-slate-300 flex-1">{a.action}</p>
                {a.owner && (
                  <span className="text-[10px] text-slate-500 shrink-0">{a.owner}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExplainActorResultView({ r }: { r: ExplainThreatActorResult }) {
  return (
    <div className="space-y-4">
      {r.headline && (
        <p className="text-base font-semibold text-white leading-snug">{r.headline}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {r.type && (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
            {r.type}
          </span>
        )}
        {r.motivation && (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            {r.motivation}
          </span>
        )}
      </div>
      {r.recent_activity && (
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Recent Activity</p>
          <p className="text-sm text-slate-300 leading-relaxed">{r.recent_activity}</p>
        </div>
      )}
      {r.what_to_do && r.what_to_do.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">Recommended Actions</p>
          <ul className="space-y-1.5">
            {r.what_to_do.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-[12px] text-slate-300">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RemediationResultView({ r }: { r: SuggestRemediationResult }) {
  const cols = [
    { key: "block_now" as const, label: "Block Now", icon: Shield, color: "#ef4444", bg: "rgba(239,68,68,0.05)", border: "rgba(239,68,68,0.15)" },
    { key: "investigate" as const, label: "Investigate", icon: Eye, color: "#f97316", bg: "rgba(249,115,22,0.05)", border: "rgba(249,115,22,0.15)" },
    { key: "monitor" as const, label: "Monitor", icon: AlertTriangle, color: "#eab308", bg: "rgba(234,179,8,0.05)", border: "rgba(234,179,8,0.15)" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {cols.map(({ key, label, icon: Icon, color, bg, border }) => (
          <div key={key} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: bg, border: `1px solid ${border}` }}>
            <div className="flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5" style={{ color }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
            </div>
            {(r[key] ?? []).length > 0 ? (
              <ul className="space-y-1">
                {(r[key] ?? []).map((item, i) => (
                  <li key={i} className="text-[11px] text-slate-300 leading-snug">{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] text-slate-600 italic">None</p>
            )}
          </div>
        ))}
      </div>
      {r.false_positive_check && (
        <div className="rounded-xl p-3" style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.1)" }}>
          <p className="text-[10px] text-purple-400 uppercase tracking-widest font-semibold mb-1">False Positive Check</p>
          <p className="text-[12px] text-slate-400 leading-relaxed">{r.false_positive_check}</p>
        </div>
      )}
    </div>
  );
}

function GenericResultView({ result }: { result: unknown }) {
  if (isRecord(result) && "text" in result && typeof result.text === "string") {
    return (
      <div className="prose prose-invert prose-sm max-w-none">
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{result.text}</p>
      </div>
    );
  }
  return (
    <pre className="text-[11px] text-slate-300 overflow-x-auto bg-black/20 rounded-lg p-3 leading-relaxed whitespace-pre-wrap break-words">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface AIAssistButtonProps {
  skill: string;
  params: Record<string, unknown>;
  label?: string;
  model?: string;
  className?: string;
}

export function AIAssistButton({ skill, params, label = "Ask AI", model, className }: AIAssistButtonProps) {
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [invokeResult, setInvokeResult] = useState<SkillInvokeResult | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await api.invokeSkill(getOrgId(), {
        skill,
        params,
        ...(model ? { model } : {}),
      });
      setInvokeResult(result);
      setDrawerOpen(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Skill invocation failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const skillLabel = skill.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-semibold text-white btn-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all",
          className
        )}
        aria-label={label}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {loading ? "Working…" : label}
      </button>

      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={cn(
          "fixed top-0 right-0 bottom-0 z-[61] w-full max-w-[480px] flex flex-col shadow-2xl transition-transform duration-300 ease-out",
          drawerOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{ background: "#110d1a", borderLeft: "1px solid rgba(139,92,246,0.15)" }}
        role="dialog"
        aria-modal="true"
        aria-label={`${skillLabel} result`}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(139,92,246,0.1)", background: "linear-gradient(135deg,rgba(139,92,246,0.06),rgba(236,72,153,0.03))" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.2),rgba(236,72,153,0.1))", border: "1px solid rgba(139,92,246,0.2)" }}
            >
              <Sparkles className="w-4 h-4 text-purple-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{skillLabel}</p>
              {invokeResult && (
                <p className="text-[10px] text-slate-500 truncate font-mono">{invokeResult.model}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-colors shrink-0"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            aria-label="Close AI result"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metadata strip */}
        {invokeResult && (
          <div
            className="flex items-center gap-4 px-5 py-2.5 shrink-0"
            style={{ borderBottom: "1px solid rgba(139,92,246,0.06)", background: "rgba(0,0,0,0.15)" }}
          >
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Clock className="w-3 h-3" />
              <span className="font-mono">{invokeResult.duration_ms}ms</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <DollarSign className="w-3 h-3" />
              <span className="font-mono">${invokeResult.cost_usd.toFixed(5)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Cpu className="w-3 h-3" />
              <span className="font-mono">{(invokeResult.input_tokens + invokeResult.output_tokens).toLocaleString()} tok</span>
            </div>
            {invokeResult.cached && (
              <span className="ml-auto px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                Cached
              </span>
            )}
          </div>
        )}

        {/* Body — scrollable result */}
        <div className="flex-1 overflow-y-auto px-5 py-5 animate-fade-up">
          {invokeResult ? (
            isTriageResult(invokeResult.skill, invokeResult.result) ? (
              <TriageResultView r={invokeResult.result} />
            ) : isExplainResult(invokeResult.skill, invokeResult.result) ? (
              <ExplainActorResultView r={invokeResult.result as ExplainThreatActorResult} />
            ) : isRemediationResult(invokeResult.skill, invokeResult.result) ? (
              <RemediationResultView r={invokeResult.result as SuggestRemediationResult} />
            ) : (
              <GenericResultView result={invokeResult.result} />
            )
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          )}
        </div>

        {/* Footer */}
        {invokeResult && (
          <div
            className="flex items-center justify-between px-5 py-3 shrink-0 text-[10px] text-slate-600 font-mono"
            style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}
          >
            <span>Cached: {invokeResult.cached ? "yes" : "no"}</span>
            <span>Cost: ${invokeResult.cost_usd.toFixed(5)}</span>
          </div>
        )}
      </div>
    </>
  );
}
