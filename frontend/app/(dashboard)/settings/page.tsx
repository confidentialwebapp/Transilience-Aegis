"use client";

import { useState, useEffect } from "react";
import { getOrgId } from "@/lib/api";
import { toast } from "sonner";
import {
  Settings, Save, Loader2, Bell, Mail, Globe, Shield, Clock,
  Webhook, Send, RefreshCw
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

async function apiFetch(path: string, options: any = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId(), ...options.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const SCAN_MODULES = [
  { key: "dark_web", label: "Dark Web Monitoring", icon: "🌑", defaultInterval: 6 },
  { key: "brand", label: "Brand Protection", icon: "🛡️", defaultInterval: 4 },
  { key: "data_leak", label: "Data Leak Detection", icon: "📄", defaultInterval: 12 },
  { key: "surface_web", label: "Surface Web Scan", icon: "🌐", defaultInterval: 24 },
  { key: "cert_monitor", label: "Certificate Monitor", icon: "🔒", defaultInterval: 1 },
  { key: "credential", label: "Credential Scan", icon: "🔑", defaultInterval: 8 },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"general" | "notifications" | "scans">("general");
  const [orgName, setOrgName] = useState("");
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [minSeverity, setMinSeverity] = useState("medium");
  const [schedules, setSchedules] = useState<Record<string, { enabled: boolean; interval_hours: number }>>({});

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [org, notif, scanSched] = await Promise.all([
        apiFetch("/api/v1/settings/org"),
        apiFetch("/api/v1/settings/notifications"),
        apiFetch("/api/v1/settings/scan-schedule"),
      ]);
      setOrgName(org.name || "");
      setPrimaryDomain(org.domain || "");
      setEmailEnabled(notif.email_enabled ?? true);
      setEmailRecipients((notif.email_recipients || []).join(", "));
      setWebhookEnabled(notif.webhook_enabled ?? false);
      setWebhookUrl(notif.webhook_url || "");
      setTelegramEnabled(notif.telegram_enabled ?? false);
      setTelegramChatId(notif.telegram_chat_id || "");
      setMinSeverity(notif.min_severity || "medium");
      setSchedules(scanSched.schedules || {});
    } catch { toast.error("Failed to load settings"); }
    finally { setLoading(false); }
  };

  const saveGeneral = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/v1/settings/org", { method: "PATCH", body: JSON.stringify({ name: orgName, domain: primaryDomain }) });
      toast.success("Organization settings saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const saveNotifications = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/v1/settings/notifications", {
        method: "PATCH",
        body: JSON.stringify({
          email_enabled: emailEnabled,
          email_recipients: emailRecipients.split(",").map((e: string) => e.trim()).filter(Boolean),
          webhook_enabled: webhookEnabled, webhook_url: webhookUrl,
          telegram_enabled: telegramEnabled, telegram_chat_id: telegramChatId,
          min_severity: minSeverity,
        }),
      });
      toast.success("Notification settings saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const saveSchedules = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/v1/settings/scan-schedule", { method: "PATCH", body: JSON.stringify({ schedules }) });
      toast.success("Scan schedules saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const triggerScan = async (module: string) => {
    try {
      await apiFetch("/api/v1/scans/trigger", { method: "POST", body: JSON.stringify({ module }) });
      toast.success(`${module.replace("_", " ")} scan triggered`);
    } catch { toast.error("Scan trigger failed"); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;

  const inputStyle = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)" };
  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} className={`w-10 h-5 rounded-full transition-all relative ${on ? "bg-purple-500" : "bg-slate-700"}`}>
      <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );

  return (
    <div className="space-y-6 animate-fade-up max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Settings className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-[11px] text-slate-500">Organization, notifications & scan schedules</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: "rgba(17,13,26,0.8)", border: "1px solid rgba(139,92,246,0.06)" }}>
        {([{ key: "general" as const, label: "General", icon: Shield }, { key: "notifications" as const, label: "Notifications", icon: Bell }, { key: "scans" as const, label: "Scan Schedules", icon: Clock }]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all ${tab === t.key ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-slate-500 hover:text-white"}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="card-enterprise p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-300">Organization Details</h2>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Organization Name</label>
              <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Your organization name"
                className="w-full mt-1.5 px-3 py-2.5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Primary Domain</label>
              <input value={primaryDomain} onChange={(e) => setPrimaryDomain(e.target.value)} placeholder="example.com"
                className="w-full mt-1.5 px-3 py-2.5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none" style={inputStyle} />
            </div>
          </div>
          <button onClick={saveGeneral} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 btn-brand rounded-lg text-sm font-medium">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings
          </button>
        </div>
      )}

      {tab === "notifications" && (
        <div className="space-y-4">
          <div className="card-enterprise p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-300">Severity Threshold</h2>
            <select value={minSeverity} onChange={(e) => setMinSeverity(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm text-slate-200 focus:outline-none" style={inputStyle}>
              <option value="critical">Critical only</option><option value="high">High+</option><option value="medium">Medium+</option><option value="low">Low+</option><option value="info">All</option>
            </select>
          </div>
          <div className="card-enterprise p-6 space-y-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Mail className="w-4 h-4 text-purple-400" /><h2 className="text-sm font-semibold text-slate-300">Email</h2></div><Toggle on={emailEnabled} onToggle={() => setEmailEnabled(!emailEnabled)} /></div>
            {emailEnabled && <input value={emailRecipients} onChange={(e) => setEmailRecipients(e.target.value)} placeholder="security@company.com, soc@company.com" className="w-full px-3 py-2.5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none" style={inputStyle} />}
          </div>
          <div className="card-enterprise p-6 space-y-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Webhook className="w-4 h-4 text-blue-400" /><h2 className="text-sm font-semibold text-slate-300">Webhook</h2></div><Toggle on={webhookEnabled} onToggle={() => setWebhookEnabled(!webhookEnabled)} /></div>
            {webhookEnabled && <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..." className="w-full px-3 py-2.5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none" style={inputStyle} />}
          </div>
          <div className="card-enterprise p-6 space-y-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Send className="w-4 h-4 text-blue-400" /><h2 className="text-sm font-semibold text-slate-300">Telegram</h2></div><Toggle on={telegramEnabled} onToggle={() => setTelegramEnabled(!telegramEnabled)} /></div>
            {telegramEnabled && <input value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} placeholder="-1001234567890" className="w-full px-3 py-2.5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none" style={inputStyle} />}
          </div>
          <button onClick={saveNotifications} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 btn-brand rounded-lg text-sm font-medium">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Notifications
          </button>
        </div>
      )}

      {tab === "scans" && (
        <div className="space-y-4">
          {SCAN_MODULES.map((mod) => {
            const sched = schedules[mod.key] || { enabled: true, interval_hours: mod.defaultInterval };
            return (
              <div key={mod.key} className="card-enterprise p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{mod.icon}</span>
                    <div><p className="text-sm font-medium text-slate-300">{mod.label}</p><p className="text-[10px] text-slate-600">Every {sched.interval_hours}h</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select value={sched.interval_hours} onChange={(e) => setSchedules({ ...schedules, [mod.key]: { ...sched, interval_hours: parseInt(e.target.value) } })}
                      className="px-2 py-1.5 rounded-lg text-xs text-slate-300" style={inputStyle}>
                      {[1,2,4,6,8,12,24].map((h) => <option key={h} value={h}>Every {h}h</option>)}
                    </select>
                    <Toggle on={sched.enabled} onToggle={() => setSchedules({ ...schedules, [mod.key]: { ...sched, enabled: !sched.enabled } })} />
                    <button onClick={() => triggerScan(mod.key)} className="p-2 rounded-lg text-slate-500 hover:text-purple-400" style={{ background: "rgba(255,255,255,0.02)" }} title="Run now">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <button onClick={saveSchedules} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 btn-brand rounded-lg text-sm font-medium">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Schedules
          </button>
        </div>
      )}
    </div>
  );
}
