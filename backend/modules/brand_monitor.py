import logging
import socket
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

from config import get_settings
from db import get_client
from utils.rate_limiter import RateLimiter
from utils.scoring import calculate_risk_score, severity_from_score
from utils.notify import dispatch_alert

logger = logging.getLogger(__name__)

_rate_limiter: Optional[RateLimiter] = None


def _get_rate_limiter() -> RateLimiter:
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


HOMOGLYPHS = {
    "a": ["@", "4", "\u00e0", "\u00e1", "\u00e2"],
    "e": ["3", "\u00e8", "\u00e9", "\u00ea"],
    "i": ["1", "!", "\u00ec", "\u00ed"],
    "l": ["1", "|", "\u2113"],
    "o": ["0", "\u00f2", "\u00f3", "\u00f4"],
    "s": ["$", "5", "\u015b"],
    "t": ["7", "+", "\u2020"],
}

COMMON_TLDS = [".com", ".net", ".org", ".io", ".co", ".info", ".biz", ".xyz", ".app", ".dev"]


def _extract_domain_parts(domain: str):
    """Extract domain name and TLD, with fallback if tldextract is unavailable."""
    try:
        import tldextract
        extracted = tldextract.extract(domain)
        name = extracted.domain
        tld = f".{extracted.suffix}" if extracted.suffix else ".com"
        return name, tld
    except ImportError:
        logger.debug("tldextract not available, falling back to simple split")
        parts = domain.rsplit(".", 1)
        if len(parts) == 2:
            return parts[0], f".{parts[1]}"
        return domain, ".com"


def generate_typosquats(domain: str) -> List[str]:
    """Generate typosquat domain variants.

    Includes: missing char, swap adjacent, double char, homoglyph,
    TLD swap, hyphen insertion, and pluralization. Capped at 50 variants.
    """
    name, tld = _extract_domain_parts(domain)
    variants = set()

    # Missing character
    for i in range(len(name)):
        variant = name[:i] + name[i + 1:]
        if variant:
            variants.add(variant + tld)

    # Swap adjacent characters
    for i in range(len(name) - 1):
        swapped = list(name)
        swapped[i], swapped[i + 1] = swapped[i + 1], swapped[i]
        variants.add("".join(swapped) + tld)

    # Double character
    for i in range(len(name)):
        variants.add(name[:i] + name[i] * 2 + name[i + 1:] + tld)

    # Homoglyph substitution
    for i, char in enumerate(name):
        if char.lower() in HOMOGLYPHS:
            for replacement in HOMOGLYPHS[char.lower()][:2]:
                variants.add(name[:i] + replacement + name[i + 1:] + tld)

    # TLD swap
    for alt_tld in COMMON_TLDS:
        if alt_tld != tld:
            variants.add(name + alt_tld)

    # Hyphen insertion
    for i in range(1, len(name)):
        variants.add(name[:i] + "-" + name[i:] + tld)

    # Pluralization
    variants.add(name + "s" + tld)

    # Remove the original domain itself
    variants.discard(domain)
    variants.discard(name + tld)

    return list(variants)[:50]


def _resolve_domain(domain: str) -> bool:
    """Check if a domain resolves via DNS.

    Uses dns.resolver if available, falls back to socket.getaddrinfo.
    """
    try:
        import dns.resolver
        answers = dns.resolver.resolve(domain, "A")
        return bool(answers)
    except ImportError:
        pass
    except Exception:
        pass

    # Fallback to socket.getaddrinfo
    try:
        results = socket.getaddrinfo(domain, None, socket.AF_INET, socket.SOCK_STREAM)
        return len(results) > 0
    except (socket.gaierror, socket.timeout, OSError):
        return False


async def check_urlscan(domain: str) -> Dict:
    """Search URLScan.io for a domain. Respects 2 req/sec limit."""
    settings = get_settings()
    if not settings.URLSCAN_API_KEY:
        logger.warning("URLSCAN_API_KEY not configured, skipping URLScan check")
        return {}

    rl = _get_rate_limiter()
    await rl.wait("urlscan", min_interval=2.0)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://urlscan.io/api/v1/search/",
                params={"q": f"domain:{domain}", "size": 5},
                headers={"API-Key": settings.URLSCAN_API_KEY},
            )
            if resp.status_code == 429:
                logger.warning("URLScan rate limited")
                return {}
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                is_phishing = any(
                    r.get("verdicts", {}).get("overall", {}).get("malicious", False)
                    for r in results
                )
                return {
                    "scanned": True,
                    "results_count": len(results),
                    "is_phishing": is_phishing,
                    "results": results[:3],
                }
    except httpx.TimeoutException:
        logger.warning(f"URLScan request timed out for {domain}")
    except Exception as e:
        logger.warning(f"URLScan check failed for {domain}: {e}")

    return {}


