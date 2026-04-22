"use client";

import { InfinityLoader } from "@/components/InfinityLoader";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  BookOpen,
  Terminal,
  ChevronRight,
  Copy,
  Check,
  Play,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Key,
  Globe,
  Search,
  ChevronDown,
  X,
  Lock,
  Zap,
  Code,
  ExternalLink,
  Hash,
} from "lucide-react";
import { getOrgId } from "@/lib/api";

// ─── OpenAPI types (minimal subset we need) ───────────────────────────────

interface OAParameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  required?: boolean;
  description?: string;
  schema?: {
    type?: string;
    default?: unknown;
    example?: unknown;
  };
  example?: unknown;
}

interface OAOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: OAParameter[];
  requestBody?: {
    required?: boolean;
    content?: {
      "application/json"?: {
        schema?: { properties?: Record<string, unknown>; example?: unknown };
        example?: unknown;
      };
    };
  };
  responses?: Record<string, { description?: string }>;
}

interface OAPath {
  get?: OAOperation;
  post?: OAOperation;
  put?: OAOperation;
  patch?: OAOperation;
  delete?: OAOperation;
}

interface OpenAPISpec {
  info?: { title?: string; version?: string; description?: string };
  paths?: Record<string, OAPath>;
  tags?: Array<{ name: string; description?: string }>;
}

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

