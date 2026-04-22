"""
Individual Investigation Scanner — scan any URL, email, IP, domain, username, phone on-demand.
Returns results inline with risk assessment from multiple OSINT sources.
"""
import asyncio
import logging
import re
import time
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel

from db import get_client
from config import get_settings
from utils.scoring import calculate_risk_score, severity_from_score

logger = logging.getLogger(__name__)
router = APIRouter()


class InvestigateRequest(BaseModel):
    target_type: str  # url, email, ip, domain, username, phone
    target_value: str


VALID_TYPES = {"url", "email", "ip", "domain", "username", "phone", "hash"}

_HASH_RE = {
    "md5":    re.compile(r"^[a-fA-F0-9]{32}$"),
    "sha1":   re.compile(r"^[a-fA-F0-9]{40}$"),
    "sha256": re.compile(r"^[a-fA-F0-9]{64}$"),
}


def _classify_hash(value: str) -> str:
    v = value.strip()
    for kind, pat in _HASH_RE.items():
        if pat.match(v):
            return kind
    return "unknown"


async def _check_whois(domain: str) -> Dict[str, Any]:
    """WHOIS/RDAP lookup — free, no key required."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(f"https://rdap.org/domain/{domain}")
            if resp.status_code == 200:
                data = resp.json()
                events = data.get("events", [])
                result = {"source": "whois", "status": "found"}
                for event in events:
                    action = event.get("eventAction", "")
                    if action == "registration":
                        result["registered"] = event.get("eventDate", "")
                    elif action == "expiration":
                        result["expires"] = event.get("eventDate", "")
                    elif action == "last changed":
                        result["updated"] = event.get("eventDate", "")
                result["status_codes"] = data.get("status", [])
                result["nameservers"] = [ns.get("ldhName", "") for ns in data.get("nameservers", [])]
                entities = data.get("entities", [])
                for ent in entities:
                    if "registrar" in ent.get("roles", []):
                        result["registrar"] = ent.get("handle", "") or ent.get("vcardArray", [[],[]])[1][0][-1] if ent.get("vcardArray") else ""
                return result
            return {"source": "whois", "status": "clean", "detail": "No RDAP data"}
    except Exception as e:
        return {"source": "whois", "status": "error", "detail": str(e)[:200]}


async def _check_dns(domain: str) -> Dict[str, Any]:
    """DNS lookup via Cloudflare DoH — free, no key required."""
    records = {}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            for rtype in ["A", "AAAA", "MX", "NS", "TXT"]:
                resp = await client.get(
                    f"https://cloudflare-dns.com/dns-query?name={domain}&type={rtype}",
                    headers={"Accept": "application/dns-json"},
                )
                if resp.status_code == 200:
                    answers = resp.json().get("Answer", [])
                    if answers:
                        records[rtype] = [a.get("data", "") for a in answers]
        has_spf = any("v=spf1" in v for v in records.get("TXT", []))
        return {
            "source": "dns",
            "status": "found",
            "records": records,
            "ip_addresses": records.get("A", []),
            "mail_servers": records.get("MX", []),
            "nameservers": records.get("NS", []),
            "has_spf": has_spf,
            "record_count": sum(len(v) for v in records.values()),
        }
    except Exception as e:
        return {"source": "dns", "status": "error", "detail": str(e)[:200]}


async def _check_ip_geolocation(ip: str) -> Dict[str, Any]:
    """IP geolocation — GeoLite2 MMDB if present, else ip-api.com."""
    # Prefer GeoLite2 (offline, no rate limit, accurate).
    try:
        from utils.geolite import lookup_geolite2
        local = lookup_geolite2(ip)
        if local:
            return local
    except Exception as e:
        logger.debug("GeoLite2 lookup fell through: %s", e)

    # Fallback: ip-api.com (free, no key, 45 req/min).
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"http://ip-api.com/json/{ip}?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,org,as,query")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "success":
                    return {
                        "source": "geolocation",
                        "provider": "ip-api",
                        "status": "found",
                        "country": data.get("country", ""),
                        "region": data.get("regionName", ""),
                        "city": data.get("city", ""),
                        "isp": data.get("isp", ""),
                        "org": data.get("org", ""),
                        "as": data.get("as", ""),
                        "timezone": data.get("timezone", ""),
                        "lat": data.get("lat"),
                        "lon": data.get("lon"),
                    }
            return {"source": "geolocation", "status": "clean", "detail": "No data"}
    except Exception as e:
        return {"source": "geolocation", "status": "error", "detail": str(e)[:200]}


async def _check_threatfox(ioc: str) -> Dict[str, Any]:
    """ThreatFox IOC lookup by Abuse.ch — now requires an Auth-Key header."""
    settings = get_settings()
    headers = {}
    if getattr(settings, "ABUSECH_AUTH_KEY", ""):
        headers["Auth-Key"] = settings.ABUSECH_AUTH_KEY
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://threatfox-api.abuse.ch/api/v1/",
                json={"query": "search_ioc", "search_term": ioc},
                headers=headers,
            )
            if resp.status_code == 401:
                return {"source": "threatfox", "status": "skipped",
                        "reason": "Abuse.ch now requires ABUSECH_AUTH_KEY (free at auth.abuse.ch)"}
            if resp.status_code != 200:
                return {"source": "threatfox", "status": "error", "detail": f"HTTP {resp.status_code}"}
            data = resp.json()
            if data.get("query_status") == "ok" and data.get("data"):
                entries = data["data"]
                return {
                    "source": "threatfox",
                    "status": "found",
                    "threat_type": entries[0].get("threat_type", ""),
                    "malware": entries[0].get("malware_printable", ""),
                    "confidence": entries[0].get("confidence_level", 0),
                    "first_seen": entries[0].get("first_seen", ""),
                    "results": [
                        {"malware": e.get("malware_printable", ""), "threat_type": e.get("threat_type", ""),
                         "confidence": e.get("confidence_level", 0), "tags": e.get("tags", [])}
                        for e in entries[:5]
                    ],
                    "total_count": len(entries),
                }
            return {"source": "threatfox", "status": "clean", "detail": "Not found in ThreatFox"}
    except Exception as e:
        return {"source": "threatfox", "status": "error", "detail": str(e)[:200]}


async def _check_blocklist(ioc_type: str, value: str) -> Dict[str, Any]:
    """Check the locally-synced open blocklists (no outbound HTTP)."""
    try:
        from modules.blocklist_sync import lookup_blocklist
        hits = lookup_blocklist(ioc_type, value)
        if not hits:
            return {"source": "blocklist", "status": "clean", "detail": "No blocklist hits"}
        return {
            "source": "blocklist",
            "status": "found",
            "hit_count": len(hits),
            "sources": sorted({h["source"] for h in hits}),
            "categories": sorted({h.get("category") for h in hits if h.get("category")}),
            "max_confidence": max((h.get("confidence") or 0) for h in hits),
            "hits": hits[:20],
        }
    except Exception as e:
        return {"source": "blocklist", "status": "error", "detail": str(e)[:200]}


async def _check_urlhaus(ioc: str) -> Dict[str, Any]:
    """URLhaus lookup by Abuse.ch — may require Auth-Key."""
    settings = get_settings()
    headers = {}
    if getattr(settings, "ABUSECH_AUTH_KEY", ""):
        headers["Auth-Key"] = settings.ABUSECH_AUTH_KEY
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post("https://urlhaus-api.abuse.ch/v1/url/", data={"url": ioc}, headers=headers)
            if resp.status_code == 401:
                return {"source": "urlhaus", "status": "skipped",
                        "reason": "Abuse.ch now requires ABUSECH_AUTH_KEY (free at auth.abuse.ch)"}
            if resp.status_code == 200:
                data = resp.json()
                if data.get("query_status") == "ok":
                    return {
                        "source": "urlhaus",
                        "status": "found",
                        "threat": data.get("threat", ""),
                        "url_status": data.get("url_status", ""),
                        "date_added": data.get("date_added", ""),
                        "tags": data.get("tags", []),
                    }
            resp = await client.post("https://urlhaus-api.abuse.ch/v1/host/", data={"host": ioc}, headers=headers)
            if resp.status_code == 401:
                return {"source": "urlhaus", "status": "skipped",
                        "reason": "Abuse.ch now requires ABUSECH_AUTH_KEY"}
            if resp.status_code == 200:
                data = resp.json()
                if data.get("query_status") == "ok" and data.get("urls"):
                    urls = data["urls"]
                    return {
                        "source": "urlhaus",
                        "status": "found",
                        "url_count": data.get("url_count", 0),
                        "results": [{"url": u.get("url", ""), "status": u.get("url_status", ""), "threat": u.get("threat", "")} for u in urls[:5]],
                    }
            return {"source": "urlhaus", "status": "clean", "detail": "Not found in URLhaus"}
    except Exception as e:
        return {"source": "urlhaus", "status": "error", "detail": str(e)[:200]}


async def _check_virustotal(target_type: str, value: str) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.VIRUSTOTAL_API_KEY:
        return {"source": "virustotal", "status": "skipped", "reason": "No API key"}

    endpoint_map = {"domain": "domains", "ip": "ip_addresses", "url": "urls"}
    endpoint = endpoint_map.get(target_type)
    if not endpoint:
        return {"source": "virustotal", "status": "skipped", "reason": "Type not supported"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            if target_type == "url":
                import base64
                url_id = base64.urlsafe_b64encode(value.encode()).decode().rstrip("=")
                resp = await client.get(
                    f"https://www.virustotal.com/api/v3/urls/{url_id}",
                    headers={"x-apikey": settings.VIRUSTOTAL_API_KEY},
                )
            else:
                resp = await client.get(
                    f"https://www.virustotal.com/api/v3/{endpoint}/{value}",
                    headers={"x-apikey": settings.VIRUSTOTAL_API_KEY},
                )
            if resp.status_code == 200:
                data = resp.json().get("data", {}).get("attributes", {})
                stats = data.get("last_analysis_stats", {})
                return {
                    "source": "virustotal",
                    "status": "found",
                    "malicious": stats.get("malicious", 0),
                    "suspicious": stats.get("suspicious", 0),
                    "harmless": stats.get("harmless", 0),
                    "reputation": data.get("reputation", 0),
                    "categories": data.get("categories", {}),
                    "last_analysis_date": data.get("last_analysis_date"),
                }
            elif resp.status_code == 404:
                return {"source": "virustotal", "status": "clean", "detail": "Not found in database"}
            else:
                return {"source": "virustotal", "status": "error", "detail": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"source": "virustotal", "status": "error", "detail": str(e)[:200]}


async def _check_hibp(email: str) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.HIBP_API_KEY:
        return {"source": "haveibeenpwned", "status": "skipped", "reason": "No API key"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"https://haveibeenpwned.com/api/v3/breachedaccount/{email}",
                headers={"hibp-api-key": settings.HIBP_API_KEY, "user-agent": "TAI-AEGIS"},
                params={"truncateResponse": "false"},
            )
            if resp.status_code == 200:
                breaches = resp.json()
                return {
                    "source": "haveibeenpwned",
                    "status": "breached",
                    "breach_count": len(breaches),
                    "breaches": [
                        {
                            "name": b.get("Name"),
                            "date": b.get("BreachDate"),
                            "data_classes": b.get("DataClasses", []),
                            "is_verified": b.get("IsVerified"),
                        }
                        for b in breaches[:20]
                    ],
                }
            elif resp.status_code == 404:
                return {"source": "haveibeenpwned", "status": "clean", "detail": "No breaches found"}
            elif resp.status_code == 429:
                return {"source": "haveibeenpwned", "status": "rate_limited"}
            else:
                return {"source": "haveibeenpwned", "status": "error", "detail": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"source": "haveibeenpwned", "status": "error", "detail": str(e)[:200]}


async def _check_shodan(ip: str) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.SHODAN_API_KEY:
        return {"source": "shodan", "status": "skipped", "reason": "No API key"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"https://api.shodan.io/shodan/host/{ip}",
                params={"key": settings.SHODAN_API_KEY},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "source": "shodan",
                    "status": "found",
                    "ports": data.get("ports", []),
                    "vulns": data.get("vulns", []),
                    "os": data.get("os"),
                    "isp": data.get("isp"),
                    "org": data.get("org"),
                    "country": data.get("country_name"),
                    "city": data.get("city"),
                    "hostnames": data.get("hostnames", []),
                    "open_ports_count": len(data.get("ports", [])),
                }
            elif resp.status_code == 404:
                return {"source": "shodan", "status": "clean", "detail": "No data found"}
            else:
                return {"source": "shodan", "status": "error", "detail": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"source": "shodan", "status": "error", "detail": str(e)[:200]}


async def _check_malwarebazaar(hash_value: str) -> Dict[str, Any]:
    """Abuse.ch MalwareBazaar — hash lookup (md5/sha1/sha256). Auth-Key now required."""
    settings = get_settings()
    headers = {}
    if getattr(settings, "ABUSECH_AUTH_KEY", ""):
        headers["Auth-Key"] = settings.ABUSECH_AUTH_KEY
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://mb-api.abuse.ch/api/v1/",
                data={"query": "get_info", "hash": hash_value},
                headers=headers,
            )
            if resp.status_code == 401:
                return {"source": "malwarebazaar", "status": "skipped",
                        "reason": "Abuse.ch now requires ABUSECH_AUTH_KEY (free at auth.abuse.ch)"}
            if resp.status_code != 200:
                return {"source": "malwarebazaar", "status": "error", "detail": f"HTTP {resp.status_code}"}
            data = resp.json()
            status = data.get("query_status")
            if status == "hash_not_found":
                return {"source": "malwarebazaar", "status": "clean", "detail": "Not seen in MalwareBazaar"}
            if status != "ok":
                return {"source": "malwarebazaar", "status": "error", "detail": status or "unknown"}
            entries = data.get("data", []) or []
            if not entries:
                return {"source": "malwarebazaar", "status": "clean"}
            top = entries[0]
            return {
                "source": "malwarebazaar",
                "status": "found",
                "md5":      top.get("md5_hash"),
                "sha1":     top.get("sha1_hash"),
                "sha256":   top.get("sha256_hash"),
                "file_name": top.get("file_name"),
                "file_type": top.get("file_type"),
                "file_size": top.get("file_size"),
                "signature": top.get("signature"),
                "first_seen": top.get("first_seen"),
                "last_seen": top.get("last_seen"),
                "tags":     top.get("tags", []) or [],
                "yara_rules": [
                    {"rule": y.get("rule_name"), "author": y.get("author")}
                    for y in (top.get("yara_rules") or [])[:10]
                ],
                "delivery_method": top.get("delivery_method"),
                "reporter": top.get("reporter"),
            }
    except Exception as e:
        return {"source": "malwarebazaar", "status": "error", "detail": str(e)[:200]}


async def _check_shodan_internetdb(ip: str) -> Dict[str, Any]:
    """Free Shodan InternetDB lookup — no API key required."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(f"https://internetdb.shodan.io/{ip}")
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "source": "shodan_internetdb",
                    "status": "found",
                    "ports": data.get("ports", []),
                    "open_ports_count": len(data.get("ports", [])),
                    "cpes": data.get("cpes", []),
                    "hostnames": data.get("hostnames", []),
                    "vulns": data.get("vulns", []),
                    "tags": data.get("tags", []),
                }
            if resp.status_code == 404:
                return {"source": "shodan_internetdb", "status": "clean", "detail": "No InternetDB record"}
            return {"source": "shodan_internetdb", "status": "error", "detail": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"source": "shodan_internetdb", "status": "error", "detail": str(e)[:200]}


