"use client";

import { X, ExternalLink, CheckCircle, Eye, XCircle, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { ModuleBadge } from "@/components/shared/ModuleBadge";
import { RiskScoreMeter } from "@/components/shared/RiskScoreMeter";
import type { Alert } from "@/lib/api";

interface Props {
  alert: Alert | null;
  onClose: () => void;
  onStatusChange: (alertId: string, status: string) => void;
}

export function AlertDetailSheet({ alert, onClose, onStatusChange }: Props) {
  if (!alert) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-slate-900 border-l border-slate-700/50 z-50 overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700/50 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Alert Details</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Title & Badges */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <SeverityBadge severity={alert.severity} />
              <ModuleBadge module={alert.module} />
            </div>
            <h3 className="text-xl font-semibold">{alert.title}</h3>
            <p className="text-sm text-slate-400 mt-1">
              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
            </p>
          </div>

          {/* Risk Score */}
          <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg">
            <RiskScoreMeter score={alert.risk_score} size={64} />
            <div>
              <div className="text-sm font-medium">Risk Score</div>
              <div className="text-xs text-slate-400">
                {alert.risk_score >= 75 ? "Critical risk level" :
                 alert.risk_score >= 50 ? "High risk level" :
                 alert.risk_score >= 25 ? "Medium risk level" : "Low risk level"}
              </div>
            </div>
          </div>

          {/* Description */}
          {alert.description && (
            <div>
              <h4 className="text-sm font-semibold text-slate-400 mb-2">Description</h4>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{alert.description}</p>
            </div>
          )}

          {/* Source URL */}
          {alert.source_url && (
            <div>
              <h4 className="text-sm font-semibold text-slate-400 mb-2">Source</h4>
              <a
                href={alert.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300"
              >
                {alert.source_url}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Raw Data */}
          {alert.raw_data && Object.keys(alert.raw_data).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-400 mb-2">Raw Data</h4>
              <pre className="text-xs bg-slate-800 rounded-lg p-4 overflow-x-auto max-h-64 text-slate-300">
                {JSON.stringify(alert.raw_data, null, 2)}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div>
            <h4 className="text-sm font-semibold text-slate-400 mb-3">Actions</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onStatusChange(alert.id, "acknowledged")}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
              >
                <Eye className="w-4 h-4" />
                Acknowledge
              </button>
              <button
                onClick={() => onStatusChange(alert.id, "resolved")}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Resolve
              </button>
              <button
                onClick={() => onStatusChange(alert.id, "false_positive")}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                False Positive
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
