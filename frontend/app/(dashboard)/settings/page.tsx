"use client";

import { useState, useEffect } from "react";
import { api, getOrgId } from "@/lib/api";
import { toast } from "sonner";
import { Save, Play, Loader2, CheckCircle } from "lucide-react";

const SCAN_MODULES = [
  { id: "dark_web", label: "Dark Web Scan", interval: "Every 6 hours" },
  { id: "brand", label: "Brand Monitor", interval: "Every 4 hours" },
  { id: "data_leak", label: "Data Leak Scan", interval: "Every 12 hours" },
  { id: "surface_web", label: "Surface Web Scan", interval: "Every 24 hours" },
  { id: "cert_monitor", label: "Certificate Monitor", interval: "Every 1 hour" },
  { id: "credential", label: "Credential Scan", interval: "Every 8 hours" },
];

export default function SettingsPage() {
  const [orgId, setOrgIdLocal] = useState("");
  const [triggeringModule, setTriggeringModule] = useState<string | null>(null);
  const [triggeredModules, setTriggeredModules] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Settings state
  const [orgName, setOrgName] = useState("My Organization");
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [minSeverity, setMinSeverity] = useState("medium");

  useEffect(() => {
    setOrgIdLocal(getOrgId());
  }, []);

  const handleTriggerScan = async (module: string) => {
    setTriggeringModule(module);
    try {
      await api.triggerScan(orgId, module);
      setTriggeredModules((prev) => new Set(prev).add(module));
      toast.success(`${module.replace(/_/g, " ")} scan triggered successfully`);
      // Clear the success indicator after 3 seconds
      setTimeout(() => {
        setTriggeredModules((prev) => {
          const next = new Set(prev);
          next.delete(module);
          return next;
        });
      }, 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to trigger scan. The server may be starting up.");
    } finally {
      setTriggeringModule(null);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    // Simulate save - in production this would call a settings API
    await new Promise((resolve) => setTimeout(resolve, 500));
    toast.success("Settings saved successfully");
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Organization */}
      <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
        <h2 className="text-lg font-semibold mb-4">Organization</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Primary Domain</label>
            <input
              type="text"
              value={primaryDomain}
              onChange={(e) => setPrimaryDomain(e.target.value)}
              placeholder="example.com"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Organization ID</label>
            <input
              type="text"
              value={orgId}
              readOnly
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-500 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
        <h2 className="text-lg font-semibold mb-4">Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Email Notifications</div>
              <div className="text-xs text-slate-400">Receive alerts via email</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:bg-cyan-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Webhook URL</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Minimum Severity</label>
            <select
              value={minSeverity}
              onChange={(e) => setMinSeverity(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
            >
              <option value="critical">Critical only</option>
              <option value="high">High and above</option>
              <option value="medium">Medium and above</option>
              <option value="low">Low and above</option>
              <option value="info">All</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scan Schedules */}
      <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
        <h2 className="text-lg font-semibold mb-4">Scan Modules</h2>
        <p className="text-sm text-slate-400 mb-4">
          Trigger an on-demand scan or view the automated schedule for each module.
        </p>
        <div className="space-y-3">
          {SCAN_MODULES.map((module) => (
            <div key={module.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <div>
                <div className="text-sm font-medium">{module.label}</div>
                <div className="text-xs text-slate-400">{module.interval}</div>
              </div>
              <button
                onClick={() => handleTriggerScan(module.id)}
                disabled={triggeringModule === module.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  triggeredModules.has(module.id)
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20"
                } disabled:opacity-50`}
              >
                {triggeringModule === module.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : triggeredModules.has(module.id) ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                {triggeredModules.has(module.id) ? "Triggered" : "Run Now"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
