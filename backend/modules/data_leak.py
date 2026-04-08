import re
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

REGEX_PATTERNS = {
    "aws_access_key": r"AKIA[0-9A-Z]{16}",
    "aws_secret_key": r"(?i)aws(.{0,20})?['\"][0-9a-zA-Z/+]{40}['\"]",
    "gcp_service_account": r"\"type\"\s*:\s*\"service_account\"",
    "gcp_api_key": r"AIza[0-9A-Za-z\-_]{35}",
    "slack_token": r"xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*",
    "slack_webhook": r"https://hooks\.slack\.com/services/T[a-zA-Z0-9_]{8,}/B[a-zA-Z0-9_]{8,}/[a-zA-Z0-9_]{24}",
    "stripe_secret": r"sk_live_[0-9a-zA-Z]{24,}",
    "stripe_publishable": r"pk_live_[0-9a-zA-Z]{24,}",
    "github_token": r"gh[pousr]_[A-Za-z0-9_]{36,}",
    "github_pat": r"github_pat_[A-Za-z0-9_]{22,}",
    "generic_api_key": r"(?i)(api[_-]?key|apikey|api_secret)\s*[=:]\s*['\"]?[A-Za-z0-9\-_]{20,}['\"]?",
    "generic_password": r"(?i)(password|passwd|pwd)\s*[=:]\s*['\"]?[^\s'\"]{8,}['\"]?",
    "private_key": r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
    "credit_card": r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b",
    "jwt_token": r"eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+",
}


def scan_text_for_secrets(text: str) -> list[dict]:
    findings = []
    for pattern_name, pattern in REGEX_PATTERNS.items():
        matches = re.findall(pattern, text[:50000])  # Cap text size
        if matches:
            findings.append({
                "pattern": pattern_name,
                "match_count": len(matches),
                "sample": str(matches[0])[:50] + "..." if matches else "",
            })
    return findings


async def scan_github_code(query: str) -> list[dict]:
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
            params={"q": query, "per_page": 20},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            for item in data.get("items", []):
                # Fetch file content to scan for patterns
                content_url = item.get("url", "")
                if content_url:
                    await rate_limiter.wait("github", min_interval=1.0)
                    content_resp = await client.get(
                        content_url,
                        headers={
                            "Authorization": f"Bearer {settings.GITHUB_PAT}",
                            "Accept": "application/vnd.github.v3.raw",
                        },
                        timeout=30,
                    )
                    if content_resp.status_code == 200:
                        secrets = scan_text_for_secrets(content_resp.text)
                        if secrets:
                            findings.append({
                                "repo": item.get("repository", {}).get("full_name", ""),
                                "path": item.get("path", ""),
                                "url": item.get("html_url", ""),
                                "secrets_found": secrets,
                            })
    return findings


async def scan_pastes(keywords: list[str]) -> list[dict]:
    await rate_limiter.wait("pastebin", min_interval=60.0)
    findings = []
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://scrape.pastebin.com/api_scraping.php",
                params={"limit": 100},
                timeout=30,
            )
            if resp.status_code == 200:
                pastes = resp.json()
                for paste in pastes:
                    key = paste.get("key", "")
                    # Fetch paste content
                    await rate_limiter.wait("pastebin", min_interval=1.0)
                    content_resp = await client.get(
                        f"https://scrape.pastebin.com/api_scrape_item.php?i={key}",
                        timeout=30,
                    )
                    if content_resp.status_code == 200:
                        content = content_resp.text
                        # Check for keywords
                        keyword_matches = [kw for kw in keywords if kw.lower() in content.lower()]
                        if keyword_matches:
                            secrets = scan_text_for_secrets(content)
                            findings.append({
                                "source": "pastebin",
                                "key": key,
                                "url": f"https://pastebin.com/{key}",
                                "title": paste.get("title", ""),
                                "keyword_matches": keyword_matches,
                                "secrets_found": secrets,
                            })
        except Exception as e:
            logger.warning(f"Paste scan failed: {e}")
    return findings


async def run_data_leak_scan(org_id: str):
    logger.info(f"Starting data leak scan for org {org_id}")
    client = get_client()

    job = client.table("scan_jobs").insert({
        "org_id": org_id,
        "module": "data_leak",
        "status": "running",
        "started_at": datetime.utcnow().isoformat(),
    }).execute()
    job_id = job.data[0]["id"]

    findings_count = 0

    try:
        assets = client.table("assets").select("*").eq("org_id", org_id).eq("status", "active").execute()
        domains = [a["value"] for a in assets.data if a["type"] == "domain"]
        keywords = [a["value"] for a in assets.data if a["type"] == "keyword"]
        github_orgs = [a["value"] for a in assets.data if a["type"] == "github_org"]
        all_search_terms = domains + keywords

        # GitHub code scanning
        for term in (domains + github_orgs)[:5]:
            try:
                github_findings = await scan_github_code(f'"{term}" password OR secret OR api_key OR token OR credential')
                for finding in github_findings:
                    score = calculate_risk_score({"exposed_credentials": True})
                    severity = severity_from_score(score)
                    alert_data = {
                        "org_id": org_id,
                        "module": "data_leak",
                        "severity": severity,
                        "title": f"Secrets leaked in GitHub repo: {finding['repo']}",
                        "description": (
                            f"Found {len(finding['secrets_found'])} secret pattern(s) in "
                            f"{finding['repo']}/{finding['path']}: "
                            f"{', '.join(s['pattern'] for s in finding['secrets_found'])}"
                        ),
                        "source_url": finding["url"],
                        "raw_data": finding,
                        "risk_score": score,
                        "status": "open",
                    }
                    client.table("alerts").insert(alert_data).execute()
                    findings_count += 1
            except Exception as e:
                logger.error(f"GitHub code scan failed for '{term}': {e}")

        # Paste site scanning
        if all_search_terms:
            try:
                paste_findings = await scan_pastes(all_search_terms)
                for finding in paste_findings:
                    has_secrets = bool(finding.get("secrets_found"))
                    score = calculate_risk_score({
                        "exposed_credentials": has_secrets,
                        "in_breach_db": True,
                    })
                    severity = severity_from_score(score)
                    alert_data = {
                        "org_id": org_id,
                        "module": "data_leak",
                        "severity": severity,
                        "title": f"Data leak found on Pastebin: {finding.get('title', 'Untitled')}",
                        "description": (
                            f"Keywords matched: {', '.join(finding['keyword_matches'])}. "
                            f"Secrets detected: {len(finding.get('secrets_found', []))}"
                        ),
                        "source_url": finding["url"],
                        "raw_data": finding,
                        "risk_score": score,
                        "status": "open",
                    }
                    client.table("alerts").insert(alert_data).execute()
                    findings_count += 1
            except Exception as e:
                logger.error(f"Paste scan failed: {e}")

        client.table("scan_jobs").update({
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat(),
            "findings_count": findings_count,
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.error(f"Data leak scan failed: {e}")
        client.table("scan_jobs").update({
            "status": "failed",
            "completed_at": datetime.utcnow().isoformat(),
            "error": str(e),
        }).eq("id", job_id).execute()

    logger.info(f"Data leak scan complete for org {org_id}: {findings_count} findings")
    return findings_count
