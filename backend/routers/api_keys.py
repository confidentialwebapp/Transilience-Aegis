"""API key management — issue, list, revoke per-org programmatic credentials.

Keys are shown once at creation (`aegis_<32_hex>`). We store sha256 of the full
key + an 8-char prefix for identification in the dashboard.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()


class ApiKeyIn(BaseModel):
    name: str
    scopes: list[str] = Field(default_factory=lambda: ["read"])
    expires_in_days: Optional[int] = None  # None = never


def _generate() -> tuple[str, str, str]:
    """Returns (full_key, key_hash, prefix)."""
    raw = secrets.token_hex(24)              # 48 chars
    full = f"aegis_{raw}"                    # 54 chars
    key_hash = hashlib.sha256(full.encode()).hexdigest()
    prefix = full[:14]                       # "aegis_" + 8 hex chars
    return full, key_hash, prefix


@router.get("/")
async def list_keys(x_org_id: str = Header(...)):
    from db import get_client

    try:
        result = (
            get_client().table("api_keys")
            .select("id,name,prefix,scopes,last_used_at,expires_at,revoked_at,created_at")
            .eq("org_id", x_org_id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"data": result.data or []}
    except Exception as e:
        logger.error("list_keys failed: %s", e)
        raise HTTPException(500, str(e))


@router.post("/")
async def create_key(body: ApiKeyIn, x_org_id: str = Header(...)):
    from db import get_client
    from utils import audit

    full, key_hash, prefix = _generate()
    expires_at = None
    if body.expires_in_days:
        from datetime import timedelta
        expires_at = (datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)).isoformat()

    try:
        result = get_client().table("api_keys").insert({
            "org_id": x_org_id,
            "name": body.name,
            "key_hash": key_hash,
            "prefix": prefix,
            "scopes": body.scopes,
            "expires_at": expires_at,
        }).execute()
        row = result.data[0] if result.data else {}
        audit.record(x_org_id, "api_key.created",
                     entity_type="api_key", entity_id=row.get("id"),
                     details={"name": body.name, "scopes": body.scopes, "prefix": prefix})
        return {
            "id": row.get("id"),
            "name": body.name,
            "prefix": prefix,
            "scopes": body.scopes,
            "expires_at": expires_at,
            "key": full,  # ⚠️ only returned ONCE — frontend must show the user
            "warning": "Store this key now — you won't be able to see it again.",
        }
    except Exception as e:
        logger.error("create_key failed: %s", e)
        raise HTTPException(500, str(e))


@router.delete("/{key_id}")
async def revoke_key(key_id: str, x_org_id: str = Header(...)):
    """Soft-revoke (sets revoked_at) — preserves audit trail."""
    from db import get_client
    from utils import audit

    try:
        get_client().table("api_keys").update({
            "revoked_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", key_id).eq("org_id", x_org_id).execute()
        audit.record(x_org_id, "api_key.revoked", entity_type="api_key", entity_id=key_id)
        return {"revoked": key_id}
    except Exception as e:
        raise HTTPException(500, str(e))
