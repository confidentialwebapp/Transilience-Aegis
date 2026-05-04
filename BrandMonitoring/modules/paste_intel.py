"""Paste-site exposure.

Hunts for brand mentions across publicly-indexed pastes (Pastebin, JustPaste,
Ghostbin, controlc, dpaste, etc.) via DuckDuckGo SERP. Pastes commonly
contain leaked credentials, source code excerpts, internal URLs, and
ransomware leak posts.
"""
from __future__ import annotations

import asyncio
import re
import urllib.parse
from typing import Any

import httpx

from core.base_module import DetectionModule
from core.evidence import Finding


PASTE_HOSTS = [
    ("pastebin.com",   "Pastebin"),
    ("paste.ee",       "Paste.ee"),
    ("justpaste.it",   "JustPaste.it"),
    ("ghostbin.co",    "Ghostbin"),
    ("controlc.com",   "ControlC"),
    ("dpaste.com",     "dpaste"),
    ("ideone.com",     "Ideone"),
    ("hastebin.com",   "Hastebin"),
    ("rentry.co",      "Rentry"),
    ("paste.org",      "paste.org"),
    ("pastebay.net",   "PasteBay"),
    ("zerobin.net",    "ZeroBin"),
    ("privatebin.net", "PrivateBin"),
]


async def _serp(query: str, max_results: int = 10) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}, timeout=12) as c:
            r = await c.post("https://html.duckduckgo.com/html/", data={"q": query})
            if r.status_code != 200:
                return out
            html = r.text or ""
    except Exception:
        return out
    pat = re.compile(r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?<a[^>]+class="result__snippet"[^>]*>(.*?)</a>', re.S | re.I)
    for m in pat.finditer(html):
        href, title, snippet = m.group(1), re.sub(r"<[^>]+>", "", m.group(2)), re.sub(r"<[^>]+>", "", m.group(3))
        if "uddg=" in href:
            try:
                href = urllib.parse.unquote(href.split("uddg=", 1)[1].split("&", 1)[0])
            except Exception:
                pass
        out.append({"url": href, "title": title.strip()[:200], "snippet": snippet.strip()[:400]})
        if len(out) >= max_results:
            break
    return out


def _which_host(url: str) -> str | None:
    u = (url or "").lower()
    for needle, label in PASTE_HOSTS:
        if needle in u:
            return label
    return None


class PasteIntelModule(DetectionModule):
    name = "paste_intel"
    category = "code_leak"
    description = "Brand mention discovery across public paste-sites via SERP dorks."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        brand = ((self.brand.get("brand") or {}).get("name") or "").strip()
        keywords = (self.brand.get("assets") or {}).get("brand_keywords") or []
        terms = [t for t in [brand, *keywords] if t]
        per_host_cap = int(self.cfg.get("max_per_host", 5))

        for term in terms:
            for host, label in PASTE_HOSTS:
                q = f'site:{host} "{term}"'
                try:
                    rows = await _serp(q, max_results=per_host_cap)
                except Exception:
                    rows = []
                for r in rows:
                    if _which_host(r.get("url", "")) != label:
                        continue
                    snippet = r.get("snippet") or ""
                    high_signal = any(s in snippet.lower() for s in ("password", "passwd", "api_key", "token", "secret", "ssh-rsa", "private_key", "credit card", "ssn"))
                    sev_l, sev_i = (4, 5) if high_signal else (3, 3)
                    tag = "[CRED-LIKE]" if high_signal else "[MENTION]"
                    findings.append(Finding.build(
                        title=f"{tag} {label} paste references '{term}'",
                        category="code_leak",
                        module=self.name,
                        affected_asset=term,
                        indicator=r.get("url") or None,
                        description=f"Public paste on {label} mentions '{term}'. Snippet: {snippet[:300]}",
                        likelihood=sev_l, impact=sev_i,
                        recommendation="Open the paste, identify the data type, file a takedown if it contains your data, and rotate any exposed secrets.",
                        remediation_priority=("immediate" if high_signal else "short_term"),
                        references=[r.get("url")] if r.get("url") else [],
                        raw={"host": label, "snippet": snippet[:400]},
                    ))
        return findings
