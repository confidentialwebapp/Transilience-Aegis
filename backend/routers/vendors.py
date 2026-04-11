"""
SVigil — Vendor Registry & Risk Monitoring Router
Vendor CRUD + vulnerability scanning + breach checking
"""
import csv
import io
import logging
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Header, Query, BackgroundTasks, UploadFile, File

from db import get_client

logger = logging.getLogger(__name__)
router = APIRouter()

_rate_limiter = None


def _get_rate_limiter():
    global _rate_limiter
    if _rate_limiter is None:
        from utils.rate_limiter import RateLimiter
        _rate_limiter = RateLimiter()
    return _rate_limiter


def _get_settings():
    from config import get_settings
    return get_settings()


# ---------------------------------------------------------------------------
# Vendor CRUD
# ---------------------------------------------------------------------------
@router.get("/")
async def list_vendors(
    x_org_id: str = Header(...),
    risk_tier: Optional[str] = Query(None),
    vendor_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("risk_score"),
    sort_desc: bool = Query(True),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    try:
        db = get_client()
        query = db.table("vendors").select("*", count="exact").eq("org_id", x_org_id)
        if risk_tier:
            query = query.eq("risk_tier", risk_tier)
        if vendor_type:
            query = query.eq("vendor_type", vendor_type)
        if status:
            query = query.eq("status", status)
        if search:
            query = query.or_(f"name.ilike.%{search}%,domain.ilike.%{search}%")

        offset = (page - 1) * per_page
        result = query.order(sort_by, desc=sort_desc).range(offset, offset + per_page - 1).execute()
        return {
            "data": result.data or [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/")
async def create_vendor(body: dict, x_org_id: str = Header(...)):
    required = ["name"]
    for field in required:
        if not body.get(field):
            raise HTTPException(400, f"{field} is required")
    try:
        db = get_client()
        vendor = {
            "org_id": x_org_id,
            "name": body["name"],
            "domain": body.get("domain", ""),
            "contact_name": body.get("contact_name", ""),
            "contact_email": body.get("contact_email", ""),
            "vendor_type": body.get("vendor_type", "saas"),
            "risk_tier": body.get("risk_tier", "medium"),
            "tags": body.get("tags", []),
            "metadata": body.get("metadata", {}),
        }
        result = db.table("vendors").insert(vendor).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/{vendor_id}")
async def get_vendor(vendor_id: str, x_org_id: str = Header(...)):
    try:
        db = get_client()
        result = db.table("vendors").select("*").eq("id", vendor_id).eq("org_id", x_org_id).execute()
        if not result.data:
            raise HTTPException(404, "Vendor not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.patch("/{vendor_id}")
async def update_vendor(vendor_id: str, body: dict, x_org_id: str = Header(...)):
    allowed = {"name", "domain", "contact_name", "contact_email", "vendor_type", "risk_tier", "tags", "status", "metadata"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "No valid fields to update")
    updates["updated_at"] = datetime.utcnow().isoformat()
    try:
        db = get_client()
        result = db.table("vendors").update(updates).eq("id", vendor_id).eq("org_id", x_org_id).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.delete("/{vendor_id}")
async def delete_vendor(vendor_id: str, x_org_id: str = Header(...)):
    try:
        db = get_client()
        db.table("vendors").delete().eq("id", vendor_id).eq("org_id", x_org_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/bulk-import")
async def bulk_import_vendors(file: UploadFile = File(...), x_org_id: str = Header(...)):
    """Import vendors from CSV. Columns: name,domain,vendor_type,risk_tier,contact_name,contact_email"""
    try:
        content = await file.read()
        text = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))
        db = get_client()
        imported = 0
        for row in reader:
            name = row.get("name", "").strip()
            if not name:
                continue
            vendor = {
                "org_id": x_org_id,
                "name": name,
                "domain": row.get("domain", "").strip(),
                "vendor_type": row.get("vendor_type", "saas").strip(),
                "risk_tier": row.get("risk_tier", "medium").strip(),
                "contact_name": row.get("contact_name", "").strip(),
                "contact_email": row.get("contact_email", "").strip(),
            }
            try:
                db.table("vendors").insert(vendor).execute()
                imported += 1
            except Exception as e:
                logger.warning("Failed to import vendor %s: %s", name, e)
        return {"imported": imported}
    except Exception as e:
        raise HTTPException(400, f"CSV import failed: {e}")


@router.get("/export/csv")
async def export_vendors_csv(x_org_id: str = Header(...)):
    """Export all vendors as CSV."""
    from fastapi.responses import StreamingResponse
    try:
        db = get_client()
        result = db.table("vendors").select("*").eq("org_id", x_org_id).order("name").execute()
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            "name", "domain", "vendor_type", "risk_tier", "risk_score",
            "contact_name", "contact_email", "status", "last_scan_at"
        ])
        writer.writeheader()
        for v in (result.data or []):
            writer.writerow({k: v.get(k, "") for k in writer.fieldnames})
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=vendors_export.csv"},
        )
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------------------------------------------------------------------------
# Vendor Scanning
# ---------------------------------------------------------------------------
async def _scan_security_headers(domain: str) -> dict:
    """Check HTTP security headers via SecurityHeaders.io API."""
    try:
        url = f"https://securityheaders.com/?q=https://{domain}&followRedirects=on"
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, headers={"Accept": "application/json"}, follow_redirects=True)
            grade = resp.headers.get("X-Grade", "?")
            return {"grade": grade, "url": f"https://securityheaders.com/?q=https://{domain}"}
    except Exception as e:
        return {"error": str(e)}


