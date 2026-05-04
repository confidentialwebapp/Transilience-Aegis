"""IntelligenceX (intelx.io) client.

Reference: https://intelx.io/integrations
Endpoints differ from typical APIs: search is async, you poll for results.
"""
from __future__ import annotations

import asyncio
from typing import Any

from config.settings import KEYS
from core.http import request_json

BASE = "https://2.intelx.io"


def _headers() -> dict[str, str]:
    return {"x-key": KEYS.intelx or "", "User-Agent": "BrandMonitoring/1.0"}


async def search(term: str, max_results: int = 100, buckets: list[str] | None = None) -> list[dict[str, Any]]:
    """Submit a search and poll for results. Returns list of records."""
    if not KEYS.intelx:
        return []
    payload: dict[str, Any] = {
        "term": term,
        "maxresults": max_results,
        "media": 0,
        "sort": 4,
        "terminate": [],
    }
    if buckets:
        payload["buckets"] = buckets
    init = await request_json("POST", f"{BASE}/intelligent/search", headers=_headers(), json=payload)
    if not isinstance(init, dict) or "id" not in init:
        return []
    sid = init["id"]
    records: list[dict[str, Any]] = []
    for _ in range(20):
        await asyncio.sleep(1.5)
        r = await request_json(
            "GET", f"{BASE}/intelligent/search/result",
            headers=_headers(),
            params={"id": sid, "limit": max_results},
        )
        if isinstance(r, dict):
            for item in r.get("records", []) or []:
                records.append(item)
            status = r.get("status", 0)
            # 0 = success / more, 1 = no more, 2 = expired, 3 = empty
            if status in (1, 2, 3):
                break
    return records


async def file_preview(systemid: str, storageid: str) -> str | None:
    """Return preview text for a record (best-effort)."""
    if not KEYS.intelx:
        return None
    r = await request_json(
        "GET", f"{BASE}/file/preview",
        headers=_headers(),
        params={"sid": storageid, "f": 0, "l": 8, "c": 1, "m": 24, "b": systemid},
    )
    if isinstance(r, dict):
        return r.get("_raw_text") or r.get("preview")
    return None
