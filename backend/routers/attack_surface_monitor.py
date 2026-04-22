"""Attack-surface monitoring control endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/run-all")
async def run_all_due(secret: str = Query("", description="Required if MODAL_TOKEN_ID set")):
    """Triggered by the Modal nightly cron. Iterates every enabled
    customer_profile and scans their domains. Cron-key gated."""
    from config import get_settings
    from modules.attack_surface_monitor import run_all

    s = get_settings()
    if s.MODAL_TOKEN_ID and secret != s.MODAL_TOKEN_ID:
        raise HTTPException(401, "unauthorized")
    return await run_all()


@router.post("/run-now/{profile_id}")
async def run_one(profile_id: str, x_org_id: str = Header(...)):
    """Manual trigger from the UI — run attack-surface scan for one profile."""
    from db import get_client
    from modules.attack_surface_monitor import run_for_profile

    p = (
        get_client().table("customer_profiles").select("*")
        .eq("id", profile_id).eq("org_id", x_org_id).execute()
    )
    if not p.data:
        raise HTTPException(404, "profile not found")
    return await run_for_profile(p.data[0])


@router.get("/snapshots/{profile_id}")
async def list_snapshots(profile_id: str, x_org_id: str = Header(...), limit: int = 30):
    """Most recent snapshots for one profile — useful for the trend chart."""
    from db import get_client

    try:
        result = (
            get_client().table("attack_surface_snapshots")
            .select("id,domain,subdomains,resolved_count,alive_count,scanned_at")
            .eq("profile_id", profile_id).eq("org_id", x_org_id)
            .order("scanned_at", desc=True).limit(limit).execute()
        )
        return {"data": result.data or []}
    except Exception as e:
        raise HTTPException(500, str(e))
