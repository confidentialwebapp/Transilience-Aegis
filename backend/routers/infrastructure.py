"""
Infrastructure & Attack Surface Monitoring Router
Subdomain Enumeration, SSL/TLS Monitor, DNS Change Tracking
"""
import logging
import re
import ssl
import socket
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Header, Query, BackgroundTasks

from db import get_client

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Subdomain Enumeration
# ---------------------------------------------------------------------------
async def enumerate_crt_sh(domain: str) -> list[str]:
    """Find subdomains via Certificate Transparency logs (crt.sh)."""
    subdomains = set()
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"https://crt.sh/?q=%.{domain}&output=json")
            if resp.status_code == 200:
                for cert in resp.json():
                    names = cert.get("name_value", "")
                    for name in names.split("\n"):
                        name = name.strip().lower()
                        if name.endswith(f".{domain}") or name == domain:
                            if "*" not in name:
                                subdomains.add(name)
    except Exception as e:
        logger.warning("crt.sh enumeration failed: %s", e)
    return list(subdomains)


async def enumerate_wayback(domain: str) -> list[str]:
    """Find subdomains from Wayback Machine CDX API."""
    subdomains = set()
    try:
        url = f"https://web.archive.org/cdx/search/cdx?url=*.{domain}/*&output=json&fl=original&collapse=urlkey&limit=500"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                for row in data[1:]:  # Skip header row
                    try:
                        from urllib.parse import urlparse
                        parsed = urlparse(row[0])
                        hostname = parsed.hostname
                        if hostname and (hostname.endswith(f".{domain}") or hostname == domain):
                            subdomains.add(hostname.lower())
                    except Exception:
                        pass
    except Exception as e:
        logger.warning("Wayback enumeration failed: %s", e)
    return list(subdomains)


async def run_subdomain_enum(org_id: str, asset_id: str, domain: str):
    """Background task: enumerate subdomains and store results."""
    try:
        db = get_client()

        # Get existing subdomains for delta detection
        existing = db.table("subdomains").select("subdomain").eq("org_id", org_id).eq("asset_id", asset_id).execute()
        existing_set = {s["subdomain"] for s in (existing.data or [])}

        # Enumerate from multiple sources
        crt_results = await enumerate_crt_sh(domain)
        wayback_results = await enumerate_wayback(domain)

        all_subs = set(crt_results) | set(wayback_results)

        new_count = 0
        for sub in all_subs:
            source = "crt_sh" if sub in crt_results else "wayback"
            is_new = sub not in existing_set

            # Resolve IP
            ip = None
            try:
                async with httpx.AsyncClient(timeout=5) as client:
                    resp = await client.get(f"https://cloudflare-dns.com/dns-query?name={sub}&type=A",
                                            headers={"Accept": "application/dns-json"})
                    if resp.status_code == 200:
                        answers = resp.json().get("Answer", [])
                        for a in answers:
                            if a.get("type") == 1:
                                ip = a.get("data")
                                break
            except Exception:
                pass

            try:
                db.table("subdomains").upsert({
                    "org_id": org_id,
                    "asset_id": asset_id,
                    "subdomain": sub,
                    "ip_address": ip,
                    "source": source,
                    "is_new": is_new,
                    "last_seen_at": datetime.utcnow().isoformat(),
                    "status": "active",
                }, on_conflict="org_id,subdomain").execute()
                if is_new:
                    new_count += 1
            except Exception as e:
                logger.warning("Failed to upsert subdomain %s: %s", sub, e)

        # Mark subdomains not seen this scan as inactive
        for existing_sub in existing_set - all_subs:
            try:
                db.table("subdomains").update({"status": "inactive"}).eq("org_id", org_id).eq("subdomain", existing_sub).execute()
            except Exception:
                pass

        logger.info("Subdomain enum for %s: %d total, %d new", domain, len(all_subs), new_count)
    except Exception as e:
        logger.error("Subdomain enumeration failed for %s: %s", domain, e)


@router.post("/subdomains/enumerate")
async def trigger_subdomain_enum(
    body: dict,
    background_tasks: BackgroundTasks,
    x_org_id: str = Header(...),
):
    """Trigger subdomain enumeration for a domain."""
    domain = body.get("domain", "").strip().lower()
    asset_id = body.get("asset_id")
    if not domain:
        raise HTTPException(400, "domain is required")
    background_tasks.add_task(run_subdomain_enum, x_org_id, asset_id, domain)
    return {"status": "enumeration_started", "domain": domain}


