"""AbuseIPDB provider — IP reputation only. 1,000 checks/day on the free tier."""

from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

SUPPORTED_TYPES = {"ip"}


async def query(ioc_type: str, value: str, settings) -> Optional[dict]:
    if ioc_type not in SUPPORTED_TYPES or not settings.ABUSEIPDB_API_KEY:
        return None

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://api.abuseipdb.com/api/v2/check",
                headers={
                    "Key": settings.ABUSEIPDB_API_KEY,
                    "Accept": "application/json",
                },
                params={"ipAddress": value, "maxAgeInDays": 90, "verbose": ""},
            )
    except Exception as e:
        logger.warning("AbuseIPDB request failed for %s: %s", value, e)
        return None

    if resp.status_code != 200:
        logger.warning("AbuseIPDB %s -> HTTP %s", value, resp.status_code)
        return None

    data = resp.json().get("data", {})
    score = data.get("abuseConfidenceScore", 0)
    verdict = "clean"
    if score >= 75:
        verdict = "malicious"
    elif score >= 25:
        verdict = "suspicious"

    tags = []
    if data.get("isTor"):
        tags.append("tor")
    if data.get("isWhitelisted"):
        tags.append("whitelisted")
    if data.get("usageType"):
        tags.append(f"usage:{data['usageType'].lower().replace(' ', '_')}")

    return {
        "source": "abuseipdb",
        "verdict": verdict,
        "confidence": int(score),
        "tags": tags,
        "country": data.get("countryCode"),
        "isp": data.get("isp"),
        "domain": data.get("domain"),
        "total_reports": data.get("totalReports", 0),
        "last_reported_at": data.get("lastReportedAt"),
        "data": data,
    }
