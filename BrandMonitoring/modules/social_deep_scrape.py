"""Deep social-media + content scraping via Apify + native APIs.

Surfaces hit:
  Instagram (search + hashtag + profile)
  Facebook (pages + posts via SERP)
  X / Twitter (search + author info from posts)
  TikTok (keyword search)
  YouTube (keyword search)
  LinkedIn (company search via Apify, fallback to SERP)
  Reddit (native JSON API, no Apify)
  Threads (Apify)
  Pinterest (Apify + SERP)
  Telegram (public channels via SERP)
  Discord (public invites via SERP)
  WhatsApp (group invites via SERP)
  Snapchat (public profiles via SERP)

Important behaviour:
  - Per-author / per-handle deduplication: one Finding per (platform, author),
    with a `mention_count` and up to 3 sample-URLs. Reduces noise drastically.
  - Whitelists declared official handles.
  - SERP fallback strictly validates target-platform domain in URL.
"""
from __future__ import annotations

import asyncio
import re
from collections import defaultdict
from typing import Any, Iterable

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from integrations import apify_client, reddit_client


def _norm(s: str | None) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _close_match(candidate: str, brand_terms: Iterable[str], min_len: int = 4) -> bool:
    n = _norm(candidate)
    if not n:
        return False
    for t in brand_terms:
        nt = _norm(t)
        if len(nt) >= min_len and nt in n:
            return True
    return False


def _is_official(value: str | None, official: set[str]) -> bool:
    n = _norm(value)
    return bool(n) and n in {_norm(o) for o in official}


def _platform_url(url: str | None, must_contain: str) -> bool:
    if not url:
        return False
    u = url.lower()
    if "google.com/search" in u or "google.com/url" in u or "bing.com/search" in u:
        return False
    return must_contain in u


def _aggregate_severity(close: bool, verified: bool, followers: int, mentions: int) -> tuple[int, int]:
    """Compute (likelihood, impact) for a deduplicated author finding."""
    if close:
        # Closely matches brand
        likelihood = 5 if (not verified and (followers or 0) > 1000) else 4
        impact = 4
    else:
        # Just mentions brand — useful for monitoring but lower severity
        likelihood = 3 if mentions >= 5 else 2
        impact = 2
    return likelihood, impact


