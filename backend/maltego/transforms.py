"""Concrete Maltego transforms backed by TAI-AEGIS data.

Each transform takes a TRXRequest and returns list[TRXEntity].
"""

from __future__ import annotations

import logging
from typing import Awaitable, Callable

from maltego.trx import TRXEntity, TRXRequest

logger = logging.getLogger(__name__)

TransformFn = Callable[[TRXRequest], Awaitable[list[TRXEntity]]]


# ---------------------------------------------------------------------------
# IPv4Address → enrichment results (multi-source)
# ---------------------------------------------------------------------------
async def ip_to_enrichment(req: TRXRequest) -> list[TRXEntity]:
    from enrichment import enrich

    result = await enrich("ip", req.value)
    out: list[TRXEntity] = []

    # Per-provider verdict entities so the analyst sees who said what.
    for provider, payload in (result.get("providers") or {}).items():
        out.append(TRXEntity(
            entity_type="maltego.Phrase",
            value=f"{provider}: {payload.get('verdict', 'unknown')} ({payload.get('confidence', 0)})",
            additional_fields={
                "provider": provider,
                "verdict": str(payload.get("verdict", "unknown")),
                "confidence": str(payload.get("confidence", 0)),
                "tags": ",".join(payload.get("tags", []) or []),
            },
        ))

    # If AbuseIPDB returned a country, surface it as a Country entity.
    abuse = (result.get("providers") or {}).get("abuseipdb") or {}
    if abuse.get("country"):
        out.append(TRXEntity(entity_type="maltego.Location", value=abuse["country"]))
    if abuse.get("isp"):
        out.append(TRXEntity(entity_type="maltego.Company", value=abuse["isp"]))

    return out


# ---------------------------------------------------------------------------
# IPv4Address → blocklist hits (open feeds)
# ---------------------------------------------------------------------------
async def ip_to_blocklists(req: TRXRequest) -> list[TRXEntity]:
    from modules.blocklist_sync import lookup_blocklist

    hits = lookup_blocklist("ip", req.value) or []
    out: list[TRXEntity] = []
    for hit in hits:
        out.append(TRXEntity(
            entity_type="maltego.Phrase",
            value=f"{hit.get('source')} ({hit.get('category', 'n/a')})",
            additional_fields={
                "source": str(hit.get("source", "")),
                "category": str(hit.get("category", "")),
                "confidence": str(hit.get("confidence", 0)),
                "first_seen": str(hit.get("first_seen", "")),
            },
        ))
    return out


# ---------------------------------------------------------------------------
# Domain → subdomains (DNSDumpster)
# ---------------------------------------------------------------------------
async def domain_to_subdomains(req: TRXRequest) -> list[TRXEntity]:
    from config import get_settings
    from modules.providers import dnsdumpster

    settings = get_settings()
    res = await dnsdumpster.query("domain", req.value, settings)
    if not res:
        return []
    out: list[TRXEntity] = []
    for sub in (res.get("subdomains") or [])[: req.soft_limit]:
        out.append(TRXEntity(entity_type="maltego.Domain", value=sub))
    for ip in (res.get("ips") or [])[:50]:
        out.append(TRXEntity(entity_type="maltego.IPv4Address", value=ip))
    return out


# ---------------------------------------------------------------------------
# Domain → theHarvester (emails + hosts + URLs)
# ---------------------------------------------------------------------------
async def domain_to_harvester(req: TRXRequest) -> list[TRXEntity]:
    from config import get_settings
    from modules.harvester import run as run_harvester

    settings = get_settings()
    res = await run_harvester(
        req.value,
        timeout=min(settings.HARVESTER_TIMEOUT_SECONDS, 90),
        binary=settings.HARVESTER_BIN,
    )
    out: list[TRXEntity] = []
    results = res.get("results", {})
    for email in (results.get("emails") or [])[:50]:
        out.append(TRXEntity(entity_type="maltego.EmailAddress", value=email))
    for host in (results.get("hosts") or [])[:50]:
        out.append(TRXEntity(entity_type="maltego.Domain", value=host))
    for ip in (results.get("ips") or [])[:50]:
        out.append(TRXEntity(entity_type="maltego.IPv4Address", value=ip))
    for url in (results.get("urls") or [])[:25]:
        out.append(TRXEntity(entity_type="maltego.URL", value=url))
    return out


# ---------------------------------------------------------------------------
# Hash → malware family (MalwareBazaar via investigate.py)
# ---------------------------------------------------------------------------
async def hash_to_family(req: TRXRequest) -> list[TRXEntity]:
    import httpx

    out: list[TRXEntity] = []
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://mb-api.abuse.ch/api/v1/",
                data={"query": "get_info", "hash": req.value},
            )
            data = resp.json() if resp.status_code == 200 else {}
    except Exception as e:
        logger.warning("MalwareBazaar failed for %s: %s", req.value, e)
        data = {}

    if data.get("query_status") == "ok":
        for sample in data.get("data", []) or []:
            family = sample.get("signature") or sample.get("file_type_mime") or "unknown"
            out.append(TRXEntity(
                entity_type="maltego.malware",
                value=family,
                additional_fields={
                    "file_type": str(sample.get("file_type", "")),
                    "first_seen": str(sample.get("first_seen", "")),
                    "tags": ",".join(sample.get("tags") or []),
                    "reporter": str(sample.get("reporter", "")),
                },
            ))
    return out


