"""DNSDumpster — subdomain discovery via the official dnsdumpster.com REST API."""

from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SUPPORTED_TYPES = {"domain"}


async def query(ioc_type: str, value: str, settings) -> Optional[dict]:
    if ioc_type not in SUPPORTED_TYPES or not settings.DNSDUMPSTER_API_KEY:
        return None

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"https://api.dnsdumpster.com/domain/{value}",
                headers={"X-API-Key": settings.DNSDUMPSTER_API_KEY, "Accept": "application/json"},
            )
    except Exception as e:
        logger.warning("DNSDumpster request failed for %s: %s", value, e)
        return None

    if resp.status_code != 200:
        logger.warning("DNSDumpster %s -> HTTP %s: %s", value, resp.status_code, resp.text[:200])
        return None

    data = resp.json()
    a = data.get("a", []) or []
    mx = data.get("mx", []) or []
    ns = data.get("ns", []) or []
    txt = data.get("txt", []) or []
    cname = data.get("cname", []) or []

    subdomains = sorted({rec.get("host") for rec in a if rec.get("host")})
    ips = sorted({ip.get("ip") for rec in a for ip in rec.get("ips", []) if ip.get("ip")})

    return {
        "source": "dnsdumpster",
        "verdict": "info",
        "confidence": 40 if subdomains else 0,
        "tags": [],
        "subdomain_count": len(subdomains),
        "subdomains": subdomains[:100],
        "ips": ips,
        "mx": [r.get("host") for r in mx if r.get("host")][:20],
        "ns": [r.get("host") for r in ns if r.get("host")][:20],
        "cname": cname[:20],
        "txt": txt[:20],
    }
