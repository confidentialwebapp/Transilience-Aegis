"""Netlas — internet asset search. 50 free requests/day."""

from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SUPPORTED_TYPES = {"ip", "domain"}


async def query(ioc_type: str, value: str, settings) -> Optional[dict]:
    if ioc_type not in SUPPORTED_TYPES or not settings.NETLAS_API_KEY:
        return None

    if ioc_type == "ip":
        query_str = f"ip:{value}"
    else:
        query_str = f"host:{value}"

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                "https://app.netlas.io/api/responses/",
                headers={"X-API-Key": settings.NETLAS_API_KEY, "Accept": "application/json"},
                params={"q": query_str, "size": 5, "fields": "ip,port,protocol,host,jarm,certificate"},
            )
    except Exception as e:
        logger.warning("Netlas request failed for %s: %s", value, e)
        return None

    if resp.status_code != 200:
        logger.warning("Netlas %s -> HTTP %s: %s", value, resp.status_code, resp.text[:200])
        return None

    data = resp.json()
    items = data.get("items", []) or []

    ports = sorted({item.get("data", {}).get("port") for item in items if item.get("data", {}).get("port") is not None})
    protocols = sorted({item.get("data", {}).get("protocol") for item in items if item.get("data", {}).get("protocol")})
    hosts = sorted({item.get("data", {}).get("host") for item in items if item.get("data", {}).get("host")})

    return {
        "source": "netlas",
        "verdict": "info",
        "confidence": 30 if items else 0,
        "tags": [],
        "result_count": data.get("count", 0),
        "ports": ports,
        "protocols": protocols,
        "hosts": hosts,
        "data": items[:5],
    }
