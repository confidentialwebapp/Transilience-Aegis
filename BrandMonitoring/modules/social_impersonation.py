"""Social media impersonation:
- Sherlock / Maigret for username enumeration across 350+ platforms.
- Apify scrapers for Instagram / Facebook / Twitter content + screenshots.
- Heuristic match against brand & executive handles.
"""
from __future__ import annotations

import asyncio
from typing import Any

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from integrations import apify_client, maigret_runner, sherlock_runner

OFFICIAL_PLATFORMS = ("twitter.com", "instagram.com", "facebook.com", "linkedin.com", "youtube.com", "tiktok.com", "telegram", "github.com")


class SocialImpersonationModule(DetectionModule):
    name = "social_impersonation"
    category = "social_impersonation"
    description = "Fake handles / pages on social platforms; executive impersonation."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []

        brand = self.brand.get("brand", {}).get("name", "")
        keywords: list[str] = list((self.brand.get("assets") or {}).get("brand_keywords") or [])
        social_handles: dict[str, list[str]] = (self.brand.get("assets") or {}).get("social_handles") or {}
        execs: list[dict[str, Any]] = (self.brand.get("people") or {}).get("executives") or []

        official_set = set()
        for handles in social_handles.values():
            for h in handles or []:
                official_set.add(h.lower().lstrip("@"))

        # 1. Brand handle hunt
        brand_terms = list({brand.lower()} | {k.lower() for k in keywords if k} | {h for h in official_set})
        brand_terms = [t for t in brand_terms if t]

        # 2. Sherlock / Maigret for each brand term + each exec name (slugified)
        candidates = list(brand_terms[:5])
        for e in execs[:5]:
            n = (e.get("name") or "").replace(" ", "").lower()
            if n:
                candidates.append(n)
            for a in (e.get("aliases") or []):
                if a:
                    candidates.append(a.lower())

        candidates = list(dict.fromkeys(candidates))
        sherlock_findings: list[dict[str, Any]] = []
        if self.cfg.get("use_sherlock", True) and sherlock_runner.is_available():
            tasks = [sherlock_runner.find_username(u) for u in candidates[:8]]
            for u, hits in zip(candidates[:8], await asyncio.gather(*tasks, return_exceptions=True)):
                if isinstance(hits, list):
                    for h in hits:
                        h["query"] = u
                        sherlock_findings.append(h)
            self.store.save_raw(self.name, "sherlock", sherlock_findings)
        if self.cfg.get("use_maigret", False) and maigret_runner.is_available():
            tasks = [maigret_runner.find_username(u) for u in candidates[:5]]
            for u, hits in zip(candidates[:5], await asyncio.gather(*tasks, return_exceptions=True)):
                if isinstance(hits, list):
                    for h in hits:
                        h["query"] = u
                        sherlock_findings.append(h)

        for hit in sherlock_findings:
            handle = hit.get("query")
            url = hit.get("url") or ""
            site = hit.get("site") or ""
            # If the handle is in the official list and site matches, skip
            if handle in official_set:
                continue
            # Heuristic: brand-related terms claimed on social platforms = potential impersonation
            if any(p in url.lower() or p in site.lower() for p in OFFICIAL_PLATFORMS):
                findings.append(Finding.build(
                    title=f"Possible impersonation: '{handle}' claimed on {site}",
                    category="social_impersonation",
                    module=self.name,
                    affected_asset=brand,
                    indicator=url,
                    likelihood=3, impact=3,
                    description=f"Username '{handle}' is registered on {site} ({url}). Not in declared official-handles list.",
                    recommendation="Manually verify ownership. If unauthorized, file impersonation report via the platform's takedown channel.",
                    remediation_priority="short_term",
                    evidence=[Evidence(type="url", label=site, value=url)],
                    raw=hit,
                ))

        # 3. Apify deep scrape on Instagram / Facebook / Twitter
        if self.cfg.get("apify_scrape", True):
            findings.extend(await self._apify_hunt(brand, execs, official_set))

        return findings

    async def _apify_hunt(self, brand: str, execs: list[dict[str, Any]], official: set[str]) -> list[Finding]:
        out: list[Finding] = []
        if not brand:
            return out

        ig_results, fb_results, tw_results = await asyncio.gather(
            apify_client.instagram_search(brand, limit=20),
            apify_client.google_search([f'site:facebook.com "{brand}"', f'site:facebook.com/groups "{brand}"'], results_per_query=10),
            apify_client.twitter_search([brand], limit=30),
            return_exceptions=True,
        )

        # Instagram profiles
        if isinstance(ig_results, list):
            self.store.save_raw(self.name, "apify_instagram", ig_results)
            for prof in ig_results:
                username = (prof.get("username") or prof.get("ownerUsername") or "").lower().lstrip("@")
                if not username or username in official:
                    continue
                followers = prof.get("followersCount") or prof.get("followers") or 0
                verified = prof.get("verified", False)
                profile_url = prof.get("url") or f"https://instagram.com/{username}"
                # Heuristic risk: name closely matches brand AND not verified
                like_brand = brand.lower().replace(" ", "") in username.replace(".", "").replace("_", "")
                if like_brand and not verified:
                    likelihood = 4 if followers > 1000 else 3
                    out.append(Finding.build(
                        title=f"Suspected impersonation Instagram account: @{username}",
                        category="social_impersonation",
                        module=self.name,
                        affected_asset=brand,
                        indicator=profile_url,
                        likelihood=likelihood, impact=4,
                        description=(
                            f"Instagram account @{username} ({followers} followers, verified={verified}) "
                            f"closely resembles brand '{brand}' and is not in the declared official list."
                        ),
                        recommendation="Submit Instagram impersonation report (https://help.instagram.com/contact/636276399721841). Capture evidence before takedown.",
                        remediation_priority="short_term",
                        evidence=[
                            Evidence(type="url", label="Profile", value=profile_url),
                            Evidence(type="url", label="Profile pic", value=prof.get("profilePicUrl")),
                        ],
                        raw=prof,
                    ))

        # Facebook (via Google search)
        if isinstance(fb_results, list):
            self.store.save_raw(self.name, "apify_facebook_search", fb_results)
            for r in fb_results[:30]:
                url = r.get("url") or ""
                title = r.get("title") or ""
                if "facebook.com" in url and brand.lower() in (title + url).lower():
                    out.append(Finding.build(
                        title=f"Facebook page mentioning brand: {title[:80]}",
                        category="social_impersonation",
                        module=self.name,
                        affected_asset=brand,
                        indicator=url,
                        likelihood=2, impact=3,
                        description=f"Facebook result references '{brand}'. Verify ownership / authorization.",
                        recommendation="If unauthorized, file Facebook impersonation report.",
                        remediation_priority="short_term",
                        evidence=[Evidence(type="url", label="Facebook", value=url)],
                        raw=r,
                    ))

        # Twitter
        if isinstance(tw_results, list):
            self.store.save_raw(self.name, "apify_twitter", tw_results)
            for tw in tw_results[:50]:
                user = tw.get("user") or {}
                screen_name = (user.get("screen_name") or user.get("username") or "").lower()
                if screen_name and screen_name not in official:
                    if brand.lower() in screen_name:
                        out.append(Finding.build(
                            title=f"Suspected impersonation Twitter/X account: @{screen_name}",
                            category="social_impersonation",
                            module=self.name,
                            affected_asset=brand,
                            indicator=f"https://twitter.com/{screen_name}",
                            likelihood=3, impact=3,
                            description=f"Twitter/X handle @{screen_name} contains brand name and is not declared official.",
                            recommendation="File X impersonation report (https://help.x.com/forms/impersonation).",
                            remediation_priority="short_term",
                            evidence=[Evidence(type="url", label="Profile", value=f"https://twitter.com/{screen_name}")],
                            raw=tw,
                        ))
        return out
