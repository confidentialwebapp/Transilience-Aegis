"""VirusTotal v3 client."""
from __future__ import annotations

import base64
from typing import Any

from config.settings import KEYS
from core.http import request_json

BASE = "https://www.virustotal.com/api/v3"


def _headers() -> dict[str, str]:
    return {"x-apikey": KEYS.virustotal or "", "accept": "application/json"}


def _url_id(url: str) -> str:
    return base64.urlsafe_b64encode(url.encode()).rstrip(b"=").decode()


async def url_report(url: str) -> dict[str, Any] | None:
    if not KEYS.virustotal:
        return None
    return await request_json("GET", f"{BASE}/urls/{_url_id(url)}", headers=_headers())  # type: ignore[return-value]


async def domain_report(domain: str) -> dict[str, Any] | None:
    if not KEYS.virustotal:
        return None
    return await request_json("GET", f"{BASE}/domains/{domain}", headers=_headers())  # type: ignore[return-value]


async def ip_report(ip: str) -> dict[str, Any] | None:
    if not KEYS.virustotal:
        return None
    return await request_json("GET", f"{BASE}/ip_addresses/{ip}", headers=_headers())  # type: ignore[return-value]


async def search(query: str, limit: int = 30) -> dict[str, Any] | None:
    if not KEYS.virustotal:
        return None
    return await request_json("GET", f"{BASE}/intelligence/search", headers=_headers(), params={"query": query, "limit": limit})  # type: ignore[return-value]
