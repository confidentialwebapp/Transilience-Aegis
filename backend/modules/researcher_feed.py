"""Curated researcher-feed ingester.

Source preference order (per channel):
  1. `tme_preview`   — scrape `https://t.me/s/<handle>` (Telegram's official
     public-channel preview HTML). 100% reliable, no third-party dependency,
     no auth, doesn't violate Telegram ToS.
  2. `rsshub_telegram` — fall back to RSSHub bridges if available. Public
     RSSHub instances rate-limit hard, so this is a backup only.
  3. `rss` / `atom`  — direct feeds for non-Telegram sources.

For each enabled channel we fetch, dedupe by GUID/external_id, extract IOCs
from the body, and upsert into `researcher_posts`. Failures on individual
feeds are logged but don't fail the whole tick.
"""

from __future__ import annotations

import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Optional

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

from utils.ioc_patterns import IOC_PATTERNS  # noqa: E402

# Mimic a real browser since t.me serves a different (lighter) page to bots.
USER_AGENT = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
HTTP_TIMEOUT = 25


def _strip_tags(html_or_text: str) -> str:
    if not html_or_text:
        return ""
    # Cheap HTML→text — the RSS body is usually already plain or lightly-formatted
    return re.sub(r"<[^>]+>", " ", html_or_text).strip()


def _parse_pubdate(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    try:
        # RFC822 (RSS 2.0)
        dt = parsedate_to_datetime(s)
        if dt and not dt.tzinfo:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat() if dt else None
    except Exception:
        pass
    try:
        # ISO 8601 (Atom)
        return datetime.fromisoformat(s.replace("Z", "+00:00")).isoformat()
    except Exception:
        return None


def _extract_iocs(text: str) -> dict[str, list[str]]:
    if not text:
        return {}
    out: dict[str, list[str]] = {}
    for kind, pattern in IOC_PATTERNS.items():
        matches = list({m.group(0) for m in pattern.finditer(text)})
        if matches:
            out[kind] = matches[:50]
    return out


def _parse_rss(xml_bytes: bytes) -> list[dict]:
    """Return list of normalized item dicts. Handles RSS 2.0 and Atom."""
    items: list[dict] = []
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as e:
        logger.warning("RSS parse failed: %s", e)
        return items

    # Detect Atom by namespace
    tag = root.tag
    is_atom = tag.endswith("}feed") or tag == "feed"

    if is_atom:
        ns = {"a": "http://www.w3.org/2005/Atom"}
        for entry in root.findall("a:entry", ns):
            link_el = entry.find("a:link", ns)
            link = link_el.get("href") if link_el is not None else ""
            content_el = entry.find("a:content", ns) or entry.find("a:summary", ns)
            text = _strip_tags(content_el.text or "") if content_el is not None else ""
            items.append({
                "external_id": (entry.findtext("a:id", default="", namespaces=ns) or link or "").strip(),
                "title": (entry.findtext("a:title", default="", namespaces=ns) or "").strip(),
                "text": text,
                "link": link,
                "published_at": _parse_pubdate(entry.findtext("a:updated", default="", namespaces=ns)
                                                or entry.findtext("a:published", default="", namespaces=ns)),
            })
    else:
        # RSS 2.0
        for it in root.iter("item"):
            link = (it.findtext("link") or "").strip()
            description = it.findtext("description") or ""
            content = (
                it.findtext("{http://purl.org/rss/1.0/modules/content/}encoded")
                or description
            )
            text = _strip_tags(content)
            items.append({
                "external_id": (it.findtext("guid") or link or "").strip(),
                "title": (it.findtext("title") or "").strip(),
                "text": text,
                "link": link,
                "published_at": _parse_pubdate(it.findtext("pubDate")),
            })
    return items


async def fetch_feed(url: str) -> bytes | None:
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=True,
                                     headers={"User-Agent": USER_AGENT}) as c:
            r = await c.get(url)
            if r.status_code == 200:
                return r.content
            logger.warning("feed %s -> HTTP %s", url, r.status_code)
    except Exception as e:
        logger.warning("feed %s fetch failed: %s", url, e)
    return None