@router.get("/subdomains")
async def list_subdomains(
    x_org_id: str = Header(...),
    domain: Optional[str] = Query(None),
    new_only: bool = Query(False),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    try:
        db = get_client()
        query = db.table("subdomains").select("*", count="exact").eq("org_id", x_org_id)
        if domain:
            query = query.ilike("subdomain", f"%.{domain}")
        if new_only:
            query = query.eq("is_new", True)
        if status:
            query = query.eq("status", status)
        offset = (page - 1) * per_page
        result = query.order("first_seen_at", desc=True).range(offset, offset + per_page - 1).execute()
        return {
            "data": result.data or [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/subdomains/stats")
async def subdomain_stats(x_org_id: str = Header(...)):
    try:
        db = get_client()
        total = db.table("subdomains").select("id", count="exact").eq("org_id", x_org_id).execute()
        new = db.table("subdomains").select("id", count="exact").eq("org_id", x_org_id).eq("is_new", True).execute()
        active = db.table("subdomains").select("id", count="exact").eq("org_id", x_org_id).eq("status", "active").execute()
        return {
            "total": getattr(total, "count", 0) or 0,
            "new": getattr(new, "count", 0) or 0,
            "active": getattr(active, "count", 0) or 0,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------------------------------------------------------------------------
# SSL/TLS Certificate Monitoring
# ---------------------------------------------------------------------------
async def check_ssl_certificate(domain: str) -> dict:
    """Check SSL certificate details for a domain."""
    result = {
        "domain": domain,
        "valid": False,
        "issuer": "",
        "subject": "",
        "sans": [],
        "valid_from": None,
        "valid_until": None,
        "days_remaining": None,
        "serial_number": "",
        "key_algorithm": "",
        "signature_algorithm": "",
        "is_wildcard": False,
        "grade": None,
    }

    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                if cert:
                    result["valid"] = True
                    # Subject
                    subject = dict(x[0] for x in cert.get("subject", ()))
                    result["subject"] = subject.get("commonName", "")
                    # Issuer
                    issuer = dict(x[0] for x in cert.get("issuer", ()))
                    result["issuer"] = issuer.get("organizationName", "")
                    # SANs
                    sans = [v for t, v in cert.get("subjectAltName", ()) if t == "DNS"]
                    result["sans"] = sans
                    result["is_wildcard"] = any("*" in s for s in sans)
                    # Dates
                    not_before = cert.get("notBefore", "")
                    not_after = cert.get("notAfter", "")
                    if not_after:
                        exp = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z")
                        result["valid_until"] = exp.isoformat()
                        result["days_remaining"] = (exp - datetime.utcnow()).days
                    if not_before:
                        start = datetime.strptime(not_before, "%b %d %H:%M:%S %Y %Z")
                        result["valid_from"] = start.isoformat()
                    # Serial
                    result["serial_number"] = format(cert.get("serialNumber", 0), "x") if cert.get("serialNumber") else ""
    except Exception as e:
        result["error"] = str(e)

    return result


async def check_ssl_labs(domain: str) -> dict:
    """Check SSL grade via Qualys SSL Labs API."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            # Start analysis
            resp = await client.get(
                "https://api.ssllabs.com/api/v3/analyze",
                params={"host": domain, "fromCache": "on", "maxAge": 24},
            )
            if resp.status_code == 200:
                data = resp.json()
                endpoints = data.get("endpoints", [])
                if endpoints:
                    return {
                        "grade": endpoints[0].get("grade", "?"),
                        "has_warnings": endpoints[0].get("hasWarnings", False),
                        "is_exceptional": endpoints[0].get("isExceptional", False),
                        "status": data.get("status"),
                    }
    except Exception as e:
        logger.warning("SSL Labs check failed for %s: %s", domain, e)
    return {}


async def run_ssl_check(org_id: str, domain: str, asset_id: Optional[str] = None):
    """Background task: full SSL certificate check."""
    try:
        db = get_client()
        cert_info = await check_ssl_certificate(domain)
        labs_info = await check_ssl_labs(domain)

        grade = labs_info.get("grade", "")
        has_weak_cipher = labs_info.get("has_warnings", False)

        record = {
            "org_id": org_id,
            "asset_id": asset_id,
            "domain": domain,
            "issuer": cert_info.get("issuer", ""),
            "subject": cert_info.get("subject", ""),
            "sans": cert_info.get("sans", []),
            "valid_from": cert_info.get("valid_from"),
            "valid_until": cert_info.get("valid_until"),
            "serial_number": cert_info.get("serial_number", ""),
            "key_algorithm": cert_info.get("key_algorithm", ""),
            "signature_algorithm": cert_info.get("signature_algorithm", ""),
            "grade": grade,
            "has_weak_cipher": has_weak_cipher,
            "is_wildcard": cert_info.get("is_wildcard", False),
            "raw_data": {**cert_info, "ssl_labs": labs_info},
            "last_checked_at": datetime.utcnow().isoformat(),
        }

        # Upsert by org_id + domain
        existing = db.table("ssl_certificates").select("id").eq("org_id", org_id).eq("domain", domain).execute()
        if existing.data:
            db.table("ssl_certificates").update(record).eq("id", existing.data[0]["id"]).execute()
        else:
            db.table("ssl_certificates").insert(record).execute()

        logger.info("SSL check for %s: grade=%s, days_remaining=%s", domain, grade, cert_info.get("days_remaining"))
    except Exception as e:
        logger.error("SSL check failed for %s: %s", domain, e)


@router.post("/ssl/check")
async def trigger_ssl_check(
    body: dict,
    background_tasks: BackgroundTasks,
    x_org_id: str = Header(...),
):
    domain = body.get("domain", "").strip().lower()
    asset_id = body.get("asset_id")
    if not domain:
        raise HTTPException(400, "domain is required")
    background_tasks.add_task(run_ssl_check, x_org_id, domain, asset_id)
    return {"status": "ssl_check_started", "domain": domain}


@router.get("/ssl")
async def list_ssl_certificates(
    x_org_id: str = Header(...),
    expiring_days: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    try:
        db = get_client()
        query = db.table("ssl_certificates").select("*", count="exact").eq("org_id", x_org_id)
        if expiring_days:
            cutoff = (datetime.utcnow() + timedelta(days=expiring_days)).isoformat()
            query = query.lte("valid_until", cutoff)
        offset = (page - 1) * per_page
        result = query.order("valid_until").range(offset, offset + per_page - 1).execute()
        return {
            "data": result.data or [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/ssl/stats")
async def ssl_stats(x_org_id: str = Header(...)):
    try:
        db = get_client()
        total = db.table("ssl_certificates").select("id", count="exact").eq("org_id", x_org_id).execute()
        now = datetime.utcnow()
        expired = db.table("ssl_certificates").select("id", count="exact").eq("org_id", x_org_id).lt("valid_until", now.isoformat()).execute()
        expiring_30 = db.table("ssl_certificates").select("id", count="exact").eq("org_id", x_org_id).lte("valid_until", (now + timedelta(days=30)).isoformat()).gte("valid_until", now.isoformat()).execute()
        weak = db.table("ssl_certificates").select("id", count="exact").eq("org_id", x_org_id).eq("has_weak_cipher", True).execute()
        return {
            "total": getattr(total, "count", 0) or 0,
            "expired": getattr(expired, "count", 0) or 0,
            "expiring_30d": getattr(expiring_30, "count", 0) or 0,
            "weak_cipher": getattr(weak, "count", 0) or 0,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------------------------------------------------------------------------
# DNS Change Monitoring
# ---------------------------------------------------------------------------
async def check_dns_records(domain: str) -> list[dict]:
    """Check DNS records via Cloudflare DNS-over-HTTPS."""
    records = []
    record_types = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "CAA"]

    async with httpx.AsyncClient(timeout=15) as client:
        for rtype in record_types:
            try:
                resp = await client.get(
                    f"https://cloudflare-dns.com/dns-query?name={domain}&type={rtype}",
                    headers={"Accept": "application/dns-json"},
                )
                if resp.status_code == 200:
                    answers = resp.json().get("Answer", [])
                    for answer in answers:
                        records.append({
                            "record_type": rtype,
                            "record_value": answer.get("data", ""),
                            "ttl": answer.get("TTL", 0),
                        })
            except Exception:
                pass
    return records


async def run_dns_check(org_id: str, domain: str, asset_id: Optional[str] = None):
    """Background task: check DNS records and detect changes."""
    try:
        db = get_client()
        current_records = await check_dns_records(domain)

        # Get previous records
        existing = db.table("dns_records").select("*").eq("org_id", org_id).eq("domain", domain).execute()
        existing_map = {}
        for r in (existing.data or []):
            key = f"{r['record_type']}:{r['record_value']}"
            existing_map[key] = r

        now = datetime.utcnow().isoformat()
        for rec in current_records:
            key = f"{rec['record_type']}:{rec['record_value']}"
            if key in existing_map:
                # Update checked_at
                db.table("dns_records").update({"checked_at": now}).eq("id", existing_map[key]["id"]).execute()
                del existing_map[key]
            else:
                # New record - check if it replaced an old one
                prev = next(
                    (e for e in (existing.data or []) if e["record_type"] == rec["record_type"] and e["record_value"] != rec["record_value"]),
                    None,
                )
                db.table("dns_records").insert({
                    "org_id": org_id,
                    "asset_id": asset_id,
                    "domain": domain,
                    "record_type": rec["record_type"],
                    "record_value": rec["record_value"],
                    "ttl": rec.get("ttl"),
                    "previous_value": prev["record_value"] if prev else None,
                    "changed_at": now if prev else None,
                    "checked_at": now,
                }).execute()

        logger.info("DNS check for %s: %d records", domain, len(current_records))
    except Exception as e:
        logger.error("DNS check failed for %s: %s", domain, e)


async def check_email_security(domain: str) -> dict:
    """Check SPF, DKIM, DMARC configuration."""
    result = {"spf": None, "dmarc": None, "issues": []}
    async with httpx.AsyncClient(timeout=15) as client:
        # SPF
        try:
            resp = await client.get(
                f"https://cloudflare-dns.com/dns-query?name={domain}&type=TXT",
                headers={"Accept": "application/dns-json"},
            )
            if resp.status_code == 200:
                for ans in resp.json().get("Answer", []):
                    data = ans.get("data", "")
                    if "v=spf1" in data:
                        result["spf"] = data
                        if "+all" in data:
                            result["issues"].append("SPF uses +all (allows any sender)")
                        elif "~all" in data:
                            result["issues"].append("SPF uses ~all (softfail, should be -all)")
        except Exception:
            pass

        # DMARC
        try:
            resp = await client.get(
                f"https://cloudflare-dns.com/dns-query?name=_dmarc.{domain}&type=TXT",
                headers={"Accept": "application/dns-json"},
            )
            if resp.status_code == 200:
                for ans in resp.json().get("Answer", []):
                    data = ans.get("data", "")
                    if "v=DMARC1" in data:
                        result["dmarc"] = data
                        if "p=none" in data:
                            result["issues"].append("DMARC policy is 'none' (no enforcement)")
        except Exception:
            pass

        if not result["spf"]:
            result["issues"].append("No SPF record found")
        if not result["dmarc"]:
            result["issues"].append("No DMARC record found")

    return result


@router.post("/dns/check")
async def trigger_dns_check(
    body: dict,
    background_tasks: BackgroundTasks,
    x_org_id: str = Header(...),
):
    domain = body.get("domain", "").strip().lower()
    asset_id = body.get("asset_id")
    if not domain:
        raise HTTPException(400, "domain is required")
    background_tasks.add_task(run_dns_check, x_org_id, domain, asset_id)
    return {"status": "dns_check_started", "domain": domain}


@router.get("/dns")
async def list_dns_records(
    x_org_id: str = Header(...),
    domain: Optional[str] = Query(None),
    record_type: Optional[str] = Query(None),
    changes_only: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    try:
        db = get_client()
        query = db.table("dns_records").select("*", count="exact").eq("org_id", x_org_id)
        if domain:
            query = query.eq("domain", domain)
        if record_type:
            query = query.eq("record_type", record_type)
        if changes_only:
            query = query.not_.is_("changed_at", "null")
        offset = (page - 1) * per_page
        result = query.order("checked_at", desc=True).range(offset, offset + per_page - 1).execute()
        return {
            "data": result.data or [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/dns/email-security/{domain}")
async def get_email_security(domain: str, x_org_id: str = Header(...)):
    """Check email security (SPF/DKIM/DMARC) for a domain."""
    return await check_email_security(domain)


# ---------------------------------------------------------------------------
# Combined Infrastructure Overview
# ---------------------------------------------------------------------------
@router.get("/overview")
async def infrastructure_overview(x_org_id: str = Header(...)):
    """Get combined infrastructure monitoring stats."""
    try:
        db = get_client()

        # Subdomain stats
        sub_total = db.table("subdomains").select("id", count="exact").eq("org_id", x_org_id).execute()
        sub_new = db.table("subdomains").select("id", count="exact").eq("org_id", x_org_id).eq("is_new", True).execute()

        # SSL stats
        ssl_total = db.table("ssl_certificates").select("id", count="exact").eq("org_id", x_org_id).execute()
        now = datetime.utcnow()
        ssl_expiring = db.table("ssl_certificates").select("id", count="exact").eq("org_id", x_org_id).lte("valid_until", (now + timedelta(days=30)).isoformat()).gte("valid_until", now.isoformat()).execute()

        # DNS stats
        dns_total = db.table("dns_records").select("id", count="exact").eq("org_id", x_org_id).execute()
        dns_changes = db.table("dns_records").select("id", count="exact").eq("org_id", x_org_id).not_.is_("changed_at", "null").execute()

        return {
            "subdomains": {
                "total": getattr(sub_total, "count", 0) or 0,
                "new": getattr(sub_new, "count", 0) or 0,
            },
            "ssl": {
                "total": getattr(ssl_total, "count", 0) or 0,
                "expiring_30d": getattr(ssl_expiring, "count", 0) or 0,
            },
            "dns": {
                "total": getattr(dns_total, "count", 0) or 0,
                "changes_detected": getattr(dns_changes, "count", 0) or 0,
            },
        }
    except Exception as e:
        raise HTTPException(500, str(e))