async def _scan_crt_sh(domain: str) -> dict:
    """Check certificate transparency for expired/expiring certs."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(f"https://crt.sh/?q=%.{domain}&output=json")
            if resp.status_code == 200:
                certs = resp.json()
                now = datetime.utcnow()
                expired = []
                expiring_soon = []
                for cert in certs[:100]:
                    not_after = cert.get("not_after", "")
                    try:
                        exp_date = datetime.strptime(not_after, "%Y-%m-%dT%H:%M:%S")
                        if exp_date < now:
                            expired.append(cert.get("common_name", ""))
                        elif (exp_date - now).days <= 30:
                            expiring_soon.append({"cn": cert.get("common_name", ""), "expires": not_after})
                    except (ValueError, TypeError):
                        pass
                return {
                    "total_certs": len(certs),
                    "expired_count": len(set(expired)),
                    "expiring_soon": expiring_soon[:10],
                }
    except Exception:
        pass
    return {}


async def _scan_shodan(domain: str) -> dict:
    """Check Shodan for open ports and services on vendor domain."""
    settings = _get_settings()
    if not settings.SHODAN_API_KEY:
        return {"error": "No Shodan API key"}
    rate_limiter = _get_rate_limiter()
    await rate_limiter.wait("shodan", min_interval=1.0)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            # Resolve domain to IP first
            dns_resp = await client.get(
                f"https://api.shodan.io/dns/resolve?hostnames={domain}&key={settings.SHODAN_API_KEY}"
            )
            if dns_resp.status_code != 200:
                return {}
            ip = dns_resp.json().get(domain)
            if not ip:
                return {"error": "Could not resolve domain"}

            await rate_limiter.wait("shodan", min_interval=1.0)
            resp = await client.get(
                f"https://api.shodan.io/shodan/host/{ip}",
                params={"key": settings.SHODAN_API_KEY},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "ip": ip,
                    "ports": data.get("ports", []),
                    "vulns": data.get("vulns", []),
                    "os": data.get("os"),
                    "org": data.get("org"),
                    "last_update": data.get("last_update"),
                }
    except Exception as e:
        return {"error": str(e)}
    return {}


async def _check_hibp_domain(domain: str) -> dict:
    """Check HIBP for breaches associated with vendor domain."""
    settings = _get_settings()
    rate_limiter = _get_rate_limiter()
    await rate_limiter.wait("hibp", min_interval=1.5)
    try:
        headers = {"user-agent": "TAI-AEGIS-ThreatIntel"}
        if settings.HIBP_API_KEY:
            headers["hibp-api-key"] = settings.HIBP_API_KEY
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"https://haveibeenpwned.com/api/v3/breaches",
                headers=headers,
            )
            if resp.status_code == 200:
                breaches = resp.json()
                domain_breaches = [b for b in breaches if domain.lower() in b.get("Domain", "").lower()]
                return {
                    "breaches_found": len(domain_breaches),
                    "breaches": [
                        {
                            "name": b.get("Name"),
                            "date": b.get("BreachDate"),
                            "pwn_count": b.get("PwnCount"),
                            "data_classes": b.get("DataClasses", []),
                        }
                        for b in domain_breaches
                    ],
                }
    except Exception as e:
        return {"error": str(e)}
    return {}


async def _check_github_leaks(vendor_name: str) -> dict:
    """Search GitHub for leaked secrets mentioning vendor."""
    settings = _get_settings()
    if not settings.GITHUB_PAT:
        return {"error": "No GitHub PAT"}
    rate_limiter = _get_rate_limiter()
    await rate_limiter.wait("github", min_interval=2.0)
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                "https://api.github.com/search/code",
                params={"q": f'"{vendor_name}" password OR secret OR api_key OR token', "per_page": 10},
                headers={
                    "Authorization": f"token {settings.GITHUB_PAT}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "total_results": data.get("total_count", 0),
                    "items": [
                        {
                            "repo": item.get("repository", {}).get("full_name"),
                            "path": item.get("path"),
                            "url": item.get("html_url"),
                        }
                        for item in data.get("items", [])[:10]
                    ],
                }
    except Exception as e:
        return {"error": str(e)}
    return {}


def compute_vendor_risk_score(results: dict) -> int:
    """Compute composite risk score from scan results."""
    score = 0

    # Security headers
    headers = results.get("security_headers", {})
    grade = headers.get("grade", "?")
    grade_scores = {"A+": 0, "A": 5, "B": 15, "C": 25, "D": 40, "E": 55, "F": 70, "?": 30}
    score += grade_scores.get(grade, 30)

    # Shodan
    shodan = results.get("shodan", {})
    ports = shodan.get("ports", [])
    vulns = shodan.get("vulns", [])
    risky_ports = {21, 23, 3389, 5900, 27017, 9200, 6379}
    exposed_risky = len(set(ports) & risky_ports)
    score += min(exposed_risky * 10, 30)
    score += min(len(vulns) * 5, 30)

    # Certificates
    certs = results.get("certificates", {})
    if certs.get("expired_count", 0) > 0:
        score += 15
    if len(certs.get("expiring_soon", [])) > 0:
        score += 5

    # HIBP breaches
    hibp = results.get("hibp", {})
    breach_count = hibp.get("breaches_found", 0)
    score += min(breach_count * 10, 30)

    # GitHub leaks
    github = results.get("github_leaks", {})
    leak_count = github.get("total_results", 0)
    if leak_count > 0:
        score += min(20 + leak_count, 30)

    return min(score, 100)


async def run_vendor_scan(org_id: str, vendor_id: str, scan_type: str = "full"):
    """Background task: run vendor security scan."""
    db = get_client()
    scan_record = None
    try:
        # Create scan record
        scan_record = db.table("vendor_scans").insert({
            "org_id": org_id,
            "vendor_id": vendor_id,
            "scan_type": scan_type,
            "status": "running",
            "started_at": datetime.utcnow().isoformat(),
        }).execute()
        scan_id = scan_record.data[0]["id"]

        # Get vendor
        vendor = db.table("vendors").select("*").eq("id", vendor_id).single().execute()
        domain = vendor.data.get("domain", "")
        name = vendor.data.get("name", "")

        results = {}
        findings = 0

        if domain:
            if scan_type in ("full", "vulnerability"):
                results["security_headers"] = await _scan_security_headers(domain)
                results["shodan"] = await _scan_shodan(domain)
                results["certificates"] = await _scan_crt_sh(domain)

            if scan_type in ("full", "breach"):
                results["hibp"] = await _check_hibp_domain(domain)
                results["github_leaks"] = await _check_github_leaks(name)

            if scan_type == "headers":
                results["security_headers"] = await _scan_security_headers(domain)

            if scan_type == "certificate":
                results["certificates"] = await _scan_crt_sh(domain)

        risk_score = compute_vendor_risk_score(results)

        # Count findings
        if results.get("shodan", {}).get("vulns"):
            findings += len(results["shodan"]["vulns"])
        if results.get("hibp", {}).get("breaches_found", 0) > 0:
            findings += results["hibp"]["breaches_found"]
        if results.get("github_leaks", {}).get("total_results", 0) > 0:
            findings += 1
        if results.get("certificates", {}).get("expired_count", 0) > 0:
            findings += 1

        # Update scan record
        db.table("vendor_scans").update({
            "status": "completed",
            "results": results,
            "risk_score": risk_score,
            "findings_count": findings,
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", scan_id).execute()

        # Update vendor risk score
        db.table("vendors").update({
            "risk_score": risk_score,
            "last_scan_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", vendor_id).execute()

        # Record score history
        db.table("vendor_score_history").insert({
            "org_id": org_id,
            "vendor_id": vendor_id,
            "risk_score": risk_score,
            "breakdown": results,
        }).execute()

        logger.info("Vendor scan completed for %s (score=%d)", name, risk_score)
    except Exception as e:
        logger.error("Vendor scan failed for %s: %s", vendor_id, e)
        if scan_record and scan_record.data:
            try:
                db.table("vendor_scans").update({
                    "status": "failed",
                    "error": str(e),
                    "completed_at": datetime.utcnow().isoformat(),
                }).eq("id", scan_record.data[0]["id"]).execute()
            except Exception:
                pass


@router.post("/{vendor_id}/scan")
async def trigger_vendor_scan(
    vendor_id: str,
    background_tasks: BackgroundTasks,
    x_org_id: str = Header(...),
    scan_type: str = Query("full"),
):
    """Trigger a security scan for a vendor."""
    # Verify vendor exists
    db = get_client()
    vendor = db.table("vendors").select("id").eq("id", vendor_id).eq("org_id", x_org_id).execute()
    if not vendor.data:
        raise HTTPException(404, "Vendor not found")
    background_tasks.add_task(run_vendor_scan, x_org_id, vendor_id, scan_type)
    return {"status": "scan_started", "vendor_id": vendor_id, "scan_type": scan_type}


@router.get("/{vendor_id}/scans")
async def get_vendor_scans(
    vendor_id: str,
    x_org_id: str = Header(...),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
):
    """Get scan history for a vendor."""
    try:
        db = get_client()
        offset = (page - 1) * per_page
        result = (
            db.table("vendor_scans")
            .select("*", count="exact")
            .eq("vendor_id", vendor_id)
            .eq("org_id", x_org_id)
            .order("created_at", desc=True)
            .range(offset, offset + per_page - 1)
            .execute()
        )
        return {
            "data": result.data or [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/{vendor_id}/score-history")
async def get_vendor_score_history(vendor_id: str, x_org_id: str = Header(...)):
    """Get risk score trend for a vendor."""
    try:
        db = get_client()
        result = (
            db.table("vendor_score_history")
            .select("risk_score,recorded_at")
            .eq("vendor_id", vendor_id)
            .eq("org_id", x_org_id)
            .order("recorded_at", desc=True)
            .limit(52)  # ~1 year of weekly data
            .execute()
        )
        return {"data": result.data or []}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/stats/summary")
async def vendor_stats(x_org_id: str = Header(...)):
    """Get vendor risk summary stats."""
    try:
        db = get_client()
        total = db.table("vendors").select("id", count="exact").eq("org_id", x_org_id).execute()
        critical = db.table("vendors").select("id", count="exact").eq("org_id", x_org_id).eq("risk_tier", "critical").execute()
        high = db.table("vendors").select("id", count="exact").eq("org_id", x_org_id).eq("risk_tier", "high").execute()
        # Average risk score
        all_vendors = db.table("vendors").select("risk_score").eq("org_id", x_org_id).execute()
        scores = [v["risk_score"] for v in (all_vendors.data or []) if v.get("risk_score")]
        avg_score = sum(scores) / len(scores) if scores else 0

        return {
            "total": getattr(total, "count", 0) or 0,
            "critical": getattr(critical, "count", 0) or 0,
            "high": getattr(high, "count", 0) or 0,
            "avg_risk_score": round(avg_score, 1),
        }
    except Exception as e:
        raise HTTPException(500, str(e))
