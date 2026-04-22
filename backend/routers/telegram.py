"""Telegram bot ingestion endpoints — list channels & messages, manual poll trigger."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Query

from db import get_client
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/channels")
async def list_channels(x_org_id: str = Header(...)):
    try:
        client = get_client()
        result = (
            client.table("telegram_channels")
            .select("*")
            .order("added_at", desc=True)
            .execute()
        )
        return {"data": result.data or []}
    except Exception as e:
        logger.error("Failed to list telegram channels: %s", e)
        raise HTTPException(500, str(e))


@router.get("/messages")
async def list_messages(
    chat_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None, description="Full-text search"),
    has_iocs: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    x_org_id: str = Header(...),
):
    try:
        client = get_client()
        offset = (page - 1) * per_page
        query = (
            client.table("telegram_messages")
            .select("*", count="exact")
            .order("message_date", desc=True)
            .range(offset, offset + per_page - 1)
        )
        if chat_id is not None:
            query = query.eq("chat_id", chat_id)
        if q:
            query = query.text_search("text", q)
        if has_iocs:
            query = query.neq("extracted_iocs", "{}")
        result = query.execute()
        return {
            "data": result.data or [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        logger.error("Failed to list telegram messages: %s", e)
        raise HTTPException(500, str(e))


@router.post("/poll")
async def manual_poll(x_org_id: str = Header(...)):
    """Trigger a single poll cycle (the scheduler also runs this continuously)."""
    settings = get_settings()
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(400, "TELEGRAM_BOT_TOKEN not configured")
    from modules.telegram_monitor import poll_once

    count = await poll_once(settings.TELEGRAM_BOT_TOKEN)
    return {"updates_processed": count}


@router.get("/poll/state")
async def poll_state(x_org_id: str = Header(...)):
    try:
        client = get_client()
        result = client.table("telegram_poll_state").select("*").eq("id", 1).execute()
        return result.data[0] if result.data else {"last_update_id": 0}
    except Exception as e:
        logger.error("Failed to read poll state: %s", e)
        raise HTTPException(500, str(e))
