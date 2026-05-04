"""Mobile app abuse: rogue listings on Play / App Store / APK mirrors.

Strategy:
  - Search Google Play and Apple App Store for the brand name.
  - Compare results against declared official package IDs.
  - Flag unofficial listings whose name/developer plausibly references the brand
    (substring match against brand or any brand keyword) as potential rogue apps.
  - Search Apify google_search for "<brand> apk" hits on third-party APK sites.
"""
from __future__ import annotations

import asyncio
import re
from typing import Any, Iterable

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from core.http import get_text, request_json
from integrations import apify_client


def _normalize(s: str | None) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _matches_brand(text: str, terms: Iterable[str]) -> bool:
    n = _normalize(text)
    for t in terms:
        nt = _normalize(t)
        if nt and len(nt) >= 4 and nt in n:
            return True
    return False


class MobileAppsModule(DetectionModule):
    name = "mobile_apps"
    category = "mobile_app_abuse"
    description = "Rogue / impersonating mobile apps across stores and APK mirrors."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        brand = self.brand.get("brand", {}).get("name", "")
        keywords = (self.brand.get("assets") or {}).get("brand_keywords") or []
        match_terms = [t for t in [brand] + keywords if t]
        official = self.brand.get("assets", {}).get("mobile_apps", {}) or {}
        official_android = set(official.get("android") or [])
        official_ios = set(str(i) for i in (official.get("ios") or []))

        if "google_play" in (self.cfg.get("stores") or []):
            findings.extend(await self._google_play(brand, match_terms, official_android))
        if "apple_app_store" in (self.cfg.get("stores") or []):
            findings.extend(await self._app_store(brand, match_terms, official_ios))
        if "apkpure" in (self.cfg.get("stores") or []):
            findings.extend(await self._apk_mirrors(brand))
        return findings

    async def _google_play(self, brand: str, match_terms: list[str], official_android: set[str]) -> list[Finding]:
        out: list[Finding] = []
        # Use Google Play search via their HTML (no official open API).
        url = f"https://play.google.com/store/search?q={brand}&c=apps"
        html = await get_text(url)
        if not html:
            return out
        package_re = re.compile(r"/store/apps/details\?id=([\w\.]+)")
        packages = list(dict.fromkeys(package_re.findall(html)))
        if not packages:
            return out
        self.store.save_raw(self.name, f"play_search_{brand}", {"packages": packages})

        for pkg in packages[:30]:
            if pkg in official_android:
                continue
            if not _matches_brand(pkg, match_terms):
                continue
            out.append(Finding.build(
                title=f"Unofficial Google Play app referencing brand: {pkg}",
                category="mobile_app_abuse",
                module=self.name,
                affected_asset=brand,
                indicator=f"https://play.google.com/store/apps/details?id={pkg}",
                likelihood=3, impact=4,
                description=f"Search for '{brand}' on Google Play surfaced package {pkg}, which is not in the declared official package list and references the brand in its identifier.",
                recommendation="Manually verify package; if rogue, file Google Play infringement report (DMCA / brand abuse).",
                remediation_priority="short_term",
                evidence=[Evidence(type="url", label="Play Store listing", value=f"https://play.google.com/store/apps/details?id={pkg}")],
            ))
        return out

    async def _app_store(self, brand: str, match_terms: list[str], official_ios: set[str]) -> list[Finding]:
        out: list[Finding] = []
        # iTunes Search API is open / free.
        r = await request_json(
            "GET", "https://itunes.apple.com/search",
            params={"term": brand, "entity": "software", "limit": 50, "country": "us"},
        )
        if not isinstance(r, dict):
            return out
        results = r.get("results") or []
        self.store.save_raw(self.name, f"appstore_{brand}", results)
        for app in results:
            track_id = str(app.get("trackId") or "")
            if track_id in official_ios:
                continue
            track_name = app.get("trackName") or ""
            seller = app.get("sellerName") or ""
            bundle = app.get("bundleId") or ""
            if not _matches_brand(track_name, match_terms) and not _matches_brand(seller, match_terms) and not _matches_brand(bundle, match_terms):
                continue
            url = app.get("trackViewUrl")
            out.append(Finding.build(
                title=f"Unofficial App Store app referencing brand: {track_name}",
                category="mobile_app_abuse",
                module=self.name,
                affected_asset=brand,
                indicator=url,
                likelihood=3, impact=4,
                description=f"App '{track_name}' by '{seller}' (bundle: {bundle}) references brand and is not in declared official iOS app list.",
                recommendation="Verify legitimacy. If rogue, submit Apple App Store content dispute and iOS app removal request.",
                remediation_priority="short_term",
                evidence=[Evidence(type="url", label="App Store listing", value=url)],
                raw=app,
            ))
        return out

    async def _apk_mirrors(self, brand: str) -> list[Finding]:
        out: list[Finding] = []
        results = await apify_client.google_search([f'"{brand}" site:apkpure.com', f'"{brand}" site:apkmirror.com', f'"{brand}" apk download'], results_per_query=10)
        if not results:
            return out
        self.store.save_raw(self.name, f"apk_search_{brand}", results)
        seen = set()
        for r in results[:40]:
            url = r.get("url") or ""
            if not url or url in seen:
                continue
            seen.add(url)
            if any(s in url.lower() for s in ("apkpure.com", "apkmirror.com", "aptoide.com", "uptodown.com")):
                out.append(Finding.build(
                    title=f"Brand-named APK on third-party mirror: {url[:80]}",
                    category="mobile_app_abuse",
                    module=self.name,
                    affected_asset=brand,
                    indicator=url,
                    likelihood=3, impact=4,
                    description="Third-party APK mirror hosts an app referencing the brand. Risk of trojanised builds.",
                    recommendation="If unauthorized distribution, file DMCA / brand-abuse takedown with the mirror. Educate customers to install only from official stores.",
                    remediation_priority="short_term",
                    evidence=[Evidence(type="url", label="Mirror listing", value=url)],
                    raw=r,
                ))
        return out
