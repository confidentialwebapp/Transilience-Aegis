"""Phase 1 Step 3 — Generate the n8n master workflow skeleton + sub-WF stubs.

Per Build Spec Part 8:
  - tai-aegis-master                       → top-level orchestrator
  - tai-aegis-sub-asset-enricher           → calls /api/admin/asset-enrich
  - tai-aegis-sub-detection-planner        → calls /api/admin/scan-plan
  - tai-aegis-sub-feat-{A..N}              → 14 detection sub-WF stubs
  - tai-aegis-sub-attribution-skill        → calls /api/skills/attribution
  - tai-aegis-sub-ai-filter                → calls /api/findings/ai-process
  - tai-aegis-sub-ai-dashboard-prep        → no-op pass-through (logic in
                                             ai-process route)
  - tai-aegis-sub-alert-router             → no-op pass-through (alerts on
                                             routing handled by Realtime
                                             channels for Phase 1)

Sub-WFs are stubs in Phase 1 Step 3. Each detection sub-WF logs its
incoming payload and returns []. Real implementations land in Phase 1
Steps 10-19 as separate PRs.

Usage: python3 _generate_master_skeleton.py
       → writes tai-aegis-master.json + 17 sub_*.json files to /data/imports/
       → run `modal run modal_app/n8n_orchestrator.py::reset_and_reimport`
         on the volume to load them into n8n
"""
import json, os, uuid, sys
from pathlib import Path

OUT_DIR = Path(__file__).parent

# Vercel base URL for skill HTTP calls
APP_URL = "https://tai-aegis.vercel.app"

# ── Helpers ──────────────────────────────────────────────────────────────

def node_id() -> str:
    return str(uuid.uuid4())

def make_node(name: str, type_: str, x: int, y: int, **params) -> dict:
    """One n8n node."""
    return {
        "id": node_id(),
        "name": name,
        "type": type_,
        "typeVersion": 1,
        "position": [x, y],
        "parameters": params,
    }

def http_request_node(name: str, method: str, url: str, body: dict | None, x: int, y: int) -> dict:
    """HTTP Request node configured for JSON POST/GET against our /api routes."""
    n = {
        "id": node_id(),
        "name": name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [x, y],
        "parameters": {
            "method": method,
            "url": url,
            "sendHeaders": True,
            "headerParameters": {"parameters": [{"name": "Content-Type", "value": "application/json"}]},
            "options": {"timeout": 55000},
        },
    }
    if body is not None:
        n["parameters"]["sendBody"] = True
        n["parameters"]["specifyBody"] = "json"
        n["parameters"]["jsonBody"] = json.dumps(body)
    return n

def webhook_trigger(name: str, path: str, x: int, y: int) -> dict:
    return {
        "id": node_id(),
        "name": name,
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [x, y],
        "webhookId": str(uuid.uuid4()),
        "parameters": {
            "httpMethod": "POST",
            "path": path,
            "options": {},
            "responseMode": "lastNode",
        },
    }

def respond_to_webhook(name: str, x: int, y: int, response: str = "={{ $json }}") -> dict:
    return make_node(
        name, "n8n-nodes-base.respondToWebhook", x, y,
        respondWith="json",
        responseBody=response,
    )

def code_node(name: str, code: str, x: int, y: int) -> dict:
    return make_node(name, "n8n-nodes-base.code", x, y, mode="runOnceForAllItems", jsCode=code)

def execute_workflow_node(name: str, target_workflow_name: str, x: int, y: int) -> dict:
    """Execute Workflow node — invokes another sub-WF by name. n8n resolves
    the workflow id at runtime by looking up by name.
    """
    return {
        "id": node_id(),
        "name": name,
        "type": "n8n-nodes-base.executeWorkflow",
        "typeVersion": 1,
        "position": [x, y],
        "parameters": {
            "source": "parameter",
            "workflowId": {"__rl": True, "value": target_workflow_name, "mode": "name"},
            "mode": "each",
        },
    }

