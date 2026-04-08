import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
from xml.etree import ElementTree
from urllib.parse import quote_plus

import httpx

from config import get_settings
from db import get_client
from utils.rate_limiter import RateLimiter
from utils.scoring import calculate_risk_score, severity_from_score

logger = logging.getLogger(__name__)

_rate_limiter: Optional[RateLimiter] = None


def _get_rate_limiter() -> RateLimiter:
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


def generate_google_dorks(domain: str, company_name: str = "") -> List[str]:
    """Generate useful Google dork queries for finding exposed data."""
    dorks = [
        f'site:pastebin.com "{domain}"',
        f'site:github.com "{domain}" password',
        f'site:trello.com "{domain}"',
        f'site:notion.so "{domain}"',
        f'filetype:pdf "{domain}" confidential',
        f'filetype:xlsx "{domain}"',
        f'filetype:doc "{domain}" internal',
        f'filetype:sql "{domain}"',
        f'inurl:admin "{domain}"',
        f'intitle:"index of" "{domain}"',
        f'site:drive.google.com "{domain}"',
        f'filetype:env "{domain}"',
        f'filetype:log "{domain}"',
        f'inurl:login "{domain}"',
    ]
    if company_name:
        dorks.extend([
            f'"{company_name}" filetype:pdf confidential',
            f'"{company_name}" site:pastebin.com',
            f'"{company_name}" password leak',
            f'"{company_name}" data breach',
            f'"{company_name}" filetype:xlsx internal',
        ])
    return dorks


def _get_bs4():
    """Lazy-import BeautifulSoup to avoid hard dependency at module level."""
    try:
        from bs4 import BeautifulSoup
        return BeautifulSoup
    except ImportError:
        logger.warning("beautifulsoup4 not installed, DuckDuckGo parsing will be limited")
        return None


async def search_duckduckgo(query: str) -> List[Dict]:
    """Scrape DuckDuckGo HTML search results.

    Uses proper User-Agent, handles captchas/blocks gracefully.
    """
    rl = _get_rate_limiter()
    await rl.wait("duckduckgo", min_interval=3.0)
    results = []

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    ),
                },
                follow_redirects=True,
            )

            if resp.status_code == 403:
                logger.warning("DuckDuckGo blocked request (possible captcha)")
                return []
            if resp.status_code == 429:
                logger.warning("DuckDuckGo rate limited")
                return []
            if resp.status_code != 200:
                logger.warning(f"DuckDuckGo returned {resp.status_code}")
                return []

            BeautifulSoup = _get_bs4()
            if BeautifulSoup is None:
                return []

            soup = BeautifulSoup(resp.text, "html.parser")

            # Check for captcha/block page
            if soup.find("form", {"id": "challenge-form"}) or "captcha" in resp.text.lower():
                logger.warning("DuckDuckGo returned a captcha page")
                return []

            for result_div in soup.select(".result__body")[:10]:
                title_el = result_div.select_one(".result__a")
                snippet_el = result_div.select_one(".result__snippet")
                url_el = result_div.select_one(".result__url")
                if title_el:
                    results.append({
                        "title": title_el.get_text(strip=True),
                        "url": url_el.get_text(strip=True) if url_el else "",
                        "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
                    })

    except httpx.TimeoutException:
        logger.warning("DuckDuckGo request timed out")
    except Exception as e:
        logger.warning(f"DuckDuckGo search failed: {e}")

    return results


