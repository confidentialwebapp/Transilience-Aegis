"""AlienVault OTX client."""
from __future__ import annotations

from typing import Any

from config.settings import KEYS
from core.http import request_json

BASE = "https://otx.alienvault.com/api/v1"


def _headers() -> dict[str, str]:
    return {"X-OTX-API-KEY": KEYS.otx or ""}


async def domain(d: str) -> dict[str, Any] | None:
    return await request_json("GET", f"{BASE}/indicators/domain/{d}/general", headers=_headers())  # type: ignore[return-value]


async def url(u: str) -> dict[str, Any] | None:
    from urllib.parse import quote
    return await request_json("GET", f"{BASE}/indicators/url/{quote(u, safe='')}/general", headers=_headers())  # type: ignore[return-value]


async def ip(addr: str) -> dict[str, Any] | None:
    return await request_json("GET", f"{BASE}/indicators/IPv4/{addr}/general", headers=_headers())  # type: ignore[return-value]


async def hostname(h: str) -> dict[str, Any] | None:
    return await request_json("GET", f"{BASE}/indicators/hostname/{h}/general", headers=_headers())  # type: ignore[return-value]


async def search_pulses(q: str, limit: int = 20) -> dict[str, Any] | None:
    return await request_json("GET", f"{BASE}/search/pulses", headers=_headers(), params={"q": q, "limit": limit})  # type: ignore[return-value]
