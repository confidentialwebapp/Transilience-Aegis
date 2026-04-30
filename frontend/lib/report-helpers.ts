// Shared helpers for the PDF report pipeline.

export type Severity = "Critical" | "Substantial" | "Moderate" | "Low";

export const SEVERITY_ORDER: Severity[] = ["Critical", "Substantial", "Moderate", "Low"];

export function severityRank(s: string | null | undefined): number {
  switch ((s ?? "").toLowerCase()) {
    case "critical": return 0;
    case "substantial": return 1;
    case "moderate": return 2;
    case "low": return 3;
    default: return 4;
  }
}

export function severityColor(s: string | null | undefined): string {
  switch ((s ?? "").toLowerCase()) {
    case "critical":    return "#ef4444";
    case "substantial": return "#f97316";
    case "moderate":    return "#eab308";
    case "low":         return "#10b981";
    default:            return "#94a3b8";
  }
}

export function severityFillLight(s: string | null | undefined): string {
  switch ((s ?? "").toLowerCase()) {
    case "critical":    return "#fee2e2";
    case "substantial": return "#ffedd5";
    case "moderate":    return "#fef3c7";
    case "low":         return "#d1fae5";
    default:            return "#f1f5f9";
  }
}

export function severityPillFg(s: string | null | undefined): string {
  switch ((s ?? "").toLowerCase()) {
    case "critical":    return "#fca5a5";
    case "substantial": return "#fdba74";
    case "moderate":    return "#fde047";
    case "low":         return "#6ee7b7";
    default:            return "#cbd5e1";
  }
}

const KIND_LABELS: Record<string, string> = {
  phishing:            "Phishing",
  brand_impersonation: "Brand Impersonation",
  exec_impersonation:  "Executive Impersonation",
  credential_breach:   "Credential Breach",
  leaked_asset:        "Leaked Asset",
  fraud:               "Fraud",
  domain_typosquat:    "Domain Typosquat",
  username_squat:      "Username Squat",
};

export function kindLabel(kind: string | null | undefined): string {
  if (!kind) return "Other";
  return KIND_LABELS[kind] ?? kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function groupBy<T>(arr: T[], key: (v: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

export function shortId(uuid: string | null | undefined): string {
  if (!uuid) return "????????";
  return uuid.replace(/-/g, "").slice(0, 8);
}

export function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

const ACTION_BUCKETS = ["takedown", "monitor", "notify_user"] as const;
export type ActionBucket = (typeof ACTION_BUCKETS)[number];

export function actionBucket(a: string | null | undefined): ActionBucket | "other" {
  const k = (a ?? "").toLowerCase();
  if (k === "takedown" || k === "monitor" || k === "notify_user") return k;
  return "other";
}

export function actionLabel(a: ActionBucket | "other"): string {
  switch (a) {
    case "takedown":    return "Initiate Takedown";
    case "monitor":     return "Monitor";
    case "notify_user": return "Notify Affected Users";
    default:            return "Other / Review";
  }
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function fmtDateOnly(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
