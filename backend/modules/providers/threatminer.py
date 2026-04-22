"""ThreatMiner — free, no API key. 10 queries/minute soft limit.

Endpoints we use:
- Domain:  /v2/domain.php?q=<domain>&rt=1  (whois)
- IP:      /v2/host.php?q=<ip>&rt=1        (whois)
- Hash:    /v2/sample.php?q=<hash>&rt=1    (metadata)

ThreatMiner returns `status_code` 200 on success, 404 when no records.
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SUPPORTED_TYPES = {"ip", "domain", "hash"}

ENDPOINT = {
    "ip": ("https://api.threatminer.org/v2/host.php", "1"),
    "domain": ("https://api.threatminer.org/v2/domain.php", "1"),
    "hash": ("https://api.threatminer.org/v2/sample.php", "1"),
}


async def query(ioc_type: str, value: str, settings) -> Optional[dict]:
    if ioc_type not in SUPPORTED_TYPES:
        return None

    url, rt = ENDPOINT[ioc_type]
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(url, params={"q": value, "rt": rt})
    except Exception as e:
        logger.warning("ThreatMiner request failed for %s/%s: %s", ioc_type, value, e)
        return None

    if resp.status_code != 200:
        return None

    body = resp.json()
    status_code = body.get("status_code")
    # ThreatMiner returns "200" / "404" as strings
    if str(status_code) != "200":
        return None

    results = body.get("results", []) or []
    if not results:
        return None

    return {
        "source": "threatminer",
        "verdict": "info",
        "confidence": 35,
        "tags": [],
        "result_count": len(results),
        "data": results[:10],
    }
