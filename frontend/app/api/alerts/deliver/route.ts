// Alert delivery — sends pending alerts to their configured channel.
// Slack webhook (recommended Phase 1) + email stub. Marks the alert
// row status=sent on success; status=failed with error on failure.
//
// Env: SLACK_WEBHOOK_URL_SOC_CRITICAL, SLACK_WEBHOOK_URL_SOC_HIGH,
//      SENDGRID_API_KEY (for email stub), PAGERDUTY_INTEGRATION_KEY

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

interface AlertRow {
  alert_id?: string; id?: string;
  tenant_id: string;
  finding_id: string;
  channel: string;
  priority: string;
  rule_matched: string;
  severity: string;
  payload: { channel_config?: Record<string, unknown>; summary?: string; source?: string; url?: string; risk_score?: number };
}

const SLACK_WEBHOOK_BY_CHANNEL: Record<string, string | undefined> = {
  "#soc-critical": process.env.SLACK_WEBHOOK_URL_SOC_CRITICAL,
  "#soc-high":     process.env.SLACK_WEBHOOK_URL_SOC_HIGH,
  "#soc-medium":   process.env.SLACK_WEBHOOK_URL_SOC_MEDIUM,
};

async function deliverSlack(a: AlertRow): Promise<{ ok: boolean; reason?: string }> {
  const channel = (a.payload.channel_config?.slack_channel as string | undefined) ?? "#soc-high";
  const url = SLACK_WEBHOOK_BY_CHANNEL[channel];
  if (!url) return { ok: false, reason: `no SLACK_WEBHOOK_URL configured for ${channel}` };

  const sevColor: Record<string, string> = {
    Critical: "#dc2626", Substantial: "#ea580c", Moderate: "#ca8a04", Low: "#65a30d",
  };
  const blocks = {
    text: `[${a.priority.toUpperCase()}] ${a.severity} — ${a.rule_matched}`,
    attachments: [{
      color: sevColor[a.severity] ?? "#475569",
      fields: [
        { title: "Summary", value: a.payload.summary ?? "(no summary)", short: false },
        { title: "Source", value: a.payload.source ?? "?", short: true },
        { title: "Risk score", value: String(a.payload.risk_score ?? "n/a"), short: true },
        ...(a.payload.url ? [{ title: "URL", value: a.payload.url, short: false }] : []),
        { title: "Finding", value: `https://tai-aegis.vercel.app/threat-management/incidents?finding_id=${a.finding_id}`, short: false },
      ],
      footer: `tai-aegis • ${a.rule_matched}`,
      ts: Math.floor(Date.now() / 1000),
    }],
  };

  try {
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blocks), signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { ok: false, reason: `slack ${r.status}: ${await r.text().catch(() => "")}` };
    return { ok: true };
  } catch (e) { return { ok: false, reason: (e as Error).message }; }
}

async function deliverEmail(a: AlertRow): Promise<{ ok: boolean; reason?: string }> {
  // Phase 1 stub — log only. Real SendGrid/SMTP wire in Phase 2.
  const to = (a.payload.channel_config?.email_to as string[] | undefined) ?? [];
  if (to.length === 0) return { ok: false, reason: "no email_to configured" };
  if (!process.env.SENDGRID_API_KEY) {
    return { ok: false, reason: "SENDGRID_API_KEY not set — email stubbed (would send to: " + to.join(", ") + ")" };
  }
  // SendGrid send (real implementation)
  try {
    const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: to.map((e) => ({ email: e })) }],
        from: { email: process.env.SENDGRID_FROM ?? "alerts@tai-aegis.vercel.app", name: "TAI AEGIS" },
        subject: `[${a.priority.toUpperCase()}] ${a.severity} — ${a.rule_matched}`,
        content: [{ type: "text/plain", value: `${a.payload.summary}\n\nSource: ${a.payload.source}\nURL: ${a.payload.url ?? "n/a"}\nRisk: ${a.payload.risk_score ?? "n/a"}\n\nhttps://tai-aegis.vercel.app/threat-management/incidents?finding_id=${a.finding_id}` }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { ok: false, reason: `sendgrid ${r.status}` };
    return { ok: true };
  } catch (e) { return { ok: false, reason: (e as Error).message }; }
}

async function deliverPagerDuty(a: AlertRow): Promise<{ ok: boolean; reason?: string }> {
  const integrationKey = process.env.PAGERDUTY_INTEGRATION_KEY;
  if (!integrationKey) return { ok: false, reason: "PAGERDUTY_INTEGRATION_KEY not set" };
  try {
    const r = await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routing_key: integrationKey, event_action: "trigger",
        payload: {
          summary: a.payload.summary ?? `${a.severity} ${a.rule_matched}`,
          severity: a.severity === "Critical" ? "critical" : a.severity === "Substantial" ? "warning" : "info",
          source: a.payload.source ?? "tai-aegis",
          custom_details: { finding_id: a.finding_id, rule: a.rule_matched, risk: a.payload.risk_score, url: a.payload.url },
        },
        dedup_key: a.finding_id,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { ok: false, reason: `pagerduty ${r.status}` };
    return { ok: true };
  } catch (e) { return { ok: false, reason: (e as Error).message }; }
}

async function deliverSiem(a: AlertRow): Promise<{ ok: boolean; reason?: string }> {
  const url = process.env.SIEM_WEBHOOK_URL;
  if (!url) return { ok: false, reason: "SIEM_WEBHOOK_URL not set" };
  try {
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SIEM_BEARER ?? ""}` },
      body: JSON.stringify(a), signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { ok: false, reason: `siem ${r.status}` };
    return { ok: true };
  } catch (e) { return { ok: false, reason: (e as Error).message }; }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tenant_id?: string; alert_id?: string; max?: number };
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    let q = sb.from("alerts").select("*").eq("status", "pending").limit(Math.min(body.max ?? 50, 100));
    if (body.tenant_id) q = q.eq("tenant_id", body.tenant_id);
    if (body.alert_id) q = q.eq("alert_id", body.alert_id);
    const { data: pending } = await q;
    const alerts = (pending ?? []) as AlertRow[];

    let sent = 0; let failed = 0;
    const reasons: string[] = [];
    for (const a of alerts) {
      let res: { ok: boolean; reason?: string };
      switch (a.channel) {
        case "slack":     res = await deliverSlack(a); break;
        case "email":     res = await deliverEmail(a); break;
        case "pagerduty": res = await deliverPagerDuty(a); break;
        case "siem":      res = await deliverSiem(a); break;
        default:          res = { ok: false, reason: `unknown channel: ${a.channel}` };
      }
      if (res.ok) {
        await sb.from("alerts").update({ status: "sent", delivered_at: new Date().toISOString() })
          .eq("alert_id", a.alert_id ?? a.id);
        sent += 1;
      } else {
        await sb.from("alerts").update({ status: "failed", delivery_status: res.reason })
          .eq("alert_id", a.alert_id ?? a.id);
        failed += 1;
        if (reasons.length < 5) reasons.push(`${a.channel}: ${res.reason}`);
      }
    }

    return NextResponse.json({ ok: true, processed: alerts.length, sent, failed, sample_failures: reasons });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
