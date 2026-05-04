"""Counterfeit listings, logo / trademark misuse on marketplaces & search."""
from __future__ import annotations

from typing import Any

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from integrations import apify_client

MARKETPLACES = ("amazon.", "ebay.", "aliexpress.", "etsy.", "flipkart.", "alibaba.", "wish.com", "rakuten.", "shein.com", "temu.com")


class ContentAbuseModule(DetectionModule):
    name = "content_abuse"
    category = "counterfeit_listing"
    description = "Counterfeit product listings and logo/trademark misuse on marketplaces."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        brand = self.brand.get("brand", {}).get("name", "")
        products = (self.brand.get("assets") or {}).get("product_names") or []
        trademarks = (self.brand.get("assets") or {}).get("trademarks") or []

        queries: list[str] = []
        for term in [brand] + products + trademarks:
            if not term:
                continue
            queries.append(f'"{term}" site:amazon.com')
            queries.append(f'"{term}" site:ebay.com')
            queries.append(f'"{term}" site:aliexpress.com')
        if not queries:
            return findings

        results = await apify_client.google_search(queries[:20], results_per_query=10)
        if not results:
            return findings
        self.store.save_raw(self.name, "marketplace_search", results)

        seen = set()
        for r in results[:120]:
            url = r.get("url") or ""
            title = r.get("title") or ""
            if not url or url in seen:
                continue
            seen.add(url)
            if any(m in url.lower() for m in MARKETPLACES):
                findings.append(Finding.build(
                    title=f"Marketplace listing referencing brand: {title[:80]}",
                    category="counterfeit_listing",
                    module=self.name,
                    affected_asset=brand,
                    indicator=url,
                    likelihood=3, impact=3,
                    description=f"Listing on {url} references brand-related term. Verify authorized reseller status.",
                    recommendation="If counterfeit / unauthorized, submit takedown via marketplace IP-protection program (Amazon Brand Registry, eBay VeRO, AliExpress IPP, etc.).",
                    remediation_priority="short_term",
                    evidence=[Evidence(type="url", label="Listing", value=url)],
                    raw=r,
                ))
        return findings
