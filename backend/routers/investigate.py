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


VALID_TYPES = {"url", "email", "ip", "domain", "username", "phone"}


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


async def _check_greynoise(ip: str) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.GREYNOISE_API_KEY:
        return {"source": "greynoise", "status": "skipped", "reason": "No API key"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"https://api.greynoise.io/v3/community/{ip}",
                headers={"key": settings.GREYNOISE_API_KEY},
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
    settings = get_settings()
    if not settings.URLSCAN_API_KEY:
        return {"source": "urlscan", "status": "skipped", "reason": "No API key"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://urlscan.io/api/v1/search/",
                params={"q": target, "size": 5},
                headers={"API-Key": settings.URLSCAN_API_KEY},
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


async def _check_crtsh(domain: str) -> Dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(f"https://crt.sh/", params={"q": f"%.{domain}", "output": "json"})
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
            # Extract domain from email for additional checks
            domain = target.split("@")[-1] if "@" in target else None
            if domain:
                results["virustotal"] = await _check_virustotal("domain", domain)
                sources_checked.append("virustotal")
            if results["hibp"].get("status") == "breached":
                scoring_factors["in_breach_db"] = True
                scoring_factors["exposed_credentials"] = True

        elif body.target_type == "domain":
            results["virustotal"] = await _check_virustotal("domain", target)
            sources_checked.append("virustotal")
            results["urlscan"] = await _check_urlscan(target)
            sources_checked.append("urlscan")
            results["crtsh"] = await _check_crtsh(target)
            sources_checked.append("crt.sh")
            results["github"] = await _check_github_leaks(target)
            sources_checked.append("github")
            if results["virustotal"].get("malicious", 0) > 0:
                scoring_factors["virustotal_flagged"] = True
            if results["urlscan"].get("malicious_count", 0) > 0:
                scoring_factors["urlscan_phishing"] = True

        elif body.target_type == "ip":
            results["virustotal"] = await _check_virustotal("ip", target)
            sources_checked.append("virustotal")
            results["shodan"] = await _check_shodan(target)
            sources_checked.append("shodan")
            results["greynoise"] = await _check_greynoise(target)
            sources_checked.append("greynoise")
            if results["virustotal"].get("malicious", 0) > 0:
                scoring_factors["virustotal_flagged"] = True
            if results["shodan"].get("open_ports_count", 0) > 10:
                scoring_factors["exposed_credentials"] = True

        elif body.target_type == "url":
            results["virustotal"] = await _check_virustotal("url", target)
            sources_checked.append("virustotal")
            results["urlscan"] = await _check_urlscan(target)
            sources_checked.append("urlscan")
            if results["virustotal"].get("malicious", 0) > 0:
                scoring_factors["virustotal_flagged"] = True
            if results["urlscan"].get("malicious_count", 0) > 0:
                scoring_factors["urlscan_phishing"] = True

        elif body.target_type == "username":
            results["username"] = await _check_username(target)
            sources_checked.append("username_platforms")
            results["github"] = await _check_github_leaks(target)
            sources_checked.append("github")

        elif body.target_type == "phone":
            results["phone"] = await _check_phone(target)
            sources_checked.append("phone_check")

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
