"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  FileText, Loader2, Plus, Sparkles, X, Eye, Download, Search,
  Filter, ChevronDown, Trash2, Pencil, ExternalLink, Tag, AlertTriangle,
  Shield, Cpu, RefreshCw, Save, Check,
} from "lucide-react";
import { api, getOrgId } from "@/lib/api";
import type {
  Advisory, AdvisoryKind, AdvisoryStatus, AdvisoryTLP, AdvisorySeverity,
  AdvisoryCreateBody, AdvisoryGenerateBody, AdvisoryIOCs,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Constants ──────────────────────────────────────────────────────────────────

const KINDS: { value: AdvisoryKind | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "threat", label: "Threat" },
  { value: "breach", label: "Breach" },
  { value: "product", label: "Product" },
];

const STATUSES: { value: AdvisoryStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const TLP_OPTIONS: AdvisoryTLP[] = ["WHITE", "GREEN", "AMBER", "RED"];

const TLP_STYLE: Record<AdvisoryTLP, { bg: string; text: string; border: string }> = {
  WHITE:  { bg: "rgba(248,250,252,0.08)",  text: "#f8fafc", border: "rgba(248,250,252,0.2)" },
  GREEN:  { bg: "rgba(16,185,129,0.1)",    text: "#34d399",  border: "rgba(16,185,129,0.25)" },
  AMBER:  { bg: "rgba(245,158,11,0.1)",    text: "#fbbf24",  border: "rgba(245,158,11,0.25)" },
  RED:    { bg: "rgba(239,68,68,0.12)",    text: "#f87171",  border: "rgba(239,68,68,0.3)" },
};

const SEVERITY_STYLE: Record<AdvisorySeverity | "unknown", { bg: string; text: string; border: string }> = {
  critical: { bg: "rgba(239,68,68,0.12)", text: "#f87171", border: "rgba(239,68,68,0.3)" },
  high:     { bg: "rgba(249,115,22,0.1)", text: "#fb923c", border: "rgba(249,115,22,0.25)" },
  medium:   { bg: "rgba(234,179,8,0.1)",  text: "#fbbf24", border: "rgba(234,179,8,0.25)" },
  low:      { bg: "rgba(16,185,129,0.08)", text: "#34d399", border: "rgba(16,185,129,0.2)" },
  info:     { bg: "rgba(59,130,246,0.08)", text: "#60a5fa", border: "rgba(59,130,246,0.2)" },
  unknown:  { bg: "rgba(100,116,139,0.1)", text: "#94a3b8", border: "rgba(100,116,139,0.2)" },
};

const KIND_STYLE: Record<AdvisoryKind, { bg: string; text: string; border: string }> = {
  threat:  { bg: "rgba(239,68,68,0.08)",   text: "#f87171", border: "rgba(239,68,68,0.2)" },
  breach:  { bg: "rgba(236,72,153,0.08)",  text: "#f472b6", border: "rgba(236,72,153,0.2)" },
  product: { bg: "rgba(139,92,246,0.08)",  text: "#a78bfa", border: "rgba(139,92,246,0.2)" },
};

const STATUS_STYLE: Record<AdvisoryStatus, { bg: string; text: string; border: string }> = {
  draft:     { bg: "rgba(100,116,139,0.1)",  text: "#94a3b8", border: "rgba(100,116,139,0.2)" },
  published: { bg: "rgba(16,185,129,0.08)",  text: "#34d399",  border: "rgba(16,185,129,0.2)" },
  archived:  { bg: "rgba(71,85,105,0.1)",    text: "#64748b",  border: "rgba(71,85,105,0.15)" },
};

// Note: real backend model id for "TAIv2" is claude-sonnet-4-6 (not 4-5).
// Using the wrong id would 400 from Anthropic with "invalid model".
const MODEL_OPTIONS = [
  { value: "claude-haiku-4-5",   label: "TAIv1", cost: "~$0.001 / draft", description: "Fast & cheap" },
  { value: "claude-sonnet-4-6",  label: "TAIv2", cost: "~$0.008 / draft", description: "Default · Balanced" },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function iocCount(iocs: AdvisoryIOCs | null | undefined): number {
  if (!iocs) return 0;
  return Object.values(iocs).reduce((s, arr) => s + (arr?.length ?? 0), 0);
}

function isSameMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ── Pill sub-components ────────────────────────────────────────────────────────

function TLPPill({ tlp }: { tlp: AdvisoryTLP }) {
  const s = TLP_STYLE[tlp];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      TLP:{tlp}
    </span>
  );
}

function SeverityPill({ severity }: { severity: AdvisorySeverity | null | undefined }) {
  const s = SEVERITY_STYLE[severity ?? "unknown"];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      {severity ?? "unknown"}
    </span>
  );
}

