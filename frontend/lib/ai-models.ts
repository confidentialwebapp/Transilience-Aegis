/**
 * Centralized AI model branding.
 *
 * The backend stores and calls Anthropic with real model IDs
 * (`claude-haiku-4-5`, `claude-sonnet-4-6`, etc.). The UI never shows
 * those — it always shows the TAI brand names below.
 *
 * To add a new model: append to MODELS, and modelLabel() will pick it up
 * via the substring match on the id.
 */

export const MODELS = [
  {
    id: "claude-haiku-4-5",
    label: "TAIv1",
    cost_hint: "Fast · cheap",
    description: "Everyday questions, triage, quick summaries.",
  },
  {
    id: "claude-sonnet-4-6",
    label: "TAIv2",
    cost_hint: "Smart · balanced",
    description: "Drafting advisories, complex analysis, multi-step reasoning.",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

/** Default model used everywhere unless explicitly overridden. */
export const DEFAULT_MODEL: ModelId = "claude-haiku-4-5";

/** Convert any backend-returned model string to the user-facing label. */
export function modelLabel(model: string | null | undefined): string {
  if (!model) return "TAI";
  if (model.includes("haiku")) return "TAIv1";
  if (model.includes("sonnet")) return "TAIv2";
  if (model.includes("opus")) return "TAIv3";
  return "TAI";
}
