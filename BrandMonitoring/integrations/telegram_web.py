"""Telegram public channel/group scraper — no API key required.

Strategy:
  1. Channel discovery via Apify (Google + Bing + dedicated Telegram-search engines)
  2. For each discovered channel, fetch https://t.me/s/<channel> — Telegram's
     public web preview returns the last ~20 posts as HTML, no auth required.
  3. Extract per-message: text, date, views, links, attached files.
  4. Caller looks for brand keywords + scam patterns + IOCs (phones, UPIs, accts).
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from bs4 import BeautifulSoup

from core.http import get_text
from core.logging_setup import get_logger

log = get_logger(__name__)

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


async def channel_preview(handle: str) -> dict[str, Any] | None:
    """Fetch t.me/s/<handle> and return parsed channel data."""
    handle = handle.strip().lstrip("@").rstrip("/")
    if not handle:
        return None
    url = f"https://t.me/s/{handle}"
    html = await get_text(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"}, timeout=20)
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")

    # Channel metadata
    title_el = soup.select_one(".tgme_channel_info_header_title")
    desc_el = soup.select_one(".tgme_channel_info_description")
    counters = {}
    for c in soup.select(".tgme_channel_info_counter"):
        v = c.select_one(".counter_value")
        t = c.select_one(".counter_type")
        if v and t:
            counters[t.get_text(strip=True).lower()] = v.get_text(strip=True)

    # Messages
    messages = []
    for msg_div in soup.select(".tgme_widget_message_wrap"):
        body = msg_div.select_one(".tgme_widget_message")
        if not body:
            continue
        text_el = body.select_one(".tgme_widget_message_text")
        text = text_el.get_text(separator=" ", strip=True) if text_el else ""
        date_el = body.select_one(".tgme_widget_message_date time")
        date = date_el.get("datetime") if date_el else ""
        views_el = body.select_one(".tgme_widget_message_views")
        views = views_el.get_text(strip=True) if views_el else ""
        link_el = body.select_one(".tgme_widget_message_date")
        link = link_el.get("href") if link_el else ""
        # Extract any embedded URLs
        links = [a.get("href") for a in body.select(".tgme_widget_message_text a[href]")]
        # File attachments
        file_el = body.select_one(".tgme_widget_message_document_title, .tgme_widget_message_document")
        file_name = file_el.get_text(strip=True) if file_el else None
        photo_el = body.select_one(".tgme_widget_message_photo_wrap")
        photo_url = photo_el.get("style", "") if photo_el else ""
        photo_match = re.search(r"url\(['\"]?([^'\")]+)['\"]?\)", photo_url) if photo_url else None
        photo_url = photo_match.group(1) if photo_match else None

        messages.append({
            "text": text,
            "date": date,
            "views": views,
            "url": link,
            "embedded_links": [l for l in links if l],
            "file_name": file_name,
            "photo_url": photo_url,
        })

    return {
        "handle": handle,
        "url": url,
        "title": title_el.get_text(strip=True) if title_el else handle,
        "description": desc_el.get_text(separator=" ", strip=True) if desc_el else "",
        "subscribers": counters.get("subscribers"),
        "photos": counters.get("photos"),
        "videos": counters.get("videos"),
        "files": counters.get("files"),
        "links": counters.get("links"),
        "messages": messages,
    }


# IOC extractors — common patterns scammers use for outreach
INDIAN_PHONE_RE = re.compile(r"\b(?:\+?91[\s\-]?)?[6-9]\d{9}\b")
INTL_PHONE_RE = re.compile(r"\+\d{1,3}[\s\-]?\d{3,4}[\s\-]?\d{3,4}[\s\-]?\d{3,5}")
UPI_RE = re.compile(r"\b[\w.\-]{2,30}@(?:ybl|axl|paytm|okaxis|okhdfcbank|oksbi|okicici|ibl|airtel|jio|fbl|axisb|sbi|hdfcbank|allbank|cnrb|federal|kbl|kotak|hsbc|idbi|indus|pnb|cosmos)\b", re.IGNORECASE)
BANK_ACCT_RE = re.compile(r"\bA\.?C\.?(?:\s*No\.?)?[:\s]+(\d{9,18})\b", re.IGNORECASE)
IFSC_RE = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")
WHATSAPP_RE = re.compile(r"(?:wa\.me|whatsapp\.com/send\?phone=|api\.whatsapp\.com)/(\+?\d+)", re.IGNORECASE)
CRYPTO_BTC_RE = re.compile(r"\b(bc1[ac-hj-np-z02-9]{6,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b")
CRYPTO_ETH_RE = re.compile(r"\b0x[a-fA-F0-9]{40}\b")


def extract_iocs(text: str) -> dict[str, list[str]]:
    """Extract scam-actionable IOCs from a message blob."""
    if not text:
        return {}
    out: dict[str, list[str]] = {}

    def _add(key: str, items: list[str]):
        if items:
            out[key] = sorted(set(items))

    _add("indian_phones", INDIAN_PHONE_RE.findall(text))
    intl = INTL_PHONE_RE.findall(text)
    # Strip Indian phones already captured (avoid double-counting)
    intl = [p for p in intl if not INDIAN_PHONE_RE.search(p)]
    _add("intl_phones", intl)
    _add("upis", UPI_RE.findall(text))
    _add("bank_accounts", BANK_ACCT_RE.findall(text))
    _add("ifsc_codes", IFSC_RE.findall(text))
    _add("whatsapp_numbers", WHATSAPP_RE.findall(text))
    _add("btc_addresses", CRYPTO_BTC_RE.findall(text))
    _add("eth_addresses", CRYPTO_ETH_RE.findall(text))
    return out