interface FlatEndpoint {
  method: HttpMethod;
  path: string;
  tag: string;
  operation: OAOperation;
  id: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const API_BASE = "https://tai-aegis-api.onrender.com";
const OPENAPI_URL = `${API_BASE}/openapi.json`;

const METHOD_STYLES: Record<
  HttpMethod,
  { label: string; bg: string; text: string; border: string }
> = {
  get:    { label: "GET",    bg: "rgba(16,185,129,0.12)",  text: "#10b981", border: "rgba(16,185,129,0.2)"  },
  post:   { label: "POST",   bg: "rgba(59,130,246,0.12)",  text: "#3b82f6", border: "rgba(59,130,246,0.2)"  },
  put:    { label: "PUT",    bg: "rgba(139,92,246,0.12)",  text: "#8b5cf6", border: "rgba(139,92,246,0.2)"  },
  patch:  { label: "PATCH",  bg: "rgba(234,179,8,0.12)",   text: "#eab308", border: "rgba(234,179,8,0.2)"   },
  delete: { label: "DELETE", bg: "rgba(239,68,68,0.12)",   text: "#ef4444", border: "rgba(239,68,68,0.2)"   },
};

// Canonical tag ordering — matches sidebar spec
const TAG_ORDER = [
  "Dashboard",
  "Assets",
  "Alerts",
  "Intel",
  "Investigate",
  "CVE",
  "Vendors",
  "Infrastructure",
  "IOC Watchlist",
  "Threat Actors",
  "Settings",
  "Recon",
  "OSINT",
  "Customer Profiles",
  "Researcher Feed",
  "Maltego Transforms",
  "Email Digest",
  "Scans",
];

// ─── Quickstart snippets ──────────────────────────────────────────────────

const QUICKSTART_TABS = ["curl", "python", "javascript"] as const;
type QSTab = (typeof QUICKSTART_TABS)[number];

const QS_SNIPPETS: Record<QSTab, string> = {
  curl: `curl -X GET \\
  "https://tai-aegis-api.onrender.com/api/v1/intel/lookup?type=ip&value=8.8.8.8" \\
  -H "X-Org-Id: YOUR_ORG_ID" \\
  -H "Content-Type: application/json"`,

  python: `import httpx

response = httpx.get(
    "https://tai-aegis-api.onrender.com/api/v1/intel/lookup",
    params={"type": "ip", "value": "8.8.8.8"},
    headers={"X-Org-Id": "YOUR_ORG_ID"},
)
data = response.json()
print(data)`,

  javascript: `const response = await fetch(
  "https://tai-aegis-api.onrender.com/api/v1/intel/lookup?type=ip&value=8.8.8.8",
  {
    headers: {
      "X-Org-Id": "YOUR_ORG_ID",
      "Content-Type": "application/json",
    },
  }
);
const data = await response.json();
console.log(data);`,
};

// ─── Sub-components ────────────────────────────────────────────────────────

function MethodPill({ method }: { method: HttpMethod }) {
  const s = METHOD_STYLES[method];
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider shrink-0"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-md text-slate-500 hover:text-white transition-colors"
      style={{ background: "rgba(255,255,255,0.05)" }}
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CodeBlock({
  code,
  language,
  className: extraClass = "",
}: {
  code: string;
  language?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-xl overflow-hidden ${extraClass}`}
      style={{ background: "rgba(7,4,11,0.8)", border: "1px solid rgba(139,92,246,0.1)" }}
    >
      {language && (
        <div
          className="flex items-center justify-between px-4 py-2 border-b"
          style={{ borderColor: "rgba(139,92,246,0.08)", background: "rgba(17,13,26,0.6)" }}
        >
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
            {language}
          </span>
          <CopyButton text={code} />
        </div>
      )}
      <pre className="p-4 text-xs text-slate-300 font-mono leading-relaxed overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

// Try-it-out side panel
function TryItPanel({
  endpoint,
  onClose,
}: {
  endpoint: FlatEndpoint;
  onClose: () => void;
}) {
  const orgId = getOrgId();
  const params = endpoint.operation.parameters ?? [];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      params.map((p) => [
        p.name,
        String(p.schema?.default ?? p.schema?.example ?? p.example ?? ""),
      ])
    )
  );
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    status: number;
    body: string;
    ms: number;
  } | null>(null);

  const send = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    const start = Date.now();
    try {
      // Build URL with path + query params
      let url = `${API_BASE}${endpoint.path}`;
      const queryParams: string[] = [];
      params.forEach((p) => {
        const val = values[p.name];
        if (!val) return;
        if (p.in === "path") {
          url = url.replace(`{${p.name}}`, encodeURIComponent(val));
        } else if (p.in === "query") {
          queryParams.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(val)}`);
        }
      });
      if (queryParams.length) url += "?" + queryParams.join("&");

      const res = await fetch(url, {
        method: endpoint.method.toUpperCase(),
        headers: {
          "Content-Type": "application/json",
          "X-Org-Id": orgId,
        },
      });
      const ms = Date.now() - start;
      let body: string;
      try {
        const json = await res.json();
        body = JSON.stringify(json, null, 2);
      } catch {
        body = await res.text();
      }
      setResponse({ status: res.status, body, ms });
    } catch (err) {
      setResponse({ status: 0, body: String(err), ms: Date.now() - start });
    } finally {
      setLoading(false);
    }
  }, [endpoint, params, values, orgId]);

  const statusColor =
    response === null
      ? "#64748b"
      : response.status >= 200 && response.status < 300
      ? "#10b981"
      : response.status >= 400
      ? "#ef4444"
      : "#f97316";

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col animate-slide-in"
      style={{
        background: "rgba(10,7,16,0.98)",
        border: "1px solid rgba(139,92,246,0.18)",
        borderRight: "none",
        backdropFilter: "blur(16px)",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b shrink-0"
        style={{ borderColor: "rgba(139,92,246,0.1)" }}
      >
        <Play className="w-4 h-4 text-purple-400" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <MethodPill method={endpoint.method} />
            <code className="text-xs text-slate-300 font-mono truncate">{endpoint.path}</code>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors hover:bg-white/5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Auth note */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-slate-400"
          style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)" }}
        >
          <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>Sending with <code className="text-purple-300 font-mono text-[10px]">X-Org-Id: {orgId.slice(0, 8)}...</code></span>
        </div>

        {/* Parameters */}
        {params.filter((p) => p.in !== "header").length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
              Parameters
            </h4>
            <div className="space-y-3">
              {params
                .filter((p) => p.in !== "header")
                .map((p) => (
                  <div key={p.name}>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300 mb-1">
                      <code className="font-mono text-purple-300">{p.name}</code>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase"
                        style={{
                          background: p.in === "path" ? "rgba(234,179,8,0.1)" : "rgba(59,130,246,0.1)",
                          color: p.in === "path" ? "#eab308" : "#3b82f6",
                        }}
                      >
                        {p.in}
                      </span>
                      {p.required && (
                        <span className="text-[9px] text-red-400">required</span>
                      )}
                    </label>
                    {p.description && (
                      <p className="text-[10px] text-slate-600 mb-1">{p.description}</p>
                    )}
                    <input
                      type="text"
                      value={values[p.name] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [p.name]: e.target.value }))
                      }
                      placeholder={
                        String(p.schema?.example ?? p.example ?? p.schema?.default ?? "")
                      }
                      className="w-full px-3 py-2 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(139,92,246,0.12)",
                      }}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Send button */}
        <button
          onClick={send}
          disabled={loading}
          className="w-full btn-brand py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              <InfinityLoader size={16} />
              Sending...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Send Request
            </>
          )}
        </button>

        {/* Response */}
        {response && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Response
              </h4>
              <span
                className="text-[11px] font-mono font-bold px-2 py-0.5 rounded"
                style={{ color: statusColor, background: `${statusColor}15` }}
              >
                {response.status || "ERR"}
              </span>
              <span className="text-[10px] text-slate-600 font-mono ml-auto">
                {response.ms}ms
              </span>
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "rgba(7,4,11,0.9)", border: "1px solid rgba(139,92,246,0.08)" }}
            >
              <div
                className="flex items-center justify-between px-3 py-1.5 border-b"
                style={{ borderColor: "rgba(139,92,246,0.07)" }}
              >
                <span className="text-[10px] text-slate-600 font-mono">application/json</span>
                <CopyButton text={response.body} />
              </div>
              <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-80 leading-relaxed whitespace-pre">
                {response.body}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [spec, setSpec] = useState<OpenAPISpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tryItEndpoint, setTryItEndpoint] = useState<FlatEndpoint | null>(null);
  const [qsTab, setQsTab] = useState<QSTab>("curl");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<Record<string, HTMLElement>>({});

  // Fetch OpenAPI spec
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(OPENAPI_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: OpenAPISpec = await res.json();
        if (!cancelled) {
          setSpec(json);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load API specification"
          );
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Flatten spec into tagged endpoint list
  const endpoints: FlatEndpoint[] = [];
  if (spec?.paths) {
    Object.entries(spec.paths).forEach(([path, pathObj]) => {
      (["get", "post", "put", "patch", "delete"] as HttpMethod[]).forEach(
        (method) => {
          const op = pathObj[method];
          if (!op) return;
          const tag = op.tags?.[0] ?? "Other";
          endpoints.push({
            method,
            path,
            tag,
            operation: op,
            id: `${method}-${path}`,
          });
        }
      );
    });
  }

  // Group by tag, respecting canonical order
  const allTags = [
    ...TAG_ORDER.filter((t) => endpoints.some((e) => e.tag === t)),
    ...endpoints
      .map((e) => e.tag)
      .filter((t) => !TAG_ORDER.includes(t))
      .filter((v, i, a) => a.indexOf(v) === i),
  ];

  // Search filter
  const filteredEndpoints = searchQuery
    ? endpoints.filter(
        (e) =>
          e.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.operation.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : endpoints;

  const filteredTags = searchQuery
    ? [...new Set(filteredEndpoints.map((e) => e.tag))]
    : allTags;

  const scrollToTag = (tag: string) => {
    setActiveTag(tag);
    sectionRefs.current[tag]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setSidebarOpen(false);
  };

  const toggleEndpoint = (id: string) => {
    setExpandedEndpoints((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}
        >
          <InfinityLoader size={28} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white mb-1">Loading API reference</p>
          <p className="text-xs text-slate-500">
            Fetching spec from <code className="text-slate-400 font-mono">tai-aegis-api.onrender.com</code>
            <br />
            <span className="text-[11px] text-slate-600">(Render free tier may take up to 30s to cold-start)</span>
          </p>
        </div>
        <div className="w-48 h-1 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.1)" }}>
          <div
            className="h-full rounded-full animate-pulse"
            style={{ background: "linear-gradient(90deg, #8b5cf6, #ec4899)", width: "60%" }}
          />
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <div className="text-center max-w-md">
          <p className="text-sm font-semibold text-white mb-1">Could not load API spec</p>
          <p className="text-xs text-slate-500 mb-4">
            {error}. The backend may be cold-starting — try again in 30 seconds.
          </p>
          <button
            onClick={() => { setError(null); setLoading(true); }}
            className="btn-brand px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <>
      {/* Try-it panel overlay */}
      {tryItEndpoint && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setTryItEndpoint(null)}
          />
          <TryItPanel
            endpoint={tryItEndpoint}
            onClose={() => setTryItEndpoint(null)}
          />
        </>
      )}

      <div className="flex min-h-screen" style={{ background: "#07040B" }}>

        {/* ── SIDEBAR (desktop sticky / mobile drawer) ───────────────────── */}
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed top-0 left-0 h-full z-30 flex flex-col shrink-0
            transition-transform duration-300 ease-in-out
            md:static md:translate-x-0 md:flex md:z-auto
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
          style={{
            width: "240px",
            background: "rgba(10,7,16,0.97)",
            borderRight: "1px solid rgba(139,92,246,0.08)",
            paddingTop: "0",
          }}
        >
          {/* Sidebar header */}
          <div
            className="flex items-center justify-between px-4 py-4 border-b shrink-0"
            style={{ borderColor: "rgba(139,92,246,0.08)" }}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-white">API Reference</span>
            </div>
            <button
              className="md:hidden p-1 text-slate-500 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
              <input
                type="text"
                placeholder="Search endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-2 rounded-lg text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(139,92,246,0.1)",
                }}
              />
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto px-2 pb-6">
            {/* Quickstart link */}
            <button
              onClick={() => {
                document.getElementById("quickstart")?.scrollIntoView({ behavior: "smooth" });
                setSidebarOpen(false);
              }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors mb-1"
            >
              <Zap className="w-3 h-3 text-yellow-400 shrink-0" />
              Quickstart
            </button>

            <div className="mt-2 mb-1 px-2">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">
                {searchQuery ? `${filteredTags.length} tags matched` : "Endpoints"}
              </span>
            </div>

            {filteredTags.map((tag) => {
              const count = filteredEndpoints.filter((e) => e.tag === tag).length;
              return (
                <button
                  key={tag}
                  onClick={() => scrollToTag(tag)}
                  className={`w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    activeTag === tag
                      ? "text-white bg-purple-500/10"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3 h-3 shrink-0 opacity-50" />
                    {tag}
                  </span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-mono shrink-0"
                    style={{
                      background: activeTag === tag ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.05)",
                      color: activeTag === tag ? "#a855f7" : "#475569",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Base URL chip */}
          <div
            className="px-3 py-3 border-t shrink-0"
            style={{ borderColor: "rgba(139,92,246,0.08)" }}
          >
            <div
              className="px-3 py-2 rounded-lg"
              style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.1)" }}
            >
              <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-0.5">Base URL</p>
              <code className="text-[10px] text-purple-300 font-mono break-all">
                tai-aegis-api.onrender.com
              </code>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 px-4 sm:px-8 py-8 max-w-4xl">

          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden mb-6 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.1)" }}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Jump to section
            <ChevronDown className="w-3.5 h-3.5 ml-auto" />
          </button>

          {/* ── PAGE HEADER ──────────────────────────────────────────── */}
          <div className="mb-12 animate-fade-up">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-purple-400 mb-3">
              API Reference
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gradient-brand leading-tight mb-4">
              Build on AEGIS
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-2xl mb-6">
              RESTful JSON API. Authenticate with the{" "}
              <code className="text-purple-300 font-mono text-xs px-1 py-0.5 rounded"
                style={{ background: "rgba(139,92,246,0.1)" }}>
                X-Org-Id
              </code>{" "}
              header (Bearer auth coming Q3 2026). Base URL:{" "}
              <code className="text-slate-300 font-mono text-xs">
                https://tai-aegis-api.onrender.com
              </code>
            </p>

            {/* CTA row */}
            <div className="flex flex-wrap gap-3">
              <a
                href="/dashboard/api-keys"
                className="btn-brand px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                Get an API key
              </a>
              <a
                href="/register"
                className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.12)" }}
              >
                <Globe className="w-3.5 h-3.5" />
                Authenticate
                <ArrowRight className="w-3 h-3" />
              </a>
              <a
                href="/status"
                target="_blank"
                className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.08)" }}
              >
                <span className="status-live inline-block" />
                API Status
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Stats strip */}
            <div className="mt-8 flex flex-wrap gap-4">
              {[
                { label: "Endpoints", value: endpoints.length || "—", color: "#8b5cf6" },
                { label: "Tags", value: allTags.length || "—", color: "#3b82f6" },
                { label: "API version", value: spec?.info?.version ?? "1.0", color: "#10b981" },
                { label: "Auth", value: "X-Org-Id header", color: "#f97316" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.07)" }}
                >
                  <span className="text-base font-extrabold font-mono" style={{ color: s.color }}>
                    {s.value}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── QUICKSTART ───────────────────────────────────────────── */}
          <section id="quickstart" className="mb-14 animate-fade-up scroll-mt-8">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.2)" }}
              >
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
              </div>
              <h2 className="text-sm font-bold text-white">Quickstart</h2>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}
              >
                GET /api/v1/intel/lookup
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              The most common operation — enrich an IP, domain, or hash against 12+ intel sources in a single call.
            </p>

            {/* Language tabs */}
            <div
              className="flex gap-1 mb-0 p-1 rounded-t-xl w-fit"
              style={{ background: "rgba(17,13,26,0.8)", border: "1px solid rgba(139,92,246,0.1)", borderBottom: "none" }}
            >
              {QUICKSTART_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setQsTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors capitalize ${
                    qsTab === tab
                      ? "text-white"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                  style={
                    qsTab === tab
                      ? { background: "rgba(139,92,246,0.15)", color: "#a78bfa" }
                      : {}
                  }
                >
                  {tab === "javascript" ? "JS / TS" : tab}
                </button>
              ))}
            </div>
            <CodeBlock
              code={QS_SNIPPETS[qsTab]}
              language={qsTab === "javascript" ? "javascript" : qsTab}
              className="rounded-tl-none"
            />
          </section>

          {/* ── ENDPOINT SECTIONS ────────────────────────────────────── */}
          {filteredTags.map((tag) => {
            const tagEndpoints = filteredEndpoints.filter((e) => e.tag === tag);
            if (tagEndpoints.length === 0) return null;

            return (
              <section
                key={tag}
                id={`tag-${tag}`}
                className="mb-12 scroll-mt-8 animate-fade-up"
                ref={(el) => {
                  if (el) sectionRefs.current[tag] = el;
                }}
              >
                {/* Tag header */}
                <div
                  className="flex items-center gap-3 mb-5 pb-3 border-b"
                  style={{ borderColor: "rgba(139,92,246,0.08)" }}
                >
                  <div
                    className="w-1 h-6 rounded-full"
                    style={{ background: "linear-gradient(180deg, #8b5cf6, #ec4899)" }}
                  />
                  <h2 className="text-base font-bold text-white">{tag}</h2>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                    style={{ background: "rgba(139,92,246,0.08)", color: "#64748b" }}
                  >
                    {tagEndpoints.length} endpoint{tagEndpoints.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Endpoint cards */}
                <div className="space-y-3">
                  {tagEndpoints.map((ep) => {
                    const isExpanded = expandedEndpoints.has(ep.id);
                    const params = ep.operation.parameters ?? [];
                    const hasParams = params.length > 0;

                    return (
                      <div
                        key={ep.id}
                        className="card-enterprise overflow-hidden"
                      >
                        {/* Card header — always visible */}
                        <button
                          onClick={() => toggleEndpoint(ep.id)}
                          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.015] transition-colors"
                        >
                          <MethodPill method={ep.method} />
                          <code className="flex-1 min-w-0 text-xs font-mono text-slate-200 truncate">
                            {ep.path}
                          </code>
                          {ep.operation.summary && (
                            <span className="hidden sm:block text-[11px] text-slate-500 truncate max-w-[200px] shrink-0">
                              {ep.operation.summary}
                            </span>
                          )}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTryItEndpoint(ep);
                              }}
                              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-purple-300 hover:text-white transition-colors"
                              style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.18)" }}
                              title="Try this endpoint"
                            >
                              <Play className="w-2.5 h-2.5" />
                              Try
                            </button>
                            <ChevronRight
                              className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${
                                isExpanded ? "rotate-90" : ""
                              }`}
                            />
                          </div>
                        </button>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div
                            className="border-t px-5 py-4 space-y-4"
                            style={{ borderColor: "rgba(139,92,246,0.07)" }}
                          >
                            {ep.operation.summary && (
                              <p className="text-xs text-slate-300">{ep.operation.summary}</p>
                            )}
                            {ep.operation.description && ep.operation.description !== ep.operation.summary && (
                              <p className="text-xs text-slate-500 leading-relaxed">{ep.operation.description}</p>
                            )}

                            {/* Parameters table */}
                            {hasParams && (
                              <div>
                                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
                                  Parameters
                                </h4>
                                <div
                                  className="rounded-lg overflow-hidden"
                                  style={{ border: "1px solid rgba(139,92,246,0.07)" }}
                                >
                                  {/* Table header */}
                                  <div
                                    className="grid text-[10px] font-semibold uppercase tracking-wider text-slate-600 px-3 py-2"
                                    style={{
                                      gridTemplateColumns: "1fr 80px 70px 2fr",
                                      background: "rgba(17,13,26,0.6)",
                                      borderBottom: "1px solid rgba(139,92,246,0.06)",
                                    }}
                                  >
                                    <span>Name</span>
                                    <span>In</span>
                                    <span>Required</span>
                                    <span>Description</span>
                                  </div>
                                  {params.map((p, pi) => (
                                    <div
                                      key={p.name}
                                      className="grid px-3 py-2.5 text-xs gap-x-2"
                                      style={{
                                        gridTemplateColumns: "1fr 80px 70px 2fr",
                                        background: pi % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                                        borderBottom:
                                          pi < params.length - 1
                                            ? "1px solid rgba(139,92,246,0.04)"
                                            : "none",
                                      }}
                                    >
                                      <span className="font-mono text-purple-300 text-[11px]">
                                        {p.name}
                                      </span>
                                      <span>
                                        <span
                                          className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                                          style={{
                                            background:
                                              p.in === "path"
                                                ? "rgba(234,179,8,0.1)"
                                                : p.in === "query"
                                                ? "rgba(59,130,246,0.1)"
                                                : "rgba(100,116,139,0.1)",
                                            color:
                                              p.in === "path"
                                                ? "#eab308"
                                                : p.in === "query"
                                                ? "#3b82f6"
                                                : "#64748b",
                                          }}
                                        >
                                          {p.in}
                                        </span>
                                      </span>
                                      <span>
                                        {p.required ? (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                                            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                                            yes
                                          </span>
                                        ) : (
                                          <span className="text-slate-600 text-[10px]">—</span>
                                        )}
                                      </span>
                                      <span className="text-slate-500 leading-relaxed text-[11px]">
                                        {p.description ?? (
                                          <span className="text-slate-700 italic">No description</span>
                                        )}
                                        {(p.schema?.example !== undefined || p.example !== undefined) && (
                                          <span className="ml-2 font-mono text-[10px] text-slate-600">
                                            e.g.{" "}
                                            <span className="text-slate-500">
                                              {String(p.schema?.example ?? p.example)}
                                            </span>
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Responses */}
                            {ep.operation.responses && (
                              <div>
                                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
                                  Responses
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(ep.operation.responses).map(([code, r]) => (
                                    <div
                                      key={code}
                                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                                      style={{
                                        background:
                                          code.startsWith("2")
                                            ? "rgba(16,185,129,0.08)"
                                            : code.startsWith("4")
                                            ? "rgba(239,68,68,0.08)"
                                            : "rgba(100,116,139,0.08)",
                                        border: `1px solid ${
                                          code.startsWith("2")
                                            ? "rgba(16,185,129,0.15)"
                                            : code.startsWith("4")
                                            ? "rgba(239,68,68,0.15)"
                                            : "rgba(100,116,139,0.12)"
                                        }`,
                                      }}
                                    >
                                      <span
                                        className="text-[11px] font-mono font-bold"
                                        style={{
                                          color: code.startsWith("2")
                                            ? "#10b981"
                                            : code.startsWith("4")
                                            ? "#ef4444"
                                            : "#64748b",
                                        }}
                                      >
                                        {code}
                                      </span>
                                      {r.description && (
                                        <span className="text-[10px] text-slate-500">
                                          {r.description}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Try it + curl buttons */}
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => setTryItEndpoint(ep)}
                                className="btn-brand px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5"
                              >
                                <Play className="w-3 h-3" />
                                Try it out
                              </button>
                              <CopyButton
                                text={`curl -X ${ep.method.toUpperCase()} "${API_BASE}${ep.path}" -H "X-Org-Id: YOUR_ORG_ID"`}
                              />
                              <span className="text-[10px] text-slate-600">Copy curl</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* ── EMPTY SEARCH STATE ───────────────────────────────────── */}
          {searchQuery && filteredEndpoints.length === 0 && (
            <div className="text-center py-16">
              <Code className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No endpoints match &ldquo;{searchQuery}&rdquo;</p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-3 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                Clear search
              </button>
            </div>
          )}

          {/* ── FOOTER NOTE ──────────────────────────────────────────── */}
          <div
            className="mt-16 pt-8 border-t text-center"
            style={{ borderColor: "rgba(139,92,246,0.07)" }}
          >
            <p className="text-[11px] text-slate-600">
              This documentation is auto-generated from the live OpenAPI spec at{" "}
              <a
                href={OPENAPI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition-colors font-mono"
              >
                /openapi.json
              </a>
              . For support, email{" "}
              <a href="mailto:fde@transilienceai.com" className="text-purple-400 hover:text-purple-300 transition-colors">
                fde@transilienceai.com
              </a>
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