# ---------------------------------------------------------------------------
# CVE → threat actors known to use it (cve_actors junction or threat_actors table)
# ---------------------------------------------------------------------------
async def cve_to_actors(req: TRXRequest) -> list[TRXEntity]:
    from db import get_client

    cve_id = req.value.upper()
    out: list[TRXEntity] = []
    try:
        client = get_client()
        result = (
            client.table("threat_actors")
            .select("name,aliases,country,malware_used,techniques")
            .contains("cves", [cve_id])
            .limit(50)
            .execute()
        )
        for row in result.data or []:
            out.append(TRXEntity(
                entity_type="maltego.threat",
                value=row.get("name") or "Unknown actor",
                additional_fields={
                    "aliases": ",".join(row.get("aliases") or []),
                    "country": str(row.get("country") or ""),
                    "techniques": ",".join((row.get("techniques") or [])[:10]),
                    "malware": ",".join((row.get("malware_used") or [])[:10]),
                },
            ))
    except Exception as e:
        logger.warning("cve_to_actors failed for %s: %s", cve_id, e)
    return out


# ---------------------------------------------------------------------------
# Email → HIBP breaches
# ---------------------------------------------------------------------------
async def email_to_breaches(req: TRXRequest) -> list[TRXEntity]:
    import httpx

    from config import get_settings

    settings = get_settings()
    if not settings.HIBP_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"https://haveibeenpwned.com/api/v3/breachedaccount/{req.value}",
                headers={"hibp-api-key": settings.HIBP_API_KEY, "user-agent": "TAI-AEGIS"},
                params={"truncateResponse": "false"},
            )
    except Exception as e:
        logger.warning("HIBP failed for %s: %s", req.value, e)
        return []

    out: list[TRXEntity] = []
    if resp.status_code == 200:
        for breach in resp.json() or []:
            out.append(TRXEntity(
                entity_type="maltego.Phrase",
                value=breach.get("Name", "Unknown breach"),
                additional_fields={
                    "title": breach.get("Title", ""),
                    "domain": breach.get("Domain", ""),
                    "breach_date": breach.get("BreachDate", ""),
                    "pwn_count": str(breach.get("PwnCount", 0)),
                    "data_classes": ",".join(breach.get("DataClasses", []) or []),
                },
            ))
    return out


# ---------------------------------------------------------------------------
# Threat actor (Phrase) → MITRE ATT&CK techniques
# ---------------------------------------------------------------------------
async def actor_to_techniques(req: TRXRequest) -> list[TRXEntity]:
    from db import get_client

    out: list[TRXEntity] = []
    try:
        client = get_client()
        result = (
            client.table("threat_actors")
            .select("name,techniques,malware_used,target_sectors")
            .ilike("name", req.value)
            .limit(5)
            .execute()
        )
        for row in result.data or []:
            for tech in (row.get("techniques") or [])[:50]:
                out.append(TRXEntity(
                    entity_type="maltego.Phrase",
                    value=tech,
                    additional_fields={"actor": row.get("name", ""), "kind": "mitre_technique"},
                ))
            for malware in (row.get("malware_used") or [])[:25]:
                out.append(TRXEntity(
                    entity_type="maltego.malware",
                    value=malware,
                    additional_fields={"actor": row.get("name", "")},
                ))
    except Exception as e:
        logger.warning("actor_to_techniques failed for %s: %s", req.value, e)
    return out


# ---------------------------------------------------------------------------
# Registry — used by the router. Add a new entry to expose a transform.
# ---------------------------------------------------------------------------
TRANSFORMS: dict[str, dict] = {
    "ip-to-enrichment": {
        "input": ["maltego.IPv4Address"],
        "fn": ip_to_enrichment,
    },
    "ip-to-blocklists": {
        "input": ["maltego.IPv4Address"],
        "fn": ip_to_blocklists,
    },
    "domain-to-subdomains": {
        "input": ["maltego.Domain", "maltego.Website"],
        "fn": domain_to_subdomains,
    },
    "domain-to-harvester": {
        "input": ["maltego.Domain", "maltego.Website"],
        "fn": domain_to_harvester,
    },
    "hash-to-family": {
        "input": ["maltego.Hash", "maltego.Phrase"],
        "fn": hash_to_family,
    },
    "cve-to-actors": {
        "input": ["maltego.Phrase", "maltego.CVE"],
        "fn": cve_to_actors,
    },
    "email-to-breaches": {
        "input": ["maltego.EmailAddress"],
        "fn": email_to_breaches,
    },
    "actor-to-techniques": {
        "input": ["maltego.Phrase", "maltego.threat"],
        "fn": actor_to_techniques,
    },
}
