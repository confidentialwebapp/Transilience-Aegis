"""Netlas.io client (passive infra recon)."""
from __future__ import annotations

from typing import Any

from config.settings import KEYS
from core.http import request_json

BASE = "https://app.netlas.io/api"


def _headers() -> dict[str, str]:
    return {"X-API-Key": KEYS.netlas or "", "Content-Type": "application/json"}


async def domains_search(query: str, size: int = 50) -> dict[str, Any] | None:
    if not KEYS.netlas:
        return None
    return await request_json(
        "GET", f"{BASE}/domains/",
        headers=_headers(),
        params={"q": query, "size": size, "indices": "domain"},
    )  # type: ignore[return-value]


async def whois_domains(query: str, size: int = 25) -> dict[str, Any] | None:
    if not KEYS.netlas:
        return None
    return await request_json(
        "GET", f"{BASE}/whois_domains/",
        headers=_headers(),
        params={"q": query, "size": size},
    )  # type: ignore[return-value]


async def host(query: str, size: int = 50) -> dict[str, Any] | None:
    if not KEYS.netlas:
        return None
    return await request_json(
        "GET", f"{BASE}/responses/",
        headers=_headers(),
        params={"q": query, "size": size},
    )  # type: ignore[return-value]


async def certificates(query: str, size: int = 50) -> dict[str, Any] | None:
    if not KEYS.netlas:
        return None
    return await request_json(
        "GET", f"{BASE}/certs/",
        headers=_headers(),
        params={"q": query, "size": size},
    )  # type: ignore[return-value]
