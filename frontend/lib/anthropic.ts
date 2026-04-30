// Server-side helper for calling Anthropic. Keeps the JSON body construction
// in TypeScript (cleaner than n8n expression-engine inline JSON.stringify)
// and centralizes model + retry logic.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export interface ClaudeCallOptions {
  model?: string;
  maxTokens?: number;
  system: string;
  user: string | object;          // string or JSON-serializable object (will be stringified)
  temperature?: number;
}

export interface ClaudeCallResult {
  text: string;
  tokens_in: number;
  tokens_out: number;
  model: string;
  stop_reason: string;
  raw: unknown;
}

export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const userContent = typeof opts.user === "string" ? opts.user : JSON.stringify(opts.user);

  const body = {
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: "user", content: userContent }],
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  };

  const resp = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${errBody.slice(0, 400)}`);
  }

  const json = (await resp.json()) as {
    content?: { type: string; text: string }[];
    usage?: { input_tokens: number; output_tokens: number };
    model?: string;
    stop_reason?: string;
  };

  const text = json.content?.[0]?.text ?? "";

  return {
    text,
    tokens_in: json.usage?.input_tokens ?? 0,
    tokens_out: json.usage?.output_tokens ?? 0,
    model: json.model ?? body.model,
    stop_reason: json.stop_reason ?? "unknown",
    raw: json,
  };
}

/** Extract a JSON value (object or array) from Claude's response.
 *  Robust against:
 *    - markdown fences (closed or unclosed if Claude hit max_tokens)
 *    - leading/trailing prose
 *    - truncation at any depth (auto-closes unbalanced brackets/strings) */
export function extractJson<T = unknown>(text: string): T | null {
  try { return JSON.parse(text) as T; } catch { /* fall through */ }

  // Strip markdown fences (closed). If only opening fence is present, drop it.
  let body = text;
  const closedFence = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (closedFence) {
    body = closedFence[1].trim();
    try { return JSON.parse(body) as T; } catch { /* fall through */ }
  } else {
    body = body.replace(/```(?:json)?\s*/, "");
  }

  // Locate the first { or [
  const objStart = body.indexOf("{");
  const arrStart = body.indexOf("[");
  let start = -1;
  let isArr = false;
  if (objStart === -1 && arrStart === -1) return null;
  if (objStart === -1) { start = arrStart; isArr = true; }
  else if (arrStart === -1) { start = objStart; }
  else if (arrStart < objStart) { start = arrStart; isArr = true; }
  else { start = objStart; }

  const candidate = body.slice(start);

  // Walk the candidate: track depth + string state. If we run out of chars
  // mid-structure, close the open contexts so JSON.parse can succeed.
  let depthObj = 0, depthArr = 0;
  let inStr = false, escape = false;
  const stack: ("{" | "[")[] = [];
  let lastValidEnd = -1;
  for (let i = 0; i < candidate.length; i++) {
    const c = candidate[i];
    if (escape) { escape = false; continue; }
    if (inStr) {
      if (c === "\\") { escape = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") { depthObj++; stack.push("{"); }
    else if (c === "[") { depthArr++; stack.push("["); }
    else if (c === "}") { depthObj--; stack.pop(); if (stack.length === 0) lastValidEnd = i; }
    else if (c === "]") { depthArr--; stack.pop(); if (stack.length === 0) lastValidEnd = i; }
  }

  if (lastValidEnd >= 0) {
    try { return JSON.parse(candidate.slice(0, lastValidEnd + 1)) as T; }
    catch { /* fall through to repair */ }
  }

  // Truncated mid-structure. Repair by closing open string + brackets.
  let repaired = candidate;
  // Strip trailing partial token after last comma or bracket open
  // (Heuristic: chop after the last comma to drop the half-written entry.)
  const lastCommaIdx = repaired.lastIndexOf(",");
  if (lastCommaIdx > 0 && stack.length > 0) {
    repaired = repaired.slice(0, lastCommaIdx);
  }
  if (inStr) repaired += '"';
  while (stack.length) {
    const open = stack.pop();
    repaired += open === "{" ? "}" : "]";
  }
  try { return JSON.parse(repaired) as T; } catch { return null; }
}
