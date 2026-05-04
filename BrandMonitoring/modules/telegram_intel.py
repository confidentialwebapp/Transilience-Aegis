"""Deep Telegram intelligence module.

Pipeline:
  1. Discover candidate channel/group handles via Apify SERP
     (Google + Bing for site:t.me + brand keywords).
  2. Use Apify dedicated Telegram-channel scraper actor where available.
  3. For each discovered handle, fetch its public web preview (https://t.me/s/<handle>)
     to read the last ~20 messages — no auth, no API key needed.
  4. Filter messages that mention brand or industry-lure keywords.
  5. Extract IOCs (phones, UPIs, bank accounts, WhatsApp numbers, crypto addrs).
  6. Score severity: scam-keyword + IOC presence + brand mention = High.
"""
from __future__ import annotations

import asyncio
import re
from typing import Any

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from core.lures import expand_keywords
from integrations import apify_client, telegram_web

SCAM_KEYWORDS = (
    "loan", "instant loan", "approve", "kyc", "kyc update", "card block",
    "support", "customer care", "helpline", "recovery", "refund",
    "withdraw", "earning", "free", "guarantee", "100%", "limited time",
    "click below", "register now", "claim", "winner", "prize", "lucky",
    "investment", "double", "trader", "bitcoin", "crypto", "pay",
)


def _channel_url(handle: str) -> str:
    return f"https://t.me/{handle.lstrip('@')}"


def _normalized(s: str | None) -> str:
    return (s or "").lower()


def _contains_brand(text: str, brand_terms: list[str]) -> bool:
    t = text.lower()
    return any(b.lower() in t for b in brand_terms if b)


def _contains_scam(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in SCAM_KEYWORDS)


