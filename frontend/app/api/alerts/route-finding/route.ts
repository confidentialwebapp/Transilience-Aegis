// Phase 1 Step 20 — Route a single finding through the alert engine.
// Looks up matching alert_routing_rules, builds delivery payloads, and
// inserts pending alerts rows. Actual channel delivery (Slack webhook,
// SendGrid, etc.) is wired per-channel in followups; for Phase 1 we
// generate the alert RECORD and a takedown_drafts row when applicable.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface Finding {
  id: string;
  tenant_id: string;
  severity: string;
  fraud_pattern: string | null;
  recommended_action: string | null;
  source: string;
  url_or_value: string | null;
  ai_summary: string | null;
  final_risk_score: number | null;
}

interface RoutingRule {
  id: string;
  rule_name: string;
  enabled: boolean;
  min_severity: string | null;
  min_risk_score: number | null;
  fraud_patterns: string[] | null;
  recommended_actions: string[] | null;
  channels: string[];
  channel_config: Record<string, unknown>;
  priority: string;
}

const SEV_RANK: Record<string, number> = { Critical: 4, Substantial: 3, Moderate: 2, Low: 1 };

function ruleMatches(rule: RoutingRule, f: Finding): boolean {
  if (!rule.enabled) return false;
  if (rule.min_severity && (SEV_RANK[f.severity] ?? 0) < (SEV_RANK[rule.min_severity] ?? 0)) return false;
  if (rule.min_risk_score !== null && rule.min_risk_score !== undefined && (f.final_risk_score ?? 0) < rule.min_risk_score) return false;
  if (rule.fraud_patterns && rule.fraud_patterns.length > 0 && !rule.fraud_patterns.includes(f.fraud_pattern ?? "")) return false;
  if (rule.recommended_actions && rule.recommended_actions.length > 0 && !rule.recommended_actions.includes(f.recommended_action ?? "")) return false;
  return true;
}

const TAKEDOWN_PROVIDERS: Record<string, string> = {
  "apify:google-play": "google_play",
  "apify:app-store": "app_store",
  "apify:apk-site": "apk_host",
  "internal:phishing-analyzer": "cloudflare",
  "internal:lookalike-discovery": "registrar",
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; finding_id?: string; finding_ids?: string[] };
    const tenant_id = body.tenant_id ?? "23610954-5fd0-482f-8eb0-11edce1f5c58";
    const ids = body.finding_id ? [body.finding_id] : (body.finding_ids ?? []);
    if (ids.length === 0) return NextResponse.json({ ok: false, error: "finding_id or finding_ids required" }, { status: 400 });

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const [{ data: rules }, { data: findings }] = await Promise.all([
      sb.from("alert_routing_rules").select("*").eq("tenant_id", tenant_id).eq("enabled", true),
      sb.from("findings").select("id, tenant_id, severity, fraud_pattern, recommended_action, source, url_or_value, ai_summary, final_risk_score").in("id", ids),
    ]);
    const rulesArr = (rules ?? []) as RoutingRule[];
    const findingArr = (findings ?? []) as Finding[];

    const alertRows: Record<string, unknown>[] = [];
    const takedownRows: Record<string, unknown>[] = [];

    for (const f of findingArr) {
      for (const rule of rulesArr) {
        if (!ruleMatches(rule, f)) continue;
        for (const channel of rule.channels) {
          alertRows.push({
            tenant_id, finding_id: f.id, channel, priority: rule.priority,
            rule_matched: rule.rule_name, status: "pending",
            severity: f.severity,
            payload: {
              channel_config: rule.channel_config,
              summary: f.ai_summary ?? `${f.severity} ${f.fraud_pattern} — ${f.url_or_value}`,
              source: f.source, url: f.url_or_value,
              risk_score: f.final_risk_score,
            },
          });
        }
      }

      // Auto-takedown draft (Phase 1: admin approves before submit)
      if (f.recommended_action === "takedown") {
        const provider = TAKEDOWN_PROVIDERS[f.source] ?? "manual";
        takedownRows.push({
          tenant_id, finding_id: f.id, status: "draft", provider,
          abuse_url: f.url_or_value,
          template_used: `${provider}_${(f.fraud_pattern ?? "default")}`,
          draft_body: `Subject: Brand-impersonation report for ${f.url_or_value}\n\n` +
            `This URL impersonates CreditAccess Grameen Limited (Indian RBI-regulated NBFC-MFI).\n` +
            `Detection: ${f.fraud_pattern} via ${f.source}.\n` +
            `Severity: ${f.severity}. Score: ${f.final_risk_score ?? "n/a"}.\n` +
            `Summary: ${f.ai_summary ?? "(none)"}\n` +
            `Please remove per your acceptable-use policy.`,
        });
      }
    }

    let alertsInserted = 0; let takedownsInserted = 0;
    if (alertRows.length > 0) {
      const r = await sb.from("alerts").insert(alertRows);
      if (!r.error) alertsInserted = alertRows.length;
    }
    if (takedownRows.length > 0) {
      const r = await sb.from("takedown_drafts").insert(takedownRows);
      if (!r.error) takedownsInserted = takedownRows.length;
    }

    return NextResponse.json({
      ok: true,
      findings_processed: findingArr.length,
      rules_evaluated: rulesArr.length,
      alerts_inserted: alertsInserted,
      takedown_drafts_inserted: takedownsInserted,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
