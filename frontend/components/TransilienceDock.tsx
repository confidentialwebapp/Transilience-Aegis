"use client";

/**
 * TransilienceDock — global slide-over chat surface.
 *
 * Mounted once in app/(dashboard)/layout.tsx, available on every authenticated
 * page. Reuses the same /api/v1/transilience-ai backend as /transilience-ai
 * so a "quick ask" from the dock and a long-form conversation on the workspace
 * page write into the same DB and history.
 *
 * Open it from anywhere with:
 *   window.dispatchEvent(new CustomEvent("tai:open", {
 *     detail: { prompt?: string; autoSend?: boolean }
 *   }))
 *
 * Or with the global Cmd/Ctrl+J hotkey (Cmd+K is already the CommandPalette).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, Send, X, Brain,
  ChevronDown, Check, Maximize2, AlertCircle,
  Plus
} from "lucide-react";
import Link from "next/link";
import { api, getOrgId, type AiMessage } from "@/lib/api";
import { InfinityLoader } from "@/components/InfinityLoader";
import { MODELS, DEFAULT_MODEL, modelLabel as sharedModelLabel } from "@/lib/ai-models";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DOCK_CONV_KEY = "tai_dock_conv_id";

const QUICK_PROMPTS = [
  "Triage today's most critical alerts",
  "What's new on the dark web in the last 24h?",
  "Draft an exec summary of this week's threat landscape",
  "Compare these IOCs: 8.8.8.8, 1.1.1.1",
] as const;

// ── Minimal inline markdown ──────────────────────────────────────────────────
// Just enough to render code, bold, italics, links, lists. Trades fidelity for
// bundle size — the workspace page at /transilience-ai has the full renderer.

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      parts.push(<code key={key++} className="px-1.5 py-0.5 rounded text-[12px] font-mono bg-purple-500/10 text-purple-200 border border-purple-500/15">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**")) {
      parts.push(<strong key={key++} className="font-semibold text-slate-100">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("*")) {
      parts.push(<em key={key++} className="italic text-slate-300">{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("[")) {
      parts.push(<a key={key++} href={m[3]} target="_blank" rel="noreferrer" className="text-purple-400 underline underline-offset-2 hover:text-purple-300">{m[2]}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MiniMarkdown({ children }: { children: string }) {
  const lines = children.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      out.push(
        <pre key={key++} className="my-2 px-3 py-2 rounded-lg text-[11.5px] text-slate-300 font-mono leading-relaxed overflow-x-auto"
             style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(139,92,246,0.12)" }}>
          {codeLines.join("\n")}
        </pre>
      );
      i++;
      continue;
    }
    if (line.match(/^### /)) {
      out.push(<h3 key={key++} className="text-[13px] font-semibold text-slate-100 mt-2 mb-1">{renderInline(line.slice(4))}</h3>);
      i++; continue;
    }
    if (line.match(/^## /)) {
      out.push(<h2 key={key++} className="text-sm font-bold text-white mt-2 mb-1">{renderInline(line.slice(3))}</h2>);
      i++; continue;
    }
    if (line.match(/^[-*+] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*+] /)) {
        items.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <ul key={key++} className="my-1.5 space-y-1">
          {items.map((it, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[13px] text-slate-300 leading-relaxed">
              <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: "rgba(139,92,246,0.7)" }} />
              <span>{renderInline(it)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }
    if (line.trim() === "") { out.push(<div key={key++} className="h-1.5" />); i++; continue; }
    out.push(<p key={key++} className="text-[13px] text-slate-300 leading-relaxed">{renderInline(line)}</p>);
    i++;
  }
  return <div className="space-y-0.5">{out}</div>;
}

// ── Model picker ─────────────────────────────────────────────────────────────

function ModelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const current = MODELS.find((m) => m.id === value) ?? MODELS[0];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-7 px-2 rounded-lg text-[11px] font-semibold text-slate-300"
        style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)" }}
      >
        <Brain className="w-3 h-3 text-purple-400" />
        {current.label}
        <ChevronDown className="w-3 h-3 text-slate-500" />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-50 rounded-xl overflow-hidden shadow-2xl min-w-[200px]"
             style={{ background: "#161122", border: "1px solid rgba(139,92,246,0.2)" }}>
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onChange(m.id); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-purple-500/10 transition-colors text-left"
            >
              <div>
                <p className="text-[12px] font-semibold text-slate-200">{m.label}</p>
                <p className="text-[10px] text-slate-500 font-mono">{m.cost_hint}</p>
              </div>
              {m.id === value && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Typing indicator (brand infinity loader) ─────────────────────────────────

function TypingDots() {
  return (
    <div className="py-0.5">
      <InfinityLoader size={18} />
    </div>
  );
}

// ── Main Dock ────────────────────────────────────────────────────────────────

export function TransilienceDock() {
  const [open, setOpen] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [model, setModel] = useState<string>(DEFAULT_MODEL);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const orgId = typeof window !== "undefined" ? getOrgId() : "";

  // ── Restore persisted conv id ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const cached = localStorage.getItem(DOCK_CONV_KEY);
      if (cached) setConvId(cached);
    } catch {}
  }, []);

  // ── Load messages when dock opens (if we have a conv) ──────────────────────
  const loadMessages = useCallback(async (id: string) => {
    setLoadingMessages(true);
    try {
      const res = await api.listAiMessages(orgId, id);
      setMessages(res.data);
    } catch {
      // conv may have been deleted — clear it and start fresh
      try { localStorage.removeItem(DOCK_CONV_KEY); } catch {}
      setConvId(null);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (open && convId && messages.length === 0) {
      loadMessages(convId);
    }
  }, [open, convId, loadMessages, messages.length]);

  // ── Auto-scroll on new messages ────────────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, open]);

  // ── Focus input when opened ────────────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const send = useCallback(async (overrideContent?: string) => {
    const content = (overrideContent ?? input).trim();
    if (!content || sending) return;

    let activeId = convId;
    if (!activeId) {
      try {
        const conv = await api.createAiConversation(orgId, {
          default_model: model,
          title: content.slice(0, 80),
        });
        activeId = conv.id;
        setConvId(activeId);
        try { localStorage.setItem(DOCK_CONV_KEY, activeId); } catch {}
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to start conversation");
        return;
      }
    }

    const optimistic: AiMessage = {
      id: `opt-${Date.now()}`,
      conversation_id: activeId,
      role: "user",
      content,
      attachments: null,
      model: null,
      input_tokens: null,
      output_tokens: null,
      cost_usd: null,
      duration_ms: null,
      cached: null,
      error: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setSending(true);

    try {
      const reply = await api.sendAiMessage(orgId, activeId, { content, model });
      if (reply.ok && reply.reply) {
        setMessages((prev) => [...prev, {
          id: `local-${Date.now()}`,
          conversation_id: activeId!,
          role: "assistant",
          content: reply.reply!,
          attachments: null,
          model: reply.model ?? null,
          input_tokens: reply.input_tokens ?? null,
          output_tokens: reply.output_tokens ?? null,
          cost_usd: reply.cost_usd ?? null,
          duration_ms: reply.duration_ms ?? null,
          cached: null,
          error: null,
          created_at: new Date().toISOString(),
        }]);
      } else {
        setMessages((prev) => [...prev, {
          id: `err-${Date.now()}`,
          conversation_id: activeId!,
          role: "assistant",
          content: "",
          attachments: null,
          model: reply.model ?? null,
          input_tokens: null, output_tokens: null, cost_usd: null,
          duration_ms: reply.duration_ms ?? null, cached: null,
          error: reply.error ?? "Unknown error",
          created_at: new Date().toISOString(),
        }]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, sending, convId, orgId, model]);

  // ── Listen for global open events ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ prompt?: string; autoSend?: boolean }>).detail || {};
      setOpen(true);
      if (detail.prompt) {
        setInput(detail.prompt);
        if (detail.autoSend) {
          // small delay so the open animation starts first
          setTimeout(() => send(detail.prompt), 120);
        } else {
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }
    };
    window.addEventListener("tai:open", handler);
    return () => window.removeEventListener("tai:open", handler);
  }, [send]);

  // ── Global hotkey: Cmd/Ctrl + J (Cmd+K is the CommandPalette) ──────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  // ── Reset to fresh conversation ────────────────────────────────────────────
  const startFresh = () => {
    try { localStorage.removeItem(DOCK_CONV_KEY); } catch {}
    setConvId(null);
    setMessages([]);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 6 * 22) + "px";
  };

  return (
    <>
      {/* Floating launcher (always visible when dock closed) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask Transilience AI (⌘J)"
          title="Ask Transilience AI · ⌘J"
          className="group fixed bottom-6 right-6 z-[60] flex items-center gap-2 h-12 px-4 rounded-full shadow-2xl transition-all hover:scale-105"
          style={{
            background: "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)",
            boxShadow: "0 10px 40px -10px rgba(139,92,246,0.6)",
          }}
        >
          <Sparkles className="w-4 h-4 text-white" />
          <span className="text-[12px] font-bold text-white tracking-wide">Ask AI</span>
          <kbd className="hidden md:inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded text-[10px] font-mono font-semibold text-white/80 bg-white/15">⌘J</kbd>
        </button>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-over panel */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-[71] h-full w-full md:w-[480px] flex flex-col transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        style={{
          background: "linear-gradient(180deg, #0f0a1c 0%, #0a0613 100%)",
          borderLeft: "1px solid rgba(139,92,246,0.18)",
          boxShadow: "-20px 0 60px -10px rgba(0,0,0,0.6)",
        }}
        aria-hidden={!open}
      >
        {/* Header */}
        <header className="flex items-center gap-2 h-14 px-4 border-b shrink-0"
                style={{ borderColor: "rgba(139,92,246,0.15)" }}>
          <img src="/logo.png" alt="Transilience AI" width={32} height={32} className="object-contain shrink-0" draggable={false} />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white leading-tight">Transilience AI</h2>
            <p className="text-[10px] text-slate-500 font-mono">Quick ask · context-aware</p>
          </div>
          <button
            onClick={startFresh}
            title="New conversation"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <Link
            href="/transilience-ai"
            title="Open full workspace"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setOpen(false)}
            title="Close (Esc)"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loadingMessages && (
            <div className="flex items-center justify-center py-8">
              <InfinityLoader size={20} />
            </div>
          )}

          {!loadingMessages && messages.length === 0 && (
            <div className="pt-6">
              <div className="text-center mb-6">
                <div className="inline-flex w-12 h-12 rounded-2xl items-center justify-center mb-3"
                     style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(236,72,153,0.2))",
                              border: "1px solid rgba(139,92,246,0.25)" }}>
                  <Brain className="w-6 h-6 text-purple-300" />
                </div>
                <h3 className="text-base font-bold text-white">Your threat intel analyst</h3>
                <p className="text-[12px] text-slate-400 mt-1 max-w-[300px] mx-auto leading-relaxed">
                  Ask about alerts, actors, CVEs, exposures — answers use your live org data.
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-1 mb-2">Try asking</p>
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-[12.5px] text-slate-300 hover:text-white transition-colors"
                    style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)" }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <img src="/logo.png" alt="Transilience AI" width={28} height={28} className="object-contain shrink-0" draggable={false} />
              )}
              <div className={cn(
                "max-w-[78%] rounded-2xl px-3.5 py-2.5",
                m.role === "user"
                  ? "rounded-tr-sm text-slate-100"
                  : "rounded-tl-sm text-slate-200"
              )}
                   style={{
                     background: m.role === "user"
                       ? "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(236,72,153,0.18))"
                       : "rgba(255,255,255,0.03)",
                     border: m.role === "user"
                       ? "1px solid rgba(139,92,246,0.25)"
                       : "1px solid rgba(255,255,255,0.06)",
                   }}>
                {m.error ? (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                    <p className="text-[12.5px] text-rose-300 leading-relaxed">{m.error}</p>
                  </div>
                ) : m.role === "assistant" ? (
                  <MiniMarkdown>{m.content}</MiniMarkdown>
                ) : (
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                )}
                {m.role === "assistant" && m.model && !m.error && (
                  <p className="mt-2 text-[10px] text-slate-500 font-mono">
                    {sharedModelLabel(m.model)}
                    {typeof m.duration_ms === "number" && ` · ${(m.duration_ms / 1000).toFixed(1)}s`}
                    {typeof m.cost_usd === "number" && m.cost_usd > 0 && ` · $${m.cost_usd.toFixed(4)}`}
                  </p>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-2.5 justify-start">
              <img src="/logo.png" alt="Transilience AI" width={28} height={28} className="object-contain shrink-0" draggable={false} />
              <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5"
                   style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div className="border-t px-3 py-3 shrink-0" style={{ borderColor: "rgba(139,92,246,0.15)" }}>
          <div className="rounded-2xl p-2"
               style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.18)" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoGrow(e.target); }}
              onKeyDown={onKey}
              placeholder="Ask anything…"
              rows={1}
              className="w-full resize-none bg-transparent outline-none text-[13.5px] text-slate-100 placeholder:text-slate-500 px-2 py-1.5"
              style={{ minHeight: 36, maxHeight: 132 }}
              disabled={sending}
            />
            <div className="flex items-center gap-2 px-1 pt-1">
              <ModelPicker value={model} onChange={setModel} />
              <span className="text-[10px] text-slate-500 font-mono ml-auto hidden md:inline">⌘↵ to send</span>
              <button
                onClick={() => send()}
                disabled={!input.trim() || sending}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: input.trim() && !sending
                    ? "linear-gradient(135deg, #7c3aed, #ec4899)"
                    : "rgba(255,255,255,0.05)",
                }}
              >
                {sending
                  ? <InfinityLoader size={14} />
                  : <Send className="w-3.5 h-3.5 text-white" />}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
