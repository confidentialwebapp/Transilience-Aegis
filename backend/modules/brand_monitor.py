import logging
from datetime import datetime
from itertools import product as iter_product

import httpx
import tldextract

from config import get_settings
from db import get_client
from utils.rate_limiter import RateLimiter
from utils.scoring import calculate_risk_score, severity_from_score
from utils.notify import dispatch_alert

logger = logging.getLogger(__name__)
settings = get_settings()
rate_limiter = RateLimiter()

HOMOGLYPHS = {
    "a": ["@", "4", "à", "á", "â"],
    "e": ["3", "è", "é", "ê"],
    "i": ["1", "!", "ì", "í"],
    "l": ["1", "|", "ℓ"],
    "o": ["0", "ò", "ó", "ô"],
    "s": ["$", "5", "ś"],
    "t": ["7", "+", "†"],
}

COMMON_TLDS = [".com", ".net", ".org", ".io", ".co", ".info", ".biz", ".xyz", ".app", ".dev"]


def generate_typosquats(domain: str) -> list[str]:
    extracted = tldextract.extract(domain)
    name = extracted.domain
    tld = f".{extracted.suffix}" if extracted.suffix else ".com"
    variants = set()

    # Missing character
    for i in range(len(name)):
        variants.add(name[:i] + name[i + 1:] + tld)

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

    # Remove the original domain
    variants.discard(domain)
    variants.discard(name + tld)

    return list(variants)[:100]  # Cap at 100 variants


async def check_urlscan(domain: str) -> dict:
    if not settings.URLSCAN_API_KEY:
        return {}

    await rate_limiter.wait("urlscan", min_interval=2.0)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://urlscan.io/api/v1/search/",
            params={"q": f"domain:{domain}", "size": 5},
            headers={"API-Key": settings.URLSCAN_API_KEY},
            timeout=30,
        )
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
    return {}


async def check_virustotal_domain(domain: str) -> dict:
    if not settings.VIRUSTOTAL_API_KEY:
        return {}

    await rate_limiter.wait("virustotal", min_interval=15.0)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://www.virustotal.com/api/v3/domains/{domain}",
            headers={"x-apikey": settings.VIRUSTOTAL_API_KEY},
            timeout=30,
        )
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
    return {}


async def run_brand_monitor(org_id: str):
    logger.info(f"Starting brand monitor for org {org_id}")
    client = get_client()

    job = client.table("scan_jobs").insert({
        "org_id": org_id,
        "module": "brand",
        "status": "running",
        "started_at": datetime.utcnow().isoformat(),
    }).execute()
    job_id = job.data[0]["id"]

    findings_count = 0

    try:
        assets = client.table("assets").select("*").eq("org_id", org_id).eq("type", "domain").eq("status", "active").execute()
        keyword_assets = client.table("assets").select("*").eq("org_id", org_id).eq("type", "keyword").eq("status", "active").execute()
        brand_keywords = [a["value"].lower() for a in keyword_assets.data]

        for asset in assets.data:
            domain = asset["value"]
            typosquats = generate_typosquats(domain)
            logger.info(f"Generated {len(typosquats)} typosquat variants for {domain}")

            for variant in typosquats[:20]:  # Limit checks to avoid rate limits
                scoring_factors = {}

                # Check if uses brand keyword
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

                # DNS check - if domain resolves, it's active
                try:
                    import dns.resolver
                    answers = dns.resolver.resolve(variant, "A")
                    if answers:
                        scoring_factors["active_dns"] = True
                except Exception:
                    continue  # Domain doesn't resolve, skip

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
                    ns = client.table("notification_settings").select("*").eq("org_id", org_id).execute()
                    if ns.data:
                        await dispatch_alert(alert_data, ns.data[0])
                except Exception:
                    pass

        client.table("scan_jobs").update({
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat(),
            "findings_count": findings_count,
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.error(f"Brand monitor failed: {e}")
        client.table("scan_jobs").update({
            "status": "failed",
            "completed_at": datetime.utcnow().isoformat(),
            "error": str(e),
        }).eq("id", job_id).execute()

    logger.info(f"Brand monitor complete for org {org_id}: {findings_count} findings")
    return findings_count
