import logging
from datetime import datetime

import httpx

from config import get_settings
from db import get_client
from utils.rate_limiter import RateLimiter
from utils.scoring import calculate_risk_score, severity_from_score
from utils.notify import dispatch_alert

logger = logging.getLogger(__name__)
settings = get_settings()
rate_limiter = RateLimiter()


async def check_hibp(email: str) -> list[dict]:
    if not settings.HIBP_API_KEY:
        return []

    await rate_limiter.wait("hibp", min_interval=1.5)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://haveibeenpwned.com/api/v3/breachedaccount/{email}",
            headers={
                "hibp-api-key": settings.HIBP_API_KEY,
                "user-agent": "TAI-AEGIS-ThreatIntel",
            },
            params={"truncateResponse": "false"},
            timeout=30,
        )
        if resp.status_code == 200:
            return resp.json()
        elif resp.status_code == 404:
            return []
        else:
            logger.warning(f"HIBP returned {resp.status_code} for {email}")
            return []


async def scan_github_leaks(query: str) -> list[dict]:
    if not settings.GITHUB_PAT:
        return []

    await rate_limiter.wait("github", min_interval=2.0)
    findings = []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/search/code",
            headers={
                "Authorization": f"Bearer {settings.GITHUB_PAT}",
                "Accept": "application/vnd.github.v3+json",
            },
            params={"q": query, "per_page": 30},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            for item in data.get("items", []):
                findings.append({
                    "repo": item.get("repository", {}).get("full_name", ""),
                    "path": item.get("path", ""),
                    "url": item.get("html_url", ""),
                    "score": item.get("score", 0),
                })
    return findings


async def scan_pastebin(keywords: list[str]) -> list[dict]:
    findings = []
    await rate_limiter.wait("pastebin", min_interval=60.0)
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://scrape.pastebin.com/api_scraping.php",
                params={"limit": 50},
                timeout=30,
            )
            if resp.status_code == 200:
                pastes = resp.json()
                for paste in pastes:
                    paste_key = paste.get("key", "")
                    title = paste.get("title", "").lower()
                    for kw in keywords:
                        if kw.lower() in title:
                            findings.append({
                                "source": "pastebin",
                                "title": paste.get("title"),
                                "url": f"https://pastebin.com/{paste_key}",
                                "date": paste.get("date"),
                                "keyword_match": kw,
                            })
        except Exception as e:
            logger.warning(f"Pastebin scrape failed: {e}")
    return findings


async def search_intelx(query: str) -> list[dict]:
    if not settings.INTELX_API_KEY:
        return []

    await rate_limiter.wait("intelx", min_interval=2.0)
    findings = []
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                "https://2.intelx.io/intelligent/search",
                headers={"x-key": settings.INTELX_API_KEY},
                json={"term": query, "maxresults": 10, "media": 0, "timeout": 5},
                timeout=30,
            )
            if resp.status_code == 200:
                data = resp.json()
                search_id = data.get("id")
                if search_id:
                    await rate_limiter.wait("intelx", min_interval=2.0)
                    results_resp = await client.get(
                        f"https://2.intelx.io/intelligent/search/result",
                        params={"id": search_id},
                        headers={"x-key": settings.INTELX_API_KEY},
                        timeout=30,
                    )
                    if results_resp.status_code == 200:
                        for record in results_resp.json().get("records", []):
                            findings.append({
                                "source": "intelx",
                                "name": record.get("name", ""),
                                "type": record.get("type", ""),
                                "date": record.get("date", ""),
                                "bucket": record.get("bucket", ""),
                            })
        except Exception as e:
            logger.warning(f"IntelX search failed: {e}")
    return findings


async def _create_alert(client, org_id: str, asset_id: str, title: str, description: str, source_url: str, raw_data: dict, module: str = "dark_web"):
    score = calculate_risk_score(raw_data.get("scoring_factors", {}))
    severity = severity_from_score(score)

    alert_data = {
        "org_id": org_id,
        "asset_id": asset_id,
        "module": module,
        "severity": severity,
        "title": title,
        "description": description,
        "source_url": source_url,
        "raw_data": raw_data,
        "risk_score": score,
        "status": "open",
    }
    result = client.table("alerts").insert(alert_data).execute()

    # Try to send notifications
    try:
        ns_result = client.table("notification_settings").select("*").eq("org_id", org_id).execute()
        if ns_result.data:
            await dispatch_alert(alert_data, ns_result.data[0])
    except Exception as e:
        logger.warning(f"Notification dispatch failed: {e}")

    return result.data[0] if result.data else None


