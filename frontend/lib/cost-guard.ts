// Phase 1 Step 2b — Cost circuit breaker for Apify spend on Starter ($29/mo).
// Called by every server route that triggers an Apify run.

import type { SupabaseClient } from "@supabase/supabase-js";

export const STARTER_MONTHLY_CAP = 29.00;
export const SOFT_THRESHOLD_PCT = 0.86;             // $25 — warn / require admin override
export const HARD_THRESHOLD_PCT = 0.98;             // $28.42 — refuse all runs
export const PER_DAY_SOFT_CAP = 1.50;               // $1.50/day baseline
export const PER_RUN_WARN = 0.50;                   // single run > $0.50 warns

export interface CostGuardResult {
  ok: boolean;
  reason: string | null;
  today_spend: number;
  month_spend: number;
  cap_remaining: number;
  cap: number;
  estimated_run_cost: number;
  forecast: {
    days_left_in_month: number;
    burn_rate_per_day: number;
    projected_month_total: number;
  };
}

export async function checkCostGuard(
  sb: SupabaseClient,
  tenantId: string,
  estimatedRunCost = 0.10,
  options: { adminOverride?: boolean } = {},
): Promise<CostGuardResult> {
  // Spend today + this month from views (apify_spend_today / apify_spend_month)
  const [todayRes, monthRes] = await Promise.all([
    sb.from("apify_spend_today").select("today_spend").eq("tenant_id", tenantId).maybeSingle(),
    sb.from("apify_spend_month").select("month_spend").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  const today = Number(todayRes.data?.today_spend ?? 0);
  const month = Number(monthRes.data?.month_spend ?? 0);
  const capRemaining = Math.max(0, STARTER_MONTHLY_CAP - month);

  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getUTCDate();
  const daysLeft = Math.max(1, lastDay - dayOfMonth);
  const elapsedDays = Math.max(1, dayOfMonth);
  const burnPerDay = month / elapsedDays;
  const projectedTotal = month + burnPerDay * daysLeft;

  let ok = true;
  let reason: string | null = null;

  if (month + estimatedRunCost > STARTER_MONTHLY_CAP * HARD_THRESHOLD_PCT) {
    ok = false;
    reason = `month_spend ($${month.toFixed(2)}) + run_cost ($${estimatedRunCost.toFixed(2)}) exceeds hard cap ($${(STARTER_MONTHLY_CAP * HARD_THRESHOLD_PCT).toFixed(2)})`;
  } else if (month > STARTER_MONTHLY_CAP * SOFT_THRESHOLD_PCT && !options.adminOverride) {
    ok = false;
    reason = `month_spend ($${month.toFixed(2)}) over soft cap ($${(STARTER_MONTHLY_CAP * SOFT_THRESHOLD_PCT).toFixed(2)}) — admin override required`;
  } else if (today + estimatedRunCost > PER_DAY_SOFT_CAP && !options.adminOverride) {
    ok = false;
    reason = `today_spend ($${today.toFixed(2)}) + run_cost ($${estimatedRunCost.toFixed(2)}) exceeds daily soft cap ($${PER_DAY_SOFT_CAP}) — admin override required`;
  }

  return {
    ok,
    reason,
    today_spend: today,
    month_spend: month,
    cap_remaining: capRemaining,
    cap: STARTER_MONTHLY_CAP,
    estimated_run_cost: estimatedRunCost,
    forecast: {
      days_left_in_month: daysLeft,
      burn_rate_per_day: Number(burnPerDay.toFixed(4)),
      projected_month_total: Number(projectedTotal.toFixed(2)),
    },
  };
}

/** Per-feature cost estimate hint used by the cost guard pre-flight check. */
export const FEATURE_COST_ESTIMATES: Record<string, number> = {
  "FEAT-001": 0.05, "FEAT-002": 0.05, "FEAT-003": 0.10,
  "FEAT-004": 0.08, "FEAT-005": 0.04, "FEAT-006": 0.04,
  "FEAT-007": 0.05, "FEAT-019": 0.02, "FEAT-020": 0.02,
  "FEAT-022": 0.10, "FEAT-023": 0.05,
};

export function estimateRunCost(featureId: string): number {
  return FEATURE_COST_ESTIMATES[featureId] ?? 0.10;
}
