"""Apify client — exhaustive coverage of social-media + content platforms.

Apify "actors" are pre-built scrapers. We call them via run-sync-get-dataset-items,
which blocks until the actor finishes (or the timeout) and returns the dataset rows.

For platforms without a dedicated free actor (Telegram, Pinterest, Discord, Snapchat),
we fall back to Google-search SERP via apify/google-search-scraper.
"""
from __future__ import annotations

import asyncio
from typing import Any

from config.settings import KEYS
from core.http import request_json

BASE = "https://api.apify.com/v2"

# Common public actors. IDs use ~ between owner and actor name.
ACTORS = {
    # Instagram
    "instagram_search":   "apify~instagram-search-scraper",
    "instagram_profile":  "apify~instagram-profile-scraper",
    "instagram_hashtag":  "apify~instagram-hashtag-scraper",
    "instagram_post":     "apify~instagram-post-scraper",
    # Facebook (Meta)
    "facebook_pages":     "apify~facebook-pages-scraper",
    "facebook_posts":     "apify~facebook-posts-scraper",
    # Twitter / X
    "twitter_search":     "apidojo~twitter-scraper-lite",
    "twitter_user":       "apidojo~twitter-user-scraper",
    # TikTok
    "tiktok_search":      "clockworks~tiktok-scraper",
    "tiktok_profile":     "clockworks~tiktok-profile-scraper",
    # YouTube
    "youtube_search":     "streamers~youtube-scraper",
    # LinkedIn
    "linkedin_company":   "bebity~linkedin-companies-scraper",
    "linkedin_search":    "curious_coder~linkedin-post-search-scraper",
    # Reddit
    "reddit_search":      "trudax~reddit-scraper-lite",
    # Threads (Meta)
    "threads_search":     "curious_coder~threads-scraper",
    # Pinterest
    "pinterest_search":   "epctex~pinterest-scraper",
    # Telegram (limited free actors)
    "telegram_channel":   "73mi~telegram-channel-scraper",
    # Generic Google SERP — fallback for platforms above when actor fails
    "google_search":      "apify~google-search-scraper",
    # Web screenshot (for evidence capture)
    "screenshot_url":     "apify~web-scraper",
}


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {KEYS.apify}"}


async def run_actor_sync(actor_id: str, payload: dict[str, Any], timeout: int = 90) -> list[dict[str, Any]]:
    """Run an Apify actor synchronously and return dataset rows."""
    if not KEYS.apify:
        return []
    url = f"{BASE}/acts/{actor_id}/run-sync-get-dataset-items"
    r = await request_json(
        "POST", url,
        headers=_auth_headers(),
        params={"timeout": timeout, "format": "json"},
        json=payload,
        retries=2,
        timeout=timeout + 30,
    )
    if isinstance(r, list):
        return r
    if isinstance(r, dict):
        return r.get("items") or r.get("data") or []
    return []


# ---------- Per-platform convenience wrappers ----------

async def instagram_search(keyword: str, search_type: str = "user", limit: int = 20) -> list[dict[str, Any]]:
    return await run_actor_sync(
        ACTORS["instagram_search"],
        {"search": keyword, "searchType": search_type, "searchLimit": limit, "resultsLimit": limit},
    )


async def instagram_profile(usernames: list[str]) -> list[dict[str, Any]]:
    if not usernames:
        return []
    return await run_actor_sync(ACTORS["instagram_profile"], {"usernames": usernames, "resultsLimit": 1})


async def instagram_hashtag(tags: list[str], results_limit: int = 30) -> list[dict[str, Any]]:
    if not tags:
        return []
    return await run_actor_sync(ACTORS["instagram_hashtag"], {"hashtags": tags, "resultsLimit": results_limit})


async def facebook_pages(start_urls: list[str]) -> list[dict[str, Any]]:
    if not start_urls:
        return []
    return await run_actor_sync(ACTORS["facebook_pages"], {"startUrls": [{"url": u} for u in start_urls]})


async def facebook_posts_search(query: str, max_posts: int = 30) -> list[dict[str, Any]]:
    """Search Facebook posts via Google SERP fallback (Facebook closes direct search)."""
    return await google_search(
        [f'site:facebook.com "{query}"', f'site:facebook.com/groups "{query}"'],
        results_per_query=10,
    )


async def twitter_search(keywords: list[str], limit: int = 30) -> list[dict[str, Any]]:
    if not keywords:
        return []
    return await run_actor_sync(
        ACTORS["twitter_search"],
        {"searchTerms": keywords, "maxItems": limit, "lang": "en"},
    )


async def tiktok_search(keywords: list[str], results_limit: int = 30) -> list[dict[str, Any]]:
    if not keywords:
        return []
    return await run_actor_sync(
        ACTORS["tiktok_search"],
        {"searchQueries": keywords, "resultsPerPage": results_limit, "shouldDownloadVideos": False, "shouldDownloadCovers": False, "shouldDownloadSubtitles": False},
    )


