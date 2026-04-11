"""
IOC Watchlist Router — Enhanced IOC lookup with watchlist + WHOIS
"""
import logging
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Header, Query, BackgroundTasks

from db import get_client

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# WHOIS Lookup (inline, via RDAP - free)
# ---------------------------------------------------------------------------
async def whois_lookup(value: str, ioc_type: str) -> dict:
    """Perform WHOIS/RDAP lookup for domain or IP."""
    if ioc_type not in ("domain", "ip"):
        return {}
    try:
        if ioc_type == "domain":
            url = f"https://rdap.org/domain/{value}"
        else:
            url = f"https://rdap.org/ip/{value}"

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                result = {"source": "rdap"}
                if ioc_type == "domain":
                    events = data.get("events", [])
                    for event in events:
                        action = event.get("eventAction", "")
                        if action in ("registration", "expiration", "last changed"):
                            result[action.replace(" ", "_")] = event.get("eventDate")
                    entities = data.get("entities", [])
                    for ent in entities:
                        roles = ent.get("roles", [])
                        if "registrar" in roles:
                            result["registrar"] = ent.get("handle", "") or ent.get("name", "")
                    result["status"] = data.get("status", [])
                    result["nameservers"] = [ns.get("ldhName", "") for ns in data.get("nameservers", [])]
                else:
                    result["name"] = data.get("name", "")
                    result["handle"] = data.get("handle", "")
                    result["cidr"] = data.get("cidr0_cidrs", [])
                    result["country"] = data.get("country", "")
                    result["start_address"] = data.get("startAddress", "")
                    result["end_address"] = data.get("endAddress", "")
                    entities = data.get("entities", [])
                    for ent in entities:
                        if "registrant" in ent.get("roles", []):
                            result["org"] = ent.get("handle", "")
                return result
    except Exception as e:
        logger.warning("WHOIS lookup failed for %s: %s", value, e)
    return {}


# ---------------------------------------------------------------------------
# Watchlist CRUD
# ---------------------------------------------------------------------------
@router.get("/")
async def list_watchlist(
    x_org_id: str = Header(...),
    ioc_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    try:
        db = get_client()
        query = db.table("ioc_watchlist").select("*", count="exact").eq("org_id", x_org_id)
        if ioc_type:
            query = query.eq("ioc_type", ioc_type)
        if status:
            query = query.eq("status", status)
        offset = (page - 1) * per_page
        result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
        return {
            "data": result.data or [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/")
async def add_to_watchlist(body: dict, x_org_id: str = Header(...)):
    ioc_type = body.get("ioc_type", "").strip()
    ioc_value = body.get("ioc_value", "").strip()
    if not ioc_type or not ioc_value:
        raise HTTPException(400, "ioc_type and ioc_value are required")
    if ioc_type not in ("ip", "domain", "hash", "url", "email"):
        raise HTTPException(400, "Invalid ioc_type")
    try:
        db = get_client()
        result = db.table("ioc_watchlist").insert({
            "org_id": x_org_id,
            "ioc_type": ioc_type,
            "ioc_value": ioc_value,
            "label": body.get("label", ""),
            "tags": body.get("tags", []),
            "alert_on_change": body.get("alert_on_change", True),
        }).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        if "duplicate" in str(e).lower():
            raise HTTPException(409, "IOC already in watchlist")
        raise HTTPException(500, str(e))


@router.delete("/{item_id}")
async def remove_from_watchlist(item_id: str, x_org_id: str = Header(...)):
    try:
        db = get_client()
        db.table("ioc_watchlist").delete().eq("id", item_id).eq("org_id", x_org_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.patch("/{item_id}")
async def update_watchlist_item(item_id: str, body: dict, x_org_id: str = Header(...)):
    allowed = {"label", "tags", "status", "alert_on_change"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "No valid fields")
    try:
        db = get_client()
        result = db.table("ioc_watchlist").update(updates).eq("id", item_id).eq("org_id", x_org_id).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------------------------------------------------------------------------
# Enhanced IOC Lookup (with WHOIS)
# ---------------------------------------------------------------------------
@router.get("/lookup-enhanced")
async def enhanced_ioc_lookup(
    type: str = Query(...),
    value: str = Query(...),
    x_org_id: str = Header(...),
):
    """Enhanced IOC lookup with WHOIS data included."""
    # Import the existing IOC lookup functions
    from routers.intel import _query_virustotal, _query_otx, _query_greynoise, _query_shodan

    results = {}

    # WHOIS/RDAP lookup (always for domain/IP)
    whois = await whois_lookup(value, type)
    if whois:
        results["whois"] = whois

    # VirusTotal
    try:
        vt = await _query_virustotal(type, value)
        if vt:
            results["virustotal"] = vt
    except Exception as e:
        logger.warning("VT lookup failed: %s", e)

    # OTX
    try:
        otx = await _query_otx(type, value)
        if otx:
            results["otx"] = otx
    except Exception as e:
        logger.warning("OTX lookup failed: %s", e)

    # IP-specific
    if type == "ip":
        try:
            gn = await _query_greynoise(value)
            if gn:
                results["greynoise"] = gn
        except Exception:
            pass
        try:
            shodan = await _query_shodan(value)
            if shodan:
                results["shodan"] = shodan
        except Exception:
            pass

    # URLScan for domains/URLs
    if type in ("domain", "url"):
        try:
            from modules.brand_monitor import check_urlscan
            urlscan = await check_urlscan(value)
            if urlscan:
                results["urlscan"] = urlscan
        except Exception:
            pass

    return {"ioc_type": type, "ioc_value": value, "results": results}


@router.get("/stats")
async def watchlist_stats(x_org_id: str = Header(...)):
    try:
        db = get_client()
        total = db.table("ioc_watchlist").select("id", count="exact").eq("org_id", x_org_id).execute()
        monitoring = db.table("ioc_watchlist").select("id", count="exact").eq("org_id", x_org_id).eq("status", "monitoring").execute()
        return {
            "total": getattr(total, "count", 0) or 0,
            "monitoring": getattr(monitoring, "count", 0) or 0,
        }
    except Exception as e:
        raise HTTPException(500, str(e))
