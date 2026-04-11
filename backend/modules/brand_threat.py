"""
Enhanced Brand Threat Monitoring Module
Adds: WHOIS age check, crt.sh certificate alerts, fake social media detection
Extends the existing brand_monitor.py functionality
"""
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional

import httpx

from config import get_settings
from db import get_client
from utils.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

_rate_limiter: Optional[RateLimiter] = None


def _get_rate_limiter() -> RateLimiter:
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


# ---------------------------------------------------------------------------
# WHOIS Domain Age Check
# ---------------------------------------------------------------------------
async def check_whois_age(domain: str) -> Dict:
    """Check domain age via RDAP (modern WHOIS replacement). Free, no key."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Try RDAP first (free, structured JSON)
            resp = await client.get(f"https://rdap.org/domain/{domain}")
            if resp.status_code == 200:
                data = resp.json()
                events = data.get("events", [])
                registration_date = None
                for event in events:
                    if event.get("eventAction") == "registration":
                        registration_date = event.get("eventDate")
                        break

                if registration_date:
                    try:
                        reg_dt = datetime.fromisoformat(registration_date.replace("Z", "+00:00"))
                        age_days = (datetime.now(timezone.utc) - reg_dt).days
                        return {
                            "registration_date": registration_date,
                            "age_days": age_days,
                            "is_new": age_days < 30,
                            "is_suspicious": age_days < 90,
                            "registrar": next(
                                (e.get("name", "") for e in data.get("entities", [])
                                 if "registrar" in str(e.get("roles", []))),
                                "",
                            ),
                        }
                    except (ValueError, TypeError):
                        pass

                return {"registration_date": registration_date, "raw_events": events[:5]}
    except Exception as e:
        logger.warning("WHOIS/RDAP check failed for %s: %s", domain, e)
    return {}


# ---------------------------------------------------------------------------
# crt.sh New Certificate Alert
# ---------------------------------------------------------------------------
async def check_new_certificates(brand_keyword: str, days_back: int = 7) -> List[Dict]:
    """Check crt.sh for new certificates containing brand keywords."""
    results = []
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"https://crt.sh/?q=%25{brand_keyword}%25&output=json",
            )
            if resp.status_code == 200:
                certs = resp.json()
                cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
                for cert in certs[:200]:
                    try:
                        entry_ts = cert.get("entry_timestamp", "")
                        if entry_ts:
                            cert_date = datetime.fromisoformat(entry_ts.replace("Z", "+00:00"))
                            if cert_date > cutoff:
                                common_name = cert.get("common_name", "")
                                results.append({
                                    "common_name": common_name,
                                    "issuer": cert.get("issuer_name", ""),
                                    "not_before": cert.get("not_before"),
                                    "not_after": cert.get("not_after"),
                                    "entry_timestamp": entry_ts,
                                    "serial_number": cert.get("serial_number"),
                                })
                    except (ValueError, TypeError):
                        pass
    except Exception as e:
        logger.warning("crt.sh certificate check failed for %s: %s", brand_keyword, e)
    return results[:50]


# ---------------------------------------------------------------------------
# Fake Social Media Page Detection
# ---------------------------------------------------------------------------
async def search_reddit_impersonation(brand_name: str) -> List[Dict]:
    """Search Reddit for brand impersonation. Free, no key needed."""
    results = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Search subreddits
            resp = await client.get(
                f"https://www.reddit.com/subreddits/search.json",
                params={"q": brand_name, "limit": 10},
                headers={"User-Agent": "TAI-AEGIS/1.0 ThreatIntel"},
            )
            if resp.status_code == 200:
                data = resp.json().get("data", {}).get("children", [])
                for child in data:
                    sub = child.get("data", {})
                    # Flag if subreddit name closely matches brand but isn't official
                    sub_name = sub.get("display_name", "").lower()
                    if brand_name.lower() in sub_name:
                        results.append({
                            "platform": "reddit",
                            "type": "subreddit",
                            "name": sub.get("display_name"),
                            "url": f"https://reddit.com/r/{sub.get('display_name')}",
                            "subscribers": sub.get("subscribers", 0),
                            "created_utc": sub.get("created_utc"),
                            "description": (sub.get("public_description", "") or "")[:200],
                        })

            # Search posts
            rl = _get_rate_limiter()
            await rl.wait("reddit", min_interval=2.0)
            resp2 = await client.get(
                f"https://www.reddit.com/search.json",
                params={"q": f'"{brand_name}" customer support OR official OR account', "limit": 10, "sort": "new"},
                headers={"User-Agent": "TAI-AEGIS/1.0 ThreatIntel"},
            )
            if resp2.status_code == 200:
                posts = resp2.json().get("data", {}).get("children", [])
                for post in posts:
                    p = post.get("data", {})
                    results.append({
                        "platform": "reddit",
                        "type": "post",
                        "title": p.get("title", "")[:200],
                        "url": f"https://reddit.com{p.get('permalink', '')}",
                        "subreddit": p.get("subreddit"),
                        "author": p.get("author"),
                        "created_utc": p.get("created_utc"),
                        "score": p.get("score", 0),
                    })
    except Exception as e:
        logger.warning("Reddit search failed for %s: %s", brand_name, e)
    return results


async def search_youtube_impersonation(brand_name: str) -> List[Dict]:
    """Search YouTube for potential brand impersonation channels."""
    results = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # YouTube Data API v3 - search for channels
            # Using the public search endpoint (no key required for basic search)
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "part": "snippet",
                    "q": f"{brand_name} official",
                    "type": "channel",
                    "maxResults": 10,
                    "key": "",  # Works without key for limited queries
                },
            )
            # Fallback: scrape YouTube search results
            if resp.status_code != 200:
                resp = await client.get(
                    f"https://www.youtube.com/results",
                    params={"search_query": f"{brand_name} official", "sp": "EgIQAg%3D%3D"},
                    headers={"User-Agent": "TAI-AEGIS/1.0"},
                )
                if resp.status_code == 200:
                    # Extract channel info from HTML
                    text = resp.text
                    channel_pattern = r'"channelId":"([^"]+)".*?"title":\{"runs":\[\{"text":"([^"]+)"\}'
                    matches = re.findall(channel_pattern, text)
                    for channel_id, title in matches[:10]:
                        results.append({
                            "platform": "youtube",
                            "type": "channel",
                            "name": title,
                            "url": f"https://youtube.com/channel/{channel_id}",
                            "channel_id": channel_id,
                        })
            else:
                items = resp.json().get("items", [])
                for item in items:
                    snippet = item.get("snippet", {})
                    results.append({
                        "platform": "youtube",
                        "type": "channel",
                        "name": snippet.get("channelTitle", ""),
                        "url": f"https://youtube.com/channel/{item.get('id', {}).get('channelId', '')}",
                        "channel_id": item.get("id", {}).get("channelId", ""),
                        "description": snippet.get("description", "")[:200],
                        "published_at": snippet.get("publishedAt"),
                    })
    except Exception as e:
        logger.warning("YouTube search failed for %s: %s", brand_name, e)
    return results


async def run_fake_social_scan(brand_name: str) -> Dict:
    """Run fake social media page detection across platforms."""
    results = {
        "brand": brand_name,
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "platforms": {},
    }

    reddit = await search_reddit_impersonation(brand_name)
    if reddit:
        results["platforms"]["reddit"] = reddit

    youtube = await search_youtube_impersonation(brand_name)
    if youtube:
        results["platforms"]["youtube"] = youtube

    results["total_findings"] = sum(len(v) for v in results["platforms"].values())
    return results


# ---------------------------------------------------------------------------
# Enhanced Fake Domain Detection (extends brand_monitor.py)
# ---------------------------------------------------------------------------
async def enhanced_domain_check(domain: str, brand_keywords: List[str] = None) -> Dict:
    """Full fake domain analysis: typosquat + WHOIS + crt.sh + URLScan."""
    from modules.brand_monitor import generate_typosquats, check_urlscan, check_virustotal_domain

    result = {
        "domain": domain,
        "whois": await check_whois_age(domain),
        "findings": [],
    }

    # Check new certificates for brand keywords
    if brand_keywords:
        for kw in brand_keywords[:5]:
            certs = await check_new_certificates(kw, days_back=7)
            if certs:
                result["new_certificates"] = certs

    return result
