"""Customer-profile CRUD + manual ransomware match trigger."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Header
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()


class ProfileIn(BaseModel):
    display_name: str
    sectors: list[str] = Field(default_factory=list)
    countries: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)
    brand_keywords: list[str] = Field(default_factory=list)
    notify_in_app: bool = True
    notify_email: Optional[str] = None
    notify_telegram_chat_id: Optional[int] = None
    enabled: bool = True
    digest_frequency: str = "off"  # off | daily | weekly


@router.get("/")
async def list_profiles(x_org_id: str = Header(...)):
    from db import get_client

    try:
        client = get_client()
        result = (
            client.table("customer_profiles")
            .select("*")
            .eq("org_id", x_org_id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"data": result.data or []}
    except Exception as e:
        logger.error("list_profiles failed: %s", e)
        raise HTTPException(500, str(e))


@router.post("/")
async def create_profile(profile: ProfileIn, x_org_id: str = Header(...)):
    from db import get_client

    try:
        client = get_client()
        result = client.table("customer_profiles").insert({
            "org_id": x_org_id,
            **profile.model_dump(),
        }).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error("create_profile failed: %s", e)
        raise HTTPException(500, str(e))


@router.patch("/{profile_id}")
async def update_profile(profile_id: str, body: dict = Body(...), x_org_id: str = Header(...)):
    from db import get_client

    allowed = {"display_name", "sectors", "countries", "domains", "brand_keywords",
               "notify_in_app", "notify_email", "notify_telegram_chat_id", "enabled",
               "digest_frequency"}
    payload = {k: v for k, v in body.items() if k in allowed}
    if not payload:
        raise HTTPException(400, "no editable fields in body")
    payload["updated_at"] = "now()"
    try:
        client = get_client()
        result = (
            client.table("customer_profiles")
            .update(payload)
            .eq("id", profile_id)
            .eq("org_id", x_org_id)
            .execute()
        )
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error("update_profile failed: %s", e)
        raise HTTPException(500, str(e))


@router.delete("/{profile_id}")
async def delete_profile(profile_id: str, x_org_id: str = Header(...)):
    from db import get_client

    try:
        client = get_client()
        client.table("customer_profiles").delete().eq("id", profile_id).eq("org_id", x_org_id).execute()
        return {"deleted": profile_id}
    except Exception as e:
        logger.error("delete_profile failed: %s", e)
        raise HTTPException(500, str(e))


@router.post("/match-now")
async def match_now(x_org_id: str = Header(...)):
    """Pull recent ransomware victims and run the matcher immediately.
    Useful as a 'check now' button in the UI; the scheduler also runs this every 15min."""
    from modules.ransomware_matcher import run_sync_and_match

    return await run_sync_and_match(limit=100)


@router.get("/recent-matches")
async def recent_matches(x_org_id: str = Header(...), limit: int = 20):
    """Last N ransomware alerts for this org — convenient widget for the profile page."""
    from db import get_client

    try:
        client = get_client()
        result = (
            client.table("alerts")
            .select("id,title,description,severity,risk_score,source_url,raw_data,created_at,status")
            .eq("org_id", x_org_id)
            .eq("module", "ransomware")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return {"data": result.data or []}
    except Exception as e:
        logger.error("recent_matches failed: %s", e)
        raise HTTPException(500, str(e))