class TelegramIntelModule(DetectionModule):
    name = "telegram_intel"
    category = "social_impersonation"
    description = "Deep Telegram public-channel scraping: discover handles, fetch recent messages, extract scam IOCs (phones / UPIs / bank accounts)."

    async def run(self) -> list[Finding]:
        brand = (self.brand.get("brand") or {}).get("name", "")
        keywords = (self.brand.get("assets") or {}).get("brand_keywords") or []
        industry = (self.brand.get("brand") or {}).get("industry")
        official = {h.lstrip("@") for h in ((self.brand.get("assets") or {}).get("social_handles") or {}).get("telegram") or []}

        brand_terms = list({*[brand], *keywords, (self.brand.get("brand") or {}).get("legal_name", "")})
        brand_terms = [b for b in brand_terms if b]
        if not brand_terms:
            return []

        # Industry-lure keyword expansion (for SERP discovery)
        expanded = expand_keywords(brand_terms, industry, max_combinations=12)

        # === Step 1: discover Telegram channel handles ===
        handles = await self._discover_handles(brand_terms, expanded, official)
        if not handles:
            return []
        self.log.info(f"telegram_intel: {len(handles)} candidate channels discovered")

        # === Step 2: scrape each channel's preview page ===
        # Bound concurrency since we're hitting t.me directly
        sem = asyncio.Semaphore(int(self.cfg.get("scrape_concurrency", 6)))
        async def _scrape(h: str):
            async with sem:
                return h, await telegram_web.channel_preview(h)
        scraped = await asyncio.gather(*(_scrape(h) for h in handles), return_exceptions=False)

        findings: list[Finding] = []
        for handle, data in scraped:
            if not data:
                continue
            self.store.save_raw(self.name, f"channel_{handle}", data)
            finding = self._build_finding(handle, data, brand_terms, official)
            if finding:
                findings.append(finding)

        return findings

    # ------------------------------------------------------------------
    async def _discover_handles(self, brand_terms: list[str], expanded: list[str], official: set[str]) -> list[str]:
        """Find candidate Telegram channel handles via Apify SERP queries."""
        queries: list[str] = []
        for t in brand_terms[:3]:
            queries += [
                f'site:t.me "{t}"',
                f'site:telegram.me "{t}"',
                f'"{t}" telegram channel',
                f'"{t}" telegram group',
            ]
        # Industry-lure combos (e.g. "creditaccess loan" → site:t.me)
        for ex in expanded:
            if ex not in brand_terms:
                queries.append(f'site:t.me "{ex}"')

        queries = list(dict.fromkeys(queries))[:14]
        results = await apify_client.google_search(queries, results_per_query=10)
        self.store.save_raw(self.name, "discovery_serp", results)

        handle_re = re.compile(r"https?://t\.me/(?:s/)?([a-zA-Z0-9_]{4,32})", re.IGNORECASE)
        invite_re = re.compile(r"https?://t\.me/(?:joinchat|\+)([A-Za-z0-9_\-]+)", re.IGNORECASE)
        handles: set[str] = set()
        for r in results or []:
            for field in (r.get("url"), r.get("description"), r.get("title")):
                if not field:
                    continue
                for m in handle_re.findall(field):
                    h = m.lower()
                    if h in ("s", "share", "joinchat", "iv", "addstickers", "addtheme", "telegram"):
                        continue
                    if h in {o.lower() for o in official}:
                        continue
                    handles.add(h)
                # Invite links can't be previewed without joining — log but skip
                _ = invite_re.findall(field)

        return sorted(handles)[: int(self.cfg.get("max_channels", 25))]

    # ------------------------------------------------------------------
    def _build_finding(self, handle: str, data: dict[str, Any], brand_terms: list[str], official: set[str]) -> Finding | None:
        if handle.lower() in {o.lower() for o in official}:
            return None

        messages = data.get("messages") or []
        title = data.get("title", handle)
        desc = data.get("description", "")
        subs = data.get("subscribers") or "?"

        # Combine all text for scoring
        all_text = "\n".join(
            [title, desc] + [(m.get("text") or "") for m in messages]
        )
        all_iocs: dict[str, set[str]] = {}
        scam_msgs: list[dict[str, Any]] = []
        brand_msgs: list[dict[str, Any]] = []

        for m in messages:
            text = m.get("text", "")
            if _contains_brand(text, brand_terms):
                brand_msgs.append(m)
            if _contains_scam(text):
                scam_msgs.append(m)
            iocs = telegram_web.extract_iocs(text)
            for k, vals in iocs.items():
                all_iocs.setdefault(k, set()).update(vals)
        # Channel-level metadata IOCs
        meta_iocs = telegram_web.extract_iocs(title + " " + desc)
        for k, vals in meta_iocs.items():
            all_iocs.setdefault(k, set()).update(vals)

        if not (brand_msgs or _contains_brand(title + " " + desc, brand_terms) or _contains_brand(handle, brand_terms)):
            # No brand mention anywhere — skip
            return None

        # Scoring
        is_scam = bool(scam_msgs and (brand_msgs or _contains_brand(handle, brand_terms)))
        has_iocs = bool(all_iocs)
        impersonates = any(b.lower().replace(" ", "") in handle.lower().replace("_", "") for b in brand_terms)

        if is_scam and impersonates:
            likelihood, impact = 5, 5
        elif is_scam or impersonates:
            likelihood, impact = 4, 4
        elif brand_msgs and has_iocs:
            likelihood, impact = 4, 4
        elif brand_msgs:
            likelihood, impact = 3, 3
        else:
            likelihood, impact = 2, 2

        # Title
        if is_scam:
            t_prefix = "Telegram SCAM channel"
        elif impersonates:
            t_prefix = "Telegram channel possibly impersonating"
        else:
            t_prefix = "Telegram channel mentions"

        sample_msgs = (scam_msgs + brand_msgs + messages)[:3]
        ev = [Evidence(type="url", label=f"Channel @{handle}", value=_channel_url(handle))]
        for m in sample_msgs[:3]:
            if m.get("url"):
                ev.append(Evidence(type="url", label=(m.get("text") or "")[:80], value=m["url"]))
        # IOC summary
        ioc_summary = ", ".join(f"{k}={len(v)}" for k, v in all_iocs.items())

        description = (
            f"Telegram channel '{title}' (@{handle}, {subs} subscribers). "
            f"{len(brand_msgs)} messages reference the brand"
            + (f", {len(scam_msgs)} contain scam-pattern keywords" if scam_msgs else "")
            + (f". IOCs extracted: {ioc_summary}" if ioc_summary else "")
            + ".\nSample bio: " + (desc or "")[:200]
        )

        # Persist IOC list as serializable
        all_iocs_serial = {k: sorted(v) for k, v in all_iocs.items()}

        return Finding.build(
            title=f"{t_prefix}: {title} (@{handle})",
            category="social_impersonation",
            module=self.name,
            affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
            indicator=_channel_url(handle),
            likelihood=likelihood, impact=impact,
            description=description,
            recommendation=(
                "Investigate the channel; if active scam, file Telegram abuse report (@notoscam, "
                "abuse@telegram.org), notify customers via official security channel, push extracted "
                "phone/UPI/account-number IOCs to bank/payment-provider fraud desks for blocking."
                if is_scam else
                "Monitor; verify whether channel impersonates the brand or merely mentions it. "
                "Consider takedown if logo or trademark misuse detected."
            ),
            remediation_priority="immediate" if is_scam or impersonates else "short_term",
            mitre_attack=["T1583.001", "T1566", "T1657"] if is_scam else ["T1583.001"],
            evidence=ev,
            raw={
                "channel": {k: v for k, v in data.items() if k != "messages"},
                "brand_message_count": len(brand_msgs),
                "scam_message_count": len(scam_msgs),
                "extracted_iocs": all_iocs_serial,
                "sample_messages": [{
                    "text": m.get("text", "")[:300],
                    "date": m.get("date"),
                    "url": m.get("url"),
                } for m in sample_msgs],
            },
        )
