"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Search, Loader2, Globe, Server, Hash, Mail, Link } from "lucide-react";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

const IOC_TYPES = [
  { value: "ip", label: "IP Address", icon: Server },
  { value: "domain", label: "Domain", icon: Globe },
  { value: "hash", label: "Hash", icon: Hash },
  { value: "url", label: "URL", icon: Link },
  { value: "email", label: "Email", icon: Mail },
];

export default function IntelPage() {
  const [type, setType] = useState("ip");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;

    setLoading(true);
    setResults(null);
    try {
      const data = await api.lookupIOC(ORG_ID, type, value.trim());
      setResults(data.results);
    } catch {
      toast.error("IOC lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Threat Intelligence</h1>
        <p className="text-sm text-slate-400 mt-1">Look up indicators of compromise across multiple sources</p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
        <div className="flex gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
          >
            {IOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter IP, domain, hash, URL, or email..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>
      </form>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {Object.entries(results).length === 0 ? (
            <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-8 text-center text-slate-500">
              No results found for this IOC.
            </div>
          ) : (
            Object.entries(results).map(([source, data]) => (
              <div key={source} className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
                <h3 className="text-sm font-semibold text-cyan-400 uppercase mb-3">{source}</h3>
                <pre className="text-xs bg-slate-800 rounded-lg p-4 overflow-x-auto max-h-80 text-slate-300">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
