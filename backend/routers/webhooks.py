"""Outbound webhook delivery — Slack, Teams, Discord, custom JSON.

When an alert is created and matches a webhook's filter, fire an HTTP POST
asynchronously. Each delivery is logged for debugging.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Body, HTTPException, Header
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class WebhookIn(BaseModel):
    name: str
    url: str
    kind: str = "generic"  # slack | teams | discord | generic
    secret: Optional[str] = None
    events: list[str] = Field(default_factory=lambda: ["alert.created"])
    min_severity: str = "medium"
    enabled: bool = True


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------
@router.get("/")
async def list_webhooks(x_org_id: str = Header(...)):
    from db import get_client

    try:
        result = (
            get_client().table("alert_webhooks")
            .select("*")
            .eq("org_id", x_org_id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"data": result.data or []}
    except Exception as e:
        logger.error("list_webhooks failed: %s", e)
        raise HTTPException(500, str(e))


@router.post("/")
async def create_webhook(body: WebhookIn, x_org_id: str = Header(...)):
    from db import get_client
    from utils import audit

    try:
        result = get_client().table("alert_webhooks").insert({
            "org_id": x_org_id,
            **body.model_dump(),
        }).execute()
        row = result.data[0] if result.data else {}
        audit.record(x_org_id, "webhook.created",
                     entity_type="webhook", entity_id=row.get("id"),
                     details={"name": body.name, "kind": body.kind, "url_host": _host_only(body.url)})
        return row
    except Exception as e:
        logger.error("create_webhook failed: %s", e)
        raise HTTPException(500, str(e))


@router.patch("/{webhook_id}")
async def update_webhook(webhook_id: str, body: dict = Body(...), x_org_id: str = Header(...)):
    from db import get_client
    from utils import audit

    allowed = {"name", "url", "kind", "secret", "events", "min_severity", "enabled"}
    payload = {k: v for k, v in body.items() if k in allowed}
    if not payload:
        raise HTTPException(400, "no editable fields")
    payload["updated_at"] = "now()"
    try:
        result = (
            get_client().table("alert_webhooks")
            .update(payload).eq("id", webhook_id).eq("org_id", x_org_id).execute()
        )
        audit.record(x_org_id, "webhook.updated", entity_type="webhook", entity_id=webhook_id)
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error("update_webhook failed: %s", e)
        raise HTTPException(500, str(e))


@router.delete("/{webhook_id}")
async def delete_webhook(webhook_id: str, x_org_id: str = Header(...)):
    from db import get_client
    from utils import audit

    try:
        get_client().table("alert_webhooks").delete().eq("id", webhook_id).eq("org_id", x_org_id).execute()
        audit.record(x_org_id, "webhook.deleted", entity_type="webhook", entity_id=webhook_id)
        return {"deleted": webhook_id}
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------------------------------------------------------------------------
# Test delivery — fires a sample alert payload to the URL right now.
# ---------------------------------------------------------------------------
@router.post("/{webhook_id}/test")
async def test_webhook(webhook_id: str, x_org_id: str = Header(...)):
    from db import get_client

    try:
        row = (
            get_client().table("alert_webhooks").select("*")
            .eq("id", webhook_id).eq("org_id", x_org_id).execute()
        )
        if not row.data:
            raise HTTPException(404, "webhook not found")
        sample_alert = {
            "title": "Test alert from AEGIS",
            "description": "This is a test event triggered from your dashboard.",
            "severity": "high",
            "module": "test",
            "source_url": "https://tai-aegis.vercel.app/alerts",
            "created_at": "now",
        }
        result = await _deliver(row.data[0], sample_alert)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------------------------------------------------------------------------
# Deliveries log
# ---------------------------------------------------------------------------
@router.get("/deliveries")
async def list_deliveries(x_org_id: str = Header(...), limit: int = 30):
    from db import get_client
    try:
        res = (
            get_client().table("webhook_deliveries").select("*")
            .eq("org_id", x_org_id).order("delivered_at", desc=True).limit(limit).execute()
        )
        return {"data": res.data or []}
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------------------------------------------------------------------------
# Internal: delivery helpers (also exported for ransomware_matcher etc. to call)
# ---------------------------------------------------------------------------
def _host_only(url: str) -> str:
    try:
        from urllib.parse import urlparse
        return urlparse(url).hostname or ""
    except Exception:
        return ""


def _shape_payload(kind: str, alert: dict) -> dict:
    """Format the payload for the destination's expected schema."""
    title = alert.get("title", "AEGIS alert")
    desc = (alert.get("description") or "")[:500]
    sev = (alert.get("severity") or "info").upper()
    color_for = {"CRITICAL": "#dc2626", "HIGH": "#ea580c", "MEDIUM": "#ca8a04",
                 "LOW": "#16a34a", "INFO": "#64748b"}
    color = color_for.get(sev, "#64748b")
    src = alert.get("source_url") or ""

    if kind == "slack":
        return {
            "attachments": [{
                "color": color,
                "title": f"[{sev}] {title}",
                "text": desc,
                "footer": "TAI-AEGIS",
                "actions": [{"type": "button", "text": "Open in dashboard",
                             "url": "https://tai-aegis.vercel.app/alerts"}] if src else [],
            }]
        }
    if kind == "discord":
        return {
            "embeds": [{
                "title": f"[{sev}] {title}",
                "description": desc,
                "url": src or None,
                "color": int(color.lstrip("#"), 16),
                "footer": {"text": "TAI-AEGIS"},
            }]
        }
    if kind == "teams":
        return {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": color.lstrip("#"),
            "title": f"[{sev}] {title}",
            "text": desc,
            "potentialAction": ([{
                "@type": "OpenUri", "name": "Open dashboard",
                "targets": [{"os": "default", "uri": "https://tai-aegis.vercel.app/alerts"}],
            }] if src else []),
        }
    # generic: send the alert as-is
    return {"alert": alert}


