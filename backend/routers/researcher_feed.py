"""Researcher-feed router: list channels, list posts, manual poll trigger."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Query

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/channels")
async def list_channels(x_org_id: str = Header(...)):
    from db import get_client

    try:
        client = get_client()
        result = (
            client.table("researcher_channels")
            .select("*")
            .order("name")
            .execute()
        )
        return {"data": result.data or []}
    except Exception as e:
        logger.error("researcher_channels list failed: %s", e)
        raise HTTPException(500, str(e))


@router.get("/posts")
async def list_posts(
    channel: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="full-text search"),
    has_iocs: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    x_org_id: str = Header(...),
):
    from db import get_client

    try:
        client = get_client()
        offset = (page - 1) * per_page
        query = (
            client.table("researcher_posts")
            .select("*", count="exact")
            .order("published_at", desc=True)
            .range(offset, offset + per_page - 1)
        )
        if channel:
            query = query.eq("channel", channel)
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
        logger.error("researcher_posts list failed: %s", e)
        raise HTTPException(500, str(e))


@router.post("/poll")
async def manual_poll(x_org_id: str = Header(...)):
    """Trigger ingestion across all enabled channels right now.
    Scheduler also runs this every 30 minutes."""
    from modules.researcher_feed import run_all

    return await run_all()


@router.post("/channels/{channel_id}/poll")
async def poll_one(channel_id: str, x_org_id: str = Header(...)):
    """Trigger ingestion for a single channel by id."""
    from db import get_client
    from modules.researcher_feed import ingest_channel

    try:
        client = get_client()
        row = client.table("researcher_channels").select("*").eq("id", channel_id).execute()
        if not row.data:
            raise HTTPException(404, "channel not found")
        return await ingest_channel(row.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
