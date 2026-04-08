import logging
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


async def check_hibp(email: str) -> List[Dict]:
    """Check Have I Been Pwned for breaches associated with an email.

    Handles HIBP v3 rate limits (1 request per 1.5s) and treats 404 as no breach.
    """
    settings = get_settings()
    if not settings.HIBP_API_KEY:
        logger.warning("HIBP_API_KEY not configured, skipping HIBP check")
        return []

    rl = _get_rate_limiter()
    await rl.wait("hibp", min_interval=1.5)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"https://haveibeenpwned.com/api/v3/breachedaccount/{email}",
                headers={
                    "hibp-api-key": settings.HIBP_API_KEY,
                    "user-agent": "TAI-AEGIS-ThreatIntel",
                },
                params={"truncateResponse": "false"},
            )
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 404:
                return []
            elif resp.status_code == 429:
                logger.warning(f"HIBP rate limited for {email}, retry later")
                return []
            else:
                logger.warning(f"HIBP returned {resp.status_code} for {email}")
                return []
    except httpx.TimeoutException:
        logger.warning(f"HIBP request timed out for {email}")
        return []
    except Exception as e:
        logger.error(f"HIBP check failed for {email}: {e}")
        return []


async def scan_github_leaks(query: str) -> List[Dict]:
    """Search GitHub Code Search API for leaked secrets.

    Handles pagination and rate limits (30 requests/min).
    """
    settings = get_settings()
    if not settings.GITHUB_PAT:
        logger.warning("GITHUB_PAT not configured, skipping GitHub leak scan")
        return []

    rl = _get_rate_limiter()
    findings = []

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            page = 1
            max_pages = 3  # Cap pagination to avoid rate limit exhaustion

            while page <= max_pages:
                await rl.wait("github", min_interval=2.0)

                resp = await client.get(
                    "https://api.github.com/search/code",
                    headers={
                        "Authorization": f"Bearer {settings.GITHUB_PAT}",
                        "Accept": "application/vnd.github.v3+json",
                    },
                    params={"q": query, "per_page": 30, "page": page},
                )

                if resp.status_code == 403:
                    logger.warning("GitHub API rate limit hit, stopping pagination")
                    break
                elif resp.status_code == 422:
                    logger.warning(f"GitHub search query rejected: {query[:100]}")
                    break
                elif resp.status_code != 200:
                    logger.warning(f"GitHub search returned {resp.status_code}")
                    break

                data = resp.json()
                items = data.get("items", [])
                for item in items:
                    findings.append({
                        "repo": item.get("repository", {}).get("full_name", ""),
                        "path": item.get("path", ""),
                        "url": item.get("html_url", ""),
                        "score": item.get("score", 0),
                    })

                # Check if there are more pages
                if len(items) < 30:
                    break
                page += 1

    except httpx.TimeoutException:
        logger.warning("GitHub search request timed out")
    except Exception as e:
        logger.error(f"GitHub leak scan failed: {e}")

    return findings


async def scan_pastebin(keywords: List[str]) -> List[Dict]:
    """Scrape Pastebin API for pastes matching keywords.

    Handles the 1 request/min rate limit. Fails gracefully if API is unavailable.
    """
    rl = _get_rate_limiter()
    findings = []

    try:
        await rl.wait("pastebin", min_interval=60.0)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://scrape.pastebin.com/api_scraping.php",
                params={"limit": 50},
            )
            if resp.status_code != 200:
                logger.warning(f"Pastebin API returned {resp.status_code}")
                return []

            try:
                pastes = resp.json()
            except Exception:
                logger.warning("Pastebin response was not valid JSON")
                return []

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
                        break  # One match per paste is enough
    except httpx.TimeoutException:
        logger.warning("Pastebin request timed out")
    except Exception as e:
        logger.warning(f"Pastebin scrape failed: {e}")

    return findings


