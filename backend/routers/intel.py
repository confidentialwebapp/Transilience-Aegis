import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Header, Query

from config import get_settings
from db import get_client
from utils.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()
rate_limiter = RateLimiter()


async def _query_virustotal(ioc_type: str, value: str) -> dict:
    if not settings.VIRUSTOTAL_API_KEY:
        return {}
    endpoint_map = {"domain": "domains", "ip": "ip_addresses", "url": "urls", "hash": "files"}
    endpoint = endpoint_map.get(ioc_type)
    if not endpoint:
        return {}

    await rate_limiter.wait("virustotal", min_interval=15.0)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://www.virustotal.com/api/v3/{endpoint}/{value}",
            headers={"x-apikey": settings.VIRUSTOTAL_API_KEY},
            timeout=30,
        )
        if resp.status_code == 200:
            return {"source": "virustotal", "data": resp.json().get("data", {})}
    return {}


async def _query_otx(ioc_type: str, value: str) -> dict:
    if not settings.OTX_API_KEY:
        return {}
    type_map = {"ip": "IPv4", "domain": "domain", "url": "url", "hash": "file"}
    otx_type = type_map.get(ioc_type)
    if not otx_type:
        return {}

    await rate_limiter.wait("otx", min_interval=1.0)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://otx.alienvault.com/api/v1/indicators/{otx_type}/{value}/general",
            headers={"X-OTX-API-KEY": settings.OTX_API_KEY},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "source": "otx",
                "pulse_count": data.get("pulse_info", {}).get("count", 0),
                "data": data,
            }
    return {}


async def _query_greynoise(ip: str) -> dict:
    if not settings.GREYNOISE_API_KEY:
        return {}

    await rate_limiter.wait("greynoise", min_interval=1.0)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.greynoise.io/v3/community/{ip}",
            headers={"key": settings.GREYNOISE_API_KEY},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "source": "greynoise",
                "noise": data.get("noise", False),
                "riot": data.get("riot", False),
                "classification": data.get("classification", "unknown"),
                "data": data,
            }
    return {}


async def _query_shodan(ip: str) -> dict:
    if not settings.SHODAN_API_KEY:
        return {}

    await rate_limiter.wait("shodan", min_interval=1.0)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.shodan.io/shodan/host/{ip}",
            params={"key": settings.SHODAN_API_KEY},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "source": "shodan",
                "ports": data.get("ports", []),
                "vulns": data.get("vulns", []),
                "os": data.get("os"),
                "data": data,
            }
    return {}


@router.get("/lookup")
async def lookup_ioc(
    type: str = Query(..., description="IOC type: ip, domain, hash, url, email"),
    value: str = Query(..., description="IOC value to look up"),
    x_org_id: str = Header(...),
):
    if type not in {"ip", "domain", "hash", "url", "email"}:
        raise HTTPException(400, "Invalid IOC type")

    results = {}

    try:
        vt = await _query_virustotal(type, value)
        if vt:
            results["virustotal"] = vt
    except Exception as e:
        logger.warning(f"VirusTotal lookup failed: {e}")

    try:
        otx = await _query_otx(type, value)
        if otx:
            results["otx"] = otx
    except Exception as e:
        logger.warning(f"OTX lookup failed: {e}")

    if type == "ip":
        try:
            gn = await _query_greynoise(value)
            if gn:
                results["greynoise"] = gn
        except Exception as e:
            logger.warning(f"GreyNoise lookup failed: {e}")

        try:
            shodan = await _query_shodan(value)
            if shodan:
                results["shodan"] = shodan
        except Exception as e:
            logger.warning(f"Shodan lookup failed: {e}")

    # Cache the result
    db = get_client()
    for source_name, source_data in results.items():
        try:
            db.table("threat_intel").insert({
                "ioc_type": type,
                "ioc_value": value,
                "source": source_name,
                "raw_data": source_data,
                "confidence": 50,
            }).execute()
        except Exception:
            pass

    return {"ioc_type": type, "ioc_value": value, "results": results}


@router.get("/feed")
async def intel_feed(
    x_org_id: str = Header(...),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
):
    client = get_client()
    offset = (page - 1) * per_page
    result = (
        client.table("threat_intel")
        .select("*", count="exact")
        .order("created_at", desc=True)
        .range(offset, offset + per_page - 1)
        .execute()
    )
    return {
        "data": result.data,
        "total": result.count,
        "page": page,
        "per_page": per_page,
    }
