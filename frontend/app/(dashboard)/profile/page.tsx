"use client";

import { useEffect, useState } from "react";
import {
  Building2, Loader2, Plus, Trash2, RefreshCw, AlertTriangle, Skull,
  Globe, Tag, MapPin, Save, X, ExternalLink,
} from "lucide-react";
import { api, getOrgId, type CustomerProfile, type ProfileMatchAlert } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ProfileForm = {
  display_name: string;
  sectors: string;
  countries: string;
  domains: string;
  brand_keywords: string;
  notify_email: string;
  notify_telegram_chat_id: string;
  digest_frequency: "off" | "daily" | "weekly";
};

const EMPTY_FORM: ProfileForm = {
  display_name: "", sectors: "", countries: "", domains: "",
  brand_keywords: "", notify_email: "", notify_telegram_chat_id: "",
  digest_frequency: "off",
};

export default function ProfilePage() {
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [matches, setMatches] = useState<ProfileMatchAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, m] = await Promise.all([
        api.listCustomerProfiles(getOrgId()),
        api.recentProfileMatches(getOrgId(), 20),
      ]);
      setProfiles(p.data);
      setMatches(m.data);
    } catch (e: any) {
      toast.error(e?.message ?? "load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const splitList = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean);

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      toast.error("display name required");
      return;
    }
    const body = {
      display_name: form.display_name.trim(),
      sectors: splitList(form.sectors),
      countries: splitList(form.countries).map((c) => c.toUpperCase()),
      domains: splitList(form.domains).map((d) => d.toLowerCase()),
      brand_keywords: splitList(form.brand_keywords),
      notify_email: form.notify_email.trim() || null,
      notify_telegram_chat_id: form.notify_telegram_chat_id ? parseInt(form.notify_telegram_chat_id) : null,
      digest_frequency: form.digest_frequency,
    };
    try {
      if (editingId) {
        await api.updateCustomerProfile(getOrgId(), editingId, body);
        toast.success("profile updated");
      } else {
        await api.createCustomerProfile(getOrgId(), body);
        toast.success("profile created");
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "save failed");
    }
  };

  const handleEdit = (p: CustomerProfile) => {
    setEditingId(p.id);
    setForm({
      display_name: p.display_name || "",
      sectors: (p.sectors || []).join(", "),
      countries: (p.countries || []).join(", "),
      domains: (p.domains || []).join(", "),
      brand_keywords: (p.brand_keywords || []).join(", "),
      notify_email: p.notify_email || "",
      notify_telegram_chat_id: p.notify_telegram_chat_id?.toString() || "",
      digest_frequency: p.digest_frequency || "off",
    });
    setShowForm(true);
  };

  const handleSendDigest = async (profileId: string) => {
    try {
      const r = await api.sendDigestNow(getOrgId(), profileId);
      if (r.status === "sent") {
        toast.success(`Digest sent (${r.alerts ?? 0} alerts, ${r.posts ?? 0} mentions)`);
      } else if (r.status === "skipped") {
        toast.info(`Skipped: ${r.reason || "no content"}`);
      } else {
        toast.error(`Failed: ${r.error || "unknown error"}`);
      }
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "send failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this profile? Existing alerts are kept.")) return;
    try {
      await api.deleteCustomerProfile(getOrgId(), id);
      toast.success("profile deleted");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "delete failed");
    }
  };

  const handleMatchNow = async () => {
    setMatching(true);
    try {
      const r = await api.matchProfilesNow(getOrgId());
      toast.success(
        `Checked ${r.victims_checked} victims · ${r.matches} matched · ${r.alerts_created} new alerts`
      );
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "match failed");
    } finally {
      setMatching(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(244,63,94,0.15),rgba(217,70,239,0.1))", border: "1px solid rgba(244,63,94,0.2)" }}>
            <Skull className="w-5 h-5 text-rose-300" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Customer Watchlist</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">Match ransomware victims and dark-web mentions against your assets</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleMatchNow} disabled={matching || profiles.length === 0}
            className="h-9 px-3 rounded-lg flex items-center gap-2 text-xs font-semibold text-white bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 disabled:opacity-40">
            {matching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Check now
          </button>
          <button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(!showForm); }}
            className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold text-white btn-brand">
            <Plus className="w-3.5 h-3.5" />
            New profile
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Profiles</p>
          <p className="text-[26px] font-bold font-mono text-white leading-none mt-2">{profiles.length}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Recent Matches</p>
          <p className="text-[26px] font-bold font-mono text-rose-300 leading-none mt-2">{matches.length}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">Auto-checked</p>
          <p className="text-[12px] text-slate-400 font-mono mt-2">every 15 min</p>
        </div>
      </div>

      {/* Profile form */}
      {showForm && (
        <div className="card-enterprise p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-200">
              {editingId ? "Edit profile" : "New customer profile"}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
              className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Display name" placeholder="Acme Corp"
              value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
            <Field label="Sectors (comma)" placeholder="Healthcare, Finance"
              value={form.sectors} onChange={(v) => setForm({ ...form, sectors: v })} icon={Tag} />
            <Field label="Countries (ISO codes)" placeholder="US, GB, IN"
              value={form.countries} onChange={(v) => setForm({ ...form, countries: v })} icon={MapPin} />
            <Field label="Domains" placeholder="acme.com, *.acme.io"
              value={form.domains} onChange={(v) => setForm({ ...form, domains: v })} icon={Globe} />
            <Field label="Brand keywords" placeholder="acme, AcmeCorp"
              value={form.brand_keywords} onChange={(v) => setForm({ ...form, brand_keywords: v })} icon={Building2} />
            <Field label="Notify email (optional)" placeholder="soc@acme.com"
              value={form.notify_email} onChange={(v) => setForm({ ...form, notify_email: v })} />
            <Field label="Telegram chat ID (optional)" placeholder="-100123456789"
              value={form.notify_telegram_chat_id} onChange={(v) => setForm({ ...form, notify_telegram_chat_id: v })} />
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Email digest frequency</label>
              <select
                value={form.digest_frequency}
                onChange={(e) => setForm({ ...form, digest_frequency: e.target.value as any })}
                className="w-full h-9 px-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-sm text-slate-200 focus:outline-none focus:border-rose-500/30"
              >
                <option value="off">Off — don't send digests</option>
                <option value="daily">Daily — every morning</option>
                <option value="weekly">Weekly — every Monday</option>
              </select>
              <p className="text-[10px] text-slate-600 mt-1">Requires "Notify email" set above. Sent via Resend.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
              className="h-9 px-4 rounded-lg text-xs font-semibold text-slate-400 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05]">
              Cancel
            </button>
            <button onClick={handleSave}
              className="h-9 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold text-white btn-brand">
              <Save className="w-3.5 h-3.5" />
              {editingId ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Profile list */}
      <div className="card-enterprise p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">Watchlist profiles</h3>
        {loading && profiles.length === 0 ? (
          <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-rose-400" /></div>
        ) : profiles.length === 0 ? (
          <div className="text-[12px] text-slate-500 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            No profiles yet. Create one to start matching ransomware leak-site victims (and other intel sources) against your sectors, countries, domains, or brand keywords.
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map((p) => (
              <div key={p.id} className="rounded-lg p-3 bg-white/[0.02] border border-white/[0.05]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{p.display_name}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(p.sectors || []).map((x) => <Pill key={`s-${x}`} icon={Tag} text={x} color="emerald" />)}
                      {(p.countries || []).map((x) => <Pill key={`c-${x}`} icon={MapPin} text={x} color="sky" />)}
                      {(p.domains || []).map((x) => <Pill key={`d-${x}`} icon={Globe} text={x} color="purple" />)}
                      {(p.brand_keywords || []).map((x) => <Pill key={`k-${x}`} icon={Building2} text={x} color="orange" />)}
                    </div>
                    {(p.notify_email || p.notify_telegram_chat_id) && (
                      <div className="flex gap-3 mt-2 text-[11px] text-slate-500">
                        {p.notify_email && <span>📧 {p.notify_email}</span>}
                        {p.notify_telegram_chat_id && <span>💬 {p.notify_telegram_chat_id}</span>}
                        {p.digest_frequency && p.digest_frequency !== "off" && (
                          <span className="text-rose-400">📬 {p.digest_frequency} digest</span>
                        )}
                        {p.digest_last_sent_at && (
                          <span className="text-slate-600">last: {new Date(p.digest_last_sent_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {p.digest_frequency && p.digest_frequency !== "off" && p.notify_email && (
                      <button
                        onClick={() => handleSendDigest(p.id)}
                        className="px-2 py-1 rounded text-[11px] text-emerald-300 hover:bg-emerald-500/10"
                        title={`Send ${p.digest_frequency} digest now`}
                      >
                        📧 Send
                      </button>
                    )}
                    <button onClick={() => handleEdit(p)} className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-white hover:bg-white/[0.05]">Edit</button>
                    <button onClick={() => handleDelete(p.id)} className="px-2 py-1 rounded text-[11px] text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent matches */}
      <div className="card-enterprise p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" /> Recent matches (ransomware module)
        </h3>
        {matches.length === 0 ? (
          <div className="text-[12px] text-slate-500 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            No matches yet. The matcher runs every 15 minutes — give it some time, or click "Check now" above.
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <div key={m.id} className="rounded-lg p-3 bg-white/[0.02] border border-rose-500/15">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{m.title}</p>
                    <p className="text-[11px] text-slate-400 mt-1 whitespace-pre-wrap">{m.description}</p>
                    {m.raw_data?.reasons && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.raw_data.reasons.map((r: string) => (
                          <span key={r} className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20">{r}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {m.source_url && (
                    <a href={m.source_url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-rose-300 shrink-0">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-slate-600 font-mono mt-2">{new Date(m.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, icon: Icon }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; icon?: any;
}) {
  return (
    <div>
      <label className="text-[11px] text-slate-500 mb-1 block">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />}
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={cn("w-full h-9 px-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500/30",
            Icon && "pl-8")} />
      </div>
    </div>
  );
}

function Pill({ icon: Icon, text, color }: { icon: any; text: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    sky: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    purple: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border", colors[color])}>
      <Icon className="w-2.5 h-2.5" />
      {text}
    </span>
  );
}
