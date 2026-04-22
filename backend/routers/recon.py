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


# =============================================================================
# Modal-powered Kali tool endpoints. Each calls a Modal serverless function so
# Render doesn't need the binaries installed.
# =============================================================================
@router.get("/subdomains")
async def subdomains(domain: str = Query(...), x_org_id: str = Header(...)):
    """Composite: subfinder → dnsx → httpx. Returns alive hosts with status/title/tech."""
    if "." not in domain:
        raise HTTPException(400, "invalid domain")
    from modules import modal_recon
    return await modal_recon.attack_surface(domain)


@router.get("/typosquats")
async def typosquats(
    domain: str = Query(...),
    registered_only: bool = Query(True, description="Only return domains that resolve"),
    x_org_id: str = Header(...),
):
    """Find lookalike/typo/IDN domains using dnstwist."""
    if "." not in domain:
        raise HTTPException(400, "invalid domain")
    from modules import modal_recon
    return await modal_recon.dnstwist(domain, registered_only=registered_only)


@router.post("/nmap")
async def nmap_scan(
    target: str = Query(...),
    args: str = Query("-sV -F -T4", description="nmap CLI args (no -iL)"),
    x_org_id: str = Header(...),
):
    """Run nmap against a single target. Caller is responsible for authorization."""
    if not target:
        raise HTTPException(400, "target required")
    from modules import modal_recon
    return await modal_recon.nmap(target, args=args)


@router.post("/nuclei")
async def nuclei_scan(
    target: str = Query(..., description="URL or host"),
    severity: str = Query("critical,high,medium"),
    x_org_id: str = Header(...),
):
    """Run nuclei templates against a target. Returns a list of findings."""
    if not target:
        raise HTTPException(400, "target required")
    from modules import modal_recon
    return await modal_recon.nuclei(target, severity=severity)


@router.post("/httpx")
async def httpx_probe(
    targets: list[str] | None = None,
    x_org_id: str = Header(...),
):
    """Probe a list of hosts for status/title/tech. Body: JSON list of strings."""
    if not targets:
        raise HTTPException(400, "targets list required")
    from modules import modal_recon
    return await modal_recon.httpx_probe(targets)

