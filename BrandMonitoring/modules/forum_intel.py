"""Forum-mention discovery.

Hunts brand mentions on the cybercrime / hacking forum landscape
(BreachForums, Leakbase, Cracked, Nulled, Doxbin, etc.) via SERP.
"""
from __future__ import annotations

import asyncio
import re
import urllib.parse
from typing import Any

import httpx

from core.base_module import DetectionModule
from core.evidence import Finding


FORUMS = [
    ("breachforums",    "BreachForums"),
    ("breached.",       "BreachForums-mirror"),
    ("leakbase.",       "Leakbase"),
    ("cracked.",        "Cracked"),
    ("nulled.",         "Nulled"),
    ("doxbin.",         "Doxbin"),
    ("xss.is",          "XSS"),
    ("exploit.in",      "Exploit"),
    ("ramp4u.",         "RAMP"),
    ("dread.",          "Dread"),
    ("raidforums.",     "RaidForums-mirror"),
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


def _which_forum(url: str) -> str | None:
    u = (url or "").lower()
    for needle, label in FORUMS:
        if needle in u:
            return label
    return None


class ForumIntelModule(DetectionModule):
    name = "forum_intel"
    category = "darkweb_exposure"
    description = "Cybercrime forum mention scraper (BreachForums, XSS, Exploit, Doxbin, etc.)."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        brand = ((self.brand.get("brand") or {}).get("name") or "").strip()
        keywords = (self.brand.get("assets") or {}).get("brand_keywords") or []
        terms = [t for t in [brand, *keywords] if t]
        per_forum_cap = int(self.cfg.get("max_per_forum", 5))

        for term in terms:
            for forum_needle, label in FORUMS:
                q = f'"{term}" {forum_needle}'
                try:
                    rows = await _serp(q, max_results=per_forum_cap)
                except Exception:
                    rows = []
                for r in rows:
                    if _which_forum(r.get("url", "")) != label:
                        continue
                    snippet = r.get("snippet") or ""
                    findings.append(Finding.build(
                        title=f"[{label}] '{term}' mentioned in forum thread",
                        category="darkweb_exposure",
                        module=self.name,
                        affected_asset=term,
                        indicator=r.get("url") or None,
                        description=f"Public SERP exposure of {label} thread referencing '{term}'. Snippet: {snippet[:300]}",
                        likelihood=3, impact=4,
                        references=[r.get("url")] if r.get("url") else [],
                        raw={"forum": label, "snippet": snippet[:400]},
                    ))
        return findings
