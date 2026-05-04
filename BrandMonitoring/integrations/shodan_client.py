"""Shodan REST client (async)."""
from __future__ import annotations

from typing import Any

from config.settings import KEYS
from core.http import request_json

BASE = "https://api.shodan.io"


async def host(ip: str) -> dict[str, Any] | None:
    if not KEYS.shodan:
        return None
    return await request_json("GET", f"{BASE}/shodan/host/{ip}", params={"key": KEYS.shodan, "minify": "false"})  # type: ignore[return-value]


async def search(query: str, limit: int = 50) -> dict[str, Any] | None:
    if not KEYS.shodan:
        return None
    return await request_json("GET", f"{BASE}/shodan/host/search", params={"key": KEYS.shodan, "query": query, "limit": limit})  # type: ignore[return-value]


async def dns_resolve(domains: list[str]) -> dict[str, Any] | None:
    if not KEYS.shodan or not domains:
        return None
    return await request_json("GET", f"{BASE}/dns/resolve", params={"key": KEYS.shodan, "hostnames": ",".join(domains)})  # type: ignore[return-value]


async def info() -> dict[str, Any] | None:
    if not KEYS.shodan:
        return None
    return await request_json("GET", f"{BASE}/api-info", params={"key": KEYS.shodan})  # type: ignore[return-value]
