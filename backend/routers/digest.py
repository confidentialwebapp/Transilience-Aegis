"""Email digest control endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import HTMLResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/send-now/{profile_id}")
async def send_now(profile_id: str, x_org_id: str = Header(...)):
    """Send a digest for one specific profile right now (manual trigger from UI)."""
    from db import get_client
    from modules.email_digest import send_digest_for_profile

    client = get_client()
    res = (
        client.table("customer_profiles")
        .select("*")
        .eq("id", profile_id)
        .eq("org_id", x_org_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "profile not found")
    return await send_digest_for_profile(res.data[0], force=True)


@router.post("/send-all")
async def send_all_due(secret: str = Query("", description="Required if MODAL_TOKEN_ID set")):
    """Iterate all due digests. Called by the Modal hourly cron.

    Auth: when called from outside the cluster, the caller must pass the same
    MODAL_TOKEN_ID as a `secret` query param. Inside-Render calls (e.g., the
    UI) don't need this and any value is accepted because the call is via the
    same network.
    """
    from config import get_settings
    from modules.email_digest import send_digests_for_all_due

    s = get_settings()
    if s.MODAL_TOKEN_ID and secret != s.MODAL_TOKEN_ID:
        # Don't expose the existence of a secret if it's wrong
        raise HTTPException(401, "unauthorized")
    return await send_digests_for_all_due()


@router.get("/log")
async def list_log(x_org_id: str = Header(...), limit: int = Query(50, ge=1, le=200)):
    """Recent digest send attempts for this org."""
    from db import get_client

    try:
        res = (
            get_client().table("digest_log")
            .select("*")
            .eq("org_id", x_org_id)
            .order("sent_at", desc=True)
            .limit(limit)
            .execute()
        )
        return {"data": res.data or []}
    except Exception as e:
        logger.error("digest log failed: %s", e)
        raise HTTPException(500, str(e))


@router.get("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe(token: str = Query(..., min_length=1)):
    """Unsubscribe link target. No auth — token is the auth.
    Returns a styled HTML confirmation page so it works straight from email."""
    from modules.email_digest import unsubscribe_by_token

    ok = unsubscribe_by_token(token)
    msg = ("✓ You have been unsubscribed from AEGIS digests."
           if ok else "Invalid or expired unsubscribe link.")
    color = "#16a34a" if ok else "#dc2626"
    return f"""<!DOCTYPE html>
<html><head><title>Unsubscribed</title></head>
<body style="font-family:sans-serif;background:#f8fafc;padding:80px 20px;text-align:center">
  <h1 style="color:{color};font-size:22px">{msg}</h1>
  <p style="color:#64748b;font-size:13px">You can re-enable digests anytime from your AEGIS dashboard.</p>
</body></html>"""
