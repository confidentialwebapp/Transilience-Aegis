"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Save, Play, Loader2 } from "lucide-react";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

const SCAN_MODULES = [
  { id: "dark_web", label: "Dark Web Scan", interval: "Every 6 hours" },
  { id: "brand", label: "Brand Monitor", interval: "Every 4 hours" },
  { id: "data_leak", label: "Data Leak Scan", interval: "Every 12 hours" },
  { id: "surface_web", label: "Surface Web Scan", interval: "Every 24 hours" },
  { id: "cert_monitor", label: "Certificate Monitor", interval: "Every 1 hour" },
  { id: "credential", label: "Credential Scan", interval: "Every 8 hours" },
];

export default function SettingsPage() {
  const [triggeringModule, setTriggeringModule] = useState<string | null>(null);

  const handleTriggerScan = async (module: string) => {
    setTriggeringModule(module);
    try {
      await api.triggerScan(ORG_ID, module);
      toast.success(`${module.replace("_", " ")} scan triggered`);
    } catch {
      toast.error("Failed to trigger scan");
    } finally {
      setTriggeringModule(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Organization */}
      <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
        <h2 className="text-lg font-semibold mb-4">Organization</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Organization Name</label>
            <input
              type="text"
              defaultValue="My Organization"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Primary Domain</label>
            <input
              type="text"
              defaultValue=""
              placeholder="example.com"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
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
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:bg-cyan-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Webhook URL</label>
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Minimum Severity</label>
            <select className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
              <option value="critical">Critical only</option>
              <option value="high">High and above</option>
              <option value="medium" selected>Medium and above</option>
              <option value="low">Low and above</option>
              <option value="info">All</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scan Schedules */}
      <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
        <h2 className="text-lg font-semibold mb-4">Scan Modules</h2>
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 disabled:opacity-50 transition-colors"
              >
                {triggeringModule === module.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                Run Now
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