async def _check_greynoise(ip: str) -> Dict[str, Any]:
    """GreyNoise. Prefer v2/noise/context (keyed) which has higher limits than v3/community."""
    settings = get_settings()
    try:
        headers = {"Accept": "application/json"}
        if settings.GREYNOISE_API_KEY:
            headers["key"] = settings.GREYNOISE_API_KEY
            url = f"https://api.greynoise.io/v2/noise/context/{ip}"
        else:
            url = f"https://api.greynoise.io/v3/community/{ip}"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 429:
                return {"source": "greynoise", "status": "skipped", "reason": "Rate limit (shared egress IP)"}
            if resp.status_code == 200:
                data = resp.json() or {}
                meta = data.get("metadata") or {}
                return {
                    "source": "greynoise",
                    "status": "found",
                    "noise": data.get("noise", False),
                    "riot": data.get("riot", False),
                    "seen": data.get("seen", False),
                    "classification": data.get("classification", "unknown"),
                    "name": data.get("name") or data.get("actor", ""),
                    "organization": meta.get("organization"),
                    "category": meta.get("category"),
                    "country": meta.get("country"),
                    "tags": data.get("tags", []),
                    "link": data.get("link", ""),
                }
            elif resp.status_code == 404:
                return {"source": "greynoise", "status": "clean", "detail": "Not observed"}
            else:
                return {"source": "greynoise", "status": "error", "detail": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"source": "greynoise", "status": "error", "detail": str(e)[:200]}


