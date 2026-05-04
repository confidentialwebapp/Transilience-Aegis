"""Initial Access Broker (IAB) intel (DRP).

Hunts for "selling access" listings naming the brand on the major underground
forums (XSS, Exploit, BreachForums, RAMP). Two complementary backends:
  1. IntelX — paid search across crawled paste / forum corpora.
  2. Free-text SERP via DuckDuckGo HTML — no API key needed, low signal but
     catches publicly-indexed forum threads (e.g. on Telegram dumps mirrors).

Critical-severity hits when the brand is named directly (e.g. "selling
access to ACME"). Otherwise high.
"""
from __future__ import annotations

import asyncio
import re
import urllib.parse
from typing import Any

import httpx

from core.base_module import DetectionModule
from core.evidence import Finding
from integrations import intelx_client


# Multi-language access-broker dorks
DORK_TEMPLATES = [
    'selling access "{brand}"',
    'selling rdp "{brand}"',
    '"{brand}" domain admin',
    '"{brand}" vpn access',
    '"{brand}" shell access',
    'продаю доступ "{brand}"',     # Russian: "selling access"
    '"{brand}" доступ',
]


async def _serp_duckduckgo(query: str, max_results: int = 10) -> list[dict[str, Any]]:
    """Free-text SERP via DuckDuckGo HTML — no API key required."""
    out: list[dict[str, Any]] = []
    url = "https://html.duckduckgo.com/html/"
    try:
        async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}, timeout=12) as client:
            r = await client.post(url, data={"q": query})
            if r.status_code != 200:
                return out
            html = r.text or ""
    except Exception:
        return out
    # Light parser — pulls anchor + snippet
    pat = re.compile(r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?<a[^>]+class="result__snippet"[^>]*>(.*?)</a>', re.S | re.I)
    for m in pat.finditer(html):
        href, title, snippet = m.group(1), re.sub(r"<[^>]+>", "", m.group(2)), re.sub(r"<[^>]+>", "", m.group(3))
        # DDG sometimes wraps the URL in their tracking redirect
        if "uddg=" in href:
            try:
                href = urllib.parse.unquote(href.split("uddg=", 1)[1].split("&", 1)[0])
            except Exception:
                pass
        out.append({"url": href, "title": title.strip()[:200], "snippet": snippet.strip()[:300]})
        if len(out) >= max_results:
            break
    return out


def _is_forum(url: str) -> str | None:
    """Return forum label if URL hints at one of the access-broker forums."""
    forums = [
        ("xss.is", "XSS"), ("xssforum", "XSS"),
        ("exploit.in", "Exploit"), ("exploitforum", "Exploit"),
        ("breachforums", "BreachForums"), ("breached.", "BreachForums"),
        ("ramp4u", "RAMP"), ("ramp.", "RAMP"),
        ("nulled.", "Nulled"), ("cracked.", "Cracked"),
        ("leakbase.", "Leakbase"), ("doxbin.", "Doxbin"),
    ]
    u = (url or "").lower()
    for needle, label in forums:
        if needle in u:
            return label
    return None


class IabIntelModule(DetectionModule):
    name = "iab_intel"
    category = "darkweb_exposure"
    description = "Hunts for 'selling access' listings naming the brand on underground forums."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        brand = ((self.brand.get("brand") or {}).get("name") or "").strip()
        keywords = (self.brand.get("assets") or {}).get("brand_keywords") or []
        terms = list({brand, *(keywords or [])})

        if not terms:
            return findings

        max_per_source = int(self.cfg.get("max_per_source", 8))

        # IntelX search
        for term in terms:
            if not term:
                continue
            try:
                rows = await intelx_client.search(f'"selling access" "{term}"', max_results=max_per_source)
            except Exception:
                rows = []
            for r in rows or []:
                url = (r.get("name") or r.get("systemid") or "").strip()
                snippet = (r.get("metadata") or "")[:300]
                forum = _is_forum(url) or "intelx-cached"
                findings.append(Finding.build(
                    title=f"[IAB-{forum}] '{term}' mentioned in access-broker corpus",
                    category="darkweb_exposure",
                    module=self.name,
                    affected_asset=brand,
                    indicator=url or None,
                    description=f"IntelX result references '{term}' alongside access-broker terminology. Snippet: {snippet}",
                    likelihood=4, impact=5,
                    remediation_priority="immediate",
                    raw={"source": "intelx", "snippet": snippet},
                ))

        # SERP fallback
        for tmpl in DORK_TEMPLATES:
            for term in terms:
                if not term:
                    continue
                q = tmpl.format(brand=term)
                try:
                    serp = await _serp_duckduckgo(q, max_results=max_per_source)
                except Exception:
                    serp = []
                for r in serp:
                    forum = _is_forum(r.get("url", ""))
                    if not forum:
                        continue
                    findings.append(Finding.build(
                        title=f"[IAB-{forum}] thread referencing '{term}': {r.get('title', '')[:60]}",
                        category="darkweb_exposure",
                        module=self.name,
                        affected_asset=brand,
                        indicator=r.get("url") or None,
                        description=f"Public SERP exposure of an access-broker forum post mentioning '{term}'. Snippet: {r.get('snippet', '')}",
                        likelihood=3, impact=5,
                        references=[r.get("url")] if r.get("url") else [],
                        remediation_priority="immediate",
                        raw={"source": "serp", "query": q, "snippet": r.get("snippet", "")},
                    ))
        return findings