def connect(name_from: str, name_to: str, idx_to: int = 0) -> dict:
    """Returns one entry of the connections dict mapping name_from → name_to."""
    return {name_from: {"main": [[{"node": name_to, "type": "main", "index": idx_to}]]}}

def merge_connections(*partials: dict) -> dict:
    out: dict = {}
    for p in partials:
        for src, val in p.items():
            if src not in out:
                out[src] = val
            else:
                # Merge multiple targets
                out[src]["main"][0].extend(val["main"][0])
    return out

def workflow(name: str, nodes: list, connections: dict) -> dict:
    """Match the exact top-level shape n8n's import:workflow CLI expects.
    Verified against existing working brand_monitoring.json: keys in order
    name → nodes → connections → settings → staticData → pinData → active.
    Adding `tags` or reordering keys breaks the CLI parser
    ("workflows.map is not a function").
    """
    return {
        "name": name,
        "nodes": nodes,
        "connections": connections,
        "settings": {"executionOrder": "v1"},
        "staticData": None,
        "pinData": {},
        "active": False,
    }

def write_workflow(filename: str, wf: dict) -> None:
    """n8n's import:workflow CLI calls .map() on the file content — it
    requires an ARRAY of workflows even for a single workflow file."""
    path = OUT_DIR / filename
    path.write_text(json.dumps([wf], indent=2))
    print(f"  wrote {filename}  ({len(wf.get('nodes',[]))} nodes)")

# ── Sub-WF stubs ─────────────────────────────────────────────────────────

def make_passthrough_sub_wf(name: str, log_prefix: str) -> dict:
    """Stub sub-WF that just logs and returns empty findings array."""
    n_trigger = webhook_trigger("Trigger", f"{name}-trigger", 240, 300)
    n_log = code_node("Log invocation", f"""
console.log('[{log_prefix}] invoked with', JSON.stringify($input.all().map(i => i.json), null, 2).slice(0, 300));
return [{{ json: {{ stub: true, source: '{log_prefix}', findings: [] }} }}];
""", 480, 300)
    n_resp = respond_to_webhook("Respond", 720, 300)
    return workflow(
        name,
        [n_trigger, n_log, n_resp],
        merge_connections(
            connect("Trigger", "Log invocation"),
            connect("Log invocation", "Respond"),
        ),
    )

def make_skill_caller_sub_wf(name: str, route_path: str, label: str) -> dict:
    """Sub-WF that proxies to a Vercel /api route — used for attribution skill,
    ai filter, asset enricher, scan planner. Cleaner than re-implementing the
    skill logic in n8n nodes."""
    n_trigger = webhook_trigger("Trigger", f"{name}-trigger", 240, 300)
    n_extract = code_node("Extract body", """
// Pass through the trigger's body to the HTTP node
return $input.all().map(i => ({ json: i.json.body || i.json }));
""", 480, 300)
    n_call = http_request_node(
        f"Call /{route_path}",
        "POST",
        f"{APP_URL}/api/{route_path}",
        None,  # body comes from previous node
        720, 300,
    )
    # Override to pass the dynamic body
    n_call["parameters"]["sendBody"] = True
    n_call["parameters"]["specifyBody"] = "json"
    n_call["parameters"]["jsonBody"] = "={{ JSON.stringify($json) }}"
    n_resp = respond_to_webhook("Respond", 960, 300)
    return workflow(
        name,
        [n_trigger, n_extract, n_call, n_resp],
        merge_connections(
            connect("Trigger", "Extract body"),
            connect("Extract body", f"Call /{route_path}"),
            connect(f"Call /{route_path}", "Respond"),
        ),
    )

# ── 14 detection sub-WF stubs ────────────────────────────────────────────

