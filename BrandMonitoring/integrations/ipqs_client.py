"""IPQualityScore client."""
from __future__ import annotations

from typing import Any
from urllib.parse import quote

from config.settings import KEYS
from core.http import request_json

BASE = "https://ipqualityscore.com/api/json"


async def url_check(url: str, strictness: int = 1) -> dict[str, Any] | None:
    if not KEYS.ipqs:
        return None
    return await request_json(
        "GET",
        f"{BASE}/url/{KEYS.ipqs}/{quote(url, safe='')}",
        params={"strictness": strictness},
    )  # type: ignore[return-value]


async def email_check(email: str) -> dict[str, Any] | None:
    if not KEYS.ipqs:
        return None
    return await request_json("GET", f"{BASE}/email/{KEYS.ipqs}/{email}")  # type: ignore[return-value]


async def ip_check(ip: str, strictness: int = 1) -> dict[str, Any] | None:
    if not KEYS.ipqs:
        return None
    return await request_json("GET", f"{BASE}/ip/{KEYS.ipqs}/{ip}", params={"strictness": strictness})  # type: ignore[return-value]


async def domain_check(domain: str) -> dict[str, Any] | None:
    if not KEYS.ipqs:
        return None
    return await request_json("GET", f"{BASE}/url/{KEYS.ipqs}/{quote(domain, safe='')}")  # type: ignore[return-value]
