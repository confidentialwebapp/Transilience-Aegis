"use client";

import { InfinityLoader } from "@/components/InfinityLoader";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles, Send, Paperclip, Plus,
  MessageSquare, Trash2, Pencil, X,
  Bot, User, Brain, FileText,
  Image as ImageIcon, ChevronDown, Check, AlertCircle,
  Menu, DollarSign, Clock, Zap,
  Shield, Building2, Tag, ChevronRight
} from "lucide-react";
import { api, getOrgId, type AiConversation, type AiMessage, type AiAttachment } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Constants ──────────────────────────────────────────────────────────────────

// Model branding centralized in lib/ai-models.ts (so every page in the app
// shows the same TAIv1 / TAIv2 labels instead of leaking provider names).
import { MODELS, DEFAULT_MODEL, modelLabel as sharedModelLabel } from "@/lib/ai-models";

const MAX_ATTACHMENTS = 5;
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
const TEXT_MIMES = new Set([
  "text/plain", "text/csv", "application/json", "text/markdown",
  "text/html", "application/xml",
]);

const QUICK_PROMPTS = [
  { icon: AlertCircle, label: "Triage today's most critical alerts", color: "rose" },
  { icon: Shield, label: "Draft a threat advisory about LockBit's recent activity", color: "purple" },
  { icon: Brain, label: "What threats target healthcare in the US right now?", color: "blue" },
  { icon: Zap, label: "Compare these IOCs: 8.8.8.8, 1.1.1.1, malware.biz", color: "amber" },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getConvTitle(conv: AiConversation): string {
  return conv.title || "New conversation";
}

// Use the shared helper so every page in the app stays consistent.
const modelLabel = sharedModelLabel;

// ── Inline Markdown Renderer (~100 lines) ────────────────────────────────────

interface MarkdownProps {
  children: string;
  className?: string;
}

function Markdown({ children, className }: MarkdownProps) {
  const lines = children.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  function nextKey() {
    return key++;
  }

  function renderInline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    // Split on code, bold, italic, links
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_|\[([^\]]+)\]\(([^)]+)\))/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith("`")) {
        parts.push(<code key={nextKey()} className="px-1.5 py-0.5 rounded text-[12px] font-mono bg-purple-500/10 text-purple-200 border border-purple-500/15">{tok.slice(1, -1)}</code>);
      } else if (tok.startsWith("**") || tok.startsWith("__")) {
        parts.push(<strong key={nextKey()} className="font-semibold text-slate-100">{tok.slice(2, -2)}</strong>);
      } else if (tok.startsWith("*") || tok.startsWith("_")) {
        parts.push(<em key={nextKey()} className="italic text-slate-300">{tok.slice(1, -1)}</em>);
      } else if (tok.startsWith("[")) {
        parts.push(<a key={nextKey()} href={m[3]} target="_blank" rel="noreferrer" className="text-purple-400 underline underline-offset-2 hover:text-purple-300 transition-colors">{m[2]}</a>);
      }
      last = m.index + tok.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={nextKey()} className="my-3 rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(139,92,246,0.12)" }}>
          {lang && (
            <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: "rgba(139,92,246,0.1)", background: "rgba(139,92,246,0.06)" }}>
              <span className="text-[10px] font-mono font-semibold text-purple-400 uppercase tracking-widest">{lang}</span>
            </div>
          )}
          <pre className="px-4 py-3 text-[12px] text-slate-300 font-mono leading-relaxed overflow-x-auto whitespace-pre">
            {codeLines.join("\n")}
          </pre>
        </div>
      );
      i++;
      continue;
    }

    // Headings
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h1) {
      elements.push(<h1 key={nextKey()} className="text-lg font-bold text-white mt-4 mb-2">{renderInline(h1[1])}</h1>);
      i++; continue;
    }
    if (h2) {
      elements.push(<h2 key={nextKey()} className="text-base font-bold text-white mt-3 mb-1.5">{renderInline(h2[1])}</h2>);
      i++; continue;
    }
    if (h3) {
      elements.push(<h3 key={nextKey()} className="text-sm font-semibold text-slate-200 mt-3 mb-1">{renderInline(h3[1])}</h3>);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={nextKey()} className="pl-3 my-2 text-slate-400 text-sm italic leading-relaxed" style={{ borderLeft: "2px solid rgba(139,92,246,0.4)" }}>
          {renderInline(line.slice(2))}
        </blockquote>
      );
      i++; continue;
    }

    // Unordered list
    if (line.match(/^[-*+] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*+] /)) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={nextKey()} className="my-2 space-y-1 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "rgba(139,92,246,0.7)" }} />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      let n = 1;
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={nextKey()} className="my-2 space-y-1 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
              <span className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-purple-300 mt-0.5" style={{ background: "rgba(139,92,246,0.08)" }}>{idx + 1}</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      n;
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      elements.push(<hr key={nextKey()} className="my-3 border-none h-px" style={{ background: "rgba(139,92,246,0.12)" }} />);
      i++; continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={nextKey()} className="h-2" />);
      i++; continue;
    }

    // Paragraph
    elements.push(
      <p key={nextKey()} className="text-sm text-slate-300 leading-relaxed">{renderInline(line)}</p>
    );
    i++;
  }

  return <div className={cn("space-y-0.5", className)}>{elements}</div>;
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-purple-400"
          style={{
            animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
          }}
        />
      ))}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-5px);opacity:1} }`}</style>
    </div>
  );
}

// ── Attachment Pill ────────────────────────────────────────────────────────────

interface LocalAttachment {
  file: File;
  previewUrl: string | null;
  b64: string;
  mime: string;
  attachType: "image" | "text";
  unsupported: boolean;
}

function AttachmentThumb({ att, onRemove }: { att: LocalAttachment; onRemove: () => void }) {
  const isImg = att.attachType === "image";
  return (
    <div className="relative group inline-flex items-center gap-1.5 h-14 px-2 rounded-xl overflow-hidden shrink-0"
      style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)", maxWidth: 120 }}>
      {isImg && att.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={att.previewUrl} alt={att.file.name} className="h-10 w-10 object-cover rounded-lg" />
      ) : (
        <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(139,92,246,0.1)" }}>
          <FileText className="w-4 h-4 text-purple-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-300 truncate font-medium leading-tight">{att.file.name}</p>
        <p className="text-[9px] text-slate-500 font-mono">{humanBytes(att.file.size)}</p>
        {att.unsupported && <p className="text-[9px] text-amber-400">may not parse</p>}
      </div>
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60"
        aria-label="Remove attachment"
      >
        <X className="w-2.5 h-2.5 text-white" />
      </button>
    </div>
  );
}

// ── Message attachment display (in message thread) ───────────────────────────

function MsgAttachmentPill({ att }: { att: AiAttachment }) {
  const isImg = att.type === "image";
  const src = isImg ? `data:${att.mime};base64,${att.data_b64}` : null;
  return (
    <div className="inline-flex items-center gap-1.5 h-8 px-2 rounded-lg shrink-0"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
      {isImg && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={att.name} className="h-5 w-5 object-cover rounded" />
      ) : (
        <FileText className="w-3.5 h-3.5 text-slate-500" />
      )}
      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">{att.name}</span>
    </div>
  );
}

// ── Model Picker ───────────────────────────────────────────────────────────────

function ModelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = MODELS.find((m) => m.id === value) ?? MODELS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold text-slate-300 transition-colors"
        style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)" }}
      >
        <Brain className="w-3 h-3 text-purple-400" />
        {current.label}
        <ChevronDown className="w-3 h-3 text-slate-500" />
      </button>
      {open && (
        <div
          className="absolute bottom-full mb-2 left-0 z-50 rounded-xl overflow-hidden shadow-2xl min-w-[200px]"
          style={{ background: "#161122", border: "1px solid rgba(139,92,246,0.2)" }}
        >
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onChange(m.id); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-purple-500/10 transition-colors text-left"
            >
              <div>
                <p className="text-[12px] font-semibold text-slate-200">{m.label}</p>
                <p className="text-[10px] text-slate-500 font-mono">{m.description}</p>
              </div>
              {m.id === value && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative z-[81] rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4 animate-fade-up"
        style={{ background: "#161122", border: "1px solid rgba(139,92,246,0.2)" }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <Trash2 className="w-5 h-5 text-rose-400" />
        </div>
        <h3 className="text-sm font-bold text-white text-center mb-1">Archive conversation?</h3>
        <p className="text-[11px] text-slate-400 text-center leading-relaxed mb-5">
          Messages are preserved but hidden from your list.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 h-9 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-9 rounded-lg text-xs font-semibold text-white transition-colors"
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TransilienceAIPage() {
  // Conversations list
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);

  // Active conversation
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Input
  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  // Plain string — backend may send model ids that aren't in our local MODELS list
  // (e.g. an older haiku-4-5 vs our new id) and we should still render gracefully.
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [sending, setSending] = useState(false);

  // UI states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [convSearchQuery, setConvSearchQuery] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [hoveringConv, setHoveringConv] = useState<string | null>(null);

  // Context sidebar data
  const [orgName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("tai_org_name") || "Your Organization";
    }
    return "Your Organization";
  });

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const orgId = getOrgId();

  // ── Load conversations ───────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.listAiConversations(orgId);
      setConversations(res.data);
      return res.data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load conversations";
      toast.error(msg);
      return [];
    } finally {
      setConvsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadConversations().then((convs) => {
      if (convs.length > 0 && !activeConvId) {
        selectConversation(convs[0]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load messages for active conversation ────────────────────────────────────

  const loadMessages = useCallback(async (convId: string) => {
    setMessagesLoading(true);
    try {
      const res = await api.listAiMessages(orgId, convId);
      setMessages(res.data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load messages";
      toast.error(msg);
    } finally {
      setMessagesLoading(false);
    }
  }, [orgId]);

  // ── Scroll to bottom ─────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // ── Select conversation ──────────────────────────────────────────────────────

  const selectConversation = useCallback((conv: AiConversation) => {
    setActiveConvId(conv.id);
    setSelectedModel(conv.default_model || DEFAULT_MODEL);
    loadMessages(conv.id);
    // On mobile, close sidebar
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [loadMessages]);

  // ── Create new conversation ──────────────────────────────────────────────────

  const createConversation = async () => {
    try {
      const conv = await api.createAiConversation(orgId, { default_model: selectedModel });
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
      setMessages([]);
      setSelectedModel(conv.default_model || DEFAULT_MODEL);
      setTimeout(() => textareaRef.current?.focus(), 50);
      if (window.innerWidth < 768) setSidebarOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create conversation";
      toast.error(msg);
    }
  };

  // ── Auto-grow textarea ───────────────────────────────────────────────────────

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    const maxH = 8 * 24; // ~8 lines
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  };

  // ── File handling ────────────────────────────────────────────────────────────

  const readFileAsB64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const processFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (attachments.length + fileArr.length > MAX_ATTACHMENTS) {
      toast.error(`Max ${MAX_ATTACHMENTS} attachments per message`);
      return;
    }
    for (const file of fileArr) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} exceeds 4 MB limit`);
        continue;
      }
      const isImg = IMAGE_MIMES.has(file.type);
      const isTxt = TEXT_MIMES.has(file.type);
      const unsupported = !isImg && !isTxt;
      if (unsupported) {
        toast.warning(`${file.name}: file type may not be parsed correctly by the AI`);
      }
      const b64 = await readFileAsB64(file);
      const previewUrl = isImg ? URL.createObjectURL(file) : null;
      setAttachments((prev) => [
        ...prev,
        { file, previewUrl, b64, mime: file.type, attachType: isImg ? "image" : "text", unsupported },
      ]);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = "";
  };

  // Drag and drop
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  }, [attachments]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => {
      const next = [...prev];
      if (next[idx].previewUrl) URL.revokeObjectURL(next[idx].previewUrl!);
      next.splice(idx, 1);
      return next;
    });
  };

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = async (overrideContent?: string) => {
    const content = (overrideContent ?? inputValue).trim();
    if ((!content && attachments.length === 0) || sending) return;
    if (!activeConvId) {
      // Create a new conversation first
      try {
        const conv = await api.createAiConversation(orgId, {
          default_model: selectedModel,
          title: content.slice(0, 80),
        });
        setConversations((prev) => [conv, ...prev]);
        setActiveConvId(conv.id);
        setMessages([]);
        // now send with the new id
        await sendToConv(conv.id, content);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to create conversation";
        toast.error(msg);
      }
      return;
    }
    await sendToConv(activeConvId, content);
  };

  const sendToConv = async (convId: string, content: string) => {
    const builtAttachments: AiAttachment[] = attachments.map((a) => ({
      type: a.attachType,
      name: a.file.name,
      mime: a.mime,
      size_bytes: a.file.size,
      data_b64: a.b64,
    }));

    // Optimistic user message
    const optimisticUser: AiMessage = {
      id: `opt-${Date.now()}`,
      conversation_id: convId,
      role: "user",
      content,
      attachments: builtAttachments.length > 0 ? builtAttachments : null,
      model: null,
      input_tokens: null,
      output_tokens: null,
      cost_usd: null,
      duration_ms: null,
      cached: null,
      error: null,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUser]);
    setInputValue("");
    setAttachments([]);
    setSending(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const reply = await api.sendAiMessage(orgId, convId, {
        content,
        attachments: builtAttachments.length > 0 ? builtAttachments : undefined,
        model: selectedModel,
      });

      if (reply.ok && reply.reply) {
        const assistantMsg: AiMessage = {
          id: `local-${Date.now()}`,
          conversation_id: convId,
          role: "assistant",
          content: reply.reply,
          attachments: null,
          model: reply.model ?? null,
          input_tokens: reply.input_tokens ?? null,
          output_tokens: reply.output_tokens ?? null,
          cost_usd: reply.cost_usd ?? null,
          duration_ms: reply.duration_ms ?? null,
          cached: null,
          error: null,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else if (!reply.ok) {
        // Error message inline
        const errMsg: AiMessage = {
          id: `err-${Date.now()}`,
          conversation_id: convId,
          role: "assistant",
          content: "",
          attachments: null,
          model: reply.model ?? null,
          input_tokens: null,
          output_tokens: null,
          cost_usd: null,
          duration_ms: reply.duration_ms ?? null,
          cached: null,
          error: reply.error ?? "Unknown error",
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }

      // Refresh conversation aggregates
      const updatedConv = await api.getAiConversation(orgId, convId);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? updatedConv : c))
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send message";
      toast.error(msg);
      // Remove optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
    } finally {
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Rename conversation ──────────────────────────────────────────────────────

  const startRename = (conv: AiConversation) => {
    setRenaming(conv.id);
    setRenameValue(getConvTitle(conv));
    setTimeout(() => renameInputRef.current?.select(), 30);
  };

  const commitRename = async (id: string) => {
    const title = renameValue.trim();
    if (!title) { setRenaming(null); return; }
    try {
      const updated = await api.renameAiConversation(orgId, id, title);
      setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Rename failed";
      toast.error(msg);
    } finally {
      setRenaming(null);
    }
  };

  // Inline title rename (in header bar)
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  const startTitleEdit = () => {
    const conv = conversations.find((c) => c.id === activeConvId);
    if (!conv) return;
    setTitleValue(getConvTitle(conv));
    setTitleEditing(true);
    setTimeout(() => titleInputRef.current?.select(), 20);
  };

  const commitTitleEdit = async () => {
    setTitleEditing(false);
    if (!activeConvId || !titleValue.trim()) return;
    try {
      const updated = await api.renameAiConversation(orgId, activeConvId, titleValue.trim());
      setConversations((prev) => prev.map((c) => (c.id === activeConvId ? updated : c)));
    } catch {
      // silent — not critical
    }
  };

  // ── Delete conversation ──────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteAiConversation(orgId, deleteTarget);
      const wasActive = deleteTarget === activeConvId;
      const remaining = conversations.filter((c) => c.id !== deleteTarget);
      setConversations(remaining);
      setDeleteTarget(null);
      if (wasActive) {
        if (remaining.length > 0) {
          selectConversation(remaining[0]);
        } else {
          setActiveConvId(null);
          setMessages([]);
        }
      }
      toast.success("Conversation archived");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      toast.error(msg);
      setDeleteTarget(null);
    }
  };

  // ── Retry failed message ─────────────────────────────────────────────────────

  const retryMessage = (msg: AiMessage) => {
    const userMsg = messages[messages.indexOf(msg) - 1];
    if (!userMsg || userMsg.role !== "user") return;
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    sendToConv(msg.conversation_id, userMsg.content);
  };

  // ── Filtered conversations ────────────────────────────────────────────────────

  const filteredConvs = convSearchQuery
    ? conversations.filter((c) =>
        getConvTitle(c).toLowerCase().includes(convSearchQuery.toLowerCase())
      )
    : conversations;

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden -m-6 rounded-none">
      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
          sidebarOpen ? "w-[260px]" : "w-0 md:w-0",
          "border-r"
        )}
        style={{ background: "#0d0a14", borderColor: "rgba(139,92,246,0.08)" }}
      >
        {sidebarOpen && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(139,92,246,0.06)" }}>
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Transilience AI" width={24} height={24} className="object-contain shrink-0" draggable={false} />
                <span className="text-[13px] font-bold text-gradient-brand">Transilience AI</span>
              </div>
              <button
                onClick={createConversation}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-purple-400 hover:text-white hover:bg-purple-500/15 transition-colors"
                title="New conversation"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-2 shrink-0">
              <input
                value={convSearchQuery}
                onChange={(e) => setConvSearchQuery(e.target.value)}
                placeholder="Search conversations…"
                className="w-full h-7 px-3 rounded-lg text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-purple-500/30"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 py-1">
              {convsLoading ? (
                <div className="flex justify-center py-8">
                  <InfinityLoader size={16} />
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="py-6 text-center">
                  <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-[11px] text-slate-600">
                    {convSearchQuery ? "No matches" : "No conversations yet"}
                  </p>
                </div>
              ) : (
                filteredConvs.map((conv) => {
                  const isActive = conv.id === activeConvId;
                  const isHovered = conv.id === hoveringConv;
                  return (
                    <div
                      key={conv.id}
                      className={cn(
                        "group relative rounded-xl mb-0.5 cursor-pointer transition-all duration-150",
                        isActive
                          ? "bg-purple-500/10 border border-purple-500/20"
                          : "border border-transparent hover:bg-white/[0.03] hover:border-white/[0.04]"
                      )}
                      style={isActive ? { borderLeftColor: "rgba(139,92,246,0.5)", borderLeftWidth: 2 } : {}}
                      onMouseEnter={() => setHoveringConv(conv.id)}
                      onMouseLeave={() => setHoveringConv(null)}
                      onClick={() => { if (renaming !== conv.id) selectConversation(conv); }}
                    >
                      <div className="px-3 py-2.5">
                        {renaming === conv.id ? (
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(conv.id);
                              if (e.key === "Escape") setRenaming(null);
                            }}
                            onBlur={() => commitRename(conv.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-[12px] text-slate-200 bg-transparent border-b border-purple-500/40 outline-none pb-0.5"
                            autoFocus
                          />
                        ) : (
                          <p className={cn(
                            "text-[12px] font-medium leading-snug truncate pr-14",
                            isActive ? "text-slate-200" : "text-slate-400"
                          )}>
                            {getConvTitle(conv)}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-600 font-mono">
                            {formatRelativeTime(conv.last_message_at || conv.created_at)}
                          </span>
                          {conv.message_count > 0 && (
                            <>
                              <span className="text-slate-700">·</span>
                              <span className="text-[10px] text-slate-600 font-mono">
                                {conv.message_count} msg
                              </span>
                            </>
                          )}
                          {conv.total_cost_usd > 0 && (
                            <>
                              <span className="text-slate-700">·</span>
                              <span className="text-[10px] text-slate-600 font-mono">
                                {formatCost(conv.total_cost_usd)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Hover actions */}
                      {(isHovered || isActive) && renaming !== conv.id && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); startRename(conv); }}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
                            title="Rename"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(conv.id); }}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid rgba(139,92,246,0.05)" }}>
              <a
                href="https://www.anthropic.com/claude"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
              >
                Powered by Claude
              </a>
            </div>
          </>
        )}
      </aside>

      {/* ── CENTER PANE ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: "#07040B" }}>

        {/* Sticky top bar */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(139,92,246,0.06)", background: "rgba(13,10,20,0.8)", backdropFilter: "blur(8px)" }}
        >
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            {activeConv ? (
              titleEditing ? (
                <input
                  ref={titleInputRef}
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitTitleEdit();
                    if (e.key === "Escape") setTitleEditing(false);
                  }}
                  onBlur={commitTitleEdit}
                  className="text-sm font-semibold text-white bg-transparent border-b border-purple-500/40 outline-none w-full max-w-xs"
                  autoFocus
                />
              ) : (
                <button
                  onClick={startTitleEdit}
                  className="text-sm font-semibold text-slate-200 hover:text-white transition-colors truncate max-w-xs text-left group flex items-center gap-1"
                  title="Click to rename"
                >
                  <span className="truncate">{getConvTitle(activeConv)}</span>
                  <Pencil className="w-3 h-3 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
                </button>
              )
            ) : (
              <span className="text-sm font-semibold text-slate-500">Transilience AI</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeConv && (
              <>
                <span className="h-6 px-2 rounded-md text-[10px] font-semibold text-purple-300 flex items-center"
                  style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.15)" }}>
                  {modelLabel(activeConv.default_model)}
                </span>
                {activeConv.total_cost_usd > 0 && (
                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {formatCost(activeConv.total_cost_usd)}
                  </span>
                )}
                <button
                  onClick={() => setDeleteTarget(activeConvId!)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Message stream */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messagesLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <InfinityLoader size={24} />
              <p className="text-[12px] text-slate-600">Loading messages…</p>
            </div>
          ) : !activeConvId || messages.length === 0 ? (
            /* ── EMPTY STATE ── */
            <div className="flex flex-col items-center justify-center h-full py-12 animate-fade-up">
              <img src="/logo.png" alt="Transilience AI" width={64} height={64} className="object-contain mb-5 glow-brand" draggable={false} />
              <h2 className="text-xl font-bold text-white mb-1 text-gradient-brand">Transilience AI</h2>
              <p className="text-[13px] text-slate-500 mb-8 text-center max-w-sm leading-relaxed">
                Ask anything about your threat intel, advisories, alerts, or the broader threat landscape.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                {QUICK_PROMPTS.map(({ label, icon: Icon, color }) => (
                  <button
                    key={label}
                    onClick={() => {
                      setInputValue(label);
                      setTimeout(() => textareaRef.current?.focus(), 50);
                    }}
                    className={cn(
                      "text-left rounded-xl p-4 transition-all duration-200 group hover:scale-[1.01]",
                      "flex items-start gap-3"
                    )}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(139,92,246,0.08)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.2)";
                      (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(139,92,246,0.08)";
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                    }}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                      color === "rose" && "bg-rose-500/10 text-rose-400",
                      color === "purple" && "bg-purple-500/10 text-purple-400",
                      color === "blue" && "bg-blue-500/10 text-blue-400",
                      color === "amber" && "bg-amber-500/10 text-amber-400",
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-[12px] text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">{label}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── MESSAGE LIST ── */
            <div className="max-w-3xl mx-auto space-y-6 pb-4">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  onRetry={retryMessage}
                />
              ))}
              {sending && (
                <div className="flex items-start gap-3 animate-fade-up">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.2),rgba(236,72,153,0.1))", border: "1px solid rgba(139,92,246,0.2)" }}>
                    <Bot className="w-4 h-4 text-purple-300" />
                  </div>
                  <div className="rounded-2xl px-4 py-3"
                    style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.1)" }}>
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── INPUT AREA ── */}
        <div
          className="shrink-0 px-4 pb-4 pt-2"
          style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}
        >
          <div className="max-w-3xl mx-auto">
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((att, idx) => (
                  <AttachmentThumb key={idx} att={att} onRemove={() => removeAttachment(idx)} />
                ))}
              </div>
            )}

            {/* Main input box */}
            <div
              className={cn(
                "relative rounded-2xl transition-all duration-200",
                dragOver && "ring-2 ring-purple-500/40"
              )}
              style={{ background: "rgba(17,13,26,0.9)", border: "1px solid rgba(139,92,246,0.12)" }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              {dragOver && (
                <div className="absolute inset-0 z-10 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(139,92,246,0.08)", border: "2px dashed rgba(139,92,246,0.4)" }}>
                  <p className="text-[12px] text-purple-300 font-medium">Drop files to attach</p>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  autoGrow(e.target);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask Transilience AI anything about your threat intel…"
                disabled={sending}
                rows={1}
                className="w-full px-4 pt-3 pb-12 text-sm text-slate-200 placeholder-slate-600 bg-transparent resize-none outline-none leading-relaxed"
                style={{ minHeight: 56, maxHeight: 192 }}
              />

              {/* Bottom toolbar */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={attachments.length >= MAX_ATTACHMENTS || sending}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] disabled:opacity-40 transition-colors"
                    title="Attach files (images, text, CSV, JSON…)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <ModelPicker value={selectedModel} onChange={setSelectedModel} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-600 hidden sm:block">⌘↵ to send</span>
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={(!inputValue.trim() && attachments.length === 0) || sending}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white btn-brand disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    title="Send message"
                  >
                    {sending ? (
                      <InfinityLoader size={16} />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <p className="text-[10px] text-slate-700 text-center mt-2">
              Transilience AI may make mistakes. Verify critical threat intel independently.
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT CONTEXT SIDEBAR ── (lg+) ──────────────────────────────────── */}
      <ContextSidebar orgName={orgName} activeConvId={activeConvId} orgId={orgId} />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,.txt,.csv,.json,.md,.html,.xml,.pdf"
        onChange={onFileInputChange}
      />

      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteModal onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, onRetry }: { msg: AiMessage; onRetry: (m: AiMessage) => void }) {
  const isUser = msg.role === "user";
  const isError = !!msg.error;

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 animate-fade-up">
        <div className="flex flex-col items-end gap-1.5 max-w-[70%]">
          <div
            className="rounded-2xl rounded-tr-sm px-4 py-3"
            style={{ background: "rgba(30,24,48,0.95)", border: "1px solid rgba(139,92,246,0.12)" }}
          >
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
          </div>
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {msg.attachments.map((att, i) => (
                <MsgAttachmentPill key={i} att={att} />
              ))}
            </div>
          )}
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <User className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-fade-up">
      <img src="/logo.png" alt="Transilience AI" width={32} height={32} className="object-contain shrink-0 mt-1" draggable={false} />
      <div className="flex-1 min-w-0">
        {isError ? (
          <div className="rounded-2xl rounded-tl-sm px-4 py-3 flex items-start gap-3"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-rose-300">{msg.error}</p>
              <button
                onClick={() => onRetry(msg)}
                className="mt-2 text-[11px] text-rose-400 hover:text-rose-300 underline underline-offset-2 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="pr-2">
            <Markdown>{msg.content}</Markdown>
            {/* Meta footer */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {msg.model && (
                <span className="text-[10px] text-slate-600 font-mono flex items-center gap-1">
                  <Brain className="w-2.5 h-2.5" />
                  {modelLabel(msg.model)}
                </span>
              )}
              {msg.duration_ms != null && (
                <span className="text-[10px] text-slate-600 font-mono flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {msg.duration_ms}ms
                </span>
              )}
              {msg.cost_usd != null && msg.cost_usd > 0 && (
                <span className="text-[10px] text-slate-600 font-mono flex items-center gap-1">
                  <DollarSign className="w-2.5 h-2.5" />
                  {formatCost(msg.cost_usd)}
                </span>
              )}
              {msg.cached && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide text-emerald-400"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
                  Cached
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Context Sidebar ───────────────────────────────────────────────────────────

interface ContextSidebarProps {
  orgName: string;
  activeConvId: string | null;
  orgId: string;
}

function ContextSidebar({ orgName, activeConvId, orgId }: ContextSidebarProps) {
  const [profiles, setProfiles] = useState<Array<{ display_name: string; sectors: string[] }>>([]);
  const [alertStats, setAlertStats] = useState<Record<string, number>>({});
  const [advisoryCount, setAdvisoryCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, a, adv] = await Promise.all([
          api.listCustomerProfiles(orgId),
          api.getAlertStats(orgId),
          api.getAdvisories(orgId, { page: 1 }),
        ]);
        setProfiles(p.data.map((pr) => ({ display_name: pr.display_name, sectors: pr.sectors || [] })));
        setAlertStats(a.by_severity || {});
        setAdvisoryCount(adv.total || 0);
      } catch {
        // non-critical
      }
    };
    load();
  }, [orgId, activeConvId]);

  const severityConfig: Array<{ key: string; label: string; color: string; bg: string; border: string }> = [
    { key: "critical", label: "Critical", color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" },
    { key: "high", label: "High", color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.2)" },
    { key: "medium", label: "Medium", color: "#eab308", bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.2)" },
  ];

  return (
    <aside
      className="hidden lg:flex flex-col w-[240px] shrink-0 overflow-y-auto"
      style={{ background: "#0d0a14", borderLeft: "1px solid rgba(139,92,246,0.06)" }}
    >
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em]">What I know</span>
        </div>

        {/* Org name */}
        <div className="rounded-xl p-3 mb-3"
          style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.1)" }}>
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <p className="text-[12px] font-semibold text-slate-200 truncate">{orgName}</p>
          </div>
        </div>

        {/* Customer profiles */}
        {profiles.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-2 flex items-center gap-1">
              <Tag className="w-2.5 h-2.5" /> Watchlist profiles
            </p>
            <div className="space-y-1.5">
              {profiles.slice(0, 4).map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <ChevronRight className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400 truncate">{p.display_name}</p>
                    {p.sectors.length > 0 && (
                      <p className="text-[10px] text-slate-600 truncate">{p.sectors.slice(0, 2).join(", ")}</p>
                    )}
                  </div>
                </div>
              ))}
              {profiles.length > 4 && (
                <p className="text-[10px] text-slate-600 pl-4">+{profiles.length - 4} more</p>
              )}
            </div>
          </div>
        )}

        {/* Alert counts */}
        <div className="mb-4">
          <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-2 flex items-center gap-1">
            <AlertCircle className="w-2.5 h-2.5" /> Active alerts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {severityConfig.map(({ key, label, color, bg, border }) => {
              const count = alertStats[key] ?? 0;
              if (count === 0) return null;
              return (
                <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: bg, border: `1px solid ${border}`, color }}>
                  {count} {label}
                </span>
              );
            })}
            {Object.values(alertStats).every((v) => v === 0) && (
              <span className="text-[11px] text-slate-600">No active alerts</span>
            )}
          </div>
        </div>

        {/* Advisories */}
        {advisoryCount > 0 && (
          <div className="mb-4">
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-1.5 flex items-center gap-1">
              <FileText className="w-2.5 h-2.5" /> Advisories on file
            </p>
            <p className="text-[11px] text-slate-400">{advisoryCount} total</p>
          </div>
        )}

        {/* Divider + note */}
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}>
          <p className="text-[10px] text-slate-600 leading-relaxed">
            These data points are auto-included in every chat — Transilience AI knows your context.
          </p>
        </div>
      </div>
    </aside>
  );
}
