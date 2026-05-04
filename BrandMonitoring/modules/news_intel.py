"""News + consumer-complaint signal capture.

Two complementary feeds:
  1. Google News RSS — fresh press / blog mentions of the brand.
  2. SERP-based Quora + Reddit complaint discovery.

A burst of news coverage is often the first public signal of a breach,
service outage, or PR incident — the security team wants this visible.
"""
from __future__ import annotations

import asyncio
import re
import urllib.parse
from typing import Any
from xml.etree import ElementTree as ET

import httpx

from core.base_module import DetectionModule
from core.evidence import Finding


GOOGLE_NEWS = "https://news.google.com/rss/search"


async def _google_news(term: str, max_items: int = 20) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    params = {"q": term, "hl": "en-IN", "gl": "IN", "ceid": "IN:en"}
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(GOOGLE_NEWS, params=params)
            if r.status_code != 200:
                return out
            root = ET.fromstring(r.text)
            for item in root.iter("item"):
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                desc = (item.findtext("description") or "").strip()
                pub = (item.findtext("pubDate") or "").strip()
                source_el = item.find("{http://www.w3.org/2005/Atom}link") or item.find("source")
                source = (source_el.text if source_el is not None and source_el.text else None) or ""
                out.append({"title": title[:240], "url": link, "snippet": re.sub(r"<[^>]+>", "", desc)[:300], "published": pub, "source": source[:80]})
                if len(out) >= max_items:
                    break
    except Exception:
        return out
    return out


async def _serp(query: str, max_results: int = 8) -> list[dict[str, Any]]:
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
        out.append({"url": href, "title": title.strip()[:200], "snippet": snippet.strip()[:300]})
        if len(out) >= max_results:
            break
    return out


# Words that bump a news item from "informational" to "high"
INCIDENT_WORDS = ("breach", "leaked", "ransomware", "hack", "phishing", "exposed", "data leak", "scam", "fraud", "compromised", "downtime", "outage")


class NewsIntelModule(DetectionModule):
    name = "news_intel"
    category = "misc"
    description = "Google News + Reddit/Quora complaint surface for brand-related coverage."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        brand = ((self.brand.get("brand") or {}).get("name") or "").strip()
        keywords = (self.brand.get("assets") or {}).get("brand_keywords") or []
        terms = [t for t in [brand, *keywords] if t]
        max_news = int(self.cfg.get("max_news_per_term", 12))
        max_serp = int(self.cfg.get("max_complaints_per_term", 6))

        for term in terms:
            news = await _google_news(term, max_items=max_news)
            for n in news:
                title_lower = (n.get("title", "") + " " + n.get("snippet", "")).lower()
                hit = next((w for w in INCIDENT_WORDS if w in title_lower), None)
                if hit:
                    findings.append(Finding.build(
                        title=f"[NEWS-INCIDENT] {hit.title()}: {n.get('title')[:80]}",
                        category="misc",
                        module=self.name,
                        affected_asset=brand,
                        indicator=n.get("url") or None,
                        description=f"Press / blog coverage matching incident keyword '{hit}'. Source: {n.get('source','?')}. Published: {n.get('published','?')}. Snippet: {n.get('snippet','')[:200]}",
                        likelihood=3, impact=4,
                        references=[n.get("url")] if n.get("url") else [],
                        recommendation="Triage the story; if substantiated, brief comms / PR and align the IR timeline.",
                        raw={"source": n.get("source"), "published": n.get("published")},
                    ))
                else:
                    findings.append(Finding.build(
                        title=f"[NEWS] {n.get('title')[:80]}",
                        category="misc",
                        module=self.name,
                        affected_asset=brand,
                        indicator=n.get("url") or None,
                        description=f"News mention via Google News. Source: {n.get('source','?')}. Snippet: {n.get('snippet','')[:200]}",
                        likelihood=2, impact=2,
                        references=[n.get("url")] if n.get("url") else [],
                        raw={"source": n.get("source"), "published": n.get("published")},
                    ))

            # Reddit + Quora complaint signal
            for site, label in (("site:reddit.com", "Reddit"), ("site:quora.com", "Quora")):
                q = f'{site} "{term}" (complaint OR scam OR fraud OR fake OR cheated)'
                try:
                    serp = await _serp(q, max_results=max_serp)
                except Exception:
                    serp = []
                for r in serp:
                    findings.append(Finding.build(
                        title=f"[{label}-COMPLAINT] {r.get('title','')[:80]}",
                        category="misc",
                        module=self.name,
                        affected_asset=brand,
                        indicator=r.get("url") or None,
                        description=f"Public complaint / negative-sentiment post on {label} mentioning '{term}'. Snippet: {r.get('snippet','')[:240]}",
                        likelihood=2, impact=2,
                        references=[r.get("url")] if r.get("url") else [],
                        raw={"site": label, "snippet": r.get("snippet", "")},
                    ))
        return findings
