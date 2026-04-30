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

/** Extract a JSON value (object or array) from Claude's response. */
export function extractJson<T = unknown>(text: string): T | null {
  // Try plain parse first
  try {
    return JSON.parse(text) as T;
  } catch {
    // ignore
  }
  // Strip markdown fences and find a balanced JSON literal
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T;
    } catch {
      // ignore
    }
  }
  // Find first { or [ to last matching } or ]
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");
  let start = -1;
  let isArr = false;
  if (objStart === -1 && arrStart === -1) return null;
  if (objStart === -1) {
    start = arrStart;
    isArr = true;
  } else if (arrStart === -1) {
    start = objStart;
  } else if (arrStart < objStart) {
    start = arrStart;
    isArr = true;
  } else {
    start = objStart;
  }
  const closer = isArr ? "]" : "}";
  const lastClose = text.lastIndexOf(closer);
  if (lastClose <= start) return null;
  try {
    return JSON.parse(text.slice(start, lastClose + 1)) as T;
  } catch {
    return null;
  }
}
