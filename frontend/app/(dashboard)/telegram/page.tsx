"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Loader2, RefreshCw, Search, Hash, Users, ExternalLink } from "lucide-react";
import { api, getOrgId, type TelegramChannel, type TelegramMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function TelegramPage() {
  const [channels, setChannels] = useState<TelegramChannel[]>([]);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [chatFilter, setChatFilter] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [hasIocs, setHasIocs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [total, setTotal] = useState(0);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, m] = await Promise.all([
        api.listTelegramChannels(getOrgId()),
        api.listTelegramMessages(getOrgId(), {
          chat_id: chatFilter ?? undefined,
          q: search || undefined,
          has_iocs: hasIocs,
          page: 1,
        }),
      ]);
      setChannels(c.data);
      setMessages(m.data);
      setTotal(m.total);
    } catch (e: any) {
      toast.error(e?.message ?? "failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [chatFilter, hasIocs]);

  const handlePoll = async () => {
    setPolling(true);
    try {
      const r = await api.pollTelegram(getOrgId());
      toast.success(`Processed ${r.updates_processed} new updates`);
      loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? "poll failed");
    } finally {
      setPolling(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(56,189,248,0.15),rgba(99,102,241,0.1))", border: "1px solid rgba(56,189,248,0.2)" }}>
            <MessageSquare className="w-5 h-5 text-sky-300" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Telegram Bot Monitor</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">@aegisdarkwebbot · IOC extraction from chats the bot is added to</p>
          </div>
        </div>
        <button
          onClick={handlePoll}
          disabled={polling}
          className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold text-white btn-brand disabled:opacity-40"
        >
          {polling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Poll now
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Channels</p>
          <p className="text-[26px] font-bold font-mono text-white leading-none mt-2">{channels.length}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Messages</p>
          <p className="text-[26px] font-bold font-mono text-sky-300 leading-none mt-2">{total.toLocaleString()}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Last Refresh</p>
          <p className="text-[12px] text-slate-400 font-mono mt-2">{loading ? "loading…" : new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Channels */}
      <div className="card-enterprise p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-sky-300" />
          <span className="text-xs text-slate-400 font-semibold">Channels the bot is in</span>
        </div>
        {channels.length === 0 ? (
          <div className="text-[12px] text-slate-500 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            <p>No channels yet. Add <span className="font-mono text-sky-300">@aegisdarkwebbot</span> to a Telegram group or channel and grant it message-reading permission.</p>
            <p className="mt-2 text-slate-600">For groups: open chat → add member → search "aegisdarkwebbot".</p>
            <p>For channels: add as administrator with "Read Messages" permission.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setChatFilter(null)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                chatFilter === null
                  ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
                  : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200"
              )}
            >
              All ({channels.length})
            </button>
            {channels.map((c) => (
              <button
                key={c.id}
                onClick={() => setChatFilter(chatFilter === c.chat_id ? null : c.chat_id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5",
                  chatFilter === c.chat_id
                    ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
                    : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200"
                )}
              >
                <span>{c.title || c.username || `chat ${c.chat_id}`}</span>
                <span className="text-[9px] uppercase opacity-60">{c.chat_type}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="card-enterprise p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadAll()}
              placeholder="Search messages…"
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500/30"
            />
          </div>
          <button
            onClick={() => setHasIocs(!hasIocs)}
            className={cn(
              "h-10 px-3 rounded-lg flex items-center gap-2 text-xs font-semibold border transition-all",
              hasIocs
                ? "bg-orange-500/15 border-orange-500/40 text-orange-300"
                : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200"
            )}
          >
            <Hash className="w-3.5 h-3.5" />
            With IOCs only
          </button>
          <button onClick={loadAll} className="h-10 px-4 rounded-lg text-sm font-semibold text-white btn-brand">
            Search
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-2">
        {loading && (
          <div className="card-enterprise p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="card-enterprise p-8 text-center text-sm text-slate-500">
            No messages yet. Once the bot is in a channel, ingestion happens every {20}s.
          </div>
        )}
        {!loading && messages.map((m) => {
          const iocs = m.extracted_iocs || {};
          const iocCount = Object.values(iocs).reduce((sum, arr) => sum + (arr?.length || 0), 0);
          const channel = channels.find((c) => c.chat_id === m.chat_id);
          return (
            <div key={m.id} className="card-enterprise p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-300">{channel?.title || channel?.username || `chat ${m.chat_id}`}</span>
                    {m.sender_name && <span>· {m.sender_name}</span>}
                    <span>· {new Date(m.message_date).toLocaleString()}</span>
                  </div>
                  {m.text && (
                    <p className="text-[13px] text-slate-300 mt-2 whitespace-pre-wrap break-words">{m.text}</p>
                  )}
                  {m.has_media && (
                    <p className="text-[11px] text-purple-400 mt-1">📎 contains {m.media_type}</p>
                  )}
                  {iocCount > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(iocs).map(([kind, vals]) => (
                        (vals || []).slice(0, 8).map((v) => (
                          <span key={`${kind}-${v}`} className="px-2 py-0.5 rounded text-[10px] font-mono bg-orange-500/10 text-orange-300 border border-orange-500/20" title={kind}>
                            {kind}: {v.length > 24 ? v.slice(0, 24) + "…" : v}
                          </span>
                        ))
                      ))}
                    </div>
                  )}
                </div>
                {channel?.username && (
                  <a
                    href={`https://t.me/${channel.username}/${m.message_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-500 hover:text-sky-300"
                    title="Open in Telegram"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
