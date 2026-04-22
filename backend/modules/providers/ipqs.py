"""IPQualityScore — IP, URL, email reputation. 5,000 requests/month on free tier."""

from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)

SUPPORTED_TYPES = {"ip", "url", "email"}


async def query(ioc_type: str, value: str, settings) -> Optional[dict]:
    if ioc_type not in SUPPORTED_TYPES or not settings.IPQS_API_KEY:
        return None

    safe_value = quote(value, safe="")
    endpoint_map = {
        "ip": f"https://ipqualityscore.com/api/json/ip/{settings.IPQS_API_KEY}/{value}",
        "url": f"https://ipqualityscore.com/api/json/url/{settings.IPQS_API_KEY}/{safe_value}",
        "email": f"https://ipqualityscore.com/api/json/email/{settings.IPQS_API_KEY}/{value}",
    }
    url = endpoint_map[ioc_type]

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
    except Exception as e:
        logger.warning("IPQS request failed for %s/%s: %s", ioc_type, value, e)
        return None

    if resp.status_code != 200:
        logger.warning("IPQS %s -> HTTP %s", value, resp.status_code)
        return None

    data = resp.json()
    if not data.get("success", False):
        logger.warning("IPQS error for %s: %s", value, data.get("message"))
        return None

    fraud_score = data.get("fraud_score", 0)
    verdict = "clean"
    if fraud_score >= 85:
        verdict = "malicious"
    elif fraud_score >= 50:
        verdict = "suspicious"

    tags = []
    for flag in ("proxy", "vpn", "tor", "is_crawler", "bot_status", "recent_abuse", "active_vpn", "active_tor", "disposable", "suspect"):
        if data.get(flag):
            tags.append(flag.replace("is_", "").replace("active_", ""))

    return {
        "source": "ipqs",
        "verdict": verdict,
        "confidence": int(fraud_score),
        "tags": sorted(set(tags)),
        "country": data.get("country_code"),
        "isp": data.get("ISP"),
        "data": data,
    }