async def _check_urlscan(target: str) -> Dict[str, Any]:
    """URLScan.io search — works WITHOUT API key for search queries."""
    settings = get_settings()
    try:
        headers = {}
        if settings.URLSCAN_API_KEY:
            headers["API-Key"] = settings.URLSCAN_API_KEY
        # urlscan's query parser chokes on raw URLs (forward slashes).
        # Wrap full URLs in `page.url.keyword:"..."` to force exact-match.
        if target.startswith(("http://", "https://")):
            query = f'page.url.keyword:"{target}"'
        else:
            query = target
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://urlscan.io/api/v1/search/",
                params={"q": query, "size": 5},
                headers=headers,
            )
            if resp.status_code == 200:
                results = resp.json().get("results", [])
                malicious = [r for r in results if r.get("verdicts", {}).get("overall", {}).get("malicious")]
                return {
                    "source": "urlscan",
                    "status": "found" if results else "clean",
                    "total_results": len(results),
                    "malicious_count": len(malicious),
                    "results": [
                        {
                            "url": r.get("page", {}).get("url"),
                            "domain": r.get("page", {}).get("domain"),
                            "ip": r.get("page", {}).get("ip"),
                            "country": r.get("page", {}).get("country"),
                            "malicious": r.get("verdicts", {}).get("overall", {}).get("malicious", False),
                            "screenshot": r.get("screenshot"),
                        }
                        for r in results[:5]
                    ],
                }
            else:
                return {"source": "urlscan", "status": "error", "detail": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"source": "urlscan", "status": "error", "detail": str(e)[:200]}


async def _check_intelx(query: str) -> Dict[str, Any]:
    """IntelX dark web search. free.intelx.io is the public tier; 2.intelx.io is paid."""
    settings = get_settings()
    if not settings.INTELX_API_KEY:
        return {"source": "intelx", "status": "skipped", "reason": "No API key"}
    hosts = ["https://free.intelx.io", "https://2.intelx.io"]
    last_err = None
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            for host in hosts:
                resp = await client.post(
                    f"{host}/intelligent/search",
                    headers={"x-key": settings.INTELX_API_KEY, "Content-Type": "application/json"},
                    json={"term": query, "maxresults": 10, "media": 0, "timeout": 10},
                )
                if resp.status_code == 401:
                    last_err = f"{host} 401"
                    continue
                if resp.status_code != 200:
                    last_err = f"{host} HTTP {resp.status_code}"
                    continue
                search_id = (resp.json() or {}).get("id")
                if not search_id:
                    return {"source": "intelx", "status": "clean", "detail": "No search id"}
                import asyncio
                await asyncio.sleep(2)
                result_resp = await client.get(
                    f"{host}/intelligent/search/result",
                    params={"id": search_id},
                    headers={"x-key": settings.INTELX_API_KEY},
                )
                if result_resp.status_code != 200:
                    last_err = f"{host} result HTTP {result_resp.status_code}"
                    continue
                data = result_resp.json() or {}
                records = data.get("records") or []
                return {
                    "source": "intelx",
                    "status": "found" if records else "clean",
                    "total_results": len(records),
                    "results": [
                        {
                            "name": r.get("name", ""),
                            "date": r.get("date", ""),
                            "bucket": r.get("bucket", ""),
                            "media": r.get("mediah", ""),
                        }
                        for r in records[:10]
                    ],
                }
            return {"source": "intelx", "status": "error", "detail": last_err or "all hosts failed"}
    except Exception as e:
        return {"source": "intelx", "status": "error", "detail": str(e)[:200]}


async def _check_otx(kind: str, value: str) -> Dict[str, Any]:
    """AlienVault OTX — works with or without key; better limits with one."""
    settings = get_settings()
    # Map our target kind to OTX section types
    kmap = {
        "ip": "IPv4", "ipv4": "IPv4", "ipv6": "IPv6",
        "domain": "domain", "hostname": "hostname", "url": "url",
        "md5": "file", "sha1": "file", "sha256": "file",
    }
    otx_type = kmap.get(kind)
    if not otx_type:
        return {"source": "otx", "status": "skipped", "reason": f"Unsupported kind {kind}"}
    headers = {"User-Agent": "TAI-AEGIS"}
    if settings.OTX_API_KEY:
        headers["X-OTX-API-KEY"] = settings.OTX_API_KEY
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            # Pulses = threat-intel matches; general = reputation + summary
            g = await client.get(
                f"https://otx.alienvault.com/api/v1/indicators/{otx_type}/{value}/general",
                headers=headers,
            )
            if g.status_code == 404:
                return {"source": "otx", "status": "clean", "detail": "No OTX record"}
            if g.status_code != 200:
                return {"source": "otx", "status": "error", "detail": f"HTTP {g.status_code}"}
            gd = g.json()
            pulses = ((gd.get("pulse_info") or {}).get("pulses") or [])
            related_malware = []
            for p in pulses[:10]:
                for m in (p.get("malware_families") or [])[:5]:
                    n = m.get("display_name") if isinstance(m, dict) else str(m)
                    if n and n not in related_malware:
                        related_malware.append(n)
            return {
                "source": "otx",
                "status": "found" if pulses else "clean",
                "reputation": gd.get("reputation", 0),
                "pulse_count": (gd.get("pulse_info") or {}).get("count", 0),
                "asn": gd.get("asn"),
                "country": gd.get("country_name"),
                "malware_families": related_malware[:10],
                "pulses": [
                    {"name": p.get("name"), "author": (p.get("author") or {}).get("username"),
                     "created": p.get("created"), "tags": (p.get("tags") or [])[:6]}
                    for p in pulses[:5]
                ],
            }
    except Exception as e:
        return {"source": "otx", "status": "error", "detail": str(e)[:200]}