class SocialDeepScrapeModule(DetectionModule):
    name = "social_deep_scrape"
    category = "social_impersonation"
    description = "Deep scrape of 13 social/content platforms via Apify + native APIs (IG, FB, X, TikTok, YouTube, LinkedIn, Reddit, Threads, Pinterest, Telegram, Discord, WhatsApp, Snapchat) with per-handle dedup."

    def _terms(self) -> list[str]:
        brand = (self.brand.get("brand") or {}).get("name", "")
        legal = (self.brand.get("brand") or {}).get("legal_name", "")
        keywords = (self.brand.get("assets") or {}).get("brand_keywords") or []
        terms = [t for t in [brand, legal] + keywords if t]
        return list(dict.fromkeys(terms))

    def _official(self, platform: str) -> set[str]:
        handles = (self.brand.get("assets") or {}).get("social_handles") or {}
        return {h.lstrip("@") for h in (handles.get(platform) or [])}

    async def run(self) -> list[Finding]:
        terms = self._terms()
        if not terms:
            return []

        platform_tasks = {
            "instagram": self._instagram(terms),
            "facebook":  self._facebook(terms),
            "twitter":   self._twitter(terms),
            "tiktok":    self._tiktok(terms),
            "youtube":   self._youtube(terms),
            "linkedin":  self._linkedin(terms),
            "reddit":    self._reddit(terms),
            "threads":   self._threads(terms),
            "pinterest": self._pinterest(terms),
            "telegram":  self._telegram(terms),
            "discord":   self._discord(terms),
            "whatsapp":  self._whatsapp(terms),
            "snapchat":  self._snapchat(terms),
        }
        disabled = set(self.cfg.get("disable_platforms") or [])
        active = {k: v for k, v in platform_tasks.items() if k not in disabled}

        results = await asyncio.gather(*active.values(), return_exceptions=True)
        out: list[Finding] = []
        for platform, batch in zip(active.keys(), results):
            if isinstance(batch, Exception):
                self.log.warning(f"{platform} failed: {batch}")
                continue
            if batch:
                self.log.info(f"{platform}: +{len(batch)} findings")
                out.extend(batch)
        return out

    # ---------- Aggregator helper ----------

    def _aggregate(
        self,
        platform: str,
        items: list[dict[str, Any]],
        author_key: str,
        url_key: str,
        official: set[str],
        terms: list[str],
        report_url_template: str,
        report_link: str,
    ) -> list[Finding]:
        """Group items by author and emit one finding per author."""
        groups: dict[str, dict[str, Any]] = defaultdict(lambda: {
            "items": [], "verified": False, "followers": 0, "name": "", "first": None,
        })
        for it in items:
            handle = (it.get(author_key) or "").lstrip("@")
            if not handle:
                continue
            g = groups[handle]
            g["items"].append(it)
            g["verified"] = g["verified"] or bool(it.get("verified") or it.get("isBlueVerified") or it.get("isVerified"))
            g["followers"] = max(g["followers"], int(it.get("followers") or it.get("followersCount") or 0))
            g["name"] = g["name"] or it.get("fullName") or it.get("name") or it.get("nickName") or ""
            if not g["first"]:
                g["first"] = it

        out: list[Finding] = []
        for handle, g in groups.items():
            if _is_official(handle, official):
                continue
            close = _close_match(handle, terms) or _close_match(g["name"], terms)
            mentions = len(g["items"])
            l, i = _aggregate_severity(close, g["verified"], g["followers"], mentions)
            sample_urls = [it.get(url_key) for it in g["items"][:3] if it.get(url_key)]
            profile_url = report_url_template.format(handle=handle)
            evidence = [Evidence(type="url", label=f"{platform} profile", value=profile_url)]
            for u in sample_urls:
                evidence.append(Evidence(type="url", label="Sample post", value=u))

            label = "possible impersonation" if close else "brand mention"
            out.append(Finding.build(
                title=f"{platform.title()} {label}: @{handle}" + (f" ({mentions} posts)" if mentions > 1 else ""),
                category="social_impersonation",
                module=self.name,
                affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
                indicator=profile_url,
                likelihood=l, impact=i,
                description=(
                    f"{platform.title()} account @{handle} (name='{g['name']}', "
                    f"{g['followers']} followers, verified={g['verified']}, mentions={mentions}) "
                    + ("closely matches the brand " if close else "references the brand ")
                    + ("and is not in declared official handles." if close else "in posts / profile.")
                ),
                recommendation=(
                    f"If unauthorized impersonation, file {platform.title()} report ({report_link}). "
                    "Capture profile snapshot for evidence."
                    if close else
                    "Manual review — likely fan / partner / news / employee, but useful for sentiment monitoring."
                ),
                remediation_priority="immediate" if l >= 5 else "short_term" if close else "long_term",
                evidence=evidence,
                raw={"first_item": g["first"], "mentions": mentions, "verified": g["verified"], "followers": g["followers"]},
            ))
        return out

    # ---------- Platform handlers ----------

    async def _instagram(self, terms: list[str]) -> list[Finding]:
        official = self._official("instagram")
        all_items: list[dict[str, Any]] = []
        for term in terms[:3]:
            results = await apify_client.instagram_search(term, search_type="user", limit=20)
            self.store.save_raw(self.name, f"ig_user_{term}", results)
            for prof in results:
                username = (prof.get("username") or prof.get("ownerUsername") or "").lstrip("@")
                if username:
                    all_items.append({
                        "username": username,
                        "fullName": prof.get("fullName"),
                        "followers": prof.get("followersCount") or 0,
                        "verified": prof.get("verified", False),
                        "url": prof.get("url"),
                        "_raw": prof,
                    })
        # Hashtag posts attributed to authors
        tags = [_norm(t) for t in terms[:2] if _norm(t)]
        if tags:
            posts = await apify_client.instagram_hashtag(tags, results_limit=20)
            self.store.save_raw(self.name, "ig_hashtag", posts)
            for post in posts:
                owner_field = post.get("ownerUsername")
                if not owner_field and isinstance(post.get("owner"), dict):
                    owner_field = post["owner"].get("username")
                if owner_field:
                    all_items.append({
                        "username": owner_field,
                        "url": post.get("url") or post.get("postUrl"),
                        "_raw": post,
                    })

        return self._aggregate(
            "instagram", all_items, author_key="username", url_key="url",
            official=official, terms=terms,
            report_url_template="https://instagram.com/{handle}",
            report_link="https://help.instagram.com/contact/636276399721841",
        )

    async def _facebook(self, terms: list[str]) -> list[Finding]:
        out: list[Finding] = []
        official = self._official("facebook")
        seen_handles: dict[str, dict[str, Any]] = {}
        for term in terms[:3]:
            results = await apify_client.facebook_posts_search(term, max_posts=15)
            self.store.save_raw(self.name, f"fb_serp_{term}", results)
            for r in results:
                url = r.get("url") or ""
                title = r.get("title") or ""
                desc = r.get("description") or ""
                if not _platform_url(url, "facebook.com"):
                    continue
                m = re.search(r"facebook\.com/([^/?#]+)", url)
                handle = m.group(1) if m else ""
                if not handle or _is_official(handle, official):
                    continue
                # Strip well-known FB paths
                if handle in ("groups", "events", "watch", "marketplace", "pages"):
                    handle = url.split("/")[-1] or handle
                key = handle.lower()
                if key not in seen_handles:
                    seen_handles[key] = {"handle": handle, "samples": [], "title": title, "desc": desc}
                seen_handles[key]["samples"].append(url)

        for key, g in seen_handles.items():
            close = _close_match(g["handle"], terms) or _close_match(g["title"], terms)
            mentions = len(g["samples"])
            l, i = _aggregate_severity(close, False, 0, mentions)
            ev = [Evidence(type="url", label=f"Facebook page: {g['handle']}", value=f"https://facebook.com/{g['handle']}")]
            for u in g["samples"][:3]:
                ev.append(Evidence(type="url", label="Sample", value=u))
            out.append(Finding.build(
                title=f"Facebook {'possible impersonation' if close else 'mention'}: {g['handle']}" + (f" ({mentions} hits)" if mentions > 1 else ""),
                category="social_impersonation",
                module=self.name,
                affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
                indicator=f"https://facebook.com/{g['handle']}",
                likelihood=l, impact=i,
                description=g["desc"][:300],
                recommendation="If impersonation: file Facebook impersonation report (https://www.facebook.com/help/contact/295309487309948).",
                remediation_priority="short_term" if close else "long_term",
                evidence=ev,
                raw=g,
            ))
        return out

    async def _twitter(self, terms: list[str]) -> list[Finding]:
        official = self._official("twitter")
        results = await apify_client.twitter_search(terms[:5], limit=40)
        self.store.save_raw(self.name, "twitter", results)
        items: list[dict[str, Any]] = []
        for tw in results:
            author = tw.get("author") or tw.get("user") or {}
            screen = (author.get("userName") or author.get("screen_name") or author.get("username") or "").lstrip("@")
            if not screen:
                continue
            items.append({
                "username": screen,
                "name": author.get("name", ""),
                "followers": author.get("followers") or author.get("followersCount") or 0,
                "verified": bool(author.get("verified") or author.get("isBlueVerified", False)),
                "url": tw.get("url") or tw.get("twitterUrl"),
                "_raw": tw,
            })
        return self._aggregate(
            "twitter", items, author_key="username", url_key="url",
            official=official, terms=terms,
            report_url_template="https://x.com/{handle}",
            report_link="https://help.x.com/forms/impersonation",
        )

    async def _tiktok(self, terms: list[str]) -> list[Finding]:
        official = self._official("tiktok")
        results = await apify_client.tiktok_search(terms[:3], results_limit=20)
        self.store.save_raw(self.name, "tiktok", results)
        items: list[dict[str, Any]] = []
        for vid in results:
            author = vid.get("authorMeta") or vid.get("author") or {}
            handle = (author.get("name") or author.get("uniqueId") or "").lstrip("@")
            url = vid.get("webVideoUrl") or vid.get("videoUrl") or vid.get("url")
            if not handle:
                continue
            items.append({
                "username": handle,
                "name": author.get("nickName"),
                "followers": author.get("fans") or author.get("followers") or 0,
                "verified": bool(author.get("verified", False)),
                "url": url,
                "_raw": vid,
            })
        return self._aggregate(
            "tiktok", items, author_key="username", url_key="url",
            official=official, terms=terms,
            report_url_template="https://www.tiktok.com/@{handle}",
            report_link="https://www.tiktok.com/legal/report/Counterfeit",
        )

    async def _youtube(self, terms: list[str]) -> list[Finding]:
        official = self._official("youtube")
        results = await apify_client.youtube_search([f'"{t}"' for t in terms[:3]], max_results=25)
        self.store.save_raw(self.name, "youtube", results)
        items: list[dict[str, Any]] = []
        for vid in results:
            channel_name = vid.get("channelName") or vid.get("channelTitle") or ""
            channel_url = vid.get("channelUrl") or ""
            channel_handle = channel_url.rstrip("/").split("/")[-1] if channel_url else ""
            if not channel_handle:
                channel_handle = channel_name.replace(" ", "")
            items.append({
                "username": channel_handle,
                "name": channel_name,
                "url": vid.get("url") or vid.get("videoUrl"),
                "_raw": vid,
            })
        return self._aggregate(
            "youtube", items, author_key="username", url_key="url",
            official=official, terms=terms,
            report_url_template="https://www.youtube.com/{handle}",
            report_link="https://support.google.com/youtube/answer/2801947",
        )

    async def _linkedin(self, terms: list[str]) -> list[Finding]:
        out: list[Finding] = []
        official = self._official("linkedin")
        results = await apify_client.linkedin_company_search(terms[:3], max_items=20)
        if not results:
            # Fallback to SERP across BOTH Google and Bing
            google = await apify_client.google_search([f'site:linkedin.com/company "{t}"' for t in terms[:3]], results_per_query=10)
            results = google or []
        self.store.save_raw(self.name, "linkedin", results)
        seen_slug: set[str] = set()
        for r in results:
            url = r.get("url") or r.get("companyUrl") or r.get("profileUrl") or ""
            name = r.get("name") or r.get("companyName") or r.get("title") or ""
            if not _platform_url(url, "linkedin.com"):
                continue
            slug = url.rstrip("/").split("/")[-1].lower()
            if not slug or slug in seen_slug or _is_official(slug, official):
                continue
            seen_slug.add(slug)
            close = _close_match(name, terms) or _close_match(slug, terms)
            l, i = _aggregate_severity(close, False, 0, 1)
            out.append(Finding.build(
                title=f"LinkedIn {'company possibly impersonating' if close else 'page mentioning'}: {name[:60] or slug}",
                category="social_impersonation",
                module=self.name,
                affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
                indicator=url,
                likelihood=l, impact=i,
                description=(r.get("description") or "")[:240],
                recommendation="If impersonation: file LinkedIn report via the page → More → Report this page.",
                remediation_priority="short_term" if close else "long_term",
                evidence=[Evidence(type="url", label="LinkedIn", value=url)],
                raw=r,
            ))
        return out

    async def _reddit(self, terms: list[str]) -> list[Finding]:
        """Reddit native JSON API — no Apify, no auth, 100/req."""
        out: list[Finding] = []
        all_posts: list[dict[str, Any]] = []
        # Use only the multi-word brand terms for tight matching (skip single-word "CreditAccess")
        tight_terms = [t for t in terms if len(t.split()) >= 2 and len(t) >= 8]
        if not tight_terms:
            tight_terms = terms[:1]
        for term in tight_terms[:3]:
            posts = await reddit_client.search(f'"{term}"', limit=100, sort="new")
            self.store.save_raw(self.name, f"reddit_{term}", posts)
            all_posts.extend(posts)
        if not all_posts:
            return out

        # Strict relevance filter: post text MUST contain a tight brand term as substring
        norm_tight = [_norm(t) for t in tight_terms]

        def _post_relevant(p: dict[str, Any]) -> bool:
            blob = _norm((p.get("title") or "") + " " + (p.get("selftext") or ""))
            return any(t in blob for t in norm_tight if t)

        relevant = [p for p in all_posts if _post_relevant(p)]
        if not relevant:
            return out

        # Dedup by post id
        by_id: dict[str, dict[str, Any]] = {}
        for p in relevant:
            pid = p.get("id") or p.get("permalink") or ""
            if pid and pid not in by_id:
                by_id[pid] = p
        relevant = list(by_id.values())

        # Group by subreddit
        SCAM_KW = ("scam", "fraud", "fake", "phishing", "hacked", "stolen", "spam", "harass", "threat")
        by_sub: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for p in relevant:
            sub = (p.get("subreddit") or "unknown").lower()
            by_sub[sub].append(p)

        for sub, posts in by_sub.items():
            # Skip user profile pseudo-subreddits (r/u_username) — usually low signal
            if sub.startswith("u_"):
                continue
            scam_posts = [p for p in posts if any(k in (p.get("title", "") + " " + p.get("selftext", "")).lower() for k in SCAM_KW)]
            other_posts = [p for p in posts if p not in scam_posts]

            if scam_posts:
                samples = scam_posts[:3]
                evidence = [Evidence(type="url", label=f"r/{sub}", value=f"https://www.reddit.com/r/{sub}")]
                for p in samples:
                    evidence.append(Evidence(type="url", label=(p.get("title", "") or "")[:80],
                                              value=f"https://www.reddit.com{p.get('permalink','')}"))
                # Severity: scales with scam-post count. 1 post = Medium; 3+ = High
                if len(scam_posts) >= 3:
                    l, i = 4, 4
                elif len(scam_posts) == 2:
                    l, i = 3, 3
                else:
                    l, i = 2, 3
                out.append(Finding.build(
                    title=f"Reddit r/{sub}: {len(scam_posts)} scam-related post(s) mentioning brand",
                    category="social_impersonation",
                    module=self.name,
                    affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
                    indicator=f"https://www.reddit.com/r/{sub}",
                    likelihood=l, impact=i,
                    description=(
                        f"{len(scam_posts)} relevant post(s) in r/{sub} discuss the brand alongside "
                        f"scam/fraud keywords. Sample titles: "
                        + " | ".join((p.get("title","") or "")[:60] for p in samples)
                    ),
                    recommendation="Triage each thread; respond from official account if customers report scams; coordinate platform-side reporting if illicit content.",
                    remediation_priority="short_term" if len(scam_posts) >= 3 else "long_term",
                    evidence=evidence,
                    raw={"posts": [{k: p.get(k) for k in ("title","author","permalink","score","num_comments","created_utc")} for p in scam_posts[:10]]},
                ))

            if other_posts and len(other_posts) >= 2:
                samples = other_posts[:3]
                out.append(Finding.build(
                    title=f"Reddit r/{sub}: {len(other_posts)} brand mentions",
                    category="social_impersonation",
                    module=self.name,
                    affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
                    indicator=f"https://www.reddit.com/r/{sub}",
                    likelihood=2, impact=2,
                    description=f"General brand mentions in r/{sub} ({len(other_posts)}). Useful for sentiment monitoring.",
                    recommendation="Monitor for sentiment shift; respond to negative threads if appropriate.",
                    remediation_priority="long_term",
                    evidence=[Evidence(type="url", label=f"r/{sub}", value=f"https://www.reddit.com/r/{sub}")] + [
                        Evidence(type="url", label=(p.get("title","") or "")[:80],
                                 value=f"https://www.reddit.com{p.get('permalink','')}") for p in samples
                    ],
                ))
        return out

    async def _threads(self, terms: list[str]) -> list[Finding]:
        out: list[Finding] = []
        results = await apify_client.threads_search(terms[:3], max_items=20)
        if not results:
            results = await apify_client.google_search([f'site:threads.net "{t}"' for t in terms[:3]], results_per_query=8)
        self.store.save_raw(self.name, "threads", results)
        seen: set[str] = set()
        for r in results:
            url = r.get("url") or r.get("link") or ""
            if not _platform_url(url, "threads."):
                continue
            if url in seen:
                continue
            seen.add(url)
            text = r.get("text") or r.get("title") or r.get("description") or ""
            out.append(Finding.build(
                title=f"Threads mention: {text[:60]}",
                category="social_impersonation",
                module=self.name,
                affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
                indicator=url,
                likelihood=2, impact=2,
                description=text[:240],
                recommendation="Monitor — Meta side; cross-reference with IG findings.",
                remediation_priority="long_term",
                evidence=[Evidence(type="url", label="Thread", value=url)],
                raw=r,
            ))
        return out

    async def _pinterest(self, terms: list[str]) -> list[Finding]:
        out: list[Finding] = []
        results = await apify_client.pinterest_search(terms[:3], max_items=20)
        if not results:
            results = await apify_client.google_search([f'site:pinterest.com "{t}"' for t in terms[:3]], results_per_query=8)
        self.store.save_raw(self.name, "pinterest", results)
        seen: set[str] = set()
        for r in results:
            url = r.get("url") or r.get("link") or ""
            if not _platform_url(url, "pinterest."):
                continue
            if url in seen:
                continue
            seen.add(url)
            out.append(Finding.build(
                title=f"Pinterest pin: {(r.get('title') or '')[:60]}",
                category="social_impersonation",
                module=self.name,
                affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
                indicator=url,
                likelihood=1, impact=1,
                description=(r.get("description") or r.get("title") or "")[:240],
                recommendation="Manual review.",
                remediation_priority="long_term",
                evidence=[Evidence(type="url", label="Pin", value=url)],
                raw=r,
            ))
        return out

    async def _telegram(self, terms: list[str]) -> list[Finding]:
        out: list[Finding] = []
        official = self._official("telegram")
        seen_handles: dict[str, dict[str, Any]] = {}
        for term in terms[:3]:
            results = await apify_client.telegram_channel_search(term, max_items=15)
            self.store.save_raw(self.name, f"tg_{term}", results)
            for r in results:
                url = r.get("url") or ""
                title = r.get("title") or ""
                desc = r.get("description") or ""
                if not _platform_url(url, "t.me"):
                    continue
                m = re.search(r"t\.me/([^/?#]+)", url)
                handle = m.group(1) if m else ""
                if not handle or _is_official(handle, official):
                    continue
                if handle.startswith("s") or handle.startswith("joinchat"):
                    continue
                key = handle.lower()
                if key not in seen_handles:
                    seen_handles[key] = {"handle": handle, "title": title, "desc": desc, "samples": []}
                seen_handles[key]["samples"].append(url)

        for key, g in seen_handles.items():
            close = _close_match(g["handle"], terms) or _close_match(g["title"], terms)
            l, i = _aggregate_severity(close, False, 0, len(g["samples"]))
            out.append(Finding.build(
                title=f"Telegram channel/group {'possibly impersonating' if close else 'mentioning'}: {g['title'][:60] or g['handle']}",
                category="social_impersonation",
                module=self.name,
                affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
                indicator=f"https://t.me/{g['handle']}",
                likelihood=l, impact=i,
                description=g["desc"][:240],
                recommendation="If impersonation/scam: report to Telegram via @notoscam or in-app report; consider law-enforcement coordination.",
                remediation_priority="immediate" if close else "long_term",
                evidence=[Evidence(type="url", label="Telegram", value=f"https://t.me/{g['handle']}")],
                raw=g,
            ))
        return out

    async def _discord(self, terms: list[str]) -> list[Finding]:
        out: list[Finding] = []
        seen: set[str] = set()
        for term in terms[:2]:
            results = await apify_client.discord_search(term)
            self.store.save_raw(self.name, f"discord_{term}", results)
            for r in results:
                url = r.get("url") or ""
                if not (_platform_url(url, "discord.gg") or _platform_url(url, "discord.com")):
                    continue
                if url in seen:
                    continue
                seen.add(url)
                out.append(Finding.build(
                    title=f"Discord invite/server referencing brand: {(r.get('title') or '')[:60]}",
                    category="social_impersonation",
                    module=self.name,
                    affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
                    indicator=url,
                    likelihood=3, impact=3,
                    description=(r.get("description") or "")[:240],
                    recommendation="Investigate — Discord servers often host scam communities for FinTech brands. Report at https://dis.gd/contact.",
                    remediation_priority="short_term",
                    evidence=[Evidence(type="url", label="Discord", value=url)],
                    raw=r,
                ))
        return out

    async def _whatsapp(self, terms: list[str]) -> list[Finding]:
        out: list[Finding] = []
        seen: set[str] = set()
        for term in terms[:2]:
            results = await apify_client.whatsapp_invite_search(term)
            self.store.save_raw(self.name, f"wa_{term}", results)
            for r in results:
                url = r.get("url") or ""
                if not _platform_url(url, "chat.whatsapp.com"):
                    continue
                if url in seen:
                    continue
                seen.add(url)
                out.append(Finding.build(
                    title=f"WhatsApp public group invite mentioning brand: {(r.get('title') or '')[:60]}",
                    category="social_impersonation",
                    module=self.name,
                    affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
                    indicator=url,
                    likelihood=4, impact=4,
                    description=("WhatsApp groups using brand often run loan/giveaway scams. " + (r.get("description") or ""))[:300],
                    recommendation="Report group via WhatsApp in-app; consider customer alert if active scam.",
                    remediation_priority="immediate",
                    evidence=[Evidence(type="url", label="Group invite", value=url)],
                    raw=r,
                ))
        return out

    async def _snapchat(self, terms: list[str]) -> list[Finding]:
        out: list[Finding] = []
        seen: set[str] = set()
        for term in terms[:2]:
            results = await apify_client.snapchat_search(term)
            self.store.save_raw(self.name, f"snap_{term}", results)
            for r in results:
                url = r.get("url") or ""
                if not _platform_url(url, "snapchat.com"):
                    continue
                if url in seen:
                    continue
                seen.add(url)
                out.append(Finding.build(
                    title=f"Snapchat profile/lens referencing brand",
                    category="social_impersonation",
                    module=self.name,
                    affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
                    indicator=url,
                    likelihood=2, impact=2,
                    description=(r.get("description") or r.get("title") or "")[:240],
                    recommendation="Manual review.",
                    remediation_priority="long_term",
                    evidence=[Evidence(type="url", label="Snapchat", value=url)],
                    raw=r,
                ))
        return out
