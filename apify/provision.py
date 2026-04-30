#!/usr/bin/env python3
"""Idempotent Apify provisioning for Transilience Aegis v2.

Reads task JSON files from apify/tasks/, then for each:
  1. Upserts the Apify Task (actor + input)
  2. Upserts a Schedule (one per keyword in keyword_rotation, or one for the
     base task if rotation is empty)
  3. Adds an ACTOR.RUN.SUCCEEDED + ACTOR.RUN.FAILED webhook on the task

Usage:
    APIFY_TOKEN="apify_api_..." python3 apify/provision.py
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

API = "https://api.apify.com/v2"
TOKEN = os.environ.get("APIFY_TOKEN") or sys.exit("ERROR: set APIFY_TOKEN")
TASKS_DIR = Path(__file__).parent / "tasks"


def _req(method: str, path: str, body: Any | None = None) -> tuple[int, dict | list | str]:
    url = f"{API}{path}{'&' if '?' in path else '?'}token={TOKEN}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read())
        except Exception:
            err_body = e.reason
        return e.code, err_body


def find_existing_task(name: str) -> str | None:
    """Return Apify task id for a task with the given name, if it exists."""
    code, body = _req("GET", "/actor-tasks?limit=1000")
    if code != 200 or not isinstance(body, dict):
        return None
    for item in body.get("data", {}).get("items", []):
        if item.get("name") == name:
            return item.get("id")
    return None


def find_existing_schedule(name: str) -> str | None:
    code, body = _req("GET", "/schedules?limit=1000")
    if code != 200 or not isinstance(body, dict):
        return None
    for item in body.get("data", {}).get("items", []):
        if item.get("name") == name:
            return item.get("id")
    return None


def find_existing_webhook(task_id: str, request_url: str) -> str | None:
    code, body = _req("GET", f"/actor-tasks/{task_id}/webhooks?limit=100")
    if code != 200 or not isinstance(body, dict):
        return None
    for item in body.get("data", {}).get("items", []):
        if item.get("requestUrl") == request_url:
            return item.get("id")
    return None


def normalize_task_name(task_id: str) -> str:
    # Apify allows only [a-z0-9-]. Strip the namespace prefix.
    return task_id.split("/", 1)[-1]


def normalize_actor_id(actor_id: str) -> str:
    # Apify actor IDs use ~ in API calls, not / (which is the human form).
    return actor_id.replace("/", "~")


def upsert_task(cfg: dict) -> tuple[str | None, str, str]:
    """Returns (task_apify_id, action, normalized_name)."""
    flat_name = normalize_task_name(cfg["task_id"])
    actor_id = normalize_actor_id(cfg["actor_id"])
    body = {
        "actId": actor_id,
        "name": flat_name,
        "options": {"memoryMbytes": 1024, "timeoutSecs": 600},
        "input": cfg["input_template"],
    }
    code, resp = _req("POST", "/actor-tasks", body)
    if code in (200, 201):
        return resp.get("data", {}).get("id"), "created", flat_name  # type: ignore
    # Conflict — try update
    existing_id = find_existing_task(flat_name)
    if existing_id:
        code2, resp2 = _req("PUT", f"/actor-tasks/{existing_id}", body)
        if code2 in (200, 201):
            return existing_id, "updated", flat_name
        print(f"  TASK UPDATE FAILED: {flat_name} → HTTP {code2} {str(resp2)[:200]}")
    print(f"  TASK FAILED: {flat_name} → HTTP {code} {str(resp)[:200]}")
    return None, "failed", flat_name


def upsert_schedule(task_apify_id: str, sched_name: str, cron: str, custom_data: dict | None = None) -> str:
    # Apify v2: customData is set on the action's `input` (override), not on the schedule root.
    action: dict = {"type": "RUN_ACTOR_TASK", "actorTaskId": task_apify_id}
    if custom_data:
        action["input"] = custom_data
    body = {
        "name": sched_name,
        "cronExpression": cron,
        "timezone": "Asia/Kolkata",
        "isEnabled": True,
        "isExclusive": True,
        "actions": [action],
    }
    code, resp = _req("POST", "/schedules", body)
    if code in (200, 201):
        return "created"
    existing_id = find_existing_schedule(sched_name)
    if existing_id:
        code2, _ = _req("PUT", f"/schedules/{existing_id}", body)
        if code2 in (200, 201):
            return "updated"
    print(f"  SCHEDULE FAILED: {sched_name} → HTTP {code} {str(resp)[:200]}")
    return "failed"


def find_existing_top_webhook(request_url: str, condition_task_id: str) -> str | None:
    code, body = _req("GET", "/webhooks?limit=1000")
    if code != 200 or not isinstance(body, dict):
        return None
    for item in body.get("data", {}).get("items", []):
        cond = item.get("condition") or {}
        if item.get("requestUrl") == request_url and cond.get("actorTaskId") == condition_task_id:
            return item.get("id")
    return None


def upsert_webhook(task_apify_id: str, cfg: dict) -> str:
    # Apify v2 webhooks live at top-level /webhooks; condition filters the task.
    body = {
        "eventTypes": ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"],
        "condition": {"actorTaskId": task_apify_id},
        "requestUrl": cfg["webhook_url"],
        "idempotencyKey": "{{run.id}}",
        "headersTemplate": json.dumps(
            {
                "X-Feature-Id": cfg["feature_id"],
                "X-Tenant-Id": cfg["tenant_id"],
                "X-Apify-Task-Id": cfg["task_id"],
            }
        ),
        "payloadTemplate": (
            '{"resource": {{resource}}, "eventData": {{eventData}}, '
            f'"feature_id": "{cfg["feature_id"]}", "tenant_id": "{cfg["tenant_id"]}"}}'
        ),
    }
    code, resp = _req("POST", "/webhooks", body)
    if code in (200, 201):
        return "created"
    existing_id = find_existing_top_webhook(cfg["webhook_url"], task_apify_id)
    if existing_id:
        code2, resp2 = _req("PUT", f"/webhooks/{existing_id}", body)
        if code2 in (200, 201):
            return "updated"
        print(f"  WEBHOOK UPDATE FAILED: → HTTP {code2} {str(resp2)[:200]}")
    print(f"  WEBHOOK FAILED: → HTTP {code} {str(resp)[:200]}")
    return "failed"


def provision(cfg: dict) -> dict:
    print(f"\n=== {cfg['task_id']} ({cfg['feature_id']}) ===")
    task_apify_id, task_action, flat_name = upsert_task(cfg)
    if not task_apify_id:
        return {"task": "failed"}
    print(f"  Task: {task_action}  apify_id={task_apify_id}")
    time.sleep(0.1)

    sched_results: list[str] = []
    rotation = cfg.get("keyword_rotation") or []
    if not rotation:
        sched_results.append(upsert_schedule(task_apify_id, flat_name, cfg["schedule_cron"]))
    else:
        for i, kw in enumerate(rotation):
            r = upsert_schedule(
                task_apify_id,
                f"{flat_name}-kw{i}",
                cfg["schedule_cron"],
                {"keyword": kw},
            )
            sched_results.append(r)
            time.sleep(0.1)
    print(f"  Schedules: {', '.join(sched_results)}")

    wh = upsert_webhook(task_apify_id, cfg)
    print(f"  Webhook: {wh}")

    return {
        "task": task_action,
        "schedules": sched_results,
        "webhook": wh,
    }


def main():
    if not TASKS_DIR.exists():
        sys.exit(f"ERROR: {TASKS_DIR} not found")

    files = sorted(TASKS_DIR.glob("*.json"))
    if not files:
        sys.exit(f"ERROR: no task JSONs in {TASKS_DIR}")

    print(f"Provisioning {len(files)} Apify Tasks against {API}")
    summary = {"tasks": {"created": 0, "updated": 0, "failed": 0},
               "schedules": {"created": 0, "updated": 0, "failed": 0},
               "webhooks": {"created": 0, "updated": 0, "failed": 0}}

    for f in files:
        cfg = json.loads(f.read_text())
        r = provision(cfg)
        summary["tasks"][r["task"]] = summary["tasks"].get(r["task"], 0) + 1
        for s in r.get("schedules", []):
            summary["schedules"][s] = summary["schedules"].get(s, 0) + 1
        if r.get("webhook"):
            summary["webhooks"][r["webhook"]] = summary["webhooks"].get(r["webhook"], 0) + 1

    print("\n" + "=" * 56)
    print("Summary:")
    print(f"  Tasks: {summary['tasks']}")
    print(f"  Schedules: {summary['schedules']}")
    print(f"  Webhooks: {summary['webhooks']}")
    print("=" * 56)

    failures = sum(v.get("failed", 0) for v in summary.values())
    sys.exit(1 if failures > 0 else 0)


if __name__ == "__main__":
    main()
