import logging
from datetime import datetime
from xml.etree import ElementTree

import httpx
from bs4 import BeautifulSoup

from config import get_settings
from db import get_client
from utils.rate_limiter import RateLimiter
from utils.scoring import calculate_risk_score, severity_from_score

logger = logging.getLogger(__name__)
settings = get_settings()
rate_limiter = RateLimiter()


def generate_google_dorks(domain: str, company_name: str = "") -> list[str]:
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
    ]
    if company_name:
        dorks.extend([
            f'"{company_name}" filetype:pdf confidential',
            f'"{company_name}" site:pastebin.com',
            f'"{company_name}" password leak',
            f'"{company_name}" data breach',
        ])
    return dorks


async def search_duckduckgo(query: str) -> list[dict]:
    await rate_limiter.wait("duckduckgo", min_interval=3.0)
    results = []
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                timeout=30,
                follow_redirects=True,
            )
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
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
        except Exception as e:
            logger.warning(f"DuckDuckGo search failed: {e}")
    return results


async def fetch_google_news(keyword: str) -> list[dict]:
    await rate_limiter.wait("google_news", min_interval=2.0)
    articles = []
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"https://news.google.com/rss/search?q={keyword}&hl=en-US&gl=US&ceid=US:en",
                timeout=30,
            )
            if resp.status_code == 200:
                root = ElementTree.fromstring(resp.content)
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
        except Exception as e:
            logger.warning(f"Google News fetch failed: {e}")
    return articles


async def run_surface_scan(org_id: str):
    logger.info(f"Starting surface web scan for org {org_id}")
    client = get_client()

    job = client.table("scan_jobs").insert({
        "org_id": org_id,
        "module": "surface_web",
        "status": "running",
        "started_at": datetime.utcnow().isoformat(),
    }).execute()
    job_id = job.data[0]["id"]

    findings_count = 0

    try:
        assets = client.table("assets").select("*").eq("org_id", org_id).eq("status", "active").execute()
        domains = [a for a in assets.data if a["type"] == "domain"]
        keywords = [a for a in assets.data if a["type"] == "keyword"]

        # Google dork searches via DuckDuckGo
        for domain_asset in domains[:3]:
            domain = domain_asset["value"]
            dorks = generate_google_dorks(domain)

            for dork in dorks[:5]:  # Limit to avoid rate limiting
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
                            "description": f"Found via dork query: {dork}\n\n{result.get('snippet', '')}",
                            "source_url": result.get("url", ""),
                            "raw_data": {"dork": dork, "result": result},
                            "risk_score": score,
                            "status": "open",
                        }
                        client.table("alerts").insert(alert_data).execute()
                        findings_count += 1
                except Exception as e:
                    logger.warning(f"Dork search failed for '{dork}': {e}")

        # News monitoring
        news_terms = [a["value"] for a in domains + keywords]
        for term in news_terms[:5]:
            try:
                articles = await fetch_google_news(f"{term} breach OR hack OR leak OR vulnerability")
                for article in articles[:5]:
                    alert_data = {
                        "org_id": org_id,
                        "module": "surface_web",
                        "severity": "low",
                        "title": f"News mention: {article['title'][:100]}",
                        "description": f"Source: {article.get('source', 'Unknown')} | Published: {article.get('published', '')}",
                        "source_url": article.get("url", ""),
                        "raw_data": article,
                        "risk_score": 15,
                        "status": "open",
                    }
                    client.table("alerts").insert(alert_data).execute()
                    findings_count += 1
            except Exception as e:
                logger.warning(f"News scan failed for '{term}': {e}")

        client.table("scan_jobs").update({
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat(),
            "findings_count": findings_count,
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.error(f"Surface web scan failed: {e}")
        client.table("scan_jobs").update({
            "status": "failed",
            "completed_at": datetime.utcnow().isoformat(),
            "error": str(e),
        }).eq("id", job_id).execute()

    logger.info(f"Surface web scan complete for org {org_id}: {findings_count} findings")
    return findings_count
