"use client";

import { useEffect, useState } from "react";
import {
  Webhook as WebhookIcon, Plus, Trash2, Loader2, CheckCircle2, XCircle,
  Send, Activity, AlertCircle, X, Save,
} from "lucide-react";
import { api, getOrgId, type Webhook, type WebhookDelivery } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Form = {
  name: string;
  url: string;
  kind: "slack" | "teams" | "discord" | "generic";
  events: string;
  min_severity: "low" | "medium" | "high" | "critical";
  secret: string;
};

const EMPTY: Form = { name: "", url: "", kind: "slack", events: "alert.created", min_severity: "medium", secret: "" };

const KIND_HELP: Record<string, string> = {
  slack: "Paste an Incoming Webhook URL from your Slack app settings (https://hooks.slack.com/...)",
  teams: "Microsoft Teams Incoming Webhook URL",
  discord: "Discord Channel Webhook URL (https://discord.com/api/webhooks/...)",
  generic: "Any HTTPS endpoint that accepts POST JSON. Will receive HMAC-SHA256 signature in X-AEGIS-Signature header if a secret is set.",
};

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [w, d] = await Promise.all([
        api.listWebhooks(getOrgId()),
        api.webhookDeliveries(getOrgId(), 20),
      ]);
      setWebhooks(w.data);
      setDeliveries(d.data);
    } catch (e: any) {
      toast.error(e?.message ?? "load failed");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.startsWith("http")) {
      toast.error("Name and full https URL required");
      return;
    }
    const body = {
      name: form.name.trim(),
      url: form.url.trim(),
      kind: form.kind,
      events: form.events.split(",").map(s => s.trim()).filter(Boolean),
      min_severity: form.min_severity,
      secret: form.secret.trim() || null,
    };
    try {
      if (editingId) {
        await api.updateWebhook(getOrgId(), editingId, body);
        toast.success("webhook updated");
      } else {
        await api.createWebhook(getOrgId(), body);
        toast.success("webhook created");
      }
      setForm(EMPTY); setEditingId(null); setShowForm(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "save failed");
    }
  };

  const handleEdit = (w: Webhook) => {
    setEditingId(w.id);
    setForm({
      name: w.name, url: w.url, kind: w.kind,
      events: (w.events || []).join(", "),
      min_severity: w.min_severity, secret: w.secret || "",
    });
    setShowForm(true);
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const r = await api.testWebhook(getOrgId(), id);
      if (r.ok) toast.success(`Test delivered (HTTP ${r.http_status})`);
      else toast.error(`Failed: ${r.error || `HTTP ${r.http_status}`}`);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "test failed");
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this webhook? Past deliveries are preserved.")) return;
    try {
      await api.deleteWebhook(getOrgId(), id);
      toast.success("deleted");
      load();
    } catch (e: any) { toast.error(e?.message ?? "delete failed"); }
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(34,197,94,0.15),rgba(56,189,248,0.1))", border: "1px solid rgba(34,197,94,0.2)" }}>
            <WebhookIcon className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Webhooks</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">Push alerts to Slack, Teams, Discord, or any HTTPS endpoint</p>
          </div>
        </div>
        <button onClick={() => { setEditingId(null); setForm(EMPTY); setShowForm(!showForm); }}
          className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold text-white btn-brand">
          <Plus className="w-3.5 h-3.5" /> New webhook
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Webhooks</p>
          <p className="text-[26px] font-bold font-mono text-white leading-none mt-2">{webhooks.length}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Recent Deliveries</p>
          <p className="text-[26px] font-bold font-mono text-emerald-300 leading-none mt-2">{deliveries.length}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Failures</p>
          <p className="text-[26px] font-bold font-mono text-red-300 leading-none mt-2">{deliveries.filter(d => !d.ok).length}</p>
        </div>
      </div>

      {showForm && (
        <div className="card-enterprise p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200">{editingId ? "Edit webhook" : "New webhook"}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Security team Slack" />
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Destination</label>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as any })}
                className="w-full h-9 px-3 rounded-lg bg-white/[0.02] border border-white/[0.08] text-sm text-slate-200">
                <option value="slack">Slack</option>
                <option value="teams">Microsoft Teams</option>
                <option value="discord">Discord</option>
                <option value="generic">Generic JSON</option>
              </select>
              <p className="text-[10px] text-slate-600 mt-1">{KIND_HELP[form.kind]}</p>
            </div>
            <div className="md:col-span-2">
              <Field label="Webhook URL" value={form.url} onChange={(v) => setForm({ ...form, url: v })} placeholder="https://hooks.slack.com/services/..." />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Minimum severity</label>
              <select value={form.min_severity} onChange={(e) => setForm({ ...form, min_severity: e.target.value as any })}
                className="w-full h-9 px-3 rounded-lg bg-white/[0.02] border border-white/[0.08] text-sm text-slate-200">
                <option value="low">Low+ (everything)</option>
                <option value="medium">Medium+</option>
                <option value="high">High+</option>
                <option value="critical">Critical only</option>
              </select>
            </div>
            <Field label="Events (comma-separated)" value={form.events} onChange={(v) => setForm({ ...form, events: v })} placeholder="alert.created" />
            {form.kind === "generic" && (
              <div className="md:col-span-2">
                <Field label="HMAC secret (optional)" value={form.secret} onChange={(v) => setForm({ ...form, secret: v })} placeholder="leave empty to skip signature verification" />
                <p className="text-[10px] text-slate-600 mt-1">If set, AEGIS adds <code className="text-purple-300">X-AEGIS-Signature: sha256=&lt;hmac&gt;</code> to every delivery so you can verify authenticity.</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="h-9 px-4 rounded-lg text-xs font-semibold text-slate-400 bg-white/[0.02] border border-white/[0.06]">Cancel</button>
            <button onClick={handleSave} className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold text-white btn-brand">
              <Save className="w-3.5 h-3.5" /> {editingId ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      <div className="card-enterprise p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">Configured webhooks</h3>
        {loading && webhooks.length === 0 ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-emerald-400" /></div>
        ) : webhooks.length === 0 ? (
          <div className="text-[12px] text-slate-500 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            No webhooks yet. Add one to push every new alert to Slack/Teams/Discord.
          </div>
        ) : (
          <div className="space-y-2">
            {webhooks.map((w) => (
              <div key={w.id} className="rounded-lg p-3 bg-white/[0.02] border border-white/[0.05]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{w.name}</p>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">{w.kind}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/[0.04] text-slate-400">≥ {w.min_severity}</span>
                      {!w.enabled && <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/15 text-red-300">disabled</span>}
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-1 truncate" title={w.url}>{w.url}</p>
                    {w.last_delivery_at && (
                      <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
                        <span>last: {new Date(w.last_delivery_at).toLocaleString()}</span>
                        <span>HTTP {w.last_delivery_status ?? "—"}</span>
                        {w.failure_count > 0 && <span className="text-red-400">{w.failure_count} consecutive failures</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleTest(w.id)} disabled={testingId === w.id}
                      className="px-2 py-1 rounded text-[11px] text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 flex items-center gap-1">
                      {testingId === w.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Test
                    </button>
                    <button onClick={() => handleEdit(w)} className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-white hover:bg-white/[0.05]">Edit</button>
                    <button onClick={() => handleDelete(w.id)} className="px-2 py-1 rounded text-[11px] text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-enterprise p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" /> Recent deliveries
        </h3>
        {deliveries.length === 0 ? (
          <p className="text-[12px] text-slate-500">No deliveries yet. Send a test from any webhook above to see it here.</p>
        ) : (
          <div className="space-y-1.5">
            {deliveries.map((d) => (
              <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                {d.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                <span className="font-mono text-[11px] text-slate-400">HTTP {d.http_status ?? "—"}</span>
                <span className="text-[11px] text-slate-300 truncate flex-1">{d.error || (d.response_body || "").slice(0, 80) || "delivered"}</span>
                <span className="text-[10px] text-slate-600 font-mono">{new Date(d.delivered_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[11px] text-slate-500 mb-1 block">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-9 px-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/30" />
    </div>
  );
}