DOMAINS = [
    ("A", "domain-website", "Domain & Website (FEAT-004/005/006/007/019/020/022/023)"),
    ("B", "mobile-apps", "Mobile Apps (FEAT-001/002/003)"),
    ("C", "social-impersonation", "Social Impersonation (FEAT-009/010/011/012/013/014)"),
    ("D", "people-impersonation", "People Impersonation (FEAT-015/028/029)"),
    ("E", "ip-trademark", "IP & Trademark"),
    ("F", "counterfeit", "Counterfeit (n/a for CA Grameen)"),
    ("G", "recruitment", "Recruitment (FEAT-024/025)"),
    ("H", "financial-scams", "Financial Scams"),
    ("I", "search-messaging", "Search & Messaging Abuse"),
    ("J", "synthetic-media", "Synthetic Media"),
    ("K", "data-leaks", "Data & Credential Leaks (FEAT-017/018)"),
    ("L", "dark-web", "Dark Web (FEAT-016)"),
    ("M", "reputation", "Reputation & Disinfo (FEAT-008)"),
    ("N", "phishing-campaigns", "Phishing Campaigns"),
]

# ── Master workflow ──────────────────────────────────────────────────────

def make_master_workflow() -> dict:
    """Per Part 8 spec — top-level orchestrator with:
      - Schedule + Webhook + Apify-callback triggers
      - Asset Enricher → Detection Planner
      - 14-domain split
      - Merge (sync gate)
      - Normalize + Attribution Skill (second pass)
      - Decision switch → AI Filter / Auto-suppress / Elevate
      - AI Dashboard Prep
      - Alert Router
    """
    nodes = []
    conns: dict = {}

    # Triggers
    nodes.append(webhook_trigger("Manual scan webhook", "tai-aegis-master", 120, 200))
    nodes.append({
        "id": node_id(),
        "name": "Schedule trigger",
        "type": "n8n-nodes-base.scheduleTrigger",
        "typeVersion": 1.1,
        "position": [120, 360],
        "parameters": {"rule": {"interval": [{"field": "hours", "hoursInterval": 12}]}},
    })

    # Step: load tenant + assets + trust graph
    nodes.append(http_request_node(
        "Load tenant context", "GET",
        f"{APP_URL}/api/admin/cost-guard?tenant_id={{{{ $json.tenant_id || '23610954-5fd0-482f-8eb0-11edce1f5c58' }}}}",
        None, 360, 280,
    ))

    # AI Asset Enricher
    nodes.append(execute_workflow_node("Asset Enricher", "tai-aegis-sub-asset-enricher", 600, 280))

    # AI Detection Planner
    nodes.append(execute_workflow_node("Detection Planner", "tai-aegis-sub-detection-planner", 840, 280))

    # 14-domain split (Switch node — for Phase 1 just routes everything to A+B+I+K+M+N as primary; rest are stubs)
    nodes.append(make_node(
        "Domain switch", "n8n-nodes-base.switch", 1080, 280,
        mode="rules",
        rules={"rules": [{"conditions": {"conditions": [{"value1": "true", "operation": "equal", "value2": "true"}]}}]},
    ))

    # 14 sub-WF executors arranged in a grid (2 columns × 7 rows below the switch)
    SUB_WF_X = 1320
    SUB_WF_Y_BASE = 80
    for i, (letter, slug, label) in enumerate(DOMAINS):
        x = SUB_WF_X + (i % 2) * 240
        y = SUB_WF_Y_BASE + (i // 2) * 100
        nodes.append(execute_workflow_node(
            f"Sub-WF {letter} ({slug})",
            f"tai-aegis-sub-feat-{slug}",
            x, y,
        ))

    # Merge (sync gate) — wait all 14 to settle
    nodes.append(make_node(
        "Sync gate (merge all)", "n8n-nodes-base.merge", 1880, 280,
        mode="combine",
        combineBy="combineByPosition",
        options={"clashHandling": {"values": {"resolveClash": "preferInput2"}}},
    ))

    # Normalize + dedupe Code node
    nodes.append(code_node(
        "Normalize + dedupe",
        """
// Phase 1 stub — flatten + dedupe by url_or_value
const all = $input.all().flatMap(i => i.json.findings || []);
const seen = new Set();
const out = [];
for (const f of all) {
  const k = (f.url_or_value || f.item_id || JSON.stringify(f)).toLowerCase();
  if (seen.has(k)) continue;
  seen.add(k);
  out.push(f);
}
return [{ json: { count: out.length, findings: out } }];
""",
        2120, 280,
    ))

    # Attribution Skill (second-pass)
    nodes.append(execute_workflow_node("Attribution Skill", "tai-aegis-sub-attribution-skill", 2360, 280))

    # AI Filter
    nodes.append(execute_workflow_node("AI Filter", "tai-aegis-sub-ai-filter", 2600, 280))

    # AI Dashboard Prep
    nodes.append(execute_workflow_node("AI Dashboard Prep", "tai-aegis-sub-ai-dashboard-prep", 2840, 280))

    # Alert Router
    nodes.append(execute_workflow_node("Alert Router", "tai-aegis-sub-alert-router", 3080, 280))

    # Final response
    nodes.append(respond_to_webhook("Respond", 3320, 280))

    # ── Connections ──
    conns = merge_connections(
        connect("Manual scan webhook", "Load tenant context"),
        connect("Schedule trigger", "Load tenant context"),
        connect("Load tenant context", "Asset Enricher"),
        connect("Asset Enricher", "Detection Planner"),
        connect("Detection Planner", "Domain switch"),
    )

    # Switch → 14 sub-WFs in parallel (all from output 0 since rules will be added in Step 4)
    for i, (letter, slug, _) in enumerate(DOMAINS):
        conns = merge_connections(
            conns, connect("Domain switch", f"Sub-WF {letter} ({slug})", idx_to=0),
        )

    # All 14 sub-WFs → merge node
    for letter, slug, _ in DOMAINS:
        conns = merge_connections(
            conns, connect(f"Sub-WF {letter} ({slug})", "Sync gate (merge all)"),
        )

    conns = merge_connections(
        conns,
        connect("Sync gate (merge all)", "Normalize + dedupe"),
        connect("Normalize + dedupe", "Attribution Skill"),
        connect("Attribution Skill", "AI Filter"),
        connect("AI Filter", "AI Dashboard Prep"),
        connect("AI Dashboard Prep", "Alert Router"),
        connect("Alert Router", "Respond"),
    )

    return workflow("tai-aegis-master", nodes, conns)

# ── Generate everything ──────────────────────────────────────────────────

def main() -> int:
    print("[skel] generating master + 17 sub-WFs into n8n/workflows/")
    write_workflow("tai-aegis-master.json", make_master_workflow())

    # Stubs for the 14 detection sub-WFs
    for letter, slug, label in DOMAINS:
        write_workflow(
            f"sub-feat-{slug}.json",
            make_passthrough_sub_wf(f"tai-aegis-sub-feat-{slug}", f"sub-feat-{letter}"),
        )

    # Skill-caller sub-WFs that proxy to /api routes
    write_workflow(
        "sub-asset-enricher.json",
        make_skill_caller_sub_wf("tai-aegis-sub-asset-enricher", "admin/asset-enrich", "asset-enricher"),
    )
    write_workflow(
        "sub-detection-planner.json",
        make_skill_caller_sub_wf("tai-aegis-sub-detection-planner", "admin/scan-plan", "detection-planner"),
    )
    write_workflow(
        "sub-attribution-skill.json",
        make_skill_caller_sub_wf("tai-aegis-sub-attribution-skill", "skills/attribution", "attribution-skill"),
    )
    write_workflow(
        "sub-ai-filter.json",
        make_skill_caller_sub_wf("tai-aegis-sub-ai-filter", "findings/ai-process", "ai-filter"),
    )

    # Pass-through stubs (logic lives in /api/findings/ai-process for Phase 1)
    write_workflow(
        "sub-ai-dashboard-prep.json",
        make_passthrough_sub_wf("tai-aegis-sub-ai-dashboard-prep", "ai-dashboard-prep"),
    )
    write_workflow(
        "sub-alert-router.json",
        make_passthrough_sub_wf("tai-aegis-sub-alert-router", "alert-router"),
    )

    print()
    print("[skel] DONE. Next: copy *.json to Modal volume /data/imports/")
    print("       and run: modal run modal_app/n8n_orchestrator.py::reset_and_reimport")
    return 0

if __name__ == "__main__":
    sys.exit(main())
