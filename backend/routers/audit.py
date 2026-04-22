"""Audit log endpoint — read-only listing for the current org."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Query

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def list_audit(
    x_org_id: str = Header(...),
    action: Optional[str] = Query(None, description="filter by action prefix, e.g. 'profile.'"),
    entity_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    from db import get_client

    try:
        client = get_client()
        offset = (page - 1) * per_page
        q = (
            client.table("audit_log")
            .select("*", count="exact")
            .eq("org_id", x_org_id)
            .order("created_at", desc=True)
            .range(offset, offset + per_page - 1)
        )
        if action:
            q = q.like("action", f"{action}%")
        if entity_type:
            q = q.eq("entity_type", entity_type)
        result = q.execute()
        return {
            "data": result.data or [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        logger.error("audit list failed: %s", e)
        raise HTTPException(500, str(e))


@router.get("/stats")
async def audit_stats(x_org_id: str = Header(...)):
    """Top actions and unique users over the last 7 days — for the audit dashboard widget."""
    from datetime import datetime, timedelta, timezone
    from db import get_client

    try:
        client = get_client()
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        result = (
            client.table("audit_log")
            .select("action,user_id,created_at")
            .eq("org_id", x_org_id)
            .gte("created_at", since)
            .limit(1000)
            .execute()
        )
        rows = result.data or []
        action_counts: dict[str, int] = {}
        users: set[str] = set()
        for r in rows:
            a = r.get("action") or "unknown"
            action_counts[a] = action_counts.get(a, 0) + 1
            if r.get("user_id"):
                users.add(r["user_id"])
        top = sorted(action_counts.items(), key=lambda x: -x[1])[:10]
        return {
            "total_events_7d": len(rows),
            "unique_users_7d": len(users),
            "top_actions": [{"action": a, "count": n} for a, n in top],
        }
    except Exception as e:
        logger.error("audit stats failed: %s", e)
        raise HTTPException(500, str(e))
