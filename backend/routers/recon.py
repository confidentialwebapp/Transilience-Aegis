"""OSINT reconnaissance: theHarvester subprocess + DNSDumpster + Netlas + ThreatMiner."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Header, Query

from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/harvest")
async def run_harvest(
    domain: str = Query(..., description="Target domain (e.g., example.com)"),
    sources: str = Query("crtsh,duckduckgo,bing,otx,hackertarget,rapiddns,anubis,urlscan"),
    limit: int = Query(200, ge=10, le=1000),
    x_org_id: str = Header(...),
):
    """Kick off a synchronous theHarvester run. Long-running — front-end should show a spinner."""
    if not domain or "." not in domain:
        raise HTTPException(400, "invalid domain")
    settings = get_settings()
    from modules.harvester import run as run_harvester

    return await run_harvester(
        domain,
        sources=sources,
        limit=limit,
        timeout=settings.HARVESTER_TIMEOUT_SECONDS,
        org_id=x_org_id,
        binary=settings.HARVESTER_BIN,
    )


@router.get("/runs")
async def list_recon_runs(
    domain: str | None = Query(None),
    limit: int = Query(20, ge=1, le=200),
    x_org_id: str = Header(...),
):
    from db import get_client

    try:
        client = get_client()
        q = (
            client.table("recon_runs")
            .select("id,domain,tool,status,started_at,completed_at,error,emails,hosts,ips,asns,urls")
            .order("started_at", desc=True)
            .limit(limit)
        )
        if domain:
            q = q.eq("domain", domain)
        result = q.execute()
        return {"data": result.data or []}
    except Exception as e:
        logger.error("Failed to list recon runs: %s", e)
        raise HTTPException(500, str(e))


@router.get("/dnsdumpster")
async def dnsdumpster_lookup(
    domain: str = Query(...),
    x_org_id: str = Header(...),
):
    settings = get_settings()
    from modules.providers import dnsdumpster

    result = await dnsdumpster.query("domain", domain, settings)
    if not result:
        raise HTTPException(404, "no DNSDumpster data (check API key or domain)")
    return result


@router.get("/netlas")
async def netlas_lookup(
    type: str = Query(..., description="ip or domain"),
    value: str = Query(...),
    x_org_id: str = Header(...),
):
    if type not in {"ip", "domain"}:
        raise HTTPException(400, "type must be ip or domain")
    settings = get_settings()
    from modules.providers import netlas

    result = await netlas.query(type, value, settings)
    if not result:
        raise HTTPException(404, "no Netlas data")
    return result


@router.get("/threatminer")
async def threatminer_lookup(
    type: str = Query(...),
    value: str = Query(...),
    x_org_id: str = Header(...),
):
    if type not in {"ip", "domain", "hash"}:
        raise HTTPException(400, "type must be ip, domain, or hash")
    settings = get_settings()
    from modules.providers import threatminer

    result = await threatminer.query(type, value, settings)
    if not result:
        raise HTTPException(404, "no ThreatMiner data")
    return result