async def check_virustotal_domain(domain: str) -> Dict:
    """Check VirusTotal API v3 for domain analysis. Respects 4 req/min limit."""
    settings = get_settings()
    if not settings.VIRUSTOTAL_API_KEY:
        logger.warning("VIRUSTOTAL_API_KEY not configured, skipping VT check")
        return {}

    rl = _get_rate_limiter()
    await rl.wait("virustotal", min_interval=15.0)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"https://www.virustotal.com/api/v3/domains/{domain}",
                headers={"x-apikey": settings.VIRUSTOTAL_API_KEY},
            )
            if resp.status_code == 429:
                logger.warning("VirusTotal rate limited")
                return {}
            if resp.status_code == 200:
                data = resp.json().get("data", {}).get("attributes", {})
                stats = data.get("last_analysis_stats", {})
                malicious = stats.get("malicious", 0)
                return {
                    "scanned": True,
                    "malicious_count": malicious,
                    "flagged": malicious > 0,
                    "reputation": data.get("reputation", 0),
                    "categories": data.get("categories", {}),
                }
    except httpx.TimeoutException:
        logger.warning(f"VirusTotal request timed out for {domain}")
    except Exception as e:
        logger.warning(f"VT check failed for {domain}: {e}")

    return {}


async def run_brand_monitor(org_id: str) -> int:
    """Main brand monitoring orchestrator."""
    logger.info(f"Starting brand monitor for org {org_id}")
    client = get_client()

    job = client.table("scan_jobs").insert({
        "org_id": org_id,
        "module": "brand",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    job_id = job.data[0]["id"]

    findings_count = 0

    try:
        assets = (
            client.table("assets")
            .select("*")
            .eq("org_id", org_id)
            .eq("type", "domain")
            .eq("status", "active")
            .execute()
        )
        keyword_assets = (
            client.table("assets")
            .select("*")
            .eq("org_id", org_id)
            .eq("type", "keyword")
            .eq("status", "active")
            .execute()
        )
        brand_keywords = [a["value"].lower() for a in (keyword_assets.data or [])]

        for asset in (assets.data or []):
            domain = asset["value"]
            typosquats = generate_typosquats(domain)
            logger.info(f"Generated {len(typosquats)} typosquat variants for {domain}")

            for variant in typosquats[:20]:
                scoring_factors = {}  # type: Dict
                urlscan_result = {}  # type: Dict
                vt_result = {}  # type: Dict

                # Check if variant uses a brand keyword
                for kw in brand_keywords:
                    if kw in variant.lower():
                        scoring_factors["uses_brand_keyword"] = True
                        break

                # URLScan check
                try:
                    urlscan_result = await check_urlscan(variant)
                    if urlscan_result.get("is_phishing"):
                        scoring_factors["urlscan_phishing"] = True
                except Exception as e:
                    logger.warning(f"URLScan check failed for {variant}: {e}")

                # VirusTotal check
                try:
                    vt_result = await check_virustotal_domain(variant)
                    if vt_result.get("flagged"):
                        scoring_factors["virustotal_flagged"] = True
                except Exception as e:
                    logger.warning(f"VT check failed for {variant}: {e}")

                # DNS resolution -- not resolving should NOT skip domains with other signals
                try:
                    if _resolve_domain(variant):
                        scoring_factors["active_dns"] = True
                except Exception:
                    pass

                if not scoring_factors:
                    continue

                score = calculate_risk_score(scoring_factors)
                if score < 20:
                    continue

                severity = severity_from_score(score)
                alert_data = {
                    "org_id": org_id,
                    "asset_id": asset["id"],
                    "module": "brand",
                    "severity": severity,
                    "title": f"Suspicious typosquat domain detected: {variant}",
                    "description": (
                        f"Domain '{variant}' is a potential typosquat of '{domain}'. "
                        f"Risk score: {score}/100. "
                        f"Factors: {', '.join(scoring_factors.keys())}"
                    ),
                    "source_url": f"https://{variant}",
                    "raw_data": {
                        "variant": variant,
                        "original": domain,
                        "scoring_factors": scoring_factors,
                        "urlscan": urlscan_result if "urlscan_phishing" in scoring_factors else {},
                        "virustotal": vt_result if "virustotal_flagged" in scoring_factors else {},
                    },
                    "risk_score": score,
                    "status": "open",
                }
                client.table("alerts").insert(alert_data).execute()
                findings_count += 1

                try:
                    ns = (
                        client.table("notification_settings")
                        .select("*")
                        .eq("org_id", org_id)
                        .execute()
                    )
                    if ns.data:
                        await dispatch_alert(alert_data, ns.data[0])
                except Exception:
                    pass

        # Update last_scan_at
        try:
            client.table("assets").update({
                "last_scan_at": datetime.now(timezone.utc).isoformat(),
            }).eq("org_id", org_id).eq("type", "domain").execute()
        except Exception as e:
            logger.warning(f"Failed to update asset last_scan_at: {e}")

        client.table("scan_jobs").update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "findings_count": findings_count,
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.error(f"Brand monitor failed: {e}")
        client.table("scan_jobs").update({
            "status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "error": str(e)[:500],
        }).eq("id", job_id).execute()

    logger.info(f"Brand monitor complete for org {org_id}: {findings_count} findings")
    return findings_count
