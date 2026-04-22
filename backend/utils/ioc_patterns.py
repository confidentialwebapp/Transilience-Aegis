"""IOC regex patterns reused by ingestion modules (researcher_feed, etc.).

Lives here as a stable home — used to live in modules/telegram_monitor but
that module was removed when the Telegram bot monitor feature was deprecated.
"""

from __future__ import annotations

import re

IOC_PATTERNS = {
    "ipv4": re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b"),
    "domain": re.compile(r"\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b", re.IGNORECASE),
    "url": re.compile(r"\bhttps?://[^\s'\"<>]+", re.IGNORECASE),
    "md5": re.compile(r"\b[a-f0-9]{32}\b", re.IGNORECASE),
    "sha1": re.compile(r"\b[a-f0-9]{40}\b", re.IGNORECASE),
    "sha256": re.compile(r"\b[a-f0-9]{64}\b", re.IGNORECASE),
    "btc": re.compile(r"\b(?:bc1[a-z0-9]{25,90}|[13][a-zA-HJ-NP-Z0-9]{25,34})\b"),
    "eth": re.compile(r"\b0x[a-fA-F0-9]{40}\b"),
    "cve": re.compile(r"\bCVE-\d{4}-\d{4,7}\b", re.IGNORECASE),
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
}


def extract(text: str, max_per_kind: int = 50) -> dict[str, list[str]]:
    """Return {kind: [unique_matches]}, capped at max_per_kind per kind."""
    if not text:
        return {}
    out: dict[str, list[str]] = {}
    for kind, pattern in IOC_PATTERNS.items():
        matches = list({m.group(0) for m in pattern.finditer(text)})
        if matches:
            out[kind] = matches[:max_per_kind]
    return out
