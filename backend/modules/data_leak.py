import re
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


# ---------------------------------------------------------------------------
# Pre-compiled regex patterns for secret detection
# ---------------------------------------------------------------------------

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

# Pre-compile all patterns once at module load for performance
_COMPILED_PATTERNS: Dict[str, "re.Pattern[str]"] = {}
for _name, _pattern in REGEX_PATTERNS.items():
    try:
        _COMPILED_PATTERNS[_name] = re.compile(_pattern)
    except re.error as e:
        logger.error(f"Failed to compile regex pattern '{_name}': {e}")

# Max text size to scan (100 KB) to prevent memory issues
_MAX_TEXT_SIZE = 102400


def scan_text_for_secrets(text: str) -> List[Dict]:
    """Scan text for secret patterns using pre-compiled regexes.

    Caps input text to 100 KB to prevent memory issues.
    """
    truncated = text[:_MAX_TEXT_SIZE]
    findings = []
    for pattern_name, compiled in _COMPILED_PATTERNS.items():
        matches = compiled.findall(truncated)
        if matches:
            sample = str(matches[0])[:50]
            findings.append({
                "pattern": pattern_name,
                "match_count": len(matches),
                "sample": sample + "..." if len(str(matches[0])) > 50 else sample,
            })
    return findings


async def scan_github_code(query: str) -> List[Dict]:
    """Search GitHub Code Search API and fetch file contents to scan for secrets.

    Handles rate limits (30 requests/min for search, additional for content).
    """
    settings = get_settings()
    if not settings.GITHUB_PAT:
        logger.warning("GITHUB_PAT not configured, skipping GitHub code scan")
        return []

    rl = _get_rate_limiter()
    findings = []

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            await rl.wait("github", min_interval=2.0)
            resp = await client.get(
                "https://api.github.com/search/code",
                headers={
                    "Authorization": f"Bearer {settings.GITHUB_PAT}",
                    "Accept": "application/vnd.github.v3+json",
                },
                params={"q": query, "per_page": 20},
            )

            if resp.status_code == 403:
                logger.warning("GitHub API rate limit hit during code search")
                return []
            if resp.status_code == 422:
                logger.warning(f"GitHub search query rejected: {query[:100]}")
                return []
            if resp.status_code != 200:
                logger.warning(f"GitHub code search returned {resp.status_code}")
                return []

            data = resp.json()
            for item in data.get("items", [])[:15]:
                content_url = item.get("url", "")
                if not content_url:
                    continue

                try:
                    await rl.wait("github", min_interval=1.0)
                    content_resp = await client.get(
                        content_url,
                        headers={
                            "Authorization": f"Bearer {settings.GITHUB_PAT}",
                            "Accept": "application/vnd.github.v3.raw",
                        },
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
                except httpx.TimeoutException:
                    logger.warning(f"Timeout fetching content from {content_url[:100]}")
                except Exception as e:
                    logger.warning(f"Failed to fetch file content: {e}")

    except httpx.TimeoutException:
        logger.warning("GitHub code search request timed out")
    except Exception as e:
        logger.error(f"GitHub code scan failed: {e}")

    return findings


async def scan_pastes(keywords: List[str]) -> List[Dict]:
    """Scan Pastebin scrape API for pastes matching keywords.

    Respects the 1 request/min rate limit for listing, 1 req/sec for content.
    """
    rl = _get_rate_limiter()
    findings = []

    try:
        await rl.wait("pastebin", min_interval=60.0)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://scrape.pastebin.com/api_scraping.php",
                params={"limit": 100},
            )
            if resp.status_code != 200:
                logger.warning(f"Pastebin API returned {resp.status_code}")
                return []

            try:
                pastes = resp.json()
            except Exception:
                logger.warning("Pastebin response was not valid JSON")
                return []

            for paste in pastes[:50]:
                key = paste.get("key", "")
                if not key:
                    continue

                try:
                    await rl.wait("pastebin_content", min_interval=1.0)
                    content_resp = await client.get(
                        f"https://scrape.pastebin.com/api_scrape_item.php?i={key}",
                    )
                    if content_resp.status_code != 200:
                        continue

                    content = content_resp.text[:_MAX_TEXT_SIZE]
                    keyword_matches = [
                        kw for kw in keywords if kw.lower() in content.lower()
                    ]
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
                except httpx.TimeoutException:
                    logger.warning(f"Timeout fetching paste {key}")
                except Exception as e:
                    logger.warning(f"Failed to fetch paste {key}: {e}")

    except httpx.TimeoutException:
        logger.warning("Pastebin listing request timed out")
    except Exception as e:
        logger.warning(f"Paste scan failed: {e}")

    return findings


async def run_data_leak_scan(org_id: str) -> int:
    """Main data leak scan orchestrator."""
    logger.info(f"Starting data leak scan for org {org_id}")
    client = get_client()

    job = client.table("scan_jobs").insert({
        "org_id": org_id,
        "module": "data_leak",
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
            .eq("status", "active")
            .execute()
        )
        domains = [a["value"] for a in assets.data if a["type"] == "domain"]
        keywords = [a["value"] for a in assets.data if a["type"] == "keyword"]
        github_orgs = [a["value"] for a in assets.data if a["type"] == "github_org"]
        all_search_terms = domains + keywords

        # --- GitHub code scanning ---
        for term in (domains + github_orgs)[:5]:
            try:
                github_findings = await scan_github_code(
                    f'"{term}" password OR secret OR api_key OR token OR credential'
                )
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

            except Exception as e:
                logger.error(f"GitHub code scan failed for '{term}': {e}")

        # --- Paste site scanning ---
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

        # Update last_scan_at
        try:
            client.table("assets").update({
                "last_scan_at": datetime.now(timezone.utc).isoformat(),
            }).eq("org_id", org_id).in_("type", ["domain", "keyword", "github_org"]).execute()
        except Exception as e:
            logger.warning(f"Failed to update asset last_scan_at: {e}")

        client.table("scan_jobs").update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "findings_count": findings_count,
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.error(f"Data leak scan failed: {e}")
        client.table("scan_jobs").update({
            "status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "error": str(e)[:500],
        }).eq("id", job_id).execute()

    logger.info(f"Data leak scan complete for org {org_id}: {findings_count} findings")
    return findings_count
