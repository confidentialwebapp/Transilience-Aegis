"""Free phishing / malware URL feeds — daily-refreshed, no auth required.

  PhishTank   — verified phishing URLs
  OpenPhish   — community-verified phishing
  URLhaus     — malware delivery URLs (Abuse.ch)
  ThreatFox   — IOC sharing platform (Abuse.ch)
"""
from __future__ import annotations

import csv
import io
import json
import zipfile
from typing import Any

from core.http import get_bytes, get_text, request_json

PHISHTANK_URL = "https://data.phishtank.com/data/online-valid.csv"
OPENPHISH_URL = "https://openphish.com/feed.txt"
URLHAUS_RECENT_CSV = "https://urlhaus.abuse.ch/downloads/csv_recent/"
THREATFOX_API = "https://threatfox.abuse.ch/api/v1/"


async def phishtank_urls() -> list[dict[str, str]]:
    """Returns [{url, target_brand, submission_time, verification_time, online}]."""
    text = await get_text(PHISHTANK_URL, timeout=60)
    if not text:
        return []
    out: list[dict[str, str]] = []
    try:
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            out.append({
                "url": row.get("url", ""),
                "target": row.get("target", ""),
                "submission_time": row.get("submission_time", ""),
                "verification_time": row.get("verification_time", ""),
                "online": row.get("online", ""),
                "details_url": row.get("phish_detail_url", ""),
            })
    except Exception:
        return []
    return out


async def openphish_urls() -> list[str]:
    text = await get_text(OPENPHISH_URL, timeout=30)
    if not text:
        return []
    return [line.strip() for line in text.splitlines() if line.strip().startswith("http")]


async def urlhaus_recent() -> list[dict[str, str]]:
    """Recent URL submissions from URLhaus."""
    text = await get_text(URLHAUS_RECENT_CSV, timeout=60)
    if not text:
        return []
    out: list[dict[str, str]] = []
    # CSV has comment-prefixed header; skip lines starting with #
    lines = [ln for ln in text.splitlines() if ln and not ln.startswith("#")]
    if not lines:
        return out
    reader = csv.reader(io.StringIO("\n".join(lines)))
    for row in reader:
        if len(row) < 8:
            continue
        out.append({
            "id": row[0],
            "dateadded": row[1],
            "url": row[2].strip('"'),
            "url_status": row[3].strip('"'),
            "threat": row[5].strip('"'),
            "tags": row[6].strip('"'),
            "reporter": row[8].strip('"') if len(row) > 8 else "",
        })
    return out


async def threatfox_search(query: str, limit: int = 25) -> list[dict[str, Any]]:
    """Search ThreatFox IOC database."""
    r = await request_json(
        "POST", THREATFOX_API,
        json={"query": "search_ioc", "search_term": query, "exact_match": False, "limit": limit},
        timeout=30,
    )
    if isinstance(r, dict) and r.get("query_status") == "ok":
        return r.get("data") or []
    return []


def grep_urls_for(items: list[Any], keywords: list[str], url_field: str = "url") -> list[dict[str, Any]]:
    """Return items whose URL (or string entry) contains any keyword (case-insensitive)."""
    kw = [k.lower() for k in keywords if k]
    out: list[dict[str, Any]] = []
    for it in items:
        url = it if isinstance(it, str) else it.get(url_field, "") or ""
        if not url:
            continue
        u = url.lower()
        for k in kw:
            if k in u:
                out.append(it if isinstance(it, dict) else {"url": url})
                break
    return out