async def run_dark_web_scan(org_id: str):
    logger.info(f"Starting dark web scan for org {org_id}")
    client = get_client()

    job = client.table("scan_jobs").insert({
        "org_id": org_id,
        "module": "dark_web",
        "status": "running",
        "started_at": datetime.utcnow().isoformat(),
    }).execute()
    job_id = job.data[0]["id"]

    findings_count = 0

    try:
        # Get org assets
        assets = client.table("assets").select("*").eq("org_id", org_id).eq("status", "active").execute()

        email_assets = [a for a in assets.data if a["type"] == "email"]
        domain_assets = [a for a in assets.data if a["type"] == "domain"]
        keyword_assets = [a for a in assets.data if a["type"] == "keyword"]

        # HIBP breach check for emails
        for asset in email_assets:
            try:
                breaches = await check_hibp(asset["value"])
                for breach in breaches:
                    await _create_alert(
                        client, org_id, asset["id"],
                        f"Email found in data breach: {breach.get('Name', 'Unknown')}",
                        f"{asset['value']} was found in the {breach.get('Name')} breach "
                        f"({breach.get('BreachDate', 'unknown date')}). "
                        f"Compromised data: {', '.join(breach.get('DataClasses', []))}",
                        f"https://haveibeenpwned.com/api/v3/breach/{breach.get('Name')}",
                        {"breach": breach, "scoring_factors": {"in_breach_db": True, "exposed_credentials": True}},
                    )
                    findings_count += 1
            except Exception as e:
                logger.error(f"HIBP check failed for {asset['value']}: {e}")

        # GitHub leak scan for domains and keywords
        search_terms = [a["value"] for a in domain_assets] + [a["value"] for a in keyword_assets]
        for term in search_terms[:5]:  # Limit to avoid rate limits
            try:
                leaks = await scan_github_leaks(f'"{term}" password OR secret OR api_key OR token')
                for leak in leaks[:10]:
                    asset_id = domain_assets[0]["id"] if domain_assets else None
                    await _create_alert(
                        client, org_id, asset_id,
                        f"Potential secret leak found on GitHub: {leak['repo']}",
                        f"Code matching '{term}' with sensitive keywords found in {leak['repo']}/{leak['path']}",
                        leak["url"],
                        {"github_leak": leak, "scoring_factors": {"exposed_credentials": True}},
                    )
                    findings_count += 1
            except Exception as e:
                logger.error(f"GitHub scan failed for '{term}': {e}")

        # Pastebin monitoring
        all_keywords = [a["value"] for a in domain_assets + keyword_assets + email_assets]
        if all_keywords:
            try:
                paste_findings = await scan_pastebin(all_keywords)
                for pf in paste_findings:
                    await _create_alert(
                        client, org_id, None,
                        f"Keyword found on Pastebin: {pf['keyword_match']}",
                        f"Paste titled '{pf['title']}' contains keyword '{pf['keyword_match']}'",
                        pf["url"],
                        {"paste": pf, "scoring_factors": {"in_breach_db": True}},
                    )
                    findings_count += 1
            except Exception as e:
                logger.error(f"Pastebin scan failed: {e}")

        # IntelX search
        for term in search_terms[:3]:
            try:
                intelx_results = await search_intelx(term)
                for result in intelx_results[:5]:
                    await _create_alert(
                        client, org_id, None,
                        f"Dark web mention found: {result.get('name', term)}",
                        f"IntelX found mention of '{term}' in {result.get('bucket', 'unknown source')}",
                        "",
                        {"intelx": result, "scoring_factors": {"in_breach_db": True}},
                    )
                    findings_count += 1
            except Exception as e:
                logger.error(f"IntelX scan failed for '{term}': {e}")

        # Update job
        client.table("scan_jobs").update({
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat(),
            "findings_count": findings_count,
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.error(f"Dark web scan failed: {e}")
        client.table("scan_jobs").update({
            "status": "failed",
            "completed_at": datetime.utcnow().isoformat(),
            "error": str(e),
        }).eq("id", job_id).execute()

    # Update last_scan_at on assets
    client.table("assets").update({
        "last_scan_at": datetime.utcnow().isoformat(),
    }).eq("org_id", org_id).in_("type", ["email", "domain", "keyword"]).execute()

    logger.info(f"Dark web scan complete for org {org_id}: {findings_count} findings")
    return findings_count
