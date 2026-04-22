const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";

/** Retrieve the org ID from localStorage, falling back to the demo org */
export function getOrgId(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("tai_org_id") || DEMO_ORG_ID;
  }
  return DEMO_ORG_ID;
}

/** Store the org ID in localStorage */
export function setOrgId(orgId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("tai_org_id", orgId);
  }
}

interface FetchOptions {
  method?: string;
  body?: unknown;
  orgId?: string;
}

const MAX_RETRIES = 3;
const TIMEOUT_MS = 60000; // 60s to handle Render cold starts

let _backendAwake = false;

/** Pre-flight health check to wake up Render backend before first real request */
async function ensureBackendAwake(): Promise<void> {
  if (_backendAwake) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    _backendAwake = true;
  } catch {
    // If health check fails, still try the real request
  }
}

/**
 * Core fetch wrapper with retry logic for Render cold starts.
 * - 60s timeout per attempt
 * - Up to 3 attempts (auto-retry on network/timeout errors)
 * - Exponential backoff: 0s, 2s, 4s between retries
 */
async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, orgId } = options;

  const resolvedOrgId = orgId || getOrgId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Org-Id": resolvedOrgId,
  };

  const url = `${API_BASE}${path}`;

  await ensureBackendAwake();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff between retries
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: `Request failed with status ${res.status}` }));
        throw new ApiError(error.detail || `API error: ${res.status}`, res.status);
      }

      // Handle 204 No Content (e.g. DELETE)
      if (res.status === 204) {
        return undefined as T;
      }

      return res.json();
    } catch (e) {
      // Don't retry API errors (4xx/5xx with a response) - only retry network/timeout
      if (e instanceof ApiError) {
        throw e;
      }
      // On non-final attempt, retry for network failures / cold start timeouts
      if (attempt < MAX_RETRIES - 1) {
        continue;
      }
      // On final failure, throw user-friendly error
      const isTimeout = e instanceof DOMException && e.name === "AbortError";
      throw new ApiError(
        isTimeout
          ? "The backend server is waking up from sleep. Please wait 30 seconds and try again."
          : "Unable to connect to the server. Please check your connection and try again.",
        0
      );
    }
  }

  throw new ApiError("Request failed after retries", 0);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
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
    apiFetch<void>(`/api/v1/assets/${assetId}`, { method: "DELETE", orgId }),

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

  // Investigate
  investigate: (orgId: string, targetType: string, targetValue: string) =>
    apiFetch<Investigation>("/api/v1/investigate/", {
      method: "POST",
      body: { target_type: targetType, target_value: targetValue },
      orgId,
    }),

  getInvestigationHistory: (orgId: string, params?: { target_type?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (params?.target_type) sp.set("target_type", params.target_type);
    if (params?.page) sp.set("page", params.page.toString());
    const qs = sp.toString();
    return apiFetch<PaginatedResponse<Investigation>>(
      `/api/v1/investigate/history${qs ? `?${qs}` : ""}`,
      { orgId }
    );
  },

  getInvestigation: (orgId: string, id: string) =>
    apiFetch<Investigation>(`/api/v1/investigate/${id}`, { orgId }),

  // Multi-source enrichment fan-out
  enrich: (orgId: string, type: string, value: string, refresh = false) =>
    apiFetch<EnrichmentResult>(
      `/api/v1/intel/enrich?type=${type}&value=${encodeURIComponent(value)}${refresh ? "&refresh=true" : ""}`,
      { orgId }
    ),

  // Recon (theHarvester + DNSDumpster + Netlas + ThreatMiner)
  runHarvester: (orgId: string, domain: string, sources?: string, limit?: number) => {
    const sp = new URLSearchParams({ domain });
    if (sources) sp.set("sources", sources);
    if (limit) sp.set("limit", String(limit));
    return apiFetch<HarvesterResult>(`/api/v1/recon/harvest?${sp.toString()}`, { method: "POST", orgId });
  },
  listReconRuns: (orgId: string, domain?: string) => {
    const sp = new URLSearchParams();
    if (domain) sp.set("domain", domain);
    sp.set("limit", "20");
    return apiFetch<{ data: HarvesterRun[] }>(`/api/v1/recon/runs?${sp.toString()}`, { orgId });
  },
  dnsdumpster: (orgId: string, domain: string) =>
    apiFetch<Record<string, unknown>>(`/api/v1/recon/dnsdumpster?domain=${encodeURIComponent(domain)}`, { orgId }),
  netlas: (orgId: string, type: "ip" | "domain", value: string) =>
    apiFetch<Record<string, unknown>>(`/api/v1/recon/netlas?type=${type}&value=${encodeURIComponent(value)}`, { orgId }),

  // Telegram bot
  listTelegramChannels: (orgId: string) =>
    apiFetch<{ data: TelegramChannel[] }>("/api/v1/telegram/channels", { orgId }),
  listTelegramMessages: (orgId: string, params?: { chat_id?: number; q?: string; has_iocs?: boolean; page?: number }) => {
    const sp = new URLSearchParams();
    if (params?.chat_id !== undefined) sp.set("chat_id", String(params.chat_id));
    if (params?.q) sp.set("q", params.q);
    if (params?.has_iocs) sp.set("has_iocs", "true");
    sp.set("page", String(params?.page ?? 1));
    sp.set("per_page", "50");
    return apiFetch<{ data: TelegramMessage[]; total: number; page: number; per_page: number }>(
      `/api/v1/telegram/messages?${sp.toString()}`,
      { orgId }
    );
  },
  pollTelegram: (orgId: string) =>
    apiFetch<{ updates_processed: number }>("/api/v1/telegram/poll", { method: "POST", orgId }),

  // Maltego transform listing (read-only — actual transforms hit per-name endpoints from Maltego desktop)
  listMaltegoTransforms: (orgId: string) =>
    apiFetch<{ transforms: MaltegoTransform[] }>("/api/v1/maltego/transforms", { orgId }),
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

export interface Investigation {
  id: string;
  org_id: string;
  target_type: string;
  target_value: string;
  status: string;
  results: Record<string, any>;
  sources_checked: string[];
  risk_score: number;
  severity?: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface EnrichmentResult {
  ioc_type: string;
  ioc_value: string;
  verdict: "malicious" | "suspicious" | "clean" | "info" | "unknown";
  confidence: number;
  tags: string[];
  sources: string[];
  providers: Record<string, Record<string, unknown>>;
  cached: boolean;
  fetched_at: string;
}

export interface HarvesterResult {
  domain: string;
  tool: string;
  status: "success" | "partial" | "failed" | "running";
  sources: string[];
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  error: string | null;
  results: {
    emails: string[];
    hosts: string[];
    ips: string[];
    asns: string[];
    urls: string[];
    linkedin: string[];
    twitter: string[];
    vulnerabilities: string[];
    trello: string[];
  };
  counts: Record<string, number>;
}

export interface HarvesterRun {
  id: string;
  domain: string;
  tool: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  emails: string[];
  hosts: string[];
  ips: string[];
  asns: string[];
  urls: string[];
}

export interface TelegramChannel {
  id: string;
  chat_id: number;
  chat_type: string;
  title: string | null;
  username: string | null;
  added_at: string;
  enabled: boolean;
}

export interface TelegramMessage {
  id: string;
  chat_id: number;
  message_id: number;
  sender_id: number | null;
  sender_name: string | null;
  message_date: string;
  text: string | null;
  has_media: boolean;
  media_type: string | null;
  extracted_iocs: Record<string, string[]>;
  ingested_at: string;
}

export interface MaltegoTransform {
  name: string;
  input_entities: string[];
  endpoint: string;
}