async def search_intelx(query: str) -> List[Dict]:
    """Search IntelX free API using the 2-step search-then-results flow.

    Handles timeouts gracefully.
    """
    settings = get_settings()
    if not settings.INTELX_API_KEY:
        logger.warning("INTELX_API_KEY not configured, skipping IntelX search")
        return []

    rl = _get_rate_limiter()
    findings = []

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Step 1: Submit search
            await rl.wait("intelx", min_interval=2.0)
            resp = await client.post(
                "https://2.intelx.io/intelligent/search",
                headers={"x-key": settings.INTELX_API_KEY},
                json={"term": query, "maxresults": 10, "media": 0, "timeout": 5},
            )
            if resp.status_code != 200:
                logger.warning(f"IntelX search returned {resp.status_code}")
                return []

            data = resp.json()
            search_id = data.get("id")
            if not search_id:
                return []

            # Step 2: Fetch results
            await rl.wait("intelx", min_interval=2.0)
            results_resp = await client.get(
                "https://2.intelx.io/intelligent/search/result",
                params={"id": search_id},
                headers={"x-key": settings.INTELX_API_KEY},
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
    except httpx.TimeoutException:
        logger.warning(f"IntelX request timed out for query: {query[:100]}")
    except Exception as e:
        logger.warning(f"IntelX search failed: {e}")

    return findings


async def _create_alert(
    client,
    org_id: str,
    asset_id: Optional[str],
    title: str,
    description: str,
    source_url: str,
    raw_data: Dict,
    module: str = "dark_web",
) -> Optional[Dict]:
    """Create an alert record and dispatch notifications."""
    score = calculate_risk_score(raw_data.get("scoring_factors", {}))
    severity = severity_from_score(score)

    alert_data = {
        "org_id": org_id,
        "asset_id": asset_id,
        "module": module,
        "severity": severity,
        "title": title[:500],
        "description": description[:2000],
        "source_url": source_url[:1000],
        "raw_data": raw_data,
        "risk_score": score,
        "status": "open",
    }
    result = client.table("alerts").insert(alert_data).execute()

    # Try to send notifications -- never let this break the scan
    try:
        ns_result = (
            client.table("notification_settings")
            .select("*")
            .eq("org_id", org_id)
            .execute()
        )
        if ns_result.data:
            await dispatch_alert(alert_data, ns_result.data[0])
    except Exception as e:
        logger.warning(f"Notification dispatch failed: {e}")

    return result.data[0] if result.data else None


async def run_dark_web_scan(org_id: str) -> int:
    """Main dark web scan orchestrator.

    Creates a scan_job, runs all sub-scans with independent error handling,
    creates alert records for findings, and updates job status.
    """
    logger.info(f"Starting dark web scan for org {org_id}")
    client = get_client()

    # Create scan job
    job = client.table("scan_jobs").insert({
        "org_id": org_id,
        "module": "dark_web",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    job_id = job.data[0]["id"]

    findings_count = 0

    try:
        # Fetch active assets
        assets = (
            client.table("assets")
            .select("*")
            .eq("org_id", org_id)
            .eq("status", "active")
            .execute()
        )

        email_assets = [a for a in assets.data if a["type"] == "email"]
        domain_assets = [a for a in assets.data if a["type"] == "domain"]
        keyword_assets = [a for a in assets.data if a["type"] == "keyword"]

        # --- HIBP breach check for emails ---
        for asset in email_assets:
            try:
                breaches = await check_hibp(asset["value"])
                for breach in breaches:
                    await _create_alert(
                        client,
                        org_id,
                        asset["id"],
                        f"Email found in data breach: {breach.get('Name', 'Unknown')}",
                        (
                            f"{asset['value']} was found in the {breach.get('Name')} breach "
                            f"({breach.get('BreachDate', 'unknown date')}). "
                            f"Compromised data: {', '.join(breach.get('DataClasses', []))}"
                        ),
                        f"https://haveibeenpwned.com/api/v3/breach/{breach.get('Name')}",
                        {
                            "breach": breach,
                            "scoring_factors": {
                                "in_breach_db": True,
                                "exposed_credentials": "Passwords" in breach.get("DataClasses", []),
                            },
                        },
                    )
                    findings_count += 1
            except Exception as e:
                logger.error(f"HIBP check failed for {asset['value']}: {e}")

        # --- GitHub leak scan for domains and keywords ---
        search_terms = [a["value"] for a in domain_assets] + [a["value"] for a in keyword_assets]
        for term in search_terms[:5]:
            try:
                leaks = await scan_github_leaks(
                    f'"{term}" password OR secret OR api_key OR token'
                )
                for leak in leaks[:10]:
                    asset_id = domain_assets[0]["id"] if domain_assets else None
                    await _create_alert(
                        client,
                        org_id,
                        asset_id,
                        f"Potential secret leak found on GitHub: {leak['repo']}",
                        f"Code matching '{term}' with sensitive keywords found in {leak['repo']}/{leak['path']}",
                        leak["url"],
                        {"github_leak": leak, "scoring_factors": {"exposed_credentials": True}},
                    )
                    findings_count += 1
            except Exception as e:
                logger.error(f"GitHub scan failed for '{term}': {e}")

        # --- Pastebin monitoring ---
        all_keywords = [a["value"] for a in domain_assets + keyword_assets + email_assets]
        if all_keywords:
            try:
                paste_findings = await scan_pastebin(all_keywords)
                for pf in paste_findings:
                    await _create_alert(
                        client,
                        org_id,
                        None,
                        f"Keyword found on Pastebin: {pf['keyword_match']}",
                        f"Paste titled '{pf['title']}' contains keyword '{pf['keyword_match']}'",
                        pf["url"],
                        {"paste": pf, "scoring_factors": {"in_breach_db": True}},
                    )
                    findings_count += 1
            except Exception as e:
                logger.error(f"Pastebin scan failed: {e}")

        # --- IntelX search ---
        for term in search_terms[:3]:
            try:
                intelx_results = await search_intelx(term)
                for result in intelx_results[:5]:
                    await _create_alert(
                        client,
                        org_id,
                        None,
                        f"Dark web mention found: {result.get('name', term)}",
                        f"IntelX found mention of '{term}' in {result.get('bucket', 'unknown source')}",
                        "",
                        {"intelx": result, "scoring_factors": {"in_breach_db": True}},
                    )
                    findings_count += 1
            except Exception as e:
                logger.error(f"IntelX scan failed for '{term}': {e}")

        # Mark job completed
        client.table("scan_jobs").update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "findings_count": findings_count,
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.error(f"Dark web scan failed: {e}")
        client.table("scan_jobs").update({
            "status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "error": str(e)[:500],
        }).eq("id", job_id).execute()

    # Update last_scan_at on scanned assets
    try:
        client.table("assets").update({
            "last_scan_at": datetime.now(timezone.utc).isoformat(),
        }).eq("org_id", org_id).in_("type", ["email", "domain", "keyword"]).execute()
    except Exception as e:
        logger.warning(f"Failed to update asset last_scan_at: {e}")

    logger.info(f"Dark web scan complete for org {org_id}: {findings_count} findings")
    return findings_count
