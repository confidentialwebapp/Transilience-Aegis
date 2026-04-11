"use client";

import { useState, useEffect } from "react";
import { getOrgId } from "@/lib/api";
import { toast } from "sonner";
import {
  Skull, Search, Loader2, Globe, Shield, ChevronRight, ExternalLink,
  Target, AlertTriangle, RefreshCw, MapPin, Calendar, Tag, Crosshair
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId() },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

interface ThreatActor {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  country?: string;
  motivation?: string;
  sophistication?: string;
  first_seen?: string;
  last_seen?: string;
  target_sectors: string[];
  techniques: string[];
  malware_used: string[];
  source: string;
}

interface RansomwareGroup {
  name: string;
  url?: string;
  last_seen?: string;
  victim_count?: number;
  status?: string;
}

export default function ThreatActorsPage() {
  const [actors, setActors] = useState<ThreatActor[]>([]);
  const [ransomware, setRansomware] = useState<RansomwareGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedActor, setSelectedActor] = useState<ThreatActor | null>(null);
  const [tab, setTab] = useState<"actors" | "ransomware">("actors");
  const [syncing, setSyncing] = useState(false);

  const fetchActors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const data = await apiFetch(`/api/v1/threat-actors/?${params}`);
      setActors(data.data || []);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchRansomware = async () => {
    try {
      const data = await apiFetch("/api/v1/threat-actors/ransomware");
      setRansomware(data.data || []);
    } catch {}
  };

  const syncActors = async () => {
    setSyncing(true);
    try {
      await apiFetch("/api/v1/threat-actors/sync");
      toast.success("Syncing MITRE ATT&CK data...");
      setTimeout(fetchActors, 5000);
    } catch { toast.error("Sync failed"); }
    finally { setSyncing(false); }
  };

  useEffect(() => { fetchActors(); fetchRansomware(); }, []);
  useEffect(() => { fetchActors(); }, [search]);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Skull className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Threat Actor Directory</h1>
            <p className="text-[11px] text-slate-500">MITRE ATT&CK groups, ransomware feeds, TTPs</p>
          </div>
        </div>
        <button onClick={syncActors} disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-all">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync MITRE ATT&CK
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0a0f1e] rounded-lg p-1 border border-purple-500/[0.06] w-fit">
        {(["actors", "ransomware"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${tab === t ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-slate-500 hover:text-white"}`}>
            {t === "actors" ? "Threat Actors" : "Ransomware Groups"}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search threat actors, groups, TTPs..."
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-purple-500/[0.06] rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-red-500/20 transition-all" />
      </div>

      {/* Actors Tab */}
      {tab === "actors" && (
        <div className="card-enterprise overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-red-400" /></div>
          ) : actors.length === 0 ? (
            <div className="p-12 text-center">
              <Skull className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No threat actors loaded. Click &quot;Sync MITRE ATT&CK&quot; to fetch data.</p>
            </div>
          ) : (
            <div className="divide-y divide-purple-500/[0.04]">
              {actors.map((actor) => (
                <div key={actor.id} className="p-4 hover:bg-white/[0.01] cursor-pointer transition-colors" onClick={() => setSelectedActor(actor)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-red-400">{actor.name}</span>
                        {actor.country && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.03] text-slate-400 border border-white/[0.06] flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{actor.country}
                          </span>
                        )}
                        {actor.motivation && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            {actor.motivation}
                          </span>
                        )}
                      </div>
                      {actor.aliases?.length > 0 && (
                        <p className="text-[10px] text-slate-600 mt-1">aka: {actor.aliases.slice(0, 3).join(", ")}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{actor.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-700 flex-shrink-0 mt-1" />
                  </div>
                  {actor.target_sectors?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {actor.target_sectors.slice(0, 4).map((s, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.02] text-slate-500 border border-white/[0.04]">
                          <Target className="w-2.5 h-2.5 inline mr-0.5" />{s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ransomware Tab */}
      {tab === "ransomware" && (
        <div className="card-enterprise overflow-hidden">
          {ransomware.length === 0 ? (
            <div className="p-12 text-center">
              <AlertTriangle className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No ransomware data loaded. Sync to fetch latest data.</p>
            </div>
          ) : (
            <div className="divide-y divide-purple-500/[0.04]">
              {ransomware.map((group, i) => (
                <div key={i} className="p-4 hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <Skull className="w-4 h-4 text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-red-400">{group.name}</p>
                        {group.last_seen && <p className="text-[10px] text-slate-600">Last active: {group.last_seen}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      {group.victim_count != null && (
                        <p className="text-sm font-bold text-slate-300">{group.victim_count}</p>
                      )}
                      <p className="text-[10px] text-slate-600">victims</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actor Detail Modal */}
      {selectedActor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedActor(null)}>
          <div className="bg-[#0d1321] rounded-xl border border-purple-500/10 max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-red-400">{selectedActor.name}</h2>
                {selectedActor.aliases?.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">Also known as: {selectedActor.aliases.join(", ")}</p>
                )}
              </div>
              <button onClick={() => setSelectedActor(null)} className="p-2 text-slate-500 hover:text-white">x</button>
            </div>
            <p className="text-sm text-slate-400 mb-4">{selectedActor.description}</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {selectedActor.country && (
                <div className="stat-card p-3">
                  <p className="text-[10px] text-slate-500 uppercase">Country</p>
                  <p className="text-sm text-slate-300 mt-1">{selectedActor.country}</p>
                </div>
              )}
              {selectedActor.motivation && (
                <div className="stat-card p-3">
                  <p className="text-[10px] text-slate-500 uppercase">Motivation</p>
                  <p className="text-sm text-slate-300 mt-1">{selectedActor.motivation}</p>
                </div>
              )}
            </div>
            {selectedActor.techniques?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Techniques (TTPs)</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedActor.techniques.map((t, i) => (
                    <span key={i} className="px-2 py-1 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-mono">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {selectedActor.target_sectors?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Target Sectors</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedActor.target_sectors.map((s, i) => (
                    <span key={i} className="px-2 py-1 rounded text-[10px] bg-white/[0.03] text-slate-400 border border-white/[0.06]">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {selectedActor.malware_used?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Malware Used</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedActor.malware_used.map((m, i) => (
                    <span key={i} className="px-2 py-1 rounded text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20">{m}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
