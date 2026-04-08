const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface FetchOptions {
  method?: string;
  body?: unknown;
  orgId?: string;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, orgId } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (orgId) {
    headers["X-Org-Id"] = orgId;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Dashboard
  getDashboardSummary: (orgId: string, dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const qs = params.toString();
    return apiFetch<DashboardSummary>(`/api/v1/dashboard/summary${qs ? `?${qs}` : ""}`, { orgId });
  },

  // Assets
  getAssets: (orgId: string, params?: { type?: string; status?: string; search?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (params?.type) sp.set("type", params.type);
    if (params?.status) sp.set("status", params.status);
    if (params?.search) sp.set("search", params.search);
    if (params?.page) sp.set("page", params.page.toString());
    const qs = sp.toString();
    return apiFetch<PaginatedResponse<Asset>>(`/api/v1/assets/${qs ? `?${qs}` : ""}`, { orgId });
  },

  createAsset: (orgId: string, data: { type: string; value: string; label?: string; tags?: string[] }) =>
    apiFetch<Asset>("/api/v1/assets/", { method: "POST", body: data, orgId }),

  deleteAsset: (orgId: string, assetId: string) =>
    apiFetch(`/api/v1/assets/${assetId}`, { method: "DELETE", orgId }),

  // Alerts
  getAlerts: (orgId: string, params?: AlertFilters) => {
    const sp = new URLSearchParams();
    if (params?.severity) sp.set("severity", params.severity);
    if (params?.module) sp.set("module", params.module);
    if (params?.status) sp.set("status", params.status);
    if (params?.page) sp.set("page", params.page.toString());
    const qs = sp.toString();
    return apiFetch<PaginatedResponse<Alert>>(`/api/v1/alerts/${qs ? `?${qs}` : ""}`, { orgId });
  },

  getAlertStats: (orgId: string) =>
    apiFetch<AlertStats>("/api/v1/alerts/stats", { orgId }),

  updateAlertStatus: (orgId: string, alertId: string, status: string) =>
    apiFetch<Alert>(`/api/v1/alerts/${alertId}/status`, { method: "PATCH", body: { status }, orgId }),

  // Scans
  triggerScan: (orgId: string, module: string) =>
    apiFetch<{ job_id: string }>("/api/v1/scans/trigger", { method: "POST", body: { module }, orgId }),

  getScans: (orgId: string) =>
    apiFetch<PaginatedResponse<ScanJob>>("/api/v1/scans/", { orgId }),

  // Intel
  lookupIOC: (orgId: string, type: string, value: string) =>
    apiFetch<IOCResult>(`/api/v1/intel/lookup?type=${type}&value=${encodeURIComponent(value)}`, { orgId }),

  getIntelFeed: (orgId: string) =>
    apiFetch<PaginatedResponse<ThreatIntel>>("/api/v1/intel/feed", { orgId }),
};

// Types
export interface DashboardSummary {
  exposure_sources: { total_mentions: number; suspects_identified: number; incidents: number };
  monitored_assets: Record<string, number>;
  total_assets: number;
  alerts_by_severity: Record<string, number>;
  alerts_by_module: Record<string, number>;
  top_assets: TopAsset[];
  recent_alerts: RecentAlert[];
  total_alerts: number;
}

export interface TopAsset {
  id: string;
  type: string;
  value: string;
  mentions: number;
}

export interface RecentAlert {
  id: string;
  severity: string;
  title: string;
  module: string;
  created_at: string;
  risk_score: number;
}

export interface Asset {
  id: string;
  org_id: string;
  type: string;
  value: string;
  label: string | null;
  tags: string[];
  status: string;
  last_scan_at: string | null;
  created_at: string;
}

export interface Alert {
  id: string;
  org_id: string;
  asset_id: string | null;
  module: string;
  severity: string;
  title: string;
  description: string;
  source_url: string;
  raw_data: Record<string, unknown>;
  risk_score: number;
  status: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  assets?: { value: string; type: string } | null;
}

export interface AlertFilters {
  severity?: string;
  module?: string;
  status?: string;
  page?: number;
}

export interface AlertStats {
  total: number;
  by_severity: Record<string, number>;
  by_module: Record<string, number>;
  by_status: Record<string, number>;
}

export interface ScanJob {
  id: string;
  module: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  findings_count: number;
  error: string | null;
}

export interface IOCResult {
  ioc_type: string;
  ioc_value: string;
  results: Record<string, unknown>;
}

export interface ThreatIntel {
  id: string;
  ioc_type: string;
  ioc_value: string;
  source: string;
  threat_type: string;
  confidence: number;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}
