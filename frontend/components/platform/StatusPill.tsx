"use client";

import { cn } from "@/lib/utils";

export type StatusKind =
  | "OPEN"
  | "CLOSED"
  | "WAITING"
  | "ON HOLD"
  | "RECOVERED"
  | "RECOVERY FAILED"
  | "ENABLED"
  | "DISABLED"
  | "ACTIVE"
  | "INACTIVE"
  | "RESOLVED"
  | "UNKNOWN"
  | "CLEAN"
  | "POTENTIALLY SUSPICIOUS"
  | "UNVERIFIED"
  | "VERIFIED"
  | "MATCHED"
  | "MISMATCHED"
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "PASS"
  | "FAIL"
  | "PENDING"
  | "INFO";

const COLOR: Record<string, { bg: string; text: string; border: string; dot?: boolean }> = {
  OPEN: { bg: "rgba(239,68,68,0.10)", text: "#fca5a5", border: "rgba(239,68,68,0.30)", dot: true },
  CRITICAL: { bg: "rgba(239,68,68,0.10)", text: "#fca5a5", border: "rgba(239,68,68,0.30)" },
  FAIL: { bg: "rgba(239,68,68,0.10)", text: "#fca5a5", border: "rgba(239,68,68,0.30)" },
  "RECOVERY FAILED": { bg: "rgba(239,68,68,0.10)", text: "#fca5a5", border: "rgba(239,68,68,0.30)" },
  DISABLED: { bg: "rgba(239,68,68,0.10)", text: "#fca5a5", border: "rgba(239,68,68,0.30)" },
  INACTIVE: { bg: "rgba(239,68,68,0.10)", text: "#fca5a5", border: "rgba(239,68,68,0.30)" },
  MISMATCHED: { bg: "rgba(239,68,68,0.10)", text: "#fca5a5", border: "rgba(239,68,68,0.30)" },

  HIGH: { bg: "rgba(249,115,22,0.10)", text: "#fdba74", border: "rgba(249,115,22,0.30)" },
  "POTENTIALLY SUSPICIOUS": { bg: "rgba(249,115,22,0.10)", text: "#fdba74", border: "rgba(249,115,22,0.30)" },
  UNVERIFIED: { bg: "rgba(249,115,22,0.10)", text: "#fdba74", border: "rgba(249,115,22,0.30)" },
  RESOLVED: { bg: "rgba(249,115,22,0.10)", text: "#fdba74", border: "rgba(249,115,22,0.30)" },

  MEDIUM: { bg: "rgba(59,130,246,0.10)", text: "#93c5fd", border: "rgba(59,130,246,0.30)" },
  WAITING: { bg: "rgba(234,179,8,0.10)", text: "#fde047", border: "rgba(234,179,8,0.30)" },
  PENDING: { bg: "rgba(234,179,8,0.10)", text: "#fde047", border: "rgba(234,179,8,0.30)" },

  CLOSED: { bg: "rgba(16,185,129,0.10)", text: "#6ee7b7", border: "rgba(16,185,129,0.30)" },
  RECOVERED: { bg: "rgba(16,185,129,0.10)", text: "#6ee7b7", border: "rgba(16,185,129,0.30)" },
  ENABLED: { bg: "rgba(16,185,129,0.10)", text: "#6ee7b7", border: "rgba(16,185,129,0.30)" },
  ACTIVE: { bg: "rgba(16,185,129,0.10)", text: "#6ee7b7", border: "rgba(16,185,129,0.30)", dot: true },
  CLEAN: { bg: "rgba(16,185,129,0.10)", text: "#6ee7b7", border: "rgba(16,185,129,0.30)" },
  VERIFIED: { bg: "rgba(16,185,129,0.10)", text: "#6ee7b7", border: "rgba(16,185,129,0.30)" },
  MATCHED: { bg: "rgba(16,185,129,0.10)", text: "#6ee7b7", border: "rgba(16,185,129,0.30)" },
  PASS: { bg: "rgba(16,185,129,0.10)", text: "#6ee7b7", border: "rgba(16,185,129,0.30)" },
  LOW: { bg: "rgba(16,185,129,0.10)", text: "#6ee7b7", border: "rgba(16,185,129,0.30)" },

  "ON HOLD": { bg: "rgba(148,163,184,0.10)", text: "#cbd5e1", border: "rgba(148,163,184,0.30)" },
  UNKNOWN: { bg: "rgba(148,163,184,0.10)", text: "#cbd5e1", border: "rgba(148,163,184,0.30)" },
  INFO: { bg: "rgba(168,85,247,0.10)", text: "#d8b4fe", border: "rgba(168,85,247,0.30)" },
};

interface Props {
  status: StatusKind | string;
  className?: string;
  small?: boolean;
}

export function StatusPill({ status, className, small }: Props) {
  const key = (status || "UNKNOWN").toUpperCase();
  const cfg = COLOR[key] || COLOR.UNKNOWN;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold tracking-wider whitespace-nowrap",
        small ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]",
        className
      )}
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      {cfg.dot && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: cfg.text }}
        />
      )}
      {key}
    </span>
  );
}
