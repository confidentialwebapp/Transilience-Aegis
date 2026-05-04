// Thin client for the backend's derived data endpoints. One file per page
// fetches from here so we never duplicate URL strings.
import { getOrgId } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "X-Org-Id": typeof window !== "undefined" ? getOrgId() : "00000000-0000-0000-0000-000000000001",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

// CTI
export const fetchThreatActors    = () => get<{ items: any[]; total: number; by_country: Record<string, number> }>("/api/v1/cti/threat-actors");
export const fetchRansomGroups    = () => get<{ items: any[]; total: number; total_victims: number }>("/api/v1/cti/ransomware-groups");
export const fetchTorNodes        = () => get<{ items: { ip: string; type: string }[]; total: number; as_of: string; source: string }>("/api/v1/cti/tor-nodes");
export const fetchMalware         = () => get<{ items: any[]; total: number; families: Record<string, number>; as_of: string; source: string }>("/api/v1/cti/malware");
export const fetchCves            = () => get<{ items: any[]; total: number; as_of: string }>("/api/v1/cti/cves");
export const fetchAdvisories      = () => get<{ items: any[]; total: number }>("/api/v1/cti/advisories");
export const fetchTaxiiCollections = () => get<{ collections: any[]; discovery_url: string }>("/api/v1/cti/stix-taxii/collections");
export const fetchApiInfo         = () => get<{ version: string; endpoints: any[] }>("/api/v1/cti/api/info");

// ASM
export const fetchAssetDiscovery  = () => get<{ items: any[]; total: number }>("/api/v1/asm/asset-discovery");
export const fetchAssetMonitoring = () => get<{ items: any[]; total: number }>("/api/v1/asm/asset-monitoring");
export const fetchAsmDns          = () => get<{ items: any[]; total: number }>("/api/v1/asm/dns");
export const fetchWhitelist       = () => get<{ brands: any[]; domains: any[]; subdomains: any[]; mobile_apps: any[]; social_profiles: any[] }>("/api/v1/asm/whitelist");

// Assets
export const fetchAssetsDomains   = () => get<{ items: any[]; total: number }>("/api/v1/assets/domains");
export const fetchAssetsMobile    = () => get<{ items: any[]; total: number }>("/api/v1/assets/mobile-apps");
export const fetchAssetsExecs     = () => get<{ items: any[]; total: number }>("/api/v1/assets/executives");

// DMARC + TPRM + Mgmt
export const fetchDmarcStats      = () => get<{ items: any[]; total: number; summary: any; as_of: string }>("/api/v1/dmarc/stats");
export const fetchTprmVendors     = () => get<{ items: any[]; total: number }>("/api/v1/tprm/vendors");
export const fetchClientUsers     = () => get<{ items: any[]; total: number; note: string }>("/api/v1/management/client-users");
export const fetchSubscription    = () => get<any>("/api/v1/management/subscription");
export const fetchServicesLicense = () => get<{ items: any[]; total: number }>("/api/v1/management/services-license");

// Reports
export const fetchReportBrandTargeted   = () => get<any>("/api/v1/reports/brand-targeted");
export const fetchReportThreatOverTime  = () => get<{ timeline: any[]; total_days: number }>("/api/v1/reports/threat-over-time");
export const fetchReportTakedownTime    = () => get<any>("/api/v1/reports/site-takedown-time");
export const fetchReportHostCountry     = () => get<{ items: any[]; total: number; as_of: string }>("/api/v1/reports/incident-by-host-country");
export const fetchReportExecSummary     = () => get<any>("/api/v1/reports/executive-summary");
export const fetchReportWss             = () => get<{ items: any[]; total: number }>("/api/v1/reports/wss");
export const fetchReportReopened        = () => get<any>("/api/v1/reports/incidents-reopened");
export const fetchReportMoved           = () => get<any>("/api/v1/reports/moved-cases");