async def youtube_search(queries: list[str], max_results: int = 25) -> list[dict[str, Any]]:
    if not queries:
        return []
    return await run_actor_sync(
        ACTORS["youtube_search"],
        {"searchKeywords": "\n".join(queries), "maxResults": max_results, "maxResultsShorts": 0, "maxResultStreams": 0},
    )


async def linkedin_company_search(queries: list[str], max_items: int = 25) -> list[dict[str, Any]]:
    if not queries:
        return []
    return await run_actor_sync(
        ACTORS["linkedin_company"],
        {"queries": queries, "maxItems": max_items},
    )


async def reddit_search(keywords: list[str], max_items: int = 30) -> list[dict[str, Any]]:
    if not keywords:
        return []
    return await run_actor_sync(
        ACTORS["reddit_search"],
        {"searches": keywords, "maxItems": max_items, "type": "all"},
    )


async def threads_search(keywords: list[str], max_items: int = 25) -> list[dict[str, Any]]:
    if not keywords:
        return []
    return await run_actor_sync(
        ACTORS["threads_search"],
        {"keywords": keywords, "maxItems": max_items},
    )


async def pinterest_search(keywords: list[str], max_items: int = 25) -> list[dict[str, Any]]:
    if not keywords:
        return []
    return await run_actor_sync(
        ACTORS["pinterest_search"],
        {"search": keywords, "maxItems": max_items},
    )


async def telegram_channel_search(query: str, max_items: int = 25) -> list[dict[str, Any]]:
    """Telegram public-channel search via SERP fallback (free Telegram actors are sparse)."""
    return await google_search(
        [f'site:t.me "{query}"', f'"{query}" site:telegram.me', f'"{query}" telegram channel'],
        results_per_query=10,
    )


async def discord_search(query: str) -> list[dict[str, Any]]:
    return await google_search(
        [f'site:discord.gg "{query}"', f'site:discord.com/invite "{query}"'],
        results_per_query=10,
    )


async def snapchat_search(query: str) -> list[dict[str, Any]]:
    return await google_search([f'site:snapchat.com "{query}"'], results_per_query=10)


async def whatsapp_invite_search(query: str) -> list[dict[str, Any]]:
    return await google_search([f'site:chat.whatsapp.com "{query}"'], results_per_query=10)


async def google_search(queries: list[str], results_per_query: int = 10, chunk_size: int = 12) -> list[dict[str, Any]]:
    """Run google-search-scraper and return a flat list of organic results.

    The actor returns one record per query, each containing `organicResults`
    plus query metadata. We flatten across all queries and drop the metadata.
    Each item retains: url, title, description, displayedUrl, position, plus
    a `_query` field with the originating search string.

    For large query sets, we chunk the calls — Apify's actor has a per-run
    timeout; one big batch with 30+ queries silently returns nothing.
    """
    if not queries:
        return []

    chunks = [queries[i : i + chunk_size] for i in range(0, len(queries), chunk_size)]

    async def _run_chunk(chunk: list[str]) -> list[dict[str, Any]]:
        # Generous per-chunk timeout: ~10s per query
        timeout = max(60, len(chunk) * 12)
        return await run_actor_sync(
            ACTORS["google_search"],
            {"queries": "\n".join(chunk), "resultsPerPage": results_per_query, "maxPagesPerQuery": 1},
            timeout=timeout,
        )

    raw_chunks = await asyncio.gather(*(_run_chunk(c) for c in chunks), return_exceptions=False)

    out: list[dict[str, Any]] = []
    for raw in raw_chunks:
        for rec in raw or []:
            if not isinstance(rec, dict):
                continue
            q = (rec.get("searchQuery") or {}).get("term", "")
            for org in rec.get("organicResults") or []:
                if isinstance(org, dict):
                    org = dict(org)
                    org["_query"] = q
                    out.append(org)
    return out


async def screenshot(url: str, full_page: bool = True) -> bytes | None:
    """Capture a screenshot of a URL via apify/web-scraper page-function."""
    if not KEYS.apify or not url:
        return None
    payload = {
        "startUrls": [{"url": url}],
        "pageFunction": "async function pageFunction(context) { const buf = await context.page.screenshot({fullPage: " + ("true" if full_page else "false") + "}); return { url: context.request.url, image: buf.toString('base64') }; }",
        "useChrome": True,
        "headless": True,
        "ignoreSslErrors": True,
        "maxRequestRetries": 1,
        "maxPagesPerCrawl": 1,
    }
    r = await run_actor_sync(ACTORS["screenshot_url"], payload, timeout=60)
    if r and isinstance(r, list) and r[0].get("image"):
        import base64
        try:
            return base64.b64decode(r[0]["image"])
        except Exception:
            return None
    return None
