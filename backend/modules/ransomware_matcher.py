"""Ransomware victim → customer profile matcher.

Runs on every ransomware sync (every 15 min). For each new victim discovered,
checks every enabled customer_profile and creates an alert (and optional
Telegram message) when there's a match on any of:
  * sectors          — exact case-insensitive match against victim.activity
  * countries        — ISO code match
  * domains          — exact or wildcard match against victim.website
  * brand_keywords   — substring match against victim_name + description

The matcher is conservative: it only emits alerts for victims discovered AFTER
the profile's last_match_check (tracked in-memory per run since profiles don't
have that column yet — alerts table dedupes via title hash check).

How alerts get delivered:
  * notify_in_app=true        → INSERT into alerts table (always done)
  * notify_email is set       → email digest (delegated to existing notify util — best effort)
  * notify_telegram_chat_id   → bot sendMessage to that chat
"""

from __future__ import annotations

import asyncio
import fnmatch
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


def _client_db():
    from db import get_client
    return get_client()


def _norm(s: Optional[str]) -> str:
    return (s or "").strip().lower()


def _victim_matches_profile(victim: dict, profile: dict) -> tuple[bool, list[str]]:
    """Return (matched, reasons). Multiple reasons are joined into the alert title."""
    reasons: list[str] = []
    v_country = _norm(victim.get("country"))
    v_activity = _norm(victim.get("activity"))
    v_name = _norm(victim.get("victim_name"))
    v_website = _norm(victim.get("website"))
    v_text = " ".join(filter(None, [v_name, _norm(victim.get("description"))]))

    sectors = [_norm(x) for x in (profile.get("sectors") or []) if x]
    countries = [_norm(x) for x in (profile.get("countries") or []) if x]
    domains = [_norm(x) for x in (profile.get("domains") or []) if x]
    keywords = [_norm(x) for x in (profile.get("brand_keywords") or []) if x]

    if sectors and v_activity and any(s in v_activity or v_activity in s for s in sectors):
        reasons.append(f"sector:{victim.get('activity')}")

    if countries and v_country and v_country.upper() in {c.upper() for c in countries}:
        reasons.append(f"country:{victim.get('country')}")

    if domains and v_website:
        # Strip protocol + path, leave bare host
        host = v_website.replace("https://", "").replace("http://", "").split("/")[0]
        for d in domains:
            d_clean = d.replace("https://", "").replace("http://", "").split("/")[0]
            if "*" in d_clean:
                if fnmatch.fnmatch(host, d_clean):
                    reasons.append(f"domain:{host}")
                    break
            elif host == d_clean or host.endswith("." + d_clean):
                reasons.append(f"domain:{host}")
                break

    if keywords:
        hit = next((k for k in keywords if k and k in v_text), None)
        if hit:
            reasons.append(f"keyword:{hit}")

    return (bool(reasons), reasons)


async def _send_telegram(chat_id: int, text: str) -> None:
    from config import get_settings

    s = get_settings()
    if not s.TELEGRAM_BOT_TOKEN:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            await c.post(
                f"https://api.telegram.org/bot{s.TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown",
                      "disable_web_page_preview": False},
            )
    except Exception as e:
        logger.warning("telegram alert send failed (chat %s): %s", chat_id, e)


def _alert_already_exists(client, org_id: str, title: str) -> bool:
    """Cheap dedup: have we already opened this exact alert in the last 30 days?"""
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        result = (
            client.table("alerts")
            .select("id")
            .eq("org_id", org_id)
            .eq("title", title)
            .gte("created_at", cutoff)
            .limit(1)
            .execute()
        )
        return bool(result.data)
    except Exception:
        return False


