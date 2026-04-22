"""
Individual Investigation Scanner — scan any URL, email, IP, domain, username, phone on-demand.
Returns results inline with risk assessment from multiple OSINT sources.
"""
import logging
import re
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
    """ThreatFox IOC lookup by Abuse.ch — free, no key required."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://threatfox-api.abuse.ch/api/v1/",
                json={"query": "search_ioc", "search_term": ioc},
            )
            if resp.status_code == 200:
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
    """URLhaus lookup by Abuse.ch — free, no key required."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Try as URL first
            resp = await client.post("https://urlhaus-api.abuse.ch/v1/url/", data={"url": ioc})
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
            # Try as host
            resp = await client.post("https://urlhaus-api.abuse.ch/v1/host/", data={"host": ioc})
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
    """Abuse.ch MalwareBazaar — free hash lookup (md5/sha1/sha256)."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://mb-api.abuse.ch/api/v1/",
                data={"query": "get_info", "hash": hash_value},
            )
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
    """GreyNoise Community API — works WITHOUT API key."""
    settings = get_settings()
    try:
        headers = {}
        if settings.GREYNOISE_API_KEY:
            headers["key"] = settings.GREYNOISE_API_KEY
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"https://api.greynoise.io/v3/community/{ip}",
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "source": "greynoise",
                    "status": "found",
                    "noise": data.get("noise", False),
                    "riot": data.get("riot", False),
                    "classification": data.get("classification", "unknown"),
                    "name": data.get("name", ""),
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
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://urlscan.io/api/v1/search/",
                params={"q": target, "size": 5},
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
    """IntelX dark web search — requires API key."""
    settings = get_settings()
    if not settings.INTELX_API_KEY:
        return {"source": "intelx", "status": "skipped", "reason": "No API key"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            # Start search
            resp = await client.post(
                "https://2.intelx.io/intelligent/search",
                headers={"x-key": settings.INTELX_API_KEY},
                json={"term": query, "maxresults": 10, "media": 0, "timeout": 10},
            )
            if resp.status_code == 200:
                search_id = resp.json().get("id")
                if search_id:
                    # Fetch results
                    import asyncio
                    await asyncio.sleep(2)
                    result_resp = await client.get(
                        f"https://2.intelx.io/intelligent/search/result?id={search_id}",
                        headers={"x-key": settings.INTELX_API_KEY},
                    )
                    if result_resp.status_code == 200:
                        data = result_resp.json()
                        records = data.get("records", [])
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
            return {"source": "intelx", "status": "clean", "detail": "No results"}
    except Exception as e:
        return {"source": "intelx", "status": "error", "detail": str(e)[:200]}


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

    try:
        if body.target_type == "email":
            results["hibp"] = await _check_hibp(target)
            sources_checked.append("haveibeenpwned")
            results["github"] = await _check_github_leaks(target)
            sources_checked.append("github")
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
            results["intelx"] = await _check_intelx(target)
            sources_checked.append("intelx")
            if results["hibp"].get("status") == "breached":
                scoring_factors["in_breach_db"] = True
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
            if (results.get("virustotal") or {}).get("malicious", 0) > 0:
                scoring_factors["virustotal_flagged"] = True
            if (results.get("urlscan") or {}).get("malicious_count", 0) > 0:
                scoring_factors["urlscan_phishing"] = True
            if (results.get("threatfox") or {}).get("status") == "found":
                scoring_factors["virustotal_flagged"] = True
            if (results.get("blocklist") or {}).get("status") == "found":
                scoring_factors["on_blocklist"] = True

        elif body.target_type == "username":
            results["username"] = await _check_username(target)
            sources_checked.append("username_platforms")
            results["github"] = await _check_github_leaks(target)
            sources_checked.append("github")

        elif body.target_type == "phone":
            results["phone"] = await _check_phone(target)
            sources_checked.append("phone_check")

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
            if (results.get("malwarebazaar") or {}).get("status") == "found":
                scoring_factors["malware_hash_match"] = True
                scoring_factors["virustotal_flagged"] = True
            if (results.get("threatfox") or {}).get("status") == "found":
                scoring_factors["malware_hash_match"] = True
            if (results.get("virustotal") or {}).get("malicious", 0) > 0:
                scoring_factors["virustotal_flagged"] = True
            if (results.get("blocklist") or {}).get("status") == "found":
                scoring_factors["on_blocklist"] = True

        # Filter out None results
        results = {k: v for k, v in results.items() if v is not None}

        risk_score = calculate_risk_score(scoring_factors)

        # Update investigation record
        if inv_id:
            db.table("investigations").update({
                "status": "completed",
                "results": results,
                "sources_checked": sources_checked,
                "risk_score": risk_score,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", inv_id).execute()

        return {
            "id": inv_id,
            "target_type": body.target_type,
            "target_value": target,
            "status": "completed",
            "risk_score": risk_score,
            "severity": severity_from_score(risk_score),
            "sources_checked": sources_checked,
            "results": results,
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