async def _check_abuseipdb(ip: str) -> Dict[str, Any]:
    """AbuseIPDB IP reputation."""
    settings = get_settings()
    if not settings.ABUSEIPDB_API_KEY:
        return {"source": "abuseipdb", "status": "skipped", "reason": "No API key"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                "https://api.abuseipdb.com/api/v2/check",
                params={"ipAddress": ip, "maxAgeInDays": 90, "verbose": ""},
                headers={"Key": settings.ABUSEIPDB_API_KEY, "Accept": "application/json"},
            )
            if resp.status_code != 200:
                return {"source": "abuseipdb", "status": "error", "detail": f"HTTP {resp.status_code}"}
            d = (resp.json() or {}).get("data") or {}
            reports = d.get("totalReports", 0)
            score = d.get("abuseConfidenceScore", 0)
            return {
                "source": "abuseipdb",
                "status": "found" if reports else "clean",
                "abuse_score": score,
                "total_reports": reports,
                "last_reported": d.get("lastReportedAt"),
                "country": d.get("countryCode"),
                "usage_type": d.get("usageType"),
                "isp": d.get("isp"),
                "domain": d.get("domain"),
                "is_tor": d.get("isTor"),
                "is_whitelisted": d.get("isWhitelisted"),
                "categories": [r.get("categories") for r in (d.get("reports") or [])[:5]],
            }
    except Exception as e:
        return {"source": "abuseipdb", "status": "error", "detail": str(e)[:200]}


async def _check_netlas(kind: str, value: str) -> Dict[str, Any]:
    """Netlas.io — passive DNS / host intelligence."""
    settings = get_settings()
    if not settings.NETLAS_API_KEY:
        return {"source": "netlas", "status": "skipped", "reason": "No API key"}
    if kind == "domain":
        q = f'domain:{value}'
        path = "/api/domains/"
    elif kind == "ip":
        q = f'ip:{value}'
        path = "/api/responses/"
    else:
        return {"source": "netlas", "status": "skipped", "reason": f"Unsupported {kind}"}
    try:
        async with httpx.AsyncClient(timeout=25, follow_redirects=True) as client:
            resp = await client.get(
                f"https://app.netlas.io{path}",
                params={"q": q, "size": 5},
                headers={
                    "X-API-Key": settings.NETLAS_API_KEY,
                    "User-Agent": "TAI-AEGIS/1.0 (+https://tai-aegis.vercel.app)",
                    "Accept": "application/json",
                },
            )
            if resp.status_code != 200:
                return {"source": "netlas", "status": "error", "detail": f"HTTP {resp.status_code}"}
            j = resp.json() or {}
            items = j.get("items", j.get("data", [])) or []
            return {
                "source": "netlas",
                "status": "found" if items else "clean",
                "total_results": j.get("count", len(items)),
                "results": [
                    {k: (it.get("data") or it).get(k) for k in ("domain", "ip", "asn", "port", "products", "last_seen")}
                    for it in items[:5]
                ],
            }
    except Exception as e:
        return {"source": "netlas", "status": "error", "detail": str(e)[:200]}