def _parse_tme_preview(html: bytes, handle: str) -> list[dict]:
    """Parse https://t.me/s/<handle> public preview HTML into normalized items."""
    items: list[dict] = []
    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception as e:
        logger.warning("t.me preview parse failed for %s: %s", handle, e)
        return items

    for msg in soup.select("div.tgme_widget_message"):
        post_id = (msg.get("data-post") or "").strip()  # e.g. "vxunderground/4815"
        link = f"https://t.me/{post_id}" if post_id else ""
        text_el = msg.select_one(".tgme_widget_message_text")
        text = text_el.get_text(" ", strip=True) if text_el else ""
        time_el = msg.select_one(".tgme_widget_message_date time")
        published_iso = None
        if time_el and time_el.get("datetime"):
            try:
                published_iso = datetime.fromisoformat(
                    time_el["datetime"].replace("Z", "+00:00")
                ).isoformat()
            except Exception:
                published_iso = None
        # Title: first 80 chars of text or fall back to post id
        title = (text[:80] + "…") if len(text) > 80 else (text or post_id)
        if not (text or link):
            continue
        items.append({
            "external_id": post_id or link,
            "title": title.strip(),
            "text": text,
            "link": link,
            "published_at": published_iso,
        })
    return items


async def ingest_channel(channel: dict) -> dict:
    from db import get_client

    handle = channel["handle"]
    source_kind = channel.get("source_kind", "tme_preview")

    # Prefer t.me/s/<handle> regardless of stored URL — it's the most reliable
    # path. Fall back to feed_url only if explicit non-telegram source_kind.
    if source_kind == "tme_preview" or "telegram" in source_kind:
        url = f"https://t.me/s/{handle}"
    else:
        url = channel["feed_url"]

    body = await fetch_feed(url)
    if not body:
        try:
            client = get_client()
            client.table("researcher_channels").update({
                "last_polled_at": datetime.now(timezone.utc).isoformat(),
                "last_error": "fetch_failed",
            }).eq("id", channel["id"]).execute()
        except Exception:
            pass
        return {"channel": handle, "status": "fetch_failed", "items": 0, "inserted": 0}

    if "telegram" in source_kind or source_kind == "tme_preview":
        items = _parse_tme_preview(body, handle)
    else:
        items = _parse_rss(body)
    if not items:
        return {"channel": handle, "status": "no_items", "items": 0, "inserted": 0}

    client = get_client()
    rows = []
    last_pub = None
    for it in items[:50]:  # cap per tick to avoid blow-ups
        text = it.get("text", "")
        published = it.get("published_at")
        if published and (last_pub is None or published > last_pub):
            last_pub = published
        rows.append({
            "channel": handle,
            "external_id": (it.get("external_id") or it.get("link") or it.get("title") or "")[:1000] or None,
            "title": it.get("title")[:500] if it.get("title") else None,
            "text": text[:8000] if text else None,
            "link": it.get("link") or None,
            "published_at": published,
            "extracted_iocs": _extract_iocs(text),
        })

    inserted = 0
    if rows:
        try:
            res = client.table("researcher_posts").upsert(
                rows, on_conflict="channel,external_id"
            ).execute()
            inserted = len(res.data or [])
        except Exception as e:
            logger.warning("researcher_posts upsert failed for %s: %s", handle, e)

    # Update channel cursor
    try:
        client.table("researcher_channels").update({
            "last_polled_at": datetime.now(timezone.utc).isoformat(),
            "last_post_at": last_pub,
            "last_error": None,
        }).eq("id", channel["id"]).execute()
    except Exception:
        pass

    return {"channel": handle, "status": "ok", "items": len(items), "inserted": inserted}


async def run_all() -> dict:
    """Iterate every enabled researcher_channel and ingest. Returns per-channel summary."""
    from db import get_client

    client = get_client()
    try:
        chans = client.table("researcher_channels").select("*").eq("enabled", True).execute()
    except Exception as e:
        logger.error("researcher_channels read failed: %s", e)
        return {"error": str(e)}

    results = []
    for ch in chans.data or []:
        try:
            r = await ingest_channel(ch)
        except Exception as e:
            logger.warning("ingest_channel %s crashed: %s", ch.get("handle"), e)
            r = {"channel": ch.get("handle"), "status": "crashed", "error": str(e)}
        results.append(r)
    return {"channels": len(results), "results": results}
