"""Native Reddit JSON API (no auth, no Apify).

Reddit blocks default user-agents — supply a real one.
Public search endpoint returns up to 100 posts per query.
"""
from __future__ import annotations

from typing import Any

from core.http import request_json

UA = "BrandMonitoring/1.0 (defensive brand-OSINT; +contact via security@example)"


async def search(query: str, limit: int = 100, sort: str = "new", time_filter: str = "all") -> list[dict[str, Any]]:
    headers = {"User-Agent": UA, "Accept": "application/json"}
    r = await request_json(
        "GET", "https://www.reddit.com/search.json",
        headers=headers,
        params={"q": query, "limit": limit, "sort": sort, "t": time_filter, "raw_json": 1},
        timeout=30,
        retries=2,
    )
    if not isinstance(r, dict):
        return []
    children = ((r.get("data") or {}).get("children") or [])
    return [c.get("data") or {} for c in children if isinstance(c, dict)]


async def search_subreddit(query: str, subreddit: str, limit: int = 50) -> list[dict[str, Any]]:
    headers = {"User-Agent": UA, "Accept": "application/json"}
    r = await request_json(
        "GET", f"https://www.reddit.com/r/{subreddit}/search.json",
        headers=headers,
        params={"q": query, "restrict_sr": 1, "limit": limit, "raw_json": 1},
        timeout=30,
    )
    if not isinstance(r, dict):
        return []
    children = ((r.get("data") or {}).get("children") or [])
    return [c.get("data") or {} for c in children if isinstance(c, dict)]
