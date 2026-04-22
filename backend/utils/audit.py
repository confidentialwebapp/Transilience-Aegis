"""Audit log helper — fire-and-forget recording of significant org-scoped events.

Every router that performs a state-changing action calls audit.record() with
the action name, entity, and any useful metadata. Failures are swallowed so a
broken audit insert never breaks a user-facing operation.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import Request

logger = logging.getLogger(__name__)


def record(
    org_id: Optional[str],
    action: str,
    *,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    user_id: Optional[str] = None,
    request: Optional[Request] = None,
) -> None:
    """Record one audit event. Best-effort — never raises."""
    try:
        from db import get_client

        ip = None
        ua = None
        if request is not None:
            ip = request.client.host if request.client else None
            ua = request.headers.get("user-agent")

        get_client().table("audit_log").insert({
            "org_id": org_id,
            "user_id": user_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "details": details or {},
            "ip": ip,
            "user_agent": (ua or "")[:500] if ua else None,
        }).execute()
    except Exception as e:
        logger.warning("audit insert failed (action=%s): %s", action, e)
