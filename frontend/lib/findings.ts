// Single source of real CreditAccessGrameen scan findings.
// Backed by the backend /api/v1/findings/* endpoints which read
// backend/data/bm_findings.json (real BrandMonitoring scan output).

import { getOrgId } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

export type Severity = "Critical" | "High" | "Substantial" | "Medium" | "Moderate" | "Low" | "Informational";

export type Finding = {
  id: string;
  title: string;
  category: string;
  module: string;
  severity: Severity;
  risk_score: number;
  likelihood: number;
  impact: number;
  description: string;
  affected_asset: string;
  indicator: string;
  discovered_at: string;
  recommendation?: string;
  remediation_priority?: string;
  references?: string[];
  evidence?: Record<string, any>;
  raw?: Record<string, any>;
  cvss?: number | null;
  cvss_vector?: string | null;
  cwe?: string | null;
  owasp?: string | null;
  mitre_attack?: string[];
  compliance_tags?: string[];
};

export type FindingsList = {
  items: Finding[];
  count: number;
  total: number;
  offset: number;
  limit: number;
};

export type FindingsStats = {
  total_findings: number;
  high_or_above: number;
  severity_counts: Record<string, number>;
  category_counts: Record<string, number>;
  module_counts: Record<string, number>;
  affected_assets: string[];
  timeline: Array<{ date: string; count: number }>;
  top_hosts: Array<{ host: string; count: number }>;
  as_of: string;
  brand: string;
  scan_id: string;
};

type FilterParams = {
  q?: string;
  severity?: string;
  category?: string;
  module?: string;
  limit?: number;
  offset?: number;
};

function qs(p: FilterParams): string {
  const u = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : "";
}

export async function fetchFindings(p: FilterParams = {}): Promise<FindingsList> {
  const url = `${API_BASE}/api/v1/findings${qs(p)}`;
  const res = await fetch(url, {
    headers: { "X-Org-Id": typeof window !== "undefined" ? getOrgId() : "00000000-0000-0000-0000-000000000001" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`findings: HTTP ${res.status}`);
  return res.json();
}

export async function fetchStats(): Promise<FindingsStats> {
  const url = `${API_BASE}/api/v1/findings/stats`;
  const res = await fetch(url, {
    headers: { "X-Org-Id": typeof window !== "undefined" ? getOrgId() : "00000000-0000-0000-0000-000000000001" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`stats: HTTP ${res.status}`);
  return res.json();
}

export const SEV_COLOR: Record<string, { bg: string; fg: string; bd: string }> = {
  Critical:      { bg: "rgba(239,68,68,0.18)", fg: "#fca5a5", bd: "rgba(239,68,68,0.30)" },
  High:          { bg: "rgba(249,115,22,0.15)", fg: "#fdba74", bd: "rgba(249,115,22,0.30)" },
  Substantial:   { bg: "rgba(245,158,11,0.15)", fg: "#fcd34d", bd: "rgba(245,158,11,0.30)" },
  Medium:        { bg: "rgba(234,179,8,0.15)", fg: "#fde68a", bd: "rgba(234,179,8,0.30)" },
  Moderate:      { bg: "rgba(234,179,8,0.15)", fg: "#fde68a", bd: "rgba(234,179,8,0.30)" },
  Low:           { bg: "rgba(59,130,246,0.12)", fg: "#93c5fd", bd: "rgba(59,130,246,0.25)" },
  Informational: { bg: "rgba(100,116,139,0.15)", fg: "#cbd5e1", bd: "rgba(100,116,139,0.25)" },
};
