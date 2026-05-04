"""AbuseIPDB client."""
from __future__ import annotations

from typing import Any

from config.settings import KEYS
from core.http import request_json

BASE = "https://api.abuseipdb.com/api/v2"


def _headers() -> dict[str, str]:
    return {"Key": KEYS.abuseipdb or "", "Accept": "application/json"}


async def check(ip: str, max_age_days: int = 90) -> dict[str, Any] | None:
    if not KEYS.abuseipdb:
        return None
    return await request_json(
        "GET", f"{BASE}/check",
        headers=_headers(),
        params={"ipAddress": ip, "maxAgeInDays": max_age_days, "verbose": "true"},
    )  # type: ignore[return-value]


async def reports(ip: str) -> dict[str, Any] | None:
    if not KEYS.abuseipdb:
        return None
    return await request_json("GET", f"{BASE}/reports", headers=_headers(), params={"ipAddress": ip})  # type: ignore[return-value]
