"""Continuous attack-surface monitoring.

For every enabled customer_profile with a non-empty domains[]:
  1. Run the Modal `attack_surface` composite (subfinder + dnsx + httpx)
  2. Diff vs the last `attack_surface_snapshots` row for that domain
  3. New subdomains or new alive hosts → create an alert
  4. Persist a fresh snapshot

Triggered nightly by the Modal cron (`nightly_attack_surface_diff`) or
manually via /api/v1/attack-surface/run-all.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _client_db():
    from db import get_client
    return get_client()


async def _scan_one(domain: str) -> dict:
    """Wrap the Modal call so failures don't crash the loop."""
    try:
        from modules import modal_recon
        return await modal_recon.attack_surface(domain)
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}", "domain": domain}


async def _last_snapshot(profile_id: str, domain: str) -> dict | None:
    try:
        client = _client_db()
        result = (
            client.table("attack_surface_snapshots").select("*")
            .eq("profile_id", profile_id).eq("domain", domain)
            .order("scanned_at", desc=True).limit(1).execute()
        )
        return result.data[0] if result.data else None
    except Exception as e:
        logger.warning("snapshot fetch failed: %s", e)
        return None


def _diff(prev: dict | None, current: dict) -> dict:
    """Return {new_subdomains: [...], new_alive: [...]}"""
    prev_subs = set(prev.get("subdomains", []) or []) if prev else set()
    curr_subs = set(current.get("subdomains", []) or [])
    prev_alive_hosts = {(h.get("host") or h.get("url") or "")
                        for h in (prev.get("alive_hosts", []) or [])} if prev else set()
    curr_alive_hosts = {(h.get("host") or h.get("url") or "")
                        for h in (current.get("alive", []) or [])}
    return {
        "new_subdomains": sorted(curr_subs - prev_subs),
        "new_alive": sorted(curr_alive_hosts - prev_alive_hosts),
    }


async def _create_diff_alert(org_id: str, profile_id: str, domain: str,
                             diff: dict, scan_result: dict) -> None:
    if not diff["new_subdomains"] and not diff["new_alive"]:
        return
    title = f"Attack-surface change: {domain}"
    desc_parts = []
    if diff["new_subdomains"]:
        n = len(diff["new_subdomains"])
        desc_parts.append(f"*{n} new subdomain{'s' if n > 1 else ''}*: " +
                          ", ".join(diff["new_subdomains"][:10]) +
                          (f" (+{n - 10} more)" if n > 10 else ""))
    if diff["new_alive"]:
        n = len(diff["new_alive"])
        desc_parts.append(f"*{n} new alive host{'s' if n > 1 else ''}*: " +
                          ", ".join(diff["new_alive"][:10]) +
                          (f" (+{n - 10} more)" if n > 10 else ""))
    description = " · ".join(desc_parts)

    try:
        client = _client_db()
        result = client.table("alerts").insert({
            "org_id": org_id,
            "module": "subdomain",
            "severity": "medium",
            "title": title,
            "description": description,
            "raw_data": {
                "domain": domain,
                "profile_id": profile_id,
                "new_subdomains": diff["new_subdomains"],
                "new_alive_hosts": diff["new_alive"],
                "scanned_at": scan_result.get("scanned_at"),
            },
            "risk_score": 50,
            "tags": ["attack-surface", "diff", "subdomain"],
        }).execute()
        new_alert = (result.data or [{}])[0]

        # Fan out to webhooks (real-time delivery)
        try:
            from routers.webhooks import fire_for_alert
            asyncio.create_task(fire_for_alert(new_alert))
        except Exception:
            pass
    except Exception as e:
        logger.warning("attack-surface alert insert failed: %s", e)


async def _persist_snapshot(org_id: str, profile_id: str, domain: str,
                            scan: dict) -> None:
    try:
        _client_db().table("attack_surface_snapshots").insert({
            "org_id": org_id,
            "profile_id": profile_id,
            "domain": domain,
            "subdomains": scan.get("subdomains", []),
            "alive_hosts": scan.get("alive", []),
            "resolved_count": len(scan.get("resolved", [])),
            "alive_count": scan.get("alive_count", 0),
            "raw": scan,
        }).execute()
    except Exception as e:
        logger.warning("snapshot insert failed: %s", e)


async def run_for_profile(profile: dict) -> dict:
    """Scan every domain on this profile, diff, alert, persist."""
    org_id = profile.get("org_id")
    profile_id = profile.get("id")
    domains = [d for d in (profile.get("domains") or []) if d and "." in d]
    if not domains:
        return {"profile_id": profile_id, "scanned": 0, "alerts": 0}

    alerts_created = 0
    for d in domains:
        # Strip wildcards/protocols → bare host
        clean = d.replace("*.", "").replace("https://", "").replace("http://", "").split("/")[0]
        if not clean or "." not in clean:
            continue
        try:
            scan = await _scan_one(clean)
            if not scan or scan.get("ok") is False:
                logger.warning("attack-surface scan failed for %s: %s",
                               clean, scan.get("error") if scan else "no result")
                continue
            prev = await _last_snapshot(profile_id, clean)
            diff = _diff(prev, scan)
            if diff["new_subdomains"] or diff["new_alive"]:
                await _create_diff_alert(org_id, profile_id, clean, diff, scan)
                alerts_created += 1
            await _persist_snapshot(org_id, profile_id, clean, scan)
        except Exception as e:
            logger.warning("attack-surface run for %s/%s failed: %s",
                           profile_id, clean, e)

    return {"profile_id": profile_id, "scanned": len(domains), "alerts": alerts_created}


async def run_all() -> dict:
    """Iterate every enabled customer_profile and scan their domains."""
    try:
        client = _client_db()
        profiles_q = (
            client.table("customer_profiles").select("*")
            .eq("enabled", True).execute()
        )
        profiles = profiles_q.data or []
    except Exception as e:
        return {"ok": False, "error": str(e)}

    if not profiles:
        return {"ok": True, "profiles": 0, "scanned": 0, "alerts_created": 0}

    total_scanned = 0
    total_alerts = 0
    for p in profiles:
        try:
            r = await run_for_profile(p)
            total_scanned += r.get("scanned", 0)
            total_alerts += r.get("alerts", 0)
        except Exception as e:
            logger.warning("attack-surface profile %s failed: %s", p.get("id"), e)
    return {
        "ok": True,
        "profiles": len(profiles),
        "scanned": total_scanned,
        "alerts_created": total_alerts,
    }
