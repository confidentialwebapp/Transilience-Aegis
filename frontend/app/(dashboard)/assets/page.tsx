"use client";

import { useState, useEffect } from "react";
import { getOrgId } from "@/lib/api";
import { useAssets } from "@/hooks/useAssets";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Globe,
  Server,
  Mail,
  Hash,
  Github,
  Users,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const ASSET_TYPES = [
  { value: "domain", label: "Domain", icon: Globe },
  { value: "ip", label: "IP Address", icon: Server },
  { value: "email", label: "Email", icon: Mail },
  { value: "keyword", label: "Keyword", icon: Hash },
  { value: "github_org", label: "GitHub Org", icon: Github },
  { value: "social", label: "Social Handle", icon: Users },
  { value: "certificate", label: "Certificate", icon: ShieldCheck },
];

const TYPE_ICONS: Record<string, typeof Globe> = {
  domain: Globe, ip: Server, email: Mail, keyword: Hash,
  github_org: Github, social: Users, certificate: ShieldCheck,
};

export default function AssetsPage() {
  const [orgId, setOrgIdLocal] = useState("");

  useEffect(() => {
    setOrgIdLocal(getOrgId());
  }, []);

  const { assets, total, loading, error, createAsset, deleteAsset, fetchAssets } = useAssets(orgId);
  const [showForm, setShowForm] = useState(false);
  const [newType, setNewType] = useState("domain");
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    setAdding(true);
    try {
      await createAsset({ type: newType, value: newValue.trim(), label: newLabel.trim() || undefined });
      setNewValue("");
      setNewLabel("");
      setShowForm(false);
      toast.success("Asset added successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add asset");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteAsset(id);
      toast.success("Asset deleted");
    } catch {
      toast.error("Failed to delete asset");
    } finally {
      setDeleting(null);
    }
  };

  const filteredAssets = filterType ? assets.filter((a) => a.type === filterType) : assets;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitored Assets</h1>
          <p className="text-sm text-slate-400 mt-1">{total} asset{total !== 1 ? "s" : ""} being monitored</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
            >
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="e.g., example.com"
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              required
            />
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (optional)"
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={adding}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </div>
        </form>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !filterType ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30" : "bg-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          All
        </button>
        {ASSET_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilterType(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterType === t.value ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30" : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="w-8 h-8 text-orange-400 mb-3" />
          <p className="text-sm text-slate-400 mb-3">{error}</p>
          <button
            onClick={() => fetchAssets()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Assets table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      ) : !error && (
        <div className="bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Value</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Label</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase hidden lg:table-cell">Last Scan</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => {
                const Icon = TYPE_ICONS[asset.type] || Globe;
                return (
                  <tr key={asset.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-400 capitalize">{asset.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{asset.value}</td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{asset.label || "-"}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        asset.status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                        asset.status === "compromised" ? "bg-red-500/10 text-red-400" :
                        "bg-slate-500/10 text-slate-400"
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                      {asset.last_scan_at
                        ? formatDistanceToNow(new Date(asset.last_scan_at), { addSuffix: true })
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(asset.id)}
                        disabled={deleting === asset.id}
                        className="p-1.5 text-slate-500 hover:text-red-400 disabled:opacity-50 transition-colors"
                      >
                        {deleting === asset.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    {filterType
                      ? `No ${filterType} assets found. Try a different filter or add a new asset.`
                      : "No assets found. Click \"Add Asset\" above to start monitoring."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
