// FEAT-034 — MCP server tool listing.
// Returns the catalog of tai-aegis features as MCP tool definitions
// that an Anthropic-Claude agent (or any MCP-compatible LLM) can
// discover and invoke. The agent then orchestrates scans by calling
// our /api/admin/scan/full-sweep + /api/findings/feat-NNN-classify
// routes via the MCP transport.
//
// This route exposes a JSON catalog; the actual MCP transport
// (stdio/sse) lives in a separate Modal-hosted bridge process that
// proxies tool calls back to these HTTP routes.

import { NextRequest, NextResponse } from "next/server";

interface McpTool {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}

const TOOLS: McpTool[] = [
  {
    name: "trigger_scan",
    description: "Run a tai-aegis scan for a feature. Returns scan_run_id + apify_run_id. Use list_features to see available feature_ids.",
    inputSchema: {
      type: "object",
      properties: {
        feature_id: { type: "string", description: "FEAT-001 .. FEAT-029" },
        apify_task_id: { type: "string", description: "creditaccessgrameen-feat-NNN-..." },
        run_kali: { type: "boolean", description: "also run Kali OSINT arm" },
      },
      required: ["feature_id", "apify_task_id"],
    },
  },
  {
    name: "list_features",
    description: "List all configured tai-aegis features for this customer with their cost-per-run estimate and current cadence.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ai_process_findings",
    description: "Run attribution skill + AI false-positive filter + incident grouping over findings still pending.",
    inputSchema: {
      type: "object",
      properties: {
        scan_run_id: { type: "string", description: "limit to one scan run" },
        max_findings: { type: "number", description: "default 80, max 200" },
      },
    },
  },
  {
    name: "list_incidents",
    description: "Return active incidents for the customer, severity-sorted.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "open | triaged | closed | reopened" },
        severity: { type: "string", description: "Critical | Substantial | Moderate | Low" },
      },
    },
  },
  {
    name: "list_takedown_drafts",
    description: "Return pending takedown drafts awaiting admin approval.",
    inputSchema: { type: "object", properties: { status: { type: "string" } } },
  },
  {
    name: "approve_takedown",
    description: "Approve a takedown draft for submission. Phase 1 only marks status=approved; external submission is a Phase 2 follow-up.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, decided_by: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "phishing_url_check",
    description: "Run the phishing URL analyzer on up to 20 candidate URLs. Returns risk-signal scores + verdicts.",
    inputSchema: {
      type: "object",
      properties: { urls: { type: "array", items: { type: "string" } } },
      required: ["urls"],
    },
  },
  {
    name: "lookalike_domain_sweep",
    description: "Run dnstwist + crt.sh against all owned domains to find candidate lookalikes; classifies top-N via FEAT-004.",
    inputSchema: {
      type: "object",
      properties: { classify_top_n: { type: "number", description: "default 10, max 20" } },
    },
  },
  {
    name: "dmarc_check",
    description: "Run DMARC/SPF/DKIM check on owned domains; reports policy weakness.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "exec_surveillance",
    description: "Run Sherlock OSINT on each executive name to find non-verified profile hits.",
    inputSchema: { type: "object", properties: {} },
  },
];

export async function GET(_req: NextRequest) {
  return NextResponse.json({
    server_name: "tai-aegis-operate",
    server_version: "1.0",
    description: "Operate the TAI AEGIS digital risk protection platform — brand monitoring, social surveillance, dark web sweeps, fake app detection, executive protection, phishing analysis, lookalike domains, fake branches, recruitment fraud.",
    tools: TOOLS,
    transport_hint: "These tool definitions follow the Anthropic Tool Use schema. Pair with /api/admin/scan/full-sweep, /api/findings/*, and /api/admin/takedowns to execute.",
  });
}
