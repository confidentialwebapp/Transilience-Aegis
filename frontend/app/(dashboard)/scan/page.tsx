"use client";

import { InfinityLoader } from "@/components/InfinityLoader";

import { useState } from "react";
import {
  Network, Globe, Skull, Shield,
  AlertTriangle, Server, ExternalLink, ChevronDown,
  Bug
} from "lucide-react";
import { api, getOrgId, type AttackSurfaceResult, type TyposquatResult, type NmapResult, type NucleiResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tool = "subdomains" | "typosquats" | "nmap" | "nuclei";

const TOOLS: { id: Tool; label: string; icon: any; placeholder: string; desc: string; color: string }[] = [
  { id: "subdomains", label: "Subdomains",  icon: Network,        placeholder: "acme.com",          desc: "subfinder → dnsx → httpx pipeline. Returns alive hosts with status code, title, and tech stack.", color: "#3b82f6" },
  { id: "typosquats", label: "Typosquats",  icon: Globe,          placeholder: "acme.com",          desc: "dnstwist — detects lookalike, IDN, and homograph domains targeting your brand.",                  color: "#a855f7" },
  { id: "nmap",       label: "Nmap",        icon: Server,         placeholder: "scanme.nmap.org",   desc: "Port + service detection. Default: top 100 TCP ports with version detection. Auth required.",      color: "#f97316" },
  { id: "nuclei",     label: "Nuclei",      icon: Bug,            placeholder: "https://example.com", desc: "Templated vulnerability scanner. Critical/High/Medium severity by default. Auth required.",     color: "#ef4444" },
];

export default function ScanPage() {
  const [active, setActive] = useState<Tool>("subdomains");
  const [target, setTarget] = useState("");
  const [args, setArgs] = useState("-sV -F -T4");
  const [severity, setSeverity] = useState("critical,high,medium");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const tool = TOOLS.find((t) => t.id === active)!;
  const ToolIcon = tool.icon;

  const handleRun = async () => {
    const t = target.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!t) {
      toast.error("Enter a target");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      let r: any;
      if (active === "subdomains") r = await api.scanSubdomains(getOrgId(), t);
      else if (active === "typosquats") r = await api.scanTyposquats(getOrgId(), t);
      else if (active === "nmap") r = await api.scanNmap(getOrgId(), target.trim(), args);
      else if (active === "nuclei") r = await api.scanNuclei(getOrgId(), target.trim(), severity);
      setResult(r);
      if (r?.ok === false && r?.error) {
        toast.error(`scan returned error: ${r.error.slice(0, 120)}`);
      } else {
        toast.success(`${tool.label} scan complete`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "scan failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,rgba(59,130,246,0.15),rgba(168,85,247,0.1))", border: "1px solid rgba(59,130,246,0.2)" }}>
          <Shield className="w-5 h-5 text-blue-300" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Active Scanners</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Kali tools running on Modal serverless · pay-per-second</p>
        </div>
      </div>

      <div className="card-enterprise p-4">
        <div className="flex flex-wrap gap-2">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => { setActive(t.id); setResult(null); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2",
                  active === t.id
                    ? "border-white/20 text-white"
                    : "bg-white/[0.02] text-slate-400 border-white/[0.06] hover:text-slate-200"
                )}
                style={active === t.id ? { background: `${t.color}20`, borderColor: `${t.color}40`, color: t.color } : {}}>
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-3">{tool.desc}</p>
      </div>

      <div className="card-enterprise p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ToolIcon className="w-4 h-4" style={{ color: tool.color }} />
          <span className="text-xs text-slate-400 font-semibold">Target</span>
        </div>
        <div className="flex gap-2">
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={tool.placeholder}
            onKeyDown={(e) => e.key === "Enter" && !running && handleRun()}
            className="flex-1 h-10 px-3 rounded-lg bg-white/[0.02] border border-white/[0.08] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40" />
          <button onClick={handleRun} disabled={running || !target.trim()}
            className="h-10 px-5 rounded-lg flex items-center gap-2 text-sm font-semibold text-white btn-brand disabled:opacity-40">
            {running ? <InfinityLoader size={16} /> : <ToolIcon className="w-4 h-4" />}
            {running ? "Running…" : `Run ${tool.label}`}
          </button>
        </div>
        {active === "nmap" && (
          <div>
            <label className="text-[11px] text-slate-500">nmap args</label>
            <input value={args} onChange={(e) => setArgs(e.target.value)}
              className="w-full mt-1 h-9 px-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[12px] text-slate-300 font-mono focus:outline-none focus:border-orange-500/30" />
          </div>
        )}
        {active === "nuclei" && (
          <div>
            <label className="text-[11px] text-slate-500">severity</label>
            <input value={severity} onChange={(e) => setSeverity(e.target.value)}
              className="w-full mt-1 h-9 px-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[12px] text-slate-300 font-mono focus:outline-none focus:border-red-500/30" />
          </div>
        )}
      </div>

      {running && (
        <div className="card-enterprise p-8 flex flex-col items-center gap-3">
          <InfinityLoader size={32} />
          <p className="text-sm text-slate-300">Running {tool.label} on Modal…</p>
          <p className="text-[11px] text-slate-600">First call has a ~5s cold start; subsequent runs are instant</p>
        </div>
      )}

      {/* Empty state — shown before first scan */}
      {!result && !running && (
        <div className="card-enterprise p-10 flex flex-col items-center text-center animate-fade-up">
          {/* Icon ring */}
          <div className="relative w-28 h-28 mb-6">
            <div className="absolute inset-0 rounded-full opacity-10 animate-ping"
              style={{ background: "radial-gradient(circle, rgba(59,130,246,0.4), transparent 70%)" }} />
            {[
              { Icon: Network,       angle: 0,   color: "#3b82f6", label: "Subdomains" },
              { Icon: Globe,         angle: 90,  color: "#a855f7", label: "Typosquats" },
              { Icon: Server,        angle: 180, color: "#f97316", label: "Nmap" },
              { Icon: Bug,           angle: 270, color: "#ef4444", label: "Nuclei" },
            ].map(({ Icon, angle, color, label }) => {
              const rad = (angle * Math.PI) / 180;
              const x = 50 + 38 * Math.cos(rad);
              const y = 50 + 38 * Math.sin(rad);
              return (
                <div key={angle}
                  className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${x}%`, top: `${y}%` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                </div>
              );
            })}
            <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,rgba(59,130,246,0.15),rgba(168,85,247,0.1))", border: "1px solid rgba(59,130,246,0.25)" }}>
              <Shield className="w-6 h-6 text-blue-300" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight">Run your first Kali scan</h2>
          <p className="text-[13px] text-slate-400 mt-2 max-w-sm leading-relaxed">
            Enumerate subdomains, hunt typosquats, port-scan a target, or check vulnerabilities —{" "}
            <span className="text-blue-300 font-semibold">all on Modal serverless</span>, no infra required.
          </p>

          <button
            onClick={() => {
              setTarget("example.com");
              setActive("subdomains");
            }}
            className="mt-5 h-9 px-5 rounded-lg flex items-center gap-2 text-sm font-semibold text-white btn-brand">
            <Network className="w-4 h-4" />
            Try with example.com
          </button>

          <div className="mt-6 w-full max-w-xs">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-px" style={{ background: "rgba(59,130,246,0.08)" }} />
              <span className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">How it works</span>
              <div className="flex-1 h-px" style={{ background: "rgba(59,130,246,0.08)" }} />
            </div>
            <ol className="space-y-2 text-left">
              {[
                { n: "1", text: "Pick a tool above — Subdomains, Typosquats, Nmap, or Nuclei" },
                { n: "2", text: "Enter your target domain or IP and click Run" },
                { n: "3", text: "Modal cold-starts in ~5s and runs the scan — results appear instantly" },
              ].map(({ n, text }) => (
                <li key={n} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-blue-300"
                    style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", marginTop: "1px" }}>
                    {n}
                  </span>
                  <span className="text-[11px] text-slate-500 leading-relaxed">{text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {result && !running && (
        <div className="space-y-3">
          {result.ok === false && result.error && (
            <div className="card-enterprise p-4 border border-red-500/20 bg-red-500/[0.02]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-300 font-semibold">Error</p>
                  <p className="text-[12px] text-red-200/80 mt-1 font-mono">{result.error}</p>
                  {result.error.includes("MODAL_TOKEN") && (
                    <p className="text-[11px] text-slate-400 mt-2">
                      Modal isn't configured on the backend yet. Add MODAL_TOKEN_ID and MODAL_TOKEN_SECRET to Render env vars.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Subdomains result */}
          {active === "subdomains" && result.alive_count !== undefined && (
            <SubdomainResult r={result as AttackSurfaceResult} />
          )}

          {/* Typosquats result */}
          {active === "typosquats" && Array.isArray(result.results) && (
            <TyposquatList r={result as TyposquatResult} />
          )}

          {/* Nmap result */}
          {active === "nmap" && result.output !== undefined && (
            <pre className="card-enterprise p-4 text-[11px] text-slate-300 font-mono overflow-x-auto whitespace-pre">
              {result.output || "(no output)"}
            </pre>
          )}

          {/* Nuclei result */}
          {active === "nuclei" && result.findings !== undefined && (
            <NucleiList r={result as NucleiResult} />
          )}
        </div>
      )}
    </div>
  );
}

function SubdomainResult({ r }: { r: AttackSurfaceResult }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Subdomains" value={r.subdomain_count} color="#3b82f6" />
        <Stat label="Resolved"   value={r.resolved.length}  color="#a855f7" />
        <Stat label="Alive"      value={r.alive_count}      color="#10b981" />
      </div>
      <div className="card-enterprise p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">Alive hosts</h3>
        {r.alive.length === 0 ? (
          <p className="text-[12px] text-slate-500">No live hosts found in the probe.</p>
        ) : (
          <div className="space-y-1.5">
            {r.alive.map((h, i) => (
              <div key={i} className="rounded-lg p-2 bg-white/[0.02] border border-white/[0.05] flex items-center gap-2 text-[12px]">
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold",
                  (h.status_code || 0) >= 400 ? "bg-red-500/15 text-red-300"
                  : (h.status_code || 0) >= 300 ? "bg-yellow-500/15 text-yellow-300"
                  : "bg-emerald-500/15 text-emerald-300")}>
                  {h.status_code ?? "—"}
                </span>
                <span className="font-mono text-slate-300 truncate flex-1">{h.url || h.host}</span>
                {h.title && <span className="text-slate-500 italic truncate max-w-[40%]">{h.title}</span>}
                {h.tech && h.tech.length > 0 && (
                  <span className="flex gap-1">
                    {h.tech.slice(0, 3).map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/10 text-purple-300 border border-purple-500/20">{t}</span>
                    ))}
                  </span>
                )}
                {h.url && <a href={h.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white"><ExternalLink className="w-3 h-3" /></a>}
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="card-enterprise p-4">
        <summary className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] cursor-pointer">
          All subdomains ({r.subdomains.length})
        </summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 mt-3 max-h-80 overflow-auto">
          {r.subdomains.map((s) => (
            <span key={s} className="font-mono text-[11px] text-slate-300 px-2 py-1 rounded-md bg-white/[0.02] border border-white/[0.05] truncate" title={s}>{s}</span>
          ))}
        </div>
      </details>
    </>
  );
}

function TyposquatList({ r }: { r: TyposquatResult }) {
  return (
    <div className="card-enterprise p-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">
        {r.count} registered typosquats
      </h3>
      {r.results.length === 0 ? (
        <p className="text-[12px] text-slate-500">No registered typosquats found — your brand is clean.</p>
      ) : (
        <div className="space-y-2">
          {r.results.map((t, i) => (
            <div key={i} className="rounded-lg p-2 bg-white/[0.02] border border-purple-500/15">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] text-purple-300 font-semibold">{t.domain}</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] uppercase bg-white/[0.04] text-slate-400">{t.fuzzer}</span>
                {t.geoip && <span className="text-[10px] text-slate-500">📍 {t.geoip}</span>}
              </div>
              {(t.dns_a || t.dns_mx) && (
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  {t.dns_a?.length ? `A: ${t.dns_a.slice(0, 3).join(", ")}` : ""}
                  {t.dns_mx?.length ? ` · MX: ${t.dns_mx.slice(0, 2).join(", ")}` : ""}
                </div>
              )}
              {t.whois_registrar && <p className="text-[10px] text-slate-600 mt-1">{t.whois_registrar}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NucleiList({ r }: { r: NucleiResult }) {
  return (
    <div className="card-enterprise p-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">
        {r.count} findings ({r.severity_filter})
      </h3>
      {r.findings.length === 0 ? (
        <p className="text-[12px] text-slate-500">No findings at the requested severity.</p>
      ) : (
        <div className="space-y-2">
          {r.findings.map((f, i) => {
            const sev = (f.info?.severity || "info").toLowerCase();
            const color = sev === "critical" ? "red" : sev === "high" ? "orange" : sev === "medium" ? "yellow" : "slate";
            return (
              <div key={i} className={cn("rounded-lg p-3 bg-white/[0.02] border", `border-${color}-500/20`)}>
                <div className="flex items-center gap-2">
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", `bg-${color}-500/15 text-${color}-300`)}>
                    {sev}
                  </span>
                  <span className="text-[13px] font-semibold text-slate-200">{f.info?.name || f["template-id"]}</span>
                </div>
                {f["matched-at"] && (
                  <p className="text-[11px] text-slate-400 font-mono mt-1 break-all">{f["matched-at"]}</p>
                )}
                {f.info?.description && (
                  <p className="text-[11px] text-slate-500 mt-1">{f.info.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="stat-card p-4">
      <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">{label}</p>
      <p className="text-[26px] font-bold font-mono leading-none mt-2" style={{ color }}>{value}</p>
    </div>
  );
}
