import logging
from datetime import datetime

import httpx

from config import get_settings
from db import get_client
from utils.rate_limiter import RateLimiter
from utils.scoring import calculate_risk_score, severity_from_score
from utils.notify import dispatch_alert

logger = logging.getLogger(__name__)
settings = get_settings()
rate_limiter = RateLimiter()


async def check_hibp_breaches(email: str) -> list[dict]:
    if not settings.HIBP_API_KEY:
        return []

    await rate_limiter.wait("hibp", min_interval=1.5)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://haveibeenpwned.com/api/v3/breachedaccount/{email}",
            headers={
                "hibp-api-key": settings.HIBP_API_KEY,
                "user-agent": "TAI-AEGIS-ThreatIntel",
            },
            params={"truncateResponse": "false"},
            timeout=30,
        )
        if resp.status_code == 200:
            return resp.json()
        return []


async def check_hibp_pastes(email: str) -> list[dict]:
    if not settings.HIBP_API_KEY:
        return []

    await rate_limiter.wait("hibp", min_interval=1.5)
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://haveibeenpwned.com/api/v3/pasteaccount/{email}",
            headers={
                "hibp-api-key": settings.HIBP_API_KEY,
                "user-agent": "TAI-AEGIS-ThreatIntel",
            },
            timeout=30,
        )
        if resp.status_code == 200:
            return resp.json()
        return []


async def run_credential_scan(org_id: str):
    logger.info(f"Starting credential scan for org {org_id}")
    client = get_client()

    job = client.table("scan_jobs").insert({
        "org_id": org_id,
        "module": "credential",
        "status": "running",
        "started_at": datetime.utcnow().isoformat(),
    }).execute()
    job_id = job.data[0]["id"]

    findings_count = 0

    try:
        assets = client.table("assets").select("*").eq("org_id", org_id).eq("status", "active").execute()
        email_assets = [a for a in assets.data if a["type"] == "email"]
        domain_assets = [a for a in assets.data if a["type"] == "domain"]

        # Check individual email assets
        for asset in email_assets:
            email = asset["value"]

            # Breach check
            try:
                breaches = await check_hibp_breaches(email)
                if breaches:
                    # Check for new breaches since last scan
                    known_breaches = set(asset.get("metadata", {}).get("known_breaches", []))
                    new_breaches = [b for b in breaches if b.get("Name") not in known_breaches]

                    if new_breaches:
                        for breach in new_breaches:
                            data_classes = breach.get("DataClasses", [])
                            has_passwords = "Passwords" in data_classes
                            score = calculate_risk_score({
                                "in_breach_db": True,
                                "exposed_credentials": has_passwords,
                            })
                            severity = severity_from_score(score)
                            alert_data = {
                                "org_id": org_id,
                                "asset_id": asset["id"],
                                "module": "credential",
                                "severity": severity,
                                "title": f"Credential exposure: {email} in {breach.get('Name')} breach",
                                "description": (
                                    f"Email {email} found in {breach.get('Name')} breach "
                                    f"(date: {breach.get('BreachDate', 'unknown')}). "
                                    f"Compromised data types: {', '.join(data_classes)}. "
                                    f"{'⚠️ Passwords were exposed!' if has_passwords else ''}"
                                ),
                                "source_url": f"https://haveibeenpwned.com/api/v3/breach/{breach.get('Name')}",
                                "raw_data": {"breach": breach},
                                "risk_score": score,
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

                    # Update known breaches
                    all_breach_names = [b.get("Name") for b in breaches]
                    client.table("assets").update({
                        "metadata": {**asset.get("metadata", {}), "known_breaches": all_breach_names},
                    }).eq("id", asset["id"]).execute()

            except Exception as e:
                logger.error(f"Breach check failed for {email}: {e}")

            # Paste check
            try:
                pastes = await check_hibp_pastes(email)
                if pastes:
                    alert_data = {
                        "org_id": org_id,
                        "asset_id": asset["id"],
                        "module": "credential",
                        "severity": "medium",
                        "title": f"Email {email} found in {len(pastes)} paste(s)",
                        "description": (
                            f"Email address found in {len(pastes)} paste site(s). "
                            f"Sources: {', '.join(set(p.get('Source', 'Unknown') for p in pastes[:5]))}"
                        ),
                        "source_url": "",
                        "raw_data": {"pastes": pastes[:20]},
                        "risk_score": 40,
                        "status": "open",
                    }
                    client.table("alerts").insert(alert_data).execute()
                    findings_count += 1
            except Exception as e:
                logger.error(f"Paste check failed for {email}: {e}")

        # Domain-wide email pattern checks
        for domain_asset in domain_assets:
            domain = domain_asset["value"]
            common_prefixes = ["info", "admin", "contact", "support", "security", "hr", "sales"]
            for prefix in common_prefixes:
                email = f"{prefix}@{domain}"
                try:
                    breaches = await check_hibp_breaches(email)
                    if breaches:
                        score = calculate_risk_score({"in_breach_db": True, "exposed_credentials": True})
                        severity = severity_from_score(score)
                        alert_data = {
                            "org_id": org_id,
                            "asset_id": domain_asset["id"],
                            "module": "credential",
                            "severity": severity,
                            "title": f"Common email {email} found in {len(breaches)} breach(es)",
                            "description": (
                                f"Standard email pattern {email} appears in breaches: "
                                f"{', '.join(b.get('Name', '') for b in breaches[:5])}"
                            ),
                            "source_url": "",
                            "raw_data": {"email": email, "breach_count": len(breaches)},
                            "risk_score": score,
                            "status": "open",
                        }
                        client.table("alerts").insert(alert_data).execute()
                        findings_count += 1
                except Exception as e:
                    logger.warning(f"Email pattern check failed for {email}: {e}")

        # Update assets
        client.table("assets").update({
            "last_scan_at": datetime.utcnow().isoformat(),
        }).eq("org_id", org_id).in_("type", ["email"]).execute()

        client.table("scan_jobs").update({
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat(),
            "findings_count": findings_count,
        }).eq("id", job_id).execute()

    except Exception as e:
        logger.error(f"Credential scan failed: {e}")
        client.table("scan_jobs").update({
            "status": "failed",
            "completed_at": datetime.utcnow().isoformat(),
            "error": str(e),
        }).eq("id", job_id).execute()

    logger.info(f"Credential scan complete for org {org_id}: {findings_count} findings")
    return findings_count
