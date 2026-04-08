import logging
from datetime import datetime

import httpx

from db import get_client
from utils.rate_limiter import RateLimiter
from utils.notify import dispatch_alert

logger = logging.getLogger(__name__)
rate_limiter = RateLimiter()


async def query_crtsh(domain: str) -> list[dict]:
    await rate_limiter.wait("crtsh", min_interval=2.0)
    certs = []
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://crt.sh/",
                params={"q": f"%.{domain}", "output": "json"},
                timeout=60,
            )
            if resp.status_code == 200:
                data = resp.json()
                for entry in data:
                    certs.append({
                        "id": entry.get("id"),
                        "issuer_name": entry.get("issuer_name", ""),
                        "common_name": entry.get("common_name", ""),
                        "name_value": entry.get("name_value", ""),
                        "not_before": entry.get("not_before", ""),
                        "not_after": entry.get("not_after", ""),
                        "serial_number": entry.get("serial_number", ""),
                    })
        except Exception as e:
            logger.warning(f"crt.sh query failed for {domain}: {e}")
    return certs


def extract_subdomains(certs: list[dict], base_domain: str) -> set[str]:
    subdomains = set()
    for cert in certs:
        name_value = cert.get("name_value", "")
        for name in name_value.split("\n"):
            name = name.strip().lower()
            if name.endswith(base_domain) and name != base_domain:
                # Remove wildcard prefix
                name = name.lstrip("*.")
                if name and name != base_domain:
                    subdomains.add(name)
    return subdomains


async def run_cert_monitor(org_id: str):
    logger.info(f"Starting certificate monitor for org {org_id}")
    client = get_client()

    job = client.table("scan_jobs").insert({
        "org_id": org_id,
        "module": "cert_monitor",
        "status": "running",
        "started_at": datetime.utcnow().isoformat(),
    }).execute()
    job_id = job.data[0]["id"]

    findings_count = 0

    try:
        assets = client.table("assets").select("*").eq("org_id", org_id).eq("type", "domain").eq("status", "active").execute()

        for asset in assets.data:
            domain = asset["value"]
            certs = await query_crtsh(domain)
            if not certs:
                continue

            subdomains = extract_subdomains(certs, domain)

            # Get previously known subdomains from metadata
            known_subs = set(asset.get("metadata", {}).get("known_subdomains", []))
            new_subs = subdomains - known_subs

            if new_subs:
                # Alert on new subdomains
                alert_data = {
                    "org_id": org_id,
                    "asset_id": asset["id"],
                    "module": "cert_monitor",
                    "severity": "medium" if len(new_subs) > 5 else "low",
                    "title": f"{len(new_subs)} new subdomain(s) discovered for {domain}",
                    "description": (
                        f"Certificate Transparency logs revealed new subdomains:\n"
                        + "\n".join(f"  - {s}" for s in sorted(new_subs)[:20])
                    ),
                    "source_url": f"https://crt.sh/?q=%.{domain}",
                    "raw_data": {
                        "new_subdomains": list(new_subs),
                        "total_subdomains": len(subdomains),
                        "cert_count": len(certs),
                    },
                    "risk_score": min(15 + len(new_subs) * 3, 60),
                    "status": "open",
                }
                client.table("alerts").insert(alert_data).execute()
                findings_count += 1

                try:
                    ns = client.table("notification_settings").select("*").eq("org_id", org_id).execute()
                    if ns.data:
                        await dispatch_alert(alert_data, ns.data[0])
                except Exception:
                    pass

            # Check for recently issued certificates (< 7 days)
            recent_certs = []
            for cert in certs:
                try:
                    not_before = datetime.fromisoformat(cert["not_before"].replace("T", " ").split("+")[0])
                    if (datetime.utcnow() - not_before).days <= 7:
                        recent_certs.append(cert)
                except Exception:
                    pass

            if recent_certs:
                alert_data = {
                    "org_id": org_id,
                    "asset_id": asset["id"],
                    "module": "cert_monitor",
                    "severity": "info",
                    "title": f"{len(recent_certs)} new certificate(s) issued for {domain}",
                    "description": (
                        f"Recently issued certificates:\n"
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
            all_subs = list(known_subs | subdomains)
            client.table("assets").update({
                "metadata": {**asset.get("metadata", {}), "known_subdomains": all_subs},
                "last_scan_at": datetime.utcnow().isoformat(),
            }).eq("id", asset["id"]).execute()

        client.table("scan_jobs").update({
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat(),
            "findings_count": findings_count,
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.error(f"Certificate monitor failed: {e}")
        client.table("scan_jobs").update({
            "status": "failed",
            "completed_at": datetime.utcnow().isoformat(),
            "error": str(e),
        }).eq("id", job_id).execute()

    logger.info(f"Certificate monitor complete for org {org_id}: {findings_count} findings")
    return findings_count
