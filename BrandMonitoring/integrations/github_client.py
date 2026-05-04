"""GitHub code search — looks for leaked secrets / source code mentioning the brand."""
from __future__ import annotations

from typing import Any

from config.settings import KEYS
from core.http import request_json

BASE = "https://api.github.com"


def _headers() -> dict[str, str]:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if KEYS.github:
        h["Authorization"] = f"Bearer {KEYS.github}"
    return h


async def code_search(query: str, per_page: int = 30) -> list[dict[str, Any]]:
    """Search code (requires GITHUB_TOKEN with public_repo scope)."""
    if not KEYS.github:
        return []
    r = await request_json(
        "GET", f"{BASE}/search/code",
        headers=_headers(),
        params={"q": query, "per_page": per_page},
    )
    if isinstance(r, dict):
        return r.get("items", []) or []
    return []


async def repo_search(query: str, per_page: int = 30) -> list[dict[str, Any]]:
    r = await request_json(
        "GET", f"{BASE}/search/repositories",
        headers=_headers(),
        params={"q": query, "per_page": per_page, "sort": "updated"},
    )
    if isinstance(r, dict):
        return r.get("items", []) or []
    return []