function KindPill({ kind }: { kind: AdvisoryKind }) {
  const s = KIND_STYLE[kind];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold capitalize"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      {kind}
    </span>
  );
}

function StatusPill({ status }: { status: AdvisoryStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold capitalize"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

// ── Advisory card ──────────────────────────────────────────────────────────────

interface AdvisoryCardProps {
  advisory: Advisory;
  onPreview: (a: Advisory) => void;
  onEdit: (a: Advisory) => void;
  onDelete: (id: string) => void;
}

function AdvisoryCard({ advisory: a, onPreview, onEdit, onDelete }: AdvisoryCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

  const handleDownloadHtml = () => {
    const orgId = getOrgId();
    window.open(`${API_BASE}/api/v1/advisories/${a.id}/html?org_id=${orgId}`, "_blank");
  };

  const handleDownloadStix = () => {
    const orgId = getOrgId();
    window.open(`${API_BASE}/api/v1/advisories/${a.id}/stix?org_id=${orgId}`, "_blank");
  };

  return (
    <article
      className="card-enterprise p-5 cursor-pointer hover:border-purple-500/25 transition-all group"
      onClick={() => onPreview(a)}
      aria-label={`Advisory: ${a.title}`}
    >
      {/* Top row: pills */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <TLPPill tlp={a.tlp} />
        <SeverityPill severity={a.severity} />
        <KindPill kind={a.kind} />
        <StatusPill status={a.status} />
        {a.generated_by_skill && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold"
            style={{ background: "rgba(139,92,246,0.1)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.2)" }}>
            <Sparkles className="w-2.5 h-2.5" /> AI
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="text-[15px] font-bold text-white leading-snug mb-1.5 group-hover:text-purple-200 transition-colors pr-4">
        {a.title}
      </h2>

      {/* Summary */}
      {a.summary && (
        <p className="text-[12px] text-slate-400 leading-relaxed line-clamp-2 mb-3">{a.summary}</p>
      )}

      {/* Tags */}
      {a.tags && a.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {a.tags.slice(0, 6).map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-slate-500 bg-white/[0.03] border border-white/[0.06]">
              <Tag className="w-2.5 h-2.5" />{tag}
            </span>
          ))}
          {a.tags.length > 6 && (
            <span className="text-[10px] text-slate-600 self-center">+{a.tags.length - 6}</span>
          )}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between gap-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <span className="text-[10px] text-slate-600 font-mono">
          {timeAgo(a.created_at)}
          {iocCount(a.iocs) > 0 && (
            <span className="ml-3 text-orange-400/70">{iocCount(a.iocs)} IOC{iocCount(a.iocs) > 1 ? "s" : ""}</span>
          )}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <ActionBtn icon={Eye} title="Preview" onClick={() => onPreview(a)} />
          <ActionBtn icon={Download} title="Download HTML" onClick={handleDownloadHtml} />
          <ActionBtn icon={Shield} title="Export STIX 2.1" onClick={handleDownloadStix} />
          <ActionBtn icon={Pencil} title="Edit" onClick={() => onEdit(a)} />
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                className="h-7 px-2 rounded text-[10px] font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20"
                onClick={() => { onDelete(a.id); setConfirmDelete(false); }}
              >
                Confirm
              </button>
              <button
                className="h-7 px-2 rounded text-[10px] text-slate-400 hover:text-white"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <ActionBtn icon={Trash2} title="Delete" onClick={() => setConfirmDelete(true)} danger />
          )}
        </div>
      </div>
    </article>
  );
}

function ActionBtn({ icon: Icon, title, onClick, danger }: {
  icon: React.FC<{ className?: string }>;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
        danger
          ? "text-slate-600 hover:text-rose-400 hover:bg-rose-500/10"
          : "text-slate-600 hover:text-purple-300 hover:bg-purple-500/10"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

// ── Preview Modal ──────────────────────────────────────────────────────────────

function PreviewModal({ advisory, onClose, onEdit }: {
  advisory: Advisory | null;
  onClose: () => void;
  onEdit: (a: Advisory) => void;
}) {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";
  const orgId = getOrgId();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!advisory) return null;

  const iocs = advisory.iocs ?? {};
  const totalIocs = iocCount(advisory.iocs);
  const previewUrl = `${API_BASE}/api/v1/advisories/${advisory.id}/preview`;

  return (
    <div className="fixed inset-0 z-[70] flex" role="dialog" aria-modal="true" aria-label={`Preview: ${advisory.title}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex w-full max-w-[1100px] mx-auto my-4 rounded-2xl overflow-hidden shadow-2xl animate-fade-up"
        style={{ background: "#0d0a14", border: "1px solid rgba(139,92,246,0.15)" }}>

        {/* Main preview area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Title bar */}
          <div className="flex items-center gap-3 px-5 py-3 shrink-0"
            style={{ borderBottom: "1px solid rgba(139,92,246,0.1)", background: "rgba(139,92,246,0.04)" }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <TLPPill tlp={advisory.tlp} />
                <SeverityPill severity={advisory.severity} />
                <KindPill kind={advisory.kind} />
              </div>
              <h2 className="text-sm font-bold text-white mt-1 truncate">{advisory.title}</h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`${API_BASE}/api/v1/advisories/${advisory.id}/html`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-3.5 h-3.5" /> HTML
              </a>
              <a
                href={`${API_BASE}/api/v1/advisories/${advisory.id}/stix`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                <Shield className="w-3.5 h-3.5" /> STIX
              </a>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={() => { onEdit(advisory); onClose(); }}
                className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold text-white btn-brand"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* iframe */}
          <iframe
            src={`${previewUrl}?org_id=${orgId}`}
            className="flex-1 w-full"
            style={{ minHeight: "600px", border: "none", background: "#fff" }}
            title={`Preview: ${advisory.title}`}
            sandbox="allow-same-origin allow-scripts"
          />
        </div>

        {/* Side panel */}
        <div className="w-[280px] shrink-0 flex flex-col overflow-y-auto"
          style={{ borderLeft: "1px solid rgba(139,92,246,0.1)", background: "rgba(0,0,0,0.2)" }}>
          <div className="p-4 space-y-5">
            {/* Status + metadata */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">Status</p>
              <StatusPill status={advisory.status} />
            </div>

            {advisory.generated_by_skill && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">Generated by</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{ background: "rgba(139,92,246,0.1)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <Sparkles className="w-3 h-3" /> {advisory.generated_by_skill}
                </span>
              </div>
            )}

            {/* IOC summary */}
            {totalIocs > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">
                  IOC Summary <span className="text-orange-400 normal-case font-bold">({totalIocs})</span>
                </p>
                <div className="space-y-1.5">
                  {Object.entries(iocs).map(([type, vals]) => {
                    if (!vals?.length) return null;
                    return (
                      <div key={type} className="rounded-lg px-3 py-2"
                        style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
                        <p className="text-[9px] text-orange-400 uppercase tracking-widest font-bold mb-0.5">{type}</p>
                        <p className="text-[13px] font-bold text-white font-mono">{vals.length}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{vals[0]}{vals.length > 1 ? ` +${vals.length - 1}` : ""}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tags */}
            {advisory.tags && advisory.tags.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {advisory.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-[10px] text-slate-400 bg-white/[0.03] border border-white/[0.06]">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="space-y-1 text-[10px] text-slate-600 font-mono border-t border-white/[0.04] pt-3">
              <div className="flex justify-between">
                <span>Created</span>
                <span>{new Date(advisory.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated</span>
                <span>{timeAgo(advisory.updated_at)}</span>
              </div>
            </div>

            {/* Placeholder related advisories */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">Related Advisories</p>
              <div className="rounded-lg p-3 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.06)" }}>
                <p className="text-[11px] text-slate-600">Auto-linking coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Manual Create/Edit Modal ───────────────────────────────────────────────────

interface ManualModalProps {
  advisory: Advisory | null; // null = create
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_MANUAL = (): AdvisoryCreateBody => ({
  kind: "threat",
  title: "",
  summary: "",
  body_markdown: "",
  iocs: { ipv4: [], domains: [], hashes: [], cves: [] },
  tags: [],
  severity: "medium",
  tlp: "GREEN",
  status: "draft",
});

function ManualModal({ advisory, onClose, onSaved }: ManualModalProps) {
  const [form, setForm] = useState<AdvisoryCreateBody>(() => {
    if (advisory) {
      return {
        kind: advisory.kind,
        title: advisory.title,
        summary: advisory.summary ?? "",
        body_markdown: advisory.body_markdown ?? "",
        iocs: advisory.iocs ?? { ipv4: [], domains: [], hashes: [], cves: [] },
        tags: advisory.tags ?? [],
        severity: advisory.severity ?? "medium",
        tlp: advisory.tlp,
        status: advisory.status,
      };
    }
    return EMPTY_MANUAL();
  });
  const [tagsInput, setTagsInput] = useState((advisory?.tags ?? []).join(", "));
  const [iocInputs, setIocInputs] = useState({
    ipv4: (advisory?.iocs?.ipv4 ?? []).join("\n"),
    domains: (advisory?.iocs?.domains ?? []).join("\n"),
    hashes: (advisory?.iocs?.hashes ?? []).join("\n"),
    cves: (advisory?.iocs?.cves ?? []).join("\n"),
  });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const parseLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

  const handleSave = async (status: AdvisoryStatus) => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    try {
      const body: AdvisoryCreateBody = {
        ...form,
        status,
        tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
        iocs: {
          ipv4: parseLines(iocInputs.ipv4),
          domains: parseLines(iocInputs.domains),
          hashes: parseLines(iocInputs.hashes),
          cves: parseLines(iocInputs.cves),
        },
      };
      if (advisory) {
        await api.updateAdvisory(getOrgId(), advisory.id, body);
        toast.success("Advisory updated");
      } else {
        await api.createAdvisory(getOrgId(), body);
        toast.success("Advisory created");
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[760px] max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl animate-fade-up"
        style={{ background: "#0d0a14", border: "1px solid rgba(139,92,246,0.2)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(139,92,246,0.1)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.2),rgba(236,72,153,0.1))", border: "1px solid rgba(139,92,246,0.25)" }}>
              <FileText className="w-4 h-4 text-purple-300" />
            </div>
            <h2 className="text-sm font-bold text-white">{advisory ? "Edit Advisory" : "New Advisory"}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPreview(!preview)}
              className={cn("h-8 px-3 rounded-lg text-[11px] font-semibold transition-all", preview
                ? "bg-purple-500/15 text-purple-300 border border-purple-500/25"
                : "text-slate-400 bg-white/[0.03] border border-white/[0.06] hover:text-white")}>
              {preview ? "Edit" : "Preview"}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {preview ? (
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)" }}>
              <h3 className="text-lg font-bold text-white mb-2">{form.title || "Untitled"}</h3>
              {form.summary && <p className="text-sm text-slate-400 mb-4">{form.summary}</p>}
              {form.body_markdown && (
                <pre className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">{form.body_markdown}</pre>
              )}
            </div>
          ) : (
            <>
              {/* Row 1: kind + severity + TLP + status */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FormSelect label="Kind" value={form.kind} onChange={(v) => setForm({ ...form, kind: v as AdvisoryKind })}>
                  {["threat", "breach", "product"].map((k) => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
                </FormSelect>
                <FormSelect label="Severity" value={form.severity ?? "medium"} onChange={(v) => setForm({ ...form, severity: v as AdvisorySeverity })}>
                  {["critical", "high", "medium", "low", "info"].map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </FormSelect>
                <FormSelect label="TLP" value={form.tlp ?? "GREEN"} onChange={(v) => setForm({ ...form, tlp: v as AdvisoryTLP })}>
                  {TLP_OPTIONS.map((t) => <option key={t} value={t}>TLP:{t}</option>)}
                </FormSelect>
                <FormSelect label="Status" value={form.status ?? "draft"} onChange={(v) => setForm({ ...form, status: v as AdvisoryStatus })}>
                  {["draft", "published", "archived"].map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </FormSelect>
              </div>

              {/* Title */}
              <FormInput label="Title" placeholder="LockBit 4.0 — new encryption variant targeting healthcare" required
                value={form.title} onChange={(v) => setForm({ ...form, title: v })} />

              {/* Summary */}
              <FormInput label="Summary (optional)" placeholder="One-paragraph executive summary"
                value={form.summary ?? ""} onChange={(v) => setForm({ ...form, summary: v })} />

              {/* Body markdown */}
              <div>
                <label className="text-[11px] text-slate-500 mb-1.5 block font-medium">Body (Markdown)</label>
                <textarea
                  rows={6}
                  value={form.body_markdown ?? ""}
                  onChange={(e) => setForm({ ...form, body_markdown: e.target.value })}
                  placeholder="## Overview&#10;&#10;Detail the threat, TTPs, and recommendations here...&#10;&#10;## Indicators of Compromise&#10;...&#10;&#10;## Recommendations&#10;..."
                  className="w-full rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none font-mono leading-relaxed resize-none"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)", transition: "border-color 0.2s" }}
                />
              </div>

              {/* Tags */}
              <FormInput label="Tags (comma-separated)" placeholder="ransomware, healthcare, TA505"
                value={tagsInput} onChange={setTagsInput} />

              {/* IOCs */}
              <div>
                <p className="text-[11px] text-slate-500 mb-2 font-medium">IOCs (one per line)</p>
                <div className="grid grid-cols-2 gap-3">
                  <IocTextarea label="IPv4 Addresses" placeholder="192.168.1.1&#10;10.0.0.1"
                    value={iocInputs.ipv4} onChange={(v) => setIocInputs({ ...iocInputs, ipv4: v })} />
                  <IocTextarea label="Domains" placeholder="evil.com&#10;c2.bad.net"
                    value={iocInputs.domains} onChange={(v) => setIocInputs({ ...iocInputs, domains: v })} />
                  <IocTextarea label="File Hashes" placeholder="d41d8cd98f00b204e9800998ecf8427e"
                    value={iocInputs.hashes} onChange={(v) => setIocInputs({ ...iocInputs, hashes: v })} />
                  <IocTextarea label="CVEs" placeholder="CVE-2024-1234&#10;CVE-2023-9999"
                    value={iocInputs.cves} onChange={(v) => setIocInputs({ ...iocInputs, cves: v })} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid rgba(139,92,246,0.1)" }}>
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-xs font-semibold text-slate-400 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-all">
            Cancel
          </button>
          <div className="flex gap-2">
            <button onClick={() => handleSave("draft")} disabled={saving}
              className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] disabled:opacity-50 transition-all">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </button>
            <button onClick={() => handleSave("published")} disabled={saving}
              className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold text-white btn-brand disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Publish Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI Draft Modal ─────────────────────────────────────────────────────────────

interface AIDraftModalProps {
  onClose: () => void;
  onDrafted: (a: Advisory) => void;
}

function AIDraftModal({ onClose, onDrafted }: AIDraftModalProps) {
  const [kind, setKind] = useState<AdvisoryKind>("threat");
  const [topic, setTopic] = useState("");
  const [facts, setFacts] = useState("");
  const [iocInputs, setIocInputs] = useState({ ipv4: "", domains: "", hashes: "", cves: "" });
  const [model, setModel] = useState<string>(MODEL_OPTIONS[1].value);
  const [generating, setGenerating] = useState(false);

  const parseLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error("Topic required"); return; }
    setGenerating(true);
    try {
      const body: AdvisoryGenerateBody = {
        kind,
        topic: topic.trim(),
        facts: parseLines(facts),
        iocs: {
          ipv4: parseLines(iocInputs.ipv4),
          domains: parseLines(iocInputs.domains),
          hashes: parseLines(iocInputs.hashes),
          cves: parseLines(iocInputs.cves),
        },
        model,
      };
      const { advisory } = await api.generateAdvisory(getOrgId(), body);
      toast.success("Advisory drafted by AI — review and publish when ready");
      onDrafted(advisory);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !generating) onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, generating]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !generating && onClose()} />
      <div className="relative z-10 w-full max-w-[680px] max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl animate-fade-up"
        style={{ background: "#0d0a14", border: "1px solid rgba(139,92,246,0.25)" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(139,92,246,0.12)", background: "linear-gradient(135deg,rgba(139,92,246,0.06),rgba(236,72,153,0.03))" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.25),rgba(236,72,153,0.12))", border: "1px solid rgba(139,92,246,0.3)" }}>
            <Sparkles className="w-4 h-4 text-purple-300" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-white">Draft an Advisory with AI</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Provide a topic and known facts. AI will write the full advisory body.</p>
          </div>
          <button onClick={() => !generating && onClose()}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Kind + Model */}
          <div className="grid grid-cols-2 gap-3">
            <FormSelect label="Advisory Kind" value={kind} onChange={(v) => setKind(v as AdvisoryKind)}>
              {["threat", "breach", "product"].map((k) => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
            </FormSelect>
            <div>
              <label className="text-[11px] text-slate-500 mb-1.5 block font-medium">Model</label>
              <div className="grid grid-cols-2 gap-2">
                {MODEL_OPTIONS.map((m) => (
                  <button key={m.value} onClick={() => setModel(m.value)}
                    className={cn("p-2.5 rounded-xl text-left border transition-all", model === m.value
                      ? "bg-purple-500/10 border-purple-500/30"
                      : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]")}>
                    <p className={cn("text-[12px] font-bold", model === m.value ? "text-purple-300" : "text-slate-300")}>{m.label}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">{m.cost}</p>
                    <p className="text-[9px] text-slate-600">{m.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Topic */}
          <div>
            <label className="text-[11px] text-slate-500 mb-1.5 block font-medium">Topic <span className="text-rose-400">*</span></label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 'LockBit 4.0 ransomware variant targeting healthcare providers in North America'"
              className="w-full h-10 px-4 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.15)", transition: "border-color 0.2s" }}
            />
          </div>

          {/* Known facts */}
          <div>
            <label className="text-[11px] text-slate-500 mb-1.5 block font-medium">Known Facts (one per line)</label>
            <textarea
              rows={4}
              value={facts}
              onChange={(e) => setFacts(e.target.value)}
              placeholder={"First reported 2024-11-15 by Sophos X-Ops\nTargets ESXi hypervisors with CVE-2024-XXXX\nRansom demands averaging $2.4M"}
              className="w-full rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)" }}
            />
          </div>

          {/* IOCs */}
          <div>
            <p className="text-[11px] text-slate-500 mb-2 font-medium">Known IOCs (one per line, optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <IocTextarea label="IPv4 Addresses" placeholder={"192.0.2.1"} value={iocInputs.ipv4} onChange={(v) => setIocInputs({ ...iocInputs, ipv4: v })} />
              <IocTextarea label="Domains" placeholder={"c2.evil.com"} value={iocInputs.domains} onChange={(v) => setIocInputs({ ...iocInputs, domains: v })} />
              <IocTextarea label="File Hashes" placeholder={"abc123..."} value={iocInputs.hashes} onChange={(v) => setIocInputs({ ...iocInputs, hashes: v })} />
              <IocTextarea label="CVEs" placeholder={"CVE-2024-XXXX"} value={iocInputs.cves} onChange={(v) => setIocInputs({ ...iocInputs, cves: v })} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid rgba(139,92,246,0.1)" }}>
          <button onClick={() => !generating && onClose()}
            disabled={generating}
            className="h-9 px-4 rounded-lg text-xs font-semibold text-slate-400 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] disabled:opacity-40 transition-all">
            Cancel
          </button>
          <button onClick={handleGenerate} disabled={generating || !topic.trim()}
            className="h-9 px-5 rounded-lg flex items-center gap-2 text-xs font-semibold text-white btn-brand disabled:opacity-50">
            {generating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate Draft
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Form primitives ────────────────────────────────────────────────────────────

function FormInput({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] text-slate-500 mb-1.5 block font-medium">
        {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-10 px-4 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)", transition: "border-color 0.2s" }} />
    </div>
  );
}

function FormSelect({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] text-slate-500 mb-1.5 block font-medium">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 px-4 pr-8 rounded-xl text-sm text-slate-200 focus:outline-none appearance-none cursor-pointer"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)" }}>
          {children}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
      </div>
    </div>
  );
}

function IocTextarea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-slate-500 mb-1 block uppercase tracking-wider font-semibold">{label}</label>
      <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl px-3 py-2 text-[11px] font-mono text-slate-300 placeholder-slate-600 focus:outline-none resize-none"
        style={{ background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.12)" }} />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdvisoriesPage() {
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [kindFilter, setKindFilter] = useState<AdvisoryKind | "">("");
  const [statusFilter, setStatusFilter] = useState<AdvisoryStatus | "">("");
  const [tlpFilter, setTlpFilter] = useState<AdvisoryTLP | "">("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Modals
  const [previewAdvisory, setPreviewAdvisory] = useState<Advisory | null>(null);
  const [editAdvisory, setEditAdvisory] = useState<Advisory | null | undefined>(undefined); // undefined = closed, null = new
  const [showAIDraft, setShowAIDraft] = useState(false);

  // Stats
  const published = advisories.filter((a) => a.status === "published" && isSameMonth(a.created_at)).length;
  const drafts = advisories.filter((a) => a.status === "draft").length;

  // Kind counts for chips
  const kindCounts = {
    threat: advisories.filter((a) => a.kind === "threat").length,
    breach: advisories.filter((a) => a.kind === "breach").length,
    product: advisories.filter((a) => a.kind === "product").length,
  };

  const load = useCallback(async (resetPage = false) => {
    setLoading(true);
    try {
      const p = resetPage ? 1 : page;
      if (resetPage) setPage(1);
      const res = await api.getAdvisories(getOrgId(), {
        kind: kindFilter || undefined,
        status: statusFilter || undefined,
        page: p,
      });
      setAdvisories(res.data);
      setTotal(res.total);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Load failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [kindFilter, statusFilter, page]);

  useEffect(() => { load(true); }, [kindFilter, statusFilter]);
  useEffect(() => { load(); }, [page]);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAdvisory(getOrgId(), id);
      toast.success("Advisory deleted");
      load(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      toast.error(msg);
    }
  };

  const handleDrafted = (a: Advisory) => {
    load(true);
    setPreviewAdvisory(a);
  };

  // Client-side search filter (title/summary/body)
  const filtered = search
    ? advisories.filter((a) =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        (a.summary ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (a.body_markdown ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : advisories;

  // Apply TLP filter client-side
  const displayed = tlpFilter
    ? filtered.filter((a) => a.tlp === tlpFilter)
    : filtered;

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (v: string) => {
    setSearchInput(v);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearch(v), 300);
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(236,72,153,0.08))", border: "1px solid rgba(139,92,246,0.2)" }}>
            <FileText className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Advisories</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Categorized threat, breach, and product advisories. Preview, export STIX/HTML, drop into MISP/OpenCTI.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={loading}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-white disabled:opacity-40 transition-all"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            title="Refresh">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
          <button onClick={() => setShowAIDraft(true)}
            className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)", border: "none", boxShadow: "0 0 20px rgba(139,92,246,0.25)" }}>
            <Sparkles className="w-3.5 h-3.5" />
            AI Draft
          </button>
          <button onClick={() => setEditAdvisory(null)}
            className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold text-white btn-brand">
            <Plus className="w-3.5 h-3.5" />
            New Advisory
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Total Advisories</p>
          <p className="text-[26px] font-bold font-mono text-white leading-none mt-2">{total}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Published This Month</p>
          <p className="text-[26px] font-bold font-mono text-emerald-300 leading-none mt-2">{published}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Drafts Pending Review</p>
          <p className="text-[26px] font-bold font-mono text-amber-300 leading-none mt-2">{drafts}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card-enterprise p-4 space-y-3">
        {/* Kind chips */}
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map((k) => {
            const count = k.value === "" ? advisories.length : kindCounts[k.value as AdvisoryKind] ?? 0;
            const active = kindFilter === k.value;
            return (
              <button key={k.value} onClick={() => setKindFilter(k.value as AdvisoryKind | "")}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5",
                  active
                    ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                    : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200")}>
                {k.label}
                <span className={cn("px-1.5 py-0.5 rounded-full text-[9px] font-bold", active ? "bg-purple-500/20 text-purple-300" : "bg-white/[0.05] text-slate-500")}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* Separator */}
          <div className="h-5 w-px bg-white/[0.06] mx-1" />

          {/* Status tabs */}
          {STATUSES.map((s) => (
            <button key={s.value} onClick={() => setStatusFilter(s.value as AdvisoryStatus | "")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all relative",
                statusFilter === s.value
                  ? "bg-white/[0.06] border-white/[0.12] text-white"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-300")}>
              {s.label}
              {statusFilter === s.value && (
                <div className="absolute left-1 right-1 bottom-0 h-[2px] rounded-full"
                  style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
              )}
            </button>
          ))}

          {/* TLP dropdown */}
          <div className="relative ml-auto">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
              <select value={tlpFilter} onChange={(e) => setTlpFilter(e.target.value as AdvisoryTLP | "")}
                className="h-8 pl-8 pr-8 rounded-lg text-[11px] font-semibold text-slate-400 focus:outline-none appearance-none cursor-pointer"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <option value="">All TLP</option>
                {TLP_OPTIONS.map((t) => <option key={t} value={t}>TLP:{t}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search advisories — title, summary, body…"
            className="w-full h-10 pl-10 pr-4 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)", transition: "border-color 0.2s" }}
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(""); setSearch(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading && displayed.length === 0 ? (
        <div className="card-enterprise p-10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState
          onNewAdvisory={() => setEditAdvisory(null)}
          onAIDraft={() => setShowAIDraft(true)}
          hasFilters={!!(kindFilter || statusFilter || tlpFilter || search)}
          onClear={() => { setKindFilter(""); setStatusFilter(""); setTlpFilter(""); setSearch(""); setSearchInput(""); }}
        />
      ) : (
        <div className="space-y-3">
          {displayed.map((a) => (
            <AdvisoryCard
              key={a.id}
              advisory={a}
              onPreview={setPreviewAdvisory}
              onEdit={(adv) => setEditAdvisory(adv)}
              onDelete={handleDelete}
            />
          ))}

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-slate-500 font-mono">
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                  className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-400 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] disabled:opacity-40 transition-all">
                  Previous
                </button>
                <button disabled={page * 20 >= total} onClick={() => setPage(page + 1)}
                  className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-400 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] disabled:opacity-40 transition-all">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {previewAdvisory && (
        <PreviewModal
          advisory={previewAdvisory}
          onClose={() => setPreviewAdvisory(null)}
          onEdit={(a) => { setEditAdvisory(a); setPreviewAdvisory(null); }}
        />
      )}
      {editAdvisory !== undefined && (
        <ManualModal
          advisory={editAdvisory}
          onClose={() => setEditAdvisory(undefined)}
          onSaved={() => load(true)}
        />
      )}
      {showAIDraft && (
        <AIDraftModal
          onClose={() => setShowAIDraft(false)}
          onDrafted={handleDrafted}
        />
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ onNewAdvisory, onAIDraft, hasFilters, onClear }: {
  onNewAdvisory: () => void;
  onAIDraft: () => void;
  hasFilters: boolean;
  onClear: () => void;
}) {
  const orbitItems = [
    { label: "TLP:RED",   angle: 0,   color: "#ef4444" },
    { label: "Threat",    angle: 60,  color: "#f87171" },
    { label: "STIX 2.1", angle: 120, color: "#a78bfa" },
    { label: "Breach",   angle: 180, color: "#f472b6" },
    { label: "Product",  angle: 240, color: "#60a5fa" },
    { label: "AI Draft", angle: 300, color: "#34d399" },
  ];

  return (
    <div className="card-enterprise p-10 flex flex-col items-center text-center animate-fade-up">
      <div className="relative w-32 h-32 mb-6">
        <div className="absolute inset-0 rounded-full opacity-10 animate-ping"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.5), transparent 70%)" }} />
        {orbitItems.map(({ label, angle, color }) => {
          const rad = (angle * Math.PI) / 180;
          const x = 50 + 42 * Math.cos(rad);
          const y = 50 + 42 * Math.sin(rad);
          return (
            <div key={angle}
              className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded"
              style={{ left: `${x}%`, top: `${y}%`, background: `${color}15`, border: `1px solid ${color}30`, fontSize: "8px", fontWeight: 700, color, whiteSpace: "nowrap" }}>
              {label}
            </div>
          );
        })}
        <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.18),rgba(236,72,153,0.1))", border: "1px solid rgba(139,92,246,0.25)" }}>
          <FileText className="w-7 h-7 text-purple-300" />
        </div>
      </div>

      {hasFilters ? (
        <>
          <h2 className="text-xl font-bold text-white tracking-tight">No advisories match your filters</h2>
          <p className="text-[13px] text-slate-400 mt-2 max-w-xs leading-relaxed">Try adjusting the kind, status, or TLP filters above.</p>
          <button onClick={onClear}
            className="mt-5 h-9 px-5 rounded-lg flex items-center gap-2 text-sm font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-all">
            <X className="w-4 h-4" /> Clear filters
          </button>
        </>
      ) : (
        <>
          <h2 className="text-xl font-bold text-white tracking-tight">Publish your first advisory</h2>
          <p className="text-[13px] text-slate-400 mt-2 max-w-sm leading-relaxed">
            Draft threat, breach, and product advisories. Export as{" "}
            <span className="text-purple-300 font-semibold">STIX 2.1</span> or{" "}
            <span className="text-blue-300 font-semibold">styled HTML</span> for MISP, OpenCTI, or email distribution.
          </p>
          <div className="flex flex-wrap gap-3 mt-6 justify-center">
            <button onClick={onAIDraft}
              className="h-9 px-5 rounded-lg flex items-center gap-2 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)", boxShadow: "0 0 20px rgba(139,92,246,0.2)" }}>
              <Sparkles className="w-4 h-4" /> Let AI draft one
            </button>
            <button onClick={onNewAdvisory}
              className="h-9 px-5 rounded-lg flex items-center gap-2 text-sm font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-all">
              <Plus className="w-4 h-4" /> Write manually
            </button>
          </div>
          <div className="mt-7 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px" style={{ background: "rgba(139,92,246,0.08)" }} />
              <span className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">Capabilities</span>
              <div className="flex-1 h-px" style={{ background: "rgba(139,92,246,0.08)" }} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-left">
              {[
                { icon: Sparkles, color: "#a78bfa", text: "AI-drafted from a topic + known facts" },
                { icon: Shield, color: "#60a5fa", text: "STIX 2.1 export for threat sharing platforms" },
                { icon: Eye, color: "#34d399", text: "Styled HTML preview and download" },
                { icon: AlertTriangle, color: "#fbbf24", text: "TLP classifications — WHITE to RED" },
                { icon: Tag, color: "#f472b6", text: "IOC lists: IPs, domains, hashes, CVEs" },
                { icon: Cpu, color: "#f97316", text: "TAIv1 or TAIv2 model selection" },
              ].map(({ icon: Icon, color, text }) => (
                <div key={text} className="flex items-start gap-2">
                  <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color }} />
                  <span className="text-[11px] text-slate-500 leading-snug">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
