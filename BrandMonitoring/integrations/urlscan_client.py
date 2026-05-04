"""urlscan.io client."""
from __future__ import annotations

from typing import Any

from config.settings import KEYS
from core.http import get_bytes, request_json

BASE = "https://urlscan.io/api/v1"


def _headers() -> dict[str, str]:
    return {"API-Key": KEYS.urlscan or "", "Content-Type": "application/json"}


async def search(query: str, size: int = 50) -> dict[str, Any] | None:
    return await request_json("GET", f"{BASE}/search/", headers=_headers(), params={"q": query, "size": size})  # type: ignore[return-value]


async def submit(url: str, visibility: str = "public", tags: list[str] | None = None) -> dict[str, Any] | None:
    if not KEYS.urlscan:
        return None
    payload: dict[str, Any] = {"url": url, "visibility": visibility}
    if tags:
        payload["tags"] = tags
    return await request_json("POST", f"{BASE}/scan/", headers=_headers(), json=payload, expect_status=(200, 201))  # type: ignore[return-value]


async def result(uuid: str) -> dict[str, Any] | None:
    return await request_json("GET", f"{BASE}/result/{uuid}/", headers=_headers())  # type: ignore[return-value]


async def screenshot(uuid: str) -> bytes | None:
    return await get_bytes(f"https://urlscan.io/screenshots/{uuid}.png")
