import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

import httpx

from config import get_settings
from db import get_client
from utils.rate_limiter import RateLimiter
from utils.notify import dispatch_alert

logger = logging.getLogger(__name__)

_rate_limiter: Optional[RateLimiter] = None


def _get_rate_limiter() -> RateLimiter:
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


async def query_crtsh(domain: str) -> List[Dict]:
    """Query crt.sh JSON API for certificate transparency logs.

    Handles large responses and enforces a 60s timeout.
    """
    rl = _get_rate_limiter()
    await rl.wait("crtsh", min_interval=2.0)
    certs = []

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(
                "https://crt.sh/",
                params={"q": f"%.{domain}", "output": "json"},
            )
            if resp.status_code != 200:
                logger.warning(f"crt.sh returned {resp.status_code} for {domain}")
                return []

            try:
                data = resp.json()
            except Exception:
                logger.warning(f"crt.sh response was not valid JSON for {domain}")
                return []

            # Cap at 5000 entries to prevent memory issues on large domains
            for entry in data[:5000]:
                certs.append({
                    "id": entry.get("id"),
                    "issuer_name": entry.get("issuer_name", ""),
                    "common_name": entry.get("common_name", ""),
                    "name_value": entry.get("name_value", ""),
                    "not_before": entry.get("not_before", ""),
                    "not_after": entry.get("not_after", ""),
                    "serial_number": entry.get("serial_number", ""),
                })

    except httpx.TimeoutException:
        logger.warning(f"crt.sh request timed out for {domain}")
    except Exception as e:
        logger.warning(f"crt.sh query failed for {domain}: {e}")

    return certs


def extract_subdomains(certs: List[Dict], base_domain: str) -> Set[str]:
    """Extract unique subdomains from certificate name_value fields.

    Handles wildcard certificates and multi-line name_value entries.
    """
    subdomains = set()  # type: Set[str]
    base_lower = base_domain.lower()

    for cert in certs:
        name_value = cert.get("name_value", "")
        for name in name_value.split("\n"):
            name = name.strip().lower()
            # Remove wildcard prefix
            if name.startswith("*."):
                name = name[2:]
            # Must be a subdomain of the base domain
            if name.endswith(base_lower) and name != base_lower:
                if name:
                    subdomains.add(name)

    return subdomains


async def run_cert_monitor(org_id: str) -> int:
    """Main certificate monitor orchestrator.

    Queries crt.sh for each domain asset, compares found subdomains
    against known ones, and alerts on new discoveries and recent certs.
    """
    logger.info(f"Starting certificate monitor for org {org_id}")
    client = get_client()

    job = client.table("scan_jobs").insert({
        "org_id": org_id,
        "module": "cert_monitor",
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    job_id = job.data[0]["id"]

    findings_count = 0

    try:
        assets = (
            client.table("assets")
            .select("*")
            .eq("org_id", org_id)
            .eq("type", "domain")
            .eq("status", "active")
            .execute()
        )

        for asset in (assets.data or []):
            domain = asset["value"]

            try:
                certs = await query_crtsh(domain)
            except Exception as e:
                logger.error(f"crt.sh query failed for {domain}: {e}")
                continue

            if not certs:
                continue

            subdomains = extract_subdomains(certs, domain)

            # Get previously known subdomains from metadata
            metadata = asset.get("metadata") or {}
            known_subs = set(metadata.get("known_subdomains", []))
            new_subs = subdomains - known_subs

            if new_subs:
                alert_data = {
                    "org_id": org_id,
                    "asset_id": asset["id"],
                    "module": "cert_monitor",
                    "severity": "medium" if len(new_subs) > 5 else "low",
                    "title": f"{len(new_subs)} new subdomain(s) discovered for {domain}",
                    "description": (
                        "Certificate Transparency logs revealed new subdomains:\n"
                        + "\n".join(f"  - {s}" for s in sorted(new_subs)[:20])
                    ),
                    "source_url": f"https://crt.sh/?q=%.{domain}",
                    "raw_data": {
                        "new_subdomains": list(new_subs)[:100],
                        "total_subdomains": len(subdomains),
                        "cert_count": len(certs),
                    },
                    "risk_score": min(15 + len(new_subs) * 3, 60),
                    "status": "open",
                }
                client.table("alerts").insert(alert_data).execute()
                findings_count += 1

                try:
                    ns = (
                        client.table("notification_settings")
                        .select("*")
                        .eq("org_id", org_id)
                        .execute()
                    )
                    if ns.data:
                        await dispatch_alert(alert_data, ns.data[0])
                except Exception:
                    pass

            # Check for recently issued certificates (< 7 days)
            now = datetime.now(timezone.utc)
            recent_certs = []
            for cert in certs:
                try:
                    not_before_str = cert.get("not_before", "")
                    if not not_before_str:
                        continue
                    # Handle various date formats from crt.sh
                    cleaned = not_before_str.replace("T", " ").split("+")[0].split("Z")[0].strip()
                    not_before = datetime.fromisoformat(cleaned).replace(tzinfo=timezone.utc)
                    if (now - not_before).days <= 7:
                        recent_certs.append(cert)
                except (ValueError, TypeError):
                    pass

            if recent_certs:
                alert_data = {
                    "org_id": org_id,
                    "asset_id": asset["id"],
                    "module": "cert_monitor",
                    "severity": "info",
                    "title": f"{len(recent_certs)} new certificate(s) issued for {domain}",
                    "description": (
                        "Recently issued certificates:\n"
                        + "\n".join(
                            f"  - {c['common_name']} (Issuer: {c['issuer_name'][:50]})"
                            for c in recent_certs[:10]
                        )
                    ),
                    "source_url": f"https://crt.sh/?q=%.{domain}",
                    "raw_data": {"recent_certs": recent_certs[:10]},
                    "risk_score": 10,
                    "status": "open",
                }
                client.table("alerts").insert(alert_data).execute()
                findings_count += 1

            # Update known subdomains in asset metadata
            all_subs = list(known_subs | subdomains)[:500]
            try:
                client.table("assets").update({
                    "metadata": {**metadata, "known_subdomains": all_subs},
                    "last_scan_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", asset["id"]).execute()
            except Exception as e:
                logger.warning(f"Failed to update asset metadata for {domain}: {e}")

        client.table("scan_jobs").update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "findings_count": findings_count,
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.error(f"Certificate monitor failed: {e}")
        client.table("scan_jobs").update({
            "status": "failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "error": str(e)[:500],
        }).eq("id", job_id).execute()

    logger.info(f"Certificate monitor complete for org {org_id}: {findings_count} findings")
    return findings_count
