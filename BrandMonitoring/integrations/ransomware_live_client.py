"""ransomware.live client."""
from __future__ import annotations

from typing import Any

from config.settings import KEYS
from core.http import request_json

BASE = "https://api.ransomware.live/v2"


def _headers() -> dict[str, str]:
    h = {"Accept": "application/json"}
    if KEYS.ransomware_live:
        h["X-Api-Key"] = KEYS.ransomware_live
    return h


async def search_victims(keyword: str) -> list[dict[str, Any]]:
    r = await request_json("GET", f"{BASE}/searchvictims/{keyword}", headers=_headers())
    return r if isinstance(r, list) else []


async def recent_victims() -> list[dict[str, Any]]:
    r = await request_json("GET", f"{BASE}/recentvictims", headers=_headers())
    return r if isinstance(r, list) else []


async def country_victims(country_code: str) -> list[dict[str, Any]]:
    r = await request_json("GET", f"{BASE}/countryvictims/{country_code}", headers=_headers())
    return r if isinstance(r, list) else []


async def groups() -> list[dict[str, Any]]:
    r = await request_json("GET", f"{BASE}/groups", headers=_headers())
    return r if isinstance(r, list) else []