async def fetch_google_news(keyword: str) -> List[Dict]:
    """Parse Google News RSS feed for threat-related articles.

    Handles XML parsing errors gracefully.
    """
    rl = _get_rate_limiter()
    await rl.wait("google_news", min_interval=2.0)
    articles = []

    try:
        encoded_keyword = quote_plus(keyword)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"https://news.google.com/rss/search?q={encoded_keyword}&hl=en-US&gl=US&ceid=US:en",
            )
            if resp.status_code != 200:
                logger.warning(f"Google News returned {resp.status_code}")
                return []

            try:
                root = ElementTree.fromstring(resp.content)
            except ElementTree.ParseError as e:
                logger.warning(f"Failed to parse Google News RSS XML: {e}")
                return []

            for item in root.findall(".//item")[:20]:
                title = item.find("title")
                link = item.find("link")
                pub_date = item.find("pubDate")
                source = item.find("source")
                articles.append({
                    "title": title.text if title is not None else "",
                    "url": link.text if link is not None else "",
                    "published": pub_date.text if pub_date is not None else "",
                    "source": source.text if source is not None else "",
                })

    except httpx.TimeoutException:
        logger.warning("Google News request timed out")
    except Exception as e:
        logger.warning(f"Google News fetch failed: {e}")

    return articles


async def run_surface_scan(org_id: str) -> int:
    """Main surface web scan orchestrator."""
    logger.info(f"Starting surface web scan for org {org_id}")
    client = get_client()

    job = client.table("scan_jobs").insert({
        "org_id": org_id,
        "module": "surface_web",
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
        domains = [a for a in assets.data if a["type"] == "domain"]
        keywords = [a for a in assets.data if a["type"] == "keyword"]

        # --- Google dork searches via DuckDuckGo ---
        for domain_asset in domains[:3]:
            domain = domain_asset["value"]
            company_name = domain_asset.get("metadata", {}).get("company_name", "")
            dorks = generate_google_dorks(domain, company_name)

            for dork in dorks[:5]:
                try:
                    results = await search_duckduckgo(dork)
                    for result in results:
                        score = calculate_risk_score({"in_breach_db": True})
                        severity = severity_from_score(score)
                        alert_data = {
                            "org_id": org_id,
                            "asset_id": domain_asset["id"],
                            "module": "surface_web",
                            "severity": severity,
                            "title": f"Surface web exposure: {result['title'][:100]}",
                            "description": (
                                f"Found via dork query: {dork}\n\n"
                                f"{result.get('snippet', '')}"
                            ),
                            "source_url": result.get("url", ""),
                            "raw_data": {"dork": dork, "result": result},
                            "risk_score": score,
                            "status": "open",
                        }
                        client.table("alerts").insert(alert_data).execute()
                        findings_count += 1
                except Exception as e:
                    logger.warning(f"Dork search failed for '{dork}': {e}")

        # --- News monitoring ---
        news_terms = [a["value"] for a in domains + keywords]
        for term in news_terms[:5]:
            try:
                articles = await fetch_google_news(
                    f"{term} breach OR hack OR leak OR vulnerability"
                )
                for article in articles[:5]:
                    alert_data = {
                        "org_id": org_id,
                        "module": "surface_web",
                        "severity": "low",
                        "title": f"News mention: {article['title'][:100]}",
                        "description": (
                            f"Source: {article.get('source', 'Unknown')} | "
                            f"Published: {article.get('published', '')}"
                        ),
                        "source_url": article.get("url", ""),
                        "raw_data": article,
                        "risk_score": 15,
                        "status": "open",
                    }
                    client.table("alerts").insert(alert_data).execute()
                    findings_count += 1
            except Exception as e:
                logger.warning(f"News scan failed for '{term}': {e}")

        # Update last_scan_at
        try:
            client.table("assets").update({
                "last_scan_at": datetime.now(timezone.utc).isoformat(),
            }).eq("org_id", org_id).in_("type", ["domain", "keyword"]).execute()
        except Exception as e:
            logger.warning(f"Failed to update asset last_scan_at: {e}")

        client.table("scan_jobs").update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "findings_count": findings_count,
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.error(f"Surface web scan failed: {e}")
        client.table("scan_jobs").update({
            "status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "error": str(e)[:500],
        }).eq("id", job_id).execute()

    logger.info(f"Surface web scan complete for org {org_id}: {findings_count} findings")
    return findings_count
