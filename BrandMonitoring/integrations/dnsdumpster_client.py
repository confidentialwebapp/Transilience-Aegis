"""DNSDumpster client (subdomain enumeration via DNS history)."""
from __future__ import annotations

from typing import Any

from config.settings import KEYS
from core.http import request_json

BASE = "https://api.dnsdumpster.com"


def _headers() -> dict[str, str]:
    return {"X-API-Key": KEYS.dnsdumpster or "", "Accept": "application/json"}


async def domain(d: str, page: int = 1) -> dict[str, Any] | None:
    if not KEYS.dnsdumpster:
        return None
    return await request_json("GET", f"{BASE}/domain/{d}", headers=_headers(), params={"page": page})  # type: ignore[return-value]