async def _check_ipqs(kind: str, value: str) -> Dict[str, Any]:
    """IPQualityScore — URL/email/phone fraud scoring.
    Handles `success:false` (e.g. quota exhausted) as 'skipped' so investigations
    don't look broken when the provider is out of credits.
    """
    settings = get_settings()
    if not settings.IPQS_API_KEY:
        return {"source": "ipqs", "status": "skipped", "reason": "No API key"}
    from urllib.parse import quote
    if kind == "url":
        endpoint = f"https://ipqualityscore.com/api/json/url/{settings.IPQS_API_KEY}/{quote(value, safe='')}"
    elif kind == "email":
        endpoint = f"https://ipqualityscore.com/api/json/email/{settings.IPQS_API_KEY}/{quote(value, safe='')}"
    elif kind == "phone":
        endpoint = f"https://ipqualityscore.com/api/json/phone/{settings.IPQS_API_KEY}/{quote(value, safe='')}"
    else:
        return {"source": "ipqs", "status": "skipped", "reason": f"Unsupported {kind}"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(endpoint)
            if resp.status_code != 200:
                return {"source": "ipqs", "status": "error", "detail": f"HTTP {resp.status_code}"}
            d = resp.json() or {}
            if not d.get("success", True):
                return {"source": "ipqs", "status": "skipped", "reason": d.get("message", "unknown")[:120]}
            out = {"source": "ipqs", "status": "found", "kind": kind}
            if kind == "url":
                out.update({
                    "unsafe": d.get("unsafe"), "spam": d.get("spamming"),
                    "malware": d.get("malware"), "phishing": d.get("phishing"),
                    "suspicious": d.get("suspicious"), "risk_score": d.get("risk_score"),
                    "domain_rank": d.get("domain_rank"), "category": d.get("category"),
                    "status_code": d.get("status_code"),
                })
            elif kind == "email":
                out.update({
                    "valid": d.get("valid"), "disposable": d.get("disposable"),
                    "deliverability": d.get("deliverability"), "fraud_score": d.get("fraud_score"),
                    "first_seen": (d.get("first_seen") or {}).get("human"),
                    "leaked": d.get("leaked"), "smtp_score": d.get("smtp_score"),
                    "honeypot": d.get("honeypot"), "recent_abuse": d.get("recent_abuse"),
                })
            elif kind == "phone":
                out.update({
                    "valid": d.get("valid"), "fraud_score": d.get("fraud_score"),
                    "active": d.get("active"), "carrier": d.get("carrier"),
                    "line_type": d.get("line_type"), "country": d.get("country"),
                    "region": d.get("region"), "city": d.get("city"),
                    "recent_abuse": d.get("recent_abuse"),
                    "leaked": d.get("leaked"), "risky": d.get("risky"),
                })
            return out
    except Exception as e:
        return {"source": "ipqs", "status": "error", "detail": str(e)[:200]}


async def _check_crtsh(domain: str) -> Dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(f"https://crt.sh/?q=%.{domain}&output=json")
            if resp.status_code == 200:
                certs = resp.json()
                subdomains = set()
                for cert in certs[:500]:
                    for name in cert.get("name_value", "").split("\n"):
                        name = name.strip().lower().lstrip("*.")
                        if name.endswith(domain) and name != domain:
                            subdomains.add(name)
                return {
                    "source": "crt.sh",
                    "status": "found",
                    "total_certs": len(certs),
                    "subdomains": sorted(list(subdomains))[:50],
                    "subdomain_count": len(subdomains),
                }
            else:
                return {"source": "crt.sh", "status": "error", "detail": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"source": "crt.sh", "status": "error", "detail": str(e)[:200]}


async def _check_github_leaks(query: str) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.GITHUB_PAT:
        return {"source": "github", "status": "skipped", "reason": "No API key"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://api.github.com/search/code",
                headers={"Authorization": f"Bearer {settings.GITHUB_PAT}", "Accept": "application/vnd.github.v3+json"},
                params={"q": f'"{query}" password OR secret OR api_key OR token', "per_page": 10},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "source": "github",
                    "status": "found" if data.get("total_count", 0) > 0 else "clean",
                    "total_count": data.get("total_count", 0),
                    "results": [
                        {
                            "repo": item.get("repository", {}).get("full_name"),
                            "path": item.get("path"),
                            "url": item.get("html_url"),
                        }
                        for item in data.get("items", [])[:10]
                    ],
                }
            elif resp.status_code == 403:
                return {"source": "github", "status": "rate_limited"}
            else:
                return {"source": "github", "status": "error", "detail": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"source": "github", "status": "error", "detail": str(e)[:200]}


async def _check_username(username: str) -> Dict[str, Any]:
    """Check username across social platforms via HTTP probing."""
    platforms = {
        "github": f"https://api.github.com/users/{username}",
        "twitter": f"https://twitter.com/{username}",
        "instagram": f"https://www.instagram.com/{username}/",
        "reddit": f"https://www.reddit.com/user/{username}/about.json",
        "linkedin": f"https://www.linkedin.com/in/{username}",
    }
    found_on = []
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            for platform, url in platforms.items():
                try:
                    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        found_on.append({"platform": platform, "url": url, "exists": True})
                    else:
                        found_on.append({"platform": platform, "url": url, "exists": False})
                except Exception:
                    found_on.append({"platform": platform, "url": url, "exists": False, "error": True})
    except Exception as e:
        return {"source": "username_check", "status": "error", "detail": str(e)[:200]}

    active = [f for f in found_on if f.get("exists")]
    return {
        "source": "username_check",
        "status": "found" if active else "clean",
        "platforms_checked": len(platforms),
        "found_on": [f["platform"] for f in active],
        "details": found_on,
    }


async def _check_phone(phone: str) -> Dict[str, Any]:
    """Basic phone number intelligence via format validation and public lookups."""
    clean = re.sub(r"[^\d+]", "", phone)
    info = {
        "source": "phone_check",
        "status": "analyzed",
        "formatted": clean,
        "length": len(clean),
    }
    # Basic validation
    if len(clean) < 7 or len(clean) > 15:
        info["valid"] = False
        info["detail"] = "Invalid phone number length"
    else:
        info["valid"] = True
        if clean.startswith("+1") or (len(clean) == 10 and not clean.startswith("+")):
            info["region"] = "US/Canada"
        elif clean.startswith("+44"):
            info["region"] = "UK"
        elif clean.startswith("+91"):
            info["region"] = "India"
        else:
            info["region"] = "Unknown"

    # Check if phone appears in data leaks via GitHub
    settings = get_settings()
    if settings.GITHUB_PAT:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    "https://api.github.com/search/code",
                    headers={"Authorization": f"Bearer {settings.GITHUB_PAT}"},
                    params={"q": f'"{clean}"', "per_page": 5},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    info["github_leaks"] = data.get("total_count", 0)
        except Exception:
            pass

    return info


# ---------------------------------------------------------------------------
# Modal / Kali OSINT tools — subfinder, dnstwist, theHarvester, nmap, nuclei, ...
# These run on Modal serverless; latencies are 30-120s per tool and are
# executed in parallel with gather(). Each returns a source-like dict so the
# frontend/AI treat them identically to an API provider.
# ---------------------------------------------------------------------------
async def _modal_domain_tools(domain: str) -> Dict[str, Dict[str, Any]]:
    """subfinder + dnstwist + theHarvester + amass + waybackurls (Phase B)."""
    try:
        from modules import modal_recon
    except Exception as e:
        return {"modal_error": {"source": "modal", "status": "error", "detail": str(e)[:150]}}

    sf, tw, th, am, wb = await asyncio.gather(
        modal_recon.subfinder(domain),
        modal_recon.dnstwist(domain, registered_only=True),
        modal_recon.theharvester(domain),
        modal_recon.amass(domain),
        modal_recon.waybackurls(domain, limit=300),
        return_exceptions=True,
    )

    def _wrap(r: Any, tool: str) -> Dict[str, Any]:
        if isinstance(r, Exception):
            return {"source": tool, "status": "error", "detail": str(r)[:200]}
        if not r or not isinstance(r, dict):
            return {"source": tool, "status": "error", "detail": "no response"}
        # Some Modal tools set `error` to their banner when the process exit
        # code is non-zero even though results are valid. Trust the `results`
        # payload if it's present and non-empty — only escalate to 'error'
        # when we have nothing usable.
        err = r.get("error")
        rr = r.get("results")
        has_data = (rr is not None and (rr if isinstance(rr, list) else (rr if isinstance(rr, dict) and rr else False))) \
                   or (r.get("count") or 0) > 0 or (r.get("subdomains") or []) or (r.get("urls") or [])
        if err and not has_data:
            return {"source": tool, "status": "error", "detail": str(err)[:200]}
        return r

    sf_wrap = _wrap(sf, "subfinder")
    if sf_wrap.get("status") != "error":
        sf_wrap = {
            "source": "subfinder",
            "status": "found" if (sf_wrap.get("count") or 0) > 0 else "clean",
            "subdomain_count": sf_wrap.get("count", 0),
            "subdomains": (sf_wrap.get("subdomains") or [])[:40],
        }

    tw_wrap = _wrap(tw, "dnstwist")
    if tw_wrap.get("status") != "error":
        twr = tw_wrap.get("results") or []
        tw_wrap = {
            "source": "dnstwist",
            "status": "found" if twr else "clean",
            "typosquat_count": len(twr),
            "typosquats": [
                {"domain": t.get("domain"), "fuzzer": t.get("fuzzer"),
                 "dns_a": (t.get("dns_a") or [None])[0]}
                for t in twr[:15]
            ],
        }

    th_wrap = _wrap(th, "theharvester")
    if th_wrap.get("status") != "error":
        rr = th_wrap.get("results") or {}
        th_wrap = {
            "source": "theharvester",
            "status": "found" if (rr.get("emails") or rr.get("hosts")) else "clean",
            "email_count": len(rr.get("emails") or []),
            "host_count": len(rr.get("hosts") or []),
            "emails": (rr.get("emails") or [])[:20],
            "hosts": (rr.get("hosts") or [])[:20],
            "ips": rr.get("ips") or [],
            "asns": (rr.get("asns") or [])[:10],
        }

    am_wrap = _wrap(am, "amass")
    if am_wrap.get("status") != "error":
        subs = am_wrap.get("subdomains") or []
        am_wrap = {
            "source": "amass",
            "status": "found" if subs else "clean",
            "subdomain_count": len(subs),
            "subdomains": subs[:40],
        }

    wb_wrap = _wrap(wb, "waybackurls")
    if wb_wrap.get("status") != "error":
        urls = wb_wrap.get("urls") or []
        wb_wrap = {
            "source": "waybackurls",
            "status": "found" if urls else "clean",
            "url_count": len(urls),
            "sample": urls[:20],
        }

    return {
        "subfinder": sf_wrap, "dnstwist": tw_wrap, "theharvester": th_wrap,
        "amass": am_wrap, "waybackurls": wb_wrap,
    }


async def _modal_ip_tools(ip: str) -> Dict[str, Dict[str, Any]]:
    try:
        from modules import modal_recon
    except Exception as e:
        return {"modal_error": {"source": "modal", "status": "error", "detail": str(e)[:150]}}
    r, nb = await asyncio.gather(
        modal_recon.nmap(ip, args="-sT -Pn -sV -F -T4"),
        modal_recon.naabu(ip, top_ports=1000),
        return_exceptions=True,
    )
    out: Dict[str, Any] = {}
    if isinstance(r, Exception) or (isinstance(r, dict) and (r.get("error") or not r.get("ok", True))):
        detail = str(r) if isinstance(r, Exception) else (r.get("error") or r.get("stderr") or "failed")
        out["nmap"] = {"source": "nmap", "status": "error", "detail": str(detail)[:200]}
    else:
        raw = r.get("output") or ""
        open_ports: List[Dict[str, str]] = []
        for line in raw.splitlines():
            line = line.strip()
            m = re.match(r"^(\d+)/tcp\s+(\S+)\s+(\S+)(?:\s+(.+))?$", line)
            if m and m.group(2) == "open":
                open_ports.append({"port": m.group(1), "service": m.group(3), "version": (m.group(4) or "").strip()})
        out["nmap"] = {
            "source": "nmap", "status": "found" if open_ports else "clean",
            "open_ports_count": len(open_ports),
            "open_ports": open_ports[:30],
            "args": r.get("args", ""),
        }
    if isinstance(nb, Exception) or (isinstance(nb, dict) and nb.get("error")):
        out["naabu"] = {"source": "naabu", "status": "error",
                        "detail": str(nb if isinstance(nb, Exception) else nb.get("error"))[:200]}
    else:
        out["naabu"] = {
            "source": "naabu",
            "status": "found" if nb.get("open_ports_count") else "clean",
            "open_ports_count": nb.get("open_ports_count", 0),
            "open_ports": nb.get("open_ports", [])[:50],
        }
    return out


async def _modal_url_tools(url: str) -> Dict[str, Dict[str, Any]]:
    try:
        from modules import modal_recon
    except Exception as e:
        return {"modal_error": {"source": "modal", "status": "error", "detail": str(e)[:150]}}
    nuc, ww = await asyncio.gather(
        modal_recon.nuclei(url, severity="critical,high,medium"),
        modal_recon.whatweb(url),
        return_exceptions=True,
    )
    out: Dict[str, Any] = {}
    if isinstance(nuc, Exception) or (isinstance(nuc, dict) and nuc.get("error")):
        out["nuclei"] = {"source": "nuclei", "status": "error",
                         "detail": str(nuc if isinstance(nuc, Exception) else nuc.get("error"))[:200]}
    else:
        findings = nuc.get("findings") or []
        by_sev: Dict[str, int] = {}
        for f in findings:
            sev = ((f.get("info") or {}).get("severity") or "unknown").lower()
            by_sev[sev] = by_sev.get(sev, 0) + 1
        out["nuclei"] = {
            "source": "nuclei",
            "status": "found" if findings else "clean",
            "total_findings": len(findings),
            "by_severity": by_sev,
            "top_findings": [
                {"template": f.get("template-id"),
                 "severity": (f.get("info") or {}).get("severity"),
                 "name": (f.get("info") or {}).get("name"),
                 "matched": f.get("matched-at")}
                for f in findings[:10]
            ],
        }
    if isinstance(ww, Exception) or (isinstance(ww, dict) and ww.get("error")):
        out["whatweb"] = {"source": "whatweb", "status": "error",
                          "detail": str(ww if isinstance(ww, Exception) else ww.get("error"))[:200]}
    else:
        out["whatweb"] = {
            "source": "whatweb",
            "status": "found" if ww.get("plugin_count") else "clean",
            "http_status": ww.get("status"),
            "target_url": ww.get("target_url"),
            "plugin_count": ww.get("plugin_count", 0),
            "plugins": ww.get("plugins", [])[:20],
        }
    return out


async def _modal_username_tools(username: str) -> Dict[str, Dict[str, Any]]:
    try:
        from modules import modal_recon
    except Exception as e:
        return {"sherlock": {"source": "sherlock", "status": "error", "detail": str(e)[:150]}}
    r = await modal_recon.sherlock(username, timeout=20)
    if isinstance(r, dict) and r.get("error"):
        return {"sherlock": {"source": "sherlock", "status": "error", "detail": str(r["error"])[:200]}}
    return {"sherlock": {
        "source": "sherlock",
        "status": "found" if r.get("found_count") else "clean",
        "found_count": r.get("found_count", 0),
        "found_on": [f.get("site") for f in (r.get("found") or [])[:30]],
        "details": (r.get("found") or [])[:30],
    }}


async def _modal_email_tools(email: str) -> Dict[str, Dict[str, Any]]:
    try:
        from modules import modal_recon
    except Exception as e:
        return {"holehe": {"source": "holehe", "status": "error", "detail": str(e)[:150]}}
    r = await modal_recon.holehe(email)
    if isinstance(r, dict) and r.get("error"):
        return {"holehe": {"source": "holehe", "status": "error", "detail": str(r["error"])[:200]}}
    return {"holehe": {
        "source": "holehe",
        "status": "found" if r.get("registered_count") else "clean",
        "registered_count": r.get("registered_count", 0),
        "registered_on": (r.get("registered_on") or [])[:50],
    }}


async def _ai_summarize(inv_id: str, org_id: str) -> Optional[Dict[str, Any]]:
    """Invoke the summarize-investigation skill. Best-effort — never raises."""
    try:
        from skills.registry import get as get_skill
        skill = get_skill("summarize-investigation")
        if not skill:
            return None
        sr = await skill.invoke(
            {"investigation_id": inv_id},
            org_id=org_id,
            model="claude-haiku-4-5",
        )
        if sr.error or not sr.result:
            return {"error": sr.error, "cached": sr.cached,
                    "input_tokens": sr.input_tokens, "output_tokens": sr.output_tokens}
        return {
            **(sr.result if isinstance(sr.result, dict) else {"text": str(sr.result)}),
            "_meta": {
                "model": sr.model,
                "input_tokens": sr.input_tokens,
                "output_tokens": sr.output_tokens,
                "cost_usd": sr.cost_usd,
                "duration_ms": sr.duration_ms,
                "cached": sr.cached,
            },
        }
    except Exception as e:
        logger.warning("ai summarize failed: %s", e)
        return {"error": f"{type(e).__name__}: {e}"}


@router.post("/")
async def investigate(body: InvestigateRequest, x_org_id: str = Header(...)):
    if body.target_type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid target type. Must be one of: {sorted(VALID_TYPES)}")

    if not body.target_value.strip():
        raise HTTPException(400, "Target value cannot be empty")

    target = body.target_value.strip()
    db = get_client()

    # Create investigation record
    inv = db.table("investigations").insert({
        "org_id": x_org_id,
        "target_type": body.target_type,
        "target_value": target,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    inv_id = inv.data[0]["id"] if inv.data else None

    results = {}
    sources_checked = []
    scoring_factors = {}
    _t_start = time.monotonic()
    _modal_runtime_ms = 0
    _modal_tools_used: List[str] = []

    async def _time_modal(coro, tag: str):
        nonlocal _modal_runtime_ms
        t0 = time.monotonic()
        r = await coro
        _modal_runtime_ms += int((time.monotonic() - t0) * 1000)
        if isinstance(r, dict):
            for k in r:
                if k not in _modal_tools_used:
                    _modal_tools_used.append(k)
        return r

    try:
        if body.target_type == "email":
            results["hibp"] = await _check_hibp(target)
            sources_checked.append("haveibeenpwned")
            results["github"] = await _check_github_leaks(target)
            sources_checked.append("github")
            results["ipqs"] = await _check_ipqs("email", target)
            sources_checked.append("ipqs")
            domain = target.split("@")[-1] if "@" in target else None
            if domain:
                results["dns"] = await _check_dns(domain)
                sources_checked.append("dns")
                results["whois"] = await _check_whois(domain)
                sources_checked.append("whois")
                results["virustotal"] = await _check_virustotal("domain", domain)
                sources_checked.append("virustotal")
                results["threatfox"] = await _check_threatfox(domain)
                sources_checked.append("threatfox")
                results["otx"] = await _check_otx("domain", domain)
                sources_checked.append("otx")
            results["intelx"] = await _check_intelx(target)
            sources_checked.append("intelx")
            # Modal Phase-B: holehe (which sites the email is registered on)
            modal_res = await _time_modal(_modal_email_tools(target), "email")
            for k, v in modal_res.items():
                results[k] = v
                sources_checked.append(k)
            if results["hibp"].get("status") == "breached":
                scoring_factors["in_breach_db"] = True
                scoring_factors["exposed_credentials"] = True
            ipqs = results.get("ipqs") or {}
            if ipqs.get("fraud_score", 0) >= 85 or ipqs.get("honeypot") or ipqs.get("disposable"):
                scoring_factors["exposed_credentials"] = True
            if (results.get("otx") or {}).get("pulse_count", 0) > 0:
                scoring_factors["virustotal_flagged"] = True
            if (results.get("holehe") or {}).get("registered_count", 0) > 0:
                scoring_factors["exposed_credentials"] = True

        elif body.target_type == "domain":
            # Free sources (no key required)
            results["dns"] = await _check_dns(target)
            sources_checked.append("dns")
            results["whois"] = await _check_whois(target)
            sources_checked.append("whois")
            results["crtsh"] = await _check_crtsh(target)
            sources_checked.append("crt.sh")
            results["threatfox"] = await _check_threatfox(target)
            sources_checked.append("threatfox")
            results["urlhaus"] = await _check_urlhaus(target)
            sources_checked.append("urlhaus")
            results["blocklist"] = await _check_blocklist("domain", target)
            sources_checked.append("blocklist")
            results["github"] = await _check_github_leaks(target)
            sources_checked.append("github")
            results["intelx"] = await _check_intelx(target)
            sources_checked.append("intelx")
            # Keyed sources (optional)
            results["virustotal"] = await _check_virustotal("domain", target)
            sources_checked.append("virustotal")
            results["urlscan"] = await _check_urlscan(target)
            sources_checked.append("urlscan")
            results["otx"] = await _check_otx("domain", target)
            sources_checked.append("otx")
            results["netlas"] = await _check_netlas("domain", target)
            sources_checked.append("netlas")
            # Modal-backed Kali OSINT tools (subfinder, dnstwist, theHarvester)
            modal_res = await _time_modal(_modal_domain_tools(target), "domain")
            for k, v in modal_res.items():
                results[k] = v
                sources_checked.append(k)
            if (results.get("subfinder") or {}).get("subdomain_count", 0) > 50:
                scoring_factors["large_attack_surface"] = True
            if (results.get("dnstwist") or {}).get("typosquat_count", 0) > 0:
                scoring_factors["typosquat_present"] = True
            if (results.get("virustotal") or {}).get("malicious", 0) > 0:
                scoring_factors["virustotal_flagged"] = True
            if (results.get("urlscan") or {}).get("malicious_count", 0) > 0:
                scoring_factors["urlscan_phishing"] = True
            if (results.get("threatfox") or {}).get("status") == "found":
                scoring_factors["virustotal_flagged"] = True
            if (results.get("urlhaus") or {}).get("status") == "found":
                scoring_factors["urlscan_phishing"] = True
            if (results.get("blocklist") or {}).get("status") == "found":
                scoring_factors["on_blocklist"] = True
            if (results.get("otx") or {}).get("pulse_count", 0) > 0:
                scoring_factors["virustotal_flagged"] = True

        elif body.target_type == "ip":
            # Free sources
            results["geolocation"] = await _check_ip_geolocation(target)
            sources_checked.append("geolocation")
            results["threatfox"] = await _check_threatfox(target)
            sources_checked.append("threatfox")
            results["urlhaus"] = await _check_urlhaus(target)
            sources_checked.append("urlhaus")
            results["blocklist"] = await _check_blocklist("ip", target)
            sources_checked.append("blocklist")
            # Free port/CPE intelligence (no key)
            results["shodan_internetdb"] = await _check_shodan_internetdb(target)
            sources_checked.append("shodan_internetdb")
            # Keyed sources
            results["virustotal"] = await _check_virustotal("ip", target)
            sources_checked.append("virustotal")
            results["shodan"] = await _check_shodan(target)
            sources_checked.append("shodan")
            results["greynoise"] = await _check_greynoise(target)
            sources_checked.append("greynoise")
            results["abuseipdb"] = await _check_abuseipdb(target)
            sources_checked.append("abuseipdb")
            results["otx"] = await _check_otx("ip", target)
            sources_checked.append("otx")
            results["netlas"] = await _check_netlas("ip", target)
            sources_checked.append("netlas")
            # Modal-backed Kali OSINT: nmap
            modal_res = await _time_modal(_modal_ip_tools(target), "ip")
            for k, v in modal_res.items():
                results[k] = v
                sources_checked.append(k)
            if (results.get("nmap") or {}).get("open_ports_count", 0) > 10:
                scoring_factors["exposed_credentials"] = True
            idb = results.get("shodan_internetdb") or {}
            if idb.get("open_ports_count", 0) > 10:
                scoring_factors["exposed_credentials"] = True
            if idb.get("vulns"):
                scoring_factors["virustotal_flagged"] = True
            if (results.get("virustotal") or {}).get("malicious", 0) > 0:
                scoring_factors["virustotal_flagged"] = True
            if (results.get("shodan") or {}).get("open_ports_count", 0) > 10:
                scoring_factors["exposed_credentials"] = True
            if (results.get("threatfox") or {}).get("status") == "found":
                scoring_factors["virustotal_flagged"] = True
            if (results.get("abuseipdb") or {}).get("abuse_score", 0) >= 50:
                scoring_factors["virustotal_flagged"] = True
            if (results.get("abuseipdb") or {}).get("is_tor"):
                scoring_factors["tor_exit_node"] = True
            if (results.get("otx") or {}).get("pulse_count", 0) > 0:
                scoring_factors["virustotal_flagged"] = True
            bl = results.get("blocklist") or {}
            if bl.get("status") == "found":
                scoring_factors["on_blocklist"] = True
                if "tor_exit" in (bl.get("sources") or []):
                    scoring_factors["tor_exit_node"] = True

        elif body.target_type == "url":
            from urllib.parse import urlparse
            parsed = urlparse(target)
            domain = parsed.hostname or target
            results["dns"] = await _check_dns(domain)
            sources_checked.append("dns")
            results["threatfox"] = await _check_threatfox(target)
            sources_checked.append("threatfox")
            results["urlhaus"] = await _check_urlhaus(target)
            sources_checked.append("urlhaus")
            results["blocklist"] = await _check_blocklist("url", target)
            sources_checked.append("blocklist")
            results["virustotal"] = await _check_virustotal("url", target)
            sources_checked.append("virustotal")
            results["urlscan"] = await _check_urlscan(target)
            sources_checked.append("urlscan")
            results["otx"] = await _check_otx("url", target)
            sources_checked.append("otx")
            results["ipqs"] = await _check_ipqs("url", target)
            sources_checked.append("ipqs")
            # Modal-backed Kali OSINT: nuclei vulnerability scan
            modal_res = await _time_modal(_modal_url_tools(target), "url")
            for k, v in modal_res.items():
                results[k] = v
                sources_checked.append(k)
            nuclei = results.get("nuclei") or {}
            if nuclei.get("by_severity", {}).get("critical", 0) > 0 or nuclei.get("by_severity", {}).get("high", 0) > 0:
                scoring_factors["urlscan_phishing"] = True
                scoring_factors["virustotal_flagged"] = True
            if (results.get("virustotal") or {}).get("malicious", 0) > 0:
                scoring_factors["virustotal_flagged"] = True
            if (results.get("urlscan") or {}).get("malicious_count", 0) > 0:
                scoring_factors["urlscan_phishing"] = True
            if (results.get("threatfox") or {}).get("status") == "found":
                scoring_factors["virustotal_flagged"] = True
            if (results.get("blocklist") or {}).get("status") == "found":
                scoring_factors["on_blocklist"] = True
            if (results.get("otx") or {}).get("pulse_count", 0) > 0:
                scoring_factors["virustotal_flagged"] = True
            if (results.get("ipqs") or {}).get("risk_score", 0) >= 75 or (results.get("ipqs") or {}).get("phishing"):
                scoring_factors["urlscan_phishing"] = True

        elif body.target_type == "username":
            results["username"] = await _check_username(target)
            sources_checked.append("username_platforms")
            results["github"] = await _check_github_leaks(target)
            sources_checked.append("github")
            results["intelx"] = await _check_intelx(target)
            sources_checked.append("intelx")
            # Modal Phase-B: sherlock across 400+ sites
            modal_res = await _time_modal(_modal_username_tools(target), "username")
            for k, v in modal_res.items():
                results[k] = v
                sources_checked.append(k)
            if (results.get("github") or {}).get("total_count", 0) > 0:
                scoring_factors["exposed_credentials"] = True
            if (results.get("sherlock") or {}).get("found_count", 0) >= 5:
                scoring_factors["exposed_credentials"] = True

        elif body.target_type == "phone":
            results["phone"] = await _check_phone(target)
            sources_checked.append("phone_check")
            results["ipqs"] = await _check_ipqs("phone", target)
            sources_checked.append("ipqs")
            ipqs = results.get("ipqs") or {}
            if ipqs.get("fraud_score", 0) >= 85 or ipqs.get("recent_abuse") or ipqs.get("risky"):
                scoring_factors["exposed_credentials"] = True

        elif body.target_type == "hash":
            kind = _classify_hash(target)
            if kind == "unknown":
                raise HTTPException(400, "Hash must be md5, sha1, or sha256 hex")
            results["malwarebazaar"] = await _check_malwarebazaar(target)
            sources_checked.append("malwarebazaar")
            results["threatfox"] = await _check_threatfox(target)
            sources_checked.append("threatfox")
            results["blocklist"] = await _check_blocklist("hash", target)
            sources_checked.append("blocklist")
            # VirusTotal file lookup — keyed
            settings = get_settings()
            if settings.VIRUSTOTAL_API_KEY:
                try:
                    async with httpx.AsyncClient(timeout=30) as client:
                        resp = await client.get(
                            f"https://www.virustotal.com/api/v3/files/{target}",
                            headers={"x-apikey": settings.VIRUSTOTAL_API_KEY},
                        )
                        if resp.status_code == 200:
                            attr = resp.json().get("data", {}).get("attributes", {})
                            stats = attr.get("last_analysis_stats", {})
                            results["virustotal"] = {
                                "source": "virustotal",
                                "status": "found",
                                "malicious": stats.get("malicious", 0),
                                "suspicious": stats.get("suspicious", 0),
                                "harmless": stats.get("harmless", 0),
                                "meaningful_name": attr.get("meaningful_name"),
                                "type_description": attr.get("type_description"),
                                "size": attr.get("size"),
                                "popular_threat_classification": attr.get("popular_threat_classification"),
                            }
                            sources_checked.append("virustotal")
                        elif resp.status_code == 404:
                            results["virustotal"] = {"source": "virustotal", "status": "clean", "detail": "Unknown to VT"}
                            sources_checked.append("virustotal")
                except Exception as e:
                    logger.warning("VT file lookup failed: %s", e)
            # OTX file hash lookup
            results["otx"] = await _check_otx(kind, target)
            sources_checked.append("otx")
            if (results.get("malwarebazaar") or {}).get("status") == "found":
                scoring_factors["malware_hash_match"] = True
                scoring_factors["virustotal_flagged"] = True
            if (results.get("threatfox") or {}).get("status") == "found":
                scoring_factors["malware_hash_match"] = True
            if (results.get("virustotal") or {}).get("malicious", 0) > 0:
                scoring_factors["virustotal_flagged"] = True
            if (results.get("blocklist") or {}).get("status") == "found":
                scoring_factors["on_blocklist"] = True
            if (results.get("otx") or {}).get("pulse_count", 0) > 0:
                scoring_factors["malware_hash_match"] = True

        # Filter out None results
        results = {k: v for k, v in results.items() if v is not None}

        # Run metadata so the UI can show Modal timing + confirm shutdown.
        # Modal functions are declared with container_idle_timeout=10, so by
        # the time this row is persisted every worker is in scaledown.
        total_ms = int((time.monotonic() - _t_start) * 1000)
        results["_run"] = {
            "total_ms": total_ms,
            "modal_runtime_ms": _modal_runtime_ms,
            "modal_tools": [t for t in _modal_tools_used if t != "modal_error"],
            "modal_containers_stopped": True,
        }

        risk_score = calculate_risk_score(scoring_factors)

        # Persist pre-AI so the skill can read the completed row
        if inv_id:
            db.table("investigations").update({
                "status": "completed",
                "results": results,
                "sources_checked": sources_checked,
                "risk_score": risk_score,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", inv_id).execute()

        # AI synthesis — always attempted, never raises. Persisted to the row
        # so history replays render the same AI card.
        ai_summary: Optional[Dict[str, Any]] = None
        if inv_id:
            try:
                ai_summary = await _ai_summarize(inv_id, x_org_id)
            except Exception as e:
                logger.warning("ai summarize raised: %s", e)
                ai_summary = {"error": f"{type(e).__name__}: {e}"}
            if ai_summary:
                try:
                    db.table("investigations").update({
                        "results": {**results, "_ai_summary": ai_summary},
                    }).eq("id", inv_id).execute()
                except Exception as e:
                    logger.warning("persist ai_summary failed: %s", e)

        return {
            "id": inv_id,
            "target_type": body.target_type,
            "target_value": target,
            "status": "completed",
            "risk_score": risk_score,
            "severity": severity_from_score(risk_score),
            "sources_checked": sources_checked,
            "results": results,
            "ai_summary": ai_summary,
        }

    except Exception as e:
        logger.error("Investigation failed for %s %s: %s", body.target_type, target, e)
        if inv_id:
            try:
                db.table("investigations").update({
                    "status": "failed",
                    "results": {"error": str(e)[:500]},
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", inv_id).execute()
            except Exception:
                pass
        raise HTTPException(500, f"Investigation failed: {str(e)[:200]}")


@router.get("/history")
async def investigation_history(
    x_org_id: str = Header(...),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    target_type: Optional[str] = Query(None),
):
    try:
        db = get_client()
        query = db.table("investigations").select("*", count="exact").eq("org_id", x_org_id)
        if target_type:
            query = query.eq("target_type", target_type)
        offset = (page - 1) * per_page
        result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
        return {
            "data": result.data or [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        logger.error("Failed to fetch investigation history: %s", e)
        raise HTTPException(500, str(e)[:200])


@router.get("/{investigation_id}")
async def get_investigation(investigation_id: str, x_org_id: str = Header(...)):
    try:
        db = get_client()
        result = db.table("investigations").select("*").eq("id", investigation_id).eq("org_id", x_org_id).execute()
        if not result.data:
            raise HTTPException(404, "Investigation not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e)[:200])