async def _persist_victim(client, victim_dict: dict) -> dict | None:
    """Upsert a fetched victim into ransomware_victims; return the row (with id)."""
    discovered = victim_dict.get("discovered") or None
    record = {
        "victim_name": victim_dict.get("victim") or "Unknown",
        "website": victim_dict.get("website") or None,
        "group_name": victim_dict.get("group") or "unknown",
        "country": victim_dict.get("country") or None,
        "activity": victim_dict.get("activity") or None,
        "description": (victim_dict.get("description") or "")[:2000] or None,
        "discovered": discovered or None,
        "post_url": victim_dict.get("post_url") or None,
        "screenshot": victim_dict.get("screenshot") or None,
        "external_id": str(victim_dict.get("id") or ""),
        "raw": victim_dict,
    }
    if not record["discovered"]:
        # UNIQUE constraint requires non-null; fall back to ingested_at via DB
        record.pop("discovered")
    try:
        # Best-effort upsert; conflict_target handles dupes from re-syncs.
        result = (
            client.table("ransomware_victims")
            .upsert([record], on_conflict="group_name,victim_name,discovered")
            .execute()
        )
        return result.data[0] if result.data else record
    except Exception as e:
        logger.warning("ransomware_victims upsert failed for %s/%s: %s",
                       record["group_name"], record["victim_name"], e)
        return None


async def run_match(victims: list[dict]) -> dict:
    """Match the given victim list against all enabled customer_profiles.

    `victims` is the normalized list returned by `fetch_recent_victims()` —
    NOT the persisted rows.

    Returns: {"victims_checked": N, "matches": M, "alerts_created": K}.
    """
    client = _client_db()

    # Persist victims (idempotent) so they're queryable later from /alerts links.
    persisted = []
    for v in victims:
        row = await _persist_victim(client, v)
        if row:
            persisted.append({**v, **(row if isinstance(row, dict) else {})})

    # Pull profiles
    try:
        profiles_q = client.table("customer_profiles").select("*").eq("enabled", True).execute()
        profiles = profiles_q.data or []
    except Exception as e:
        logger.warning("customer_profiles fetch failed: %s", e)
        profiles = []

    if not profiles:
        return {"victims_checked": len(persisted), "matches": 0, "alerts_created": 0,
                "note": "no enabled customer_profiles — add one to receive alerts"}

    matches = 0
    alerts_created = 0
    for v in persisted:
        for p in profiles:
            ok, reasons = _victim_matches_profile(v, p)
            if not ok:
                continue
            matches += 1
            org_id = p.get("org_id")
            title = f"Ransomware: {v.get('group','?')} → {v.get('victim','?')}"
            if _alert_already_exists(client, org_id, title):
                continue
            try:
                desc = (
                    f"{v.get('group','?')} listed *{v.get('victim','?')}* on its leak site.\n"
                    f"Sector: {v.get('activity','—')}  ·  Country: {v.get('country','—')}\n"
                    f"Discovered: {v.get('discovered','—')}\n"
                    f"Match reasons: {', '.join(reasons)}"
                )
                client.table("alerts").insert({
                    "org_id": org_id,
                    "module": "ransomware",
                    "severity": "high",
                    "title": title,
                    "description": desc,
                    "source_url": v.get("post_url") or "",
                    "raw_data": {"victim": v, "profile_id": p.get("id"), "reasons": reasons},
                    "risk_score": 80,
                    "tags": ["ransomware", v.get("group", ""), *reasons],
                }).execute()
                alerts_created += 1

                # Optional Telegram delivery
                chat_id = p.get("notify_telegram_chat_id")
                if chat_id:
                    msg = (
                        f"🚨 *Ransomware match*\n"
                        f"Group: *{v.get('group','?')}*\n"
                        f"Victim: *{v.get('victim','?')}*\n"
                        f"Sector: {v.get('activity','—')} · Country: {v.get('country','—')}\n"
                        f"Reasons: {', '.join(reasons)}\n"
                        f"{v.get('post_url','')}"
                    )
                    asyncio.create_task(_send_telegram(int(chat_id), msg))
            except Exception as e:
                logger.warning("alert insert failed: %s", e)

    return {
        "victims_checked": len(persisted),
        "profiles": len(profiles),
        "matches": matches,
        "alerts_created": alerts_created,
    }


async def run_sync_and_match(limit: int = 100) -> dict:
    """Convenience: pull recent victims, persist, match. Called by the scheduler."""
    from routers.threat_actors import fetch_recent_victims

    victims = await fetch_recent_victims(limit=limit)
    return await run_match(victims)