async def _deliver(webhook: dict, alert: dict, attempt: int = 1) -> dict:
    """Deliver one alert to one webhook. Logs the result. Never raises."""
    from db import get_client

    payload = _shape_payload(webhook.get("kind", "generic"), alert)
    body_bytes = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json", "User-Agent": "TAI-AEGIS-Webhook/1.0"}
    if webhook.get("kind") == "generic" and webhook.get("secret"):
        sig = hmac.new(webhook["secret"].encode(), body_bytes, hashlib.sha256).hexdigest()
        headers["X-AEGIS-Signature"] = f"sha256={sig}"

    status = None
    body_resp = ""
    error = None
    ok = False
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(webhook["url"], content=body_bytes, headers=headers)
            status = resp.status_code
            body_resp = (resp.text or "")[:500]
            ok = 200 <= resp.status_code < 300
    except Exception as e:
        error = f"{type(e).__name__}: {e}"

    # Update webhook + log
    try:
        client = get_client()
        update_payload = {
            "last_delivery_at": "now()",
            "last_delivery_status": status,
            "last_delivery_error": error,
        }
        if not ok:
            update_payload["failure_count"] = (webhook.get("failure_count") or 0) + 1
        else:
            update_payload["failure_count"] = 0
        client.table("alert_webhooks").update(update_payload).eq("id", webhook["id"]).execute()

        client.table("webhook_deliveries").insert({
            "webhook_id": webhook["id"],
            "org_id": webhook["org_id"],
            "alert_id": alert.get("id"),
            "http_status": status,
            "ok": ok,
            "response_body": body_resp,
            "error": error,
            "attempt": attempt,
        }).execute()
    except Exception as e:
        logger.warning("webhook delivery log failed: %s", e)

    return {"ok": ok, "http_status": status, "error": error, "response_body": body_resp[:200]}


async def fire_for_alert(alert: dict) -> int:
    """Public hook — call this whenever an alert is created. Returns delivered count."""
    from db import get_client

    org_id = alert.get("org_id")
    if not org_id:
        return 0
    sev_rank = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
    alert_rank = sev_rank.get(alert.get("severity", "info"), 0)

    try:
        result = (
            get_client().table("alert_webhooks")
            .select("*").eq("org_id", org_id).eq("enabled", True).execute()
        )
        webhooks = result.data or []
    except Exception:
        return 0

    delivered = 0
    for wh in webhooks:
        if alert_rank < sev_rank.get(wh.get("min_severity", "medium"), 2):
            continue
        if "alert.created" not in (wh.get("events") or []):
            continue
        try:
            r = await _deliver(wh, alert)
            if r["ok"]:
                delivered += 1
        except Exception as e:
            logger.warning("fire_for_alert delivery crashed: %s", e)
    return delivered
