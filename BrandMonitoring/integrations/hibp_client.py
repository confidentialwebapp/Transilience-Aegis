"""Have I Been Pwned client."""
from __future__ import annotations

from typing import Any

from config.settings import KEYS
from core.http import request_json

BASE = "https://haveibeenpwned.com/api/v3"


def _headers() -> dict[str, str]:
    return {
        "hibp-api-key": KEYS.hibp or "",
        "User-Agent": "BrandMonitoring-Enterprise/1.0",
    }


async def breaches_for_account(email: str, truncate: bool = False) -> list[dict[str, Any]]:
    if not KEYS.hibp:
        return []
    r = await request_json(
        "GET", f"{BASE}/breachedaccount/{email}",
        headers=_headers(),
        params={"truncateResponse": str(truncate).lower(), "includeUnverified": "true"},
        expect_status=(200, 404),
    )
    if isinstance(r, list):
        return r
    return []


async def pastes_for_account(email: str) -> list[dict[str, Any]]:
    if not KEYS.hibp:
        return []
    r = await request_json("GET", f"{BASE}/pasteaccount/{email}", headers=_headers(), expect_status=(200, 404))
    if isinstance(r, list):
        return r
    return []


async def breach(name: str) -> dict[str, Any] | None:
    return await request_json("GET", f"{BASE}/breach/{name}", headers=_headers())  # type: ignore[return-value]


async def all_breaches(domain: str | None = None) -> list[dict[str, Any]]:
    params = {"domain": domain} if domain else None
    r = await request_json("GET", f"{BASE}/breaches", headers=_headers(), params=params)
    return r if isinstance(r, list) else []
