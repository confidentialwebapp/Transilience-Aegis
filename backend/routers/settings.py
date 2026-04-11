"""
Organization Settings Router
Handles org configuration, notification preferences, scan schedules
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Query

from db import get_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/org")
async def get_org_settings(x_org_id: str = Header(...)):
    """Get organization settings."""
    try:
        db = get_client()
        org = db.table("orgs").select("*").eq("id", x_org_id).execute()
        if not org.data:
            # Auto-create org for demo mode
            result = db.table("orgs").insert({
                "id": x_org_id,
                "name": "My Organization",
                "domain": "",
                "plan": "free",
                "settings": {},
            }).execute()
            return result.data[0] if result.data else {}
        return org.data[0]
    except Exception as e:
        logger.error("Get org settings failed: %s", e)
        raise HTTPException(500, str(e))


@router.patch("/org")
async def update_org_settings(body: dict, x_org_id: str = Header(...)):
    """Update organization settings."""
    allowed = {"name", "domain", "settings"}
    updates = {}
    for k, v in body.items():
        if k in allowed:
            updates[k] = v

    if not updates:
        raise HTTPException(400, "No valid fields to update")

    try:
        db = get_client()
        # Check if org exists, create if not
        existing = db.table("orgs").select("id").eq("id", x_org_id).execute()
        if not existing.data:
            result = db.table("orgs").insert({
                "id": x_org_id,
                "name": updates.get("name", "My Organization"),
                "domain": updates.get("domain", ""),
                "settings": updates.get("settings", {}),
            }).execute()
            return result.data[0] if result.data else {}

        result = db.table("orgs").update(updates).eq("id", x_org_id).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error("Update org settings failed: %s", e)
        raise HTTPException(500, str(e))


@router.get("/notifications")
async def get_notification_settings(x_org_id: str = Header(...)):
    """Get notification settings for the org."""
    try:
        db = get_client()
        result = db.table("notification_settings").select("*").eq("org_id", x_org_id).execute()
        if not result.data:
            # Create default notification settings
            new_settings = db.table("notification_settings").insert({
                "org_id": x_org_id,
                "email_enabled": True,
                "email_recipients": [],
                "webhook_enabled": False,
                "webhook_url": "",
                "telegram_enabled": False,
                "telegram_chat_id": "",
                "min_severity": "medium",
            }).execute()
            return new_settings.data[0] if new_settings.data else {}
        return result.data[0]
    except Exception as e:
        logger.error("Get notification settings failed: %s", e)
        raise HTTPException(500, str(e))


@router.patch("/notifications")
async def update_notification_settings(body: dict, x_org_id: str = Header(...)):
    """Update notification settings."""
    allowed = {
        "email_enabled", "email_recipients", "webhook_enabled",
        "webhook_url", "telegram_enabled", "telegram_chat_id", "min_severity"
    }
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = datetime.utcnow().isoformat()

    if not updates:
        raise HTTPException(400, "No valid fields")

    try:
        db = get_client()
        existing = db.table("notification_settings").select("id").eq("org_id", x_org_id).execute()
        if not existing.data:
            updates["org_id"] = x_org_id
            result = db.table("notification_settings").insert(updates).execute()
        else:
            result = db.table("notification_settings").update(updates).eq("org_id", x_org_id).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error("Update notification settings failed: %s", e)
        raise HTTPException(500, str(e))


@router.get("/scan-schedule")
async def get_scan_schedule(x_org_id: str = Header(...)):
    """Get scan schedule configuration."""
    try:
        db = get_client()
        org = db.table("orgs").select("settings").eq("id", x_org_id).execute()
        settings = (org.data[0] if org.data else {}).get("settings", {})
        return {
            "schedules": settings.get("scan_schedules", {
                "dark_web": {"enabled": True, "interval_hours": 6},
                "brand": {"enabled": True, "interval_hours": 4},
                "data_leak": {"enabled": True, "interval_hours": 12},
                "surface_web": {"enabled": True, "interval_hours": 24},
                "cert_monitor": {"enabled": True, "interval_hours": 1},
                "credential": {"enabled": True, "interval_hours": 8},
            }),
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.patch("/scan-schedule")
async def update_scan_schedule(body: dict, x_org_id: str = Header(...)):
    """Update scan schedule configuration."""
    try:
        db = get_client()
        org = db.table("orgs").select("settings").eq("id", x_org_id).execute()
        current_settings = (org.data[0] if org.data else {}).get("settings", {})
        current_settings["scan_schedules"] = body.get("schedules", {})
        db.table("orgs").update({"settings": current_settings}).eq("id", x_org_id).execute()
        return {"status": "updated", "schedules": current_settings["scan_schedules"]}
    except Exception as e:
        raise HTTPException(500, str(e))
