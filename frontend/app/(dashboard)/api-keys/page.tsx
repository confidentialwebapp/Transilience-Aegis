"use client";

import { InfinityLoader } from "@/components/InfinityLoader";

import { useEffect, useState } from "react";
import {
  Key, Plus, Trash2, Copy,
  Check, X, Save, AlertTriangle
} from "lucide-react";
import { api, getOrgId, type ApiKey } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [expires, setExpires] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.listApiKeys(getOrgId());
      setKeys(r.data);
    } catch (e: any) { toast.error(e?.message ?? "load failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    setCreating(true);
    try {
      const r = await api.createApiKey(getOrgId(), {
        name: name.trim(), scopes,
        expires_in_days: expires,
      });
      setNewKey(r.key);
      toast.success("API key created — copy it now");
      setName(""); setShowForm(false);
      load();
    } catch (e: any) { toast.error(e?.message ?? "create failed"); }
    finally { setCreating(false); }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this key immediately? Apps using it will lose access.")) return;
    try {
      await api.revokeApiKey(getOrgId(), id);
      toast.success("revoked");
      load();
    } catch (e: any) { toast.error(e?.message ?? "revoke failed"); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(244,63,94,0.1))", border: "1px solid rgba(245,158,11,0.2)" }}>
            <Key className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">API Keys</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">Programmatic access for your CI, scripts, and integrations</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold text-white btn-brand">
          <Plus className="w-3.5 h-3.5" /> New key
        </button>
      </div>

      {newKey && (
        <div className="card-enterprise p-4 border border-amber-500/30 bg-amber-500/[0.04]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-200">Copy this key now</p>
              <p className="text-[11px] text-amber-300/70 mt-1">It will not be shown again. Anyone with this key has full org-scoped access until revoked.</p>
              <div className="mt-3 flex gap-2">
                <code className="flex-1 px-3 py-2 bg-black/40 rounded-lg text-[12px] text-amber-200 font-mono break-all">{newKey}</code>
                <button onClick={() => copyToClipboard(newKey)}
                  className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-amber-500/30 hover:bg-amber-500/40 flex items-center gap-1">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button onClick={() => setNewKey(null)} className="h-9 px-3 rounded-lg text-slate-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card-enterprise p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Create API key</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="CI pipeline"
                className="w-full h-9 px-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/30" />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Expires</label>
              <select value={expires ?? "never"} onChange={(e) => setExpires(e.target.value === "never" ? null : Number(e.target.value))}
                className="w-full h-9 px-3 rounded-lg bg-white/[0.02] border border-white/[0.08] text-sm text-slate-200">
                <option value="never">Never</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] text-slate-500 mb-1 block">Scopes</label>
              <div className="flex gap-2">
                {(["read", "write", "admin"] as const).map((s) => (
                  <button key={s} onClick={() => setScopes(scopes.includes(s) ? scopes.filter(x => x !== s) : [...scopes, s])}
                    className={cn("h-9 px-3 rounded-lg text-xs font-semibold border", scopes.includes(s)
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                      : "bg-white/[0.02] border-white/[0.06] text-slate-400")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="h-9 px-4 rounded-lg text-xs font-semibold text-slate-400 bg-white/[0.02] border border-white/[0.06]">Cancel</button>
            <button onClick={handleCreate} disabled={creating} className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold text-white btn-brand disabled:opacity-40">
              {creating ? <InfinityLoader size={14} /> : <Save className="w-3.5 h-3.5" />} Create
            </button>
          </div>
        </div>
      )}

      <div className="card-enterprise p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">Active keys</h3>
        {loading && keys.length === 0 ? (
          <div className="flex justify-center py-6"><InfinityLoader size={20} /></div>
        ) : keys.length === 0 ? (
          <p className="text-[12px] text-slate-500 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            No API keys yet. Create one to integrate AEGIS with your SIEM, SOAR, or custom dashboards.
          </p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => {
              const revoked = !!k.revoked_at;
              const expired = k.expires_at && new Date(k.expires_at) < new Date();
              return (
                <div key={k.id} className={cn("rounded-lg p-3 bg-white/[0.02] border", revoked || expired ? "border-red-500/20 opacity-60" : "border-white/[0.05]")}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{k.name}</span>
                        <code className="text-[11px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded">{k.prefix}…</code>
                        {(k.scopes || []).map((s) => (
                          <span key={s} className="text-[9px] uppercase font-bold bg-white/[0.04] text-slate-400 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                        {revoked && <span className="text-[10px] text-red-400">REVOKED {new Date(k.revoked_at!).toLocaleDateString()}</span>}
                        {expired && !revoked && <span className="text-[10px] text-red-400">EXPIRED</span>}
                      </div>
                      <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
                        <span>created: {new Date(k.created_at).toLocaleDateString()}</span>
                        {k.last_used_at && <span>last used: {new Date(k.last_used_at).toLocaleString()}</span>}
                        {k.expires_at && !expired && <span>expires: {new Date(k.expires_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    {!revoked && (
                      <button onClick={() => handleRevoke(k.id)} className="px-2 py-1 rounded text-[11px] text-red-400 hover:bg-red-500/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
