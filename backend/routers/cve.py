"""
CVE Intelligence Feed Router
Sources: NVD API v2 (NIST), CISA KEV, EPSS (first.org)
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Header, Query, BackgroundTasks

from db import get_client

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# NVD API v2 — Free, no key required (50 req/30s with key)
# ---------------------------------------------------------------------------
async def fetch_nvd_cves(
    keyword: Optional[str] = None,
    cve_id: Optional[str] = None,
    days_back: int = 7,
    start_index: int = 0,
    results_per_page: int = 20,
) -> dict:
    """Fetch CVEs from NIST NVD API v2."""
    base_url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    params = {"startIndex": start_index, "resultsPerPage": results_per_page}

    if cve_id:
        params["cveId"] = cve_id
    elif keyword:
        params["keywordSearch"] = keyword
    else:
        pub_start = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%dT00:00:00.000")
        pub_end = datetime.utcnow().strftime("%Y-%m-%dT23:59:59.999")
        params["pubStartDate"] = pub_start
        params["pubEndDate"] = pub_end

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(base_url, params=params)
        if resp.status_code == 200:
            return resp.json()
        logger.warning("NVD API returned %s: %s", resp.status_code, resp.text[:200])
    return {}


def parse_nvd_cve(vuln: dict) -> dict:
    """Parse NVD vulnerability object into our schema."""
    cve = vuln.get("cve", {})
    cve_id = cve.get("id", "")
    descriptions = cve.get("descriptions", [])
    desc = next((d["value"] for d in descriptions if d.get("lang") == "en"), "")

    # CVSS scoring - prefer v3.1, fallback to v3.0, then v2
    metrics = cve.get("metrics", {})
    cvss_score = 0.0
    cvss_vector = ""
    severity = "none"

    for version in ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]:
        metric_list = metrics.get(version, [])
        if metric_list:
            cvss_data = metric_list[0].get("cvssData", {})
            cvss_score = cvss_data.get("baseScore", 0)
            cvss_vector = cvss_data.get("vectorString", "")
            sev = metric_list[0].get("cvssData", {}).get("baseSeverity", "").lower()
            if not sev:
                sev = metric_list[0].get("baseSeverity", "").lower()
            if sev in ("critical", "high", "medium", "low"):
                severity = sev
            break

    if severity == "none" and cvss_score > 0:
        if cvss_score >= 9.0:
            severity = "critical"
        elif cvss_score >= 7.0:
            severity = "high"
        elif cvss_score >= 4.0:
            severity = "medium"
        else:
            severity = "low"

    # Affected products (CPE)
    configurations = cve.get("configurations", [])
    affected = []
    for config in configurations:
        for node in config.get("nodes", []):
            for match in node.get("cpeMatch", []):
                if match.get("vulnerable"):
                    affected.append(match.get("criteria", ""))

    # References (column name ref_urls to avoid reserved word)
    refs = [{"url": r.get("url"), "source": r.get("source")} for r in cve.get("references", [])]

    # Weaknesses
    weaknesses = []
    for w in cve.get("weaknesses", []):
        for d in w.get("description", []):
            if d.get("value") != "NVD-CWE-Other":
                weaknesses.append(d.get("value"))

    published = cve.get("published")
    modified = cve.get("lastModified")

    return {
        "cve_id": cve_id,
        "description": desc[:2000] if desc else "",
        "severity": severity,
        "cvss_score": cvss_score,
        "cvss_vector": cvss_vector,
        "affected_products": affected[:50],
        "ref_urls": refs[:20],
        "weaknesses": list(set(weaknesses)),
        "published_at": published,
        "modified_at": modified,
    }


# ---------------------------------------------------------------------------
# CISA KEV — Known Exploited Vulnerabilities
# ---------------------------------------------------------------------------
async def fetch_cisa_kev() -> list:
    """Fetch CISA Known Exploited Vulnerabilities catalog."""
    url = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("vulnerabilities", [])
    return []


# ---------------------------------------------------------------------------
# EPSS — Exploit Prediction Scoring System (first.org)
# ---------------------------------------------------------------------------
async def fetch_epss_scores(cve_ids: list[str]) -> dict:
    """Fetch EPSS scores for a list of CVE IDs."""
    if not cve_ids:
        return {}
    url = "https://api.first.org/data/v1/epss"
    scores = {}
    # API accepts up to 100 CVEs per request
    for i in range(0, len(cve_ids), 100):
        batch = cve_ids[i:i + 100]
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params={"cve": ",".join(batch)})
            if resp.status_code == 200:
                for entry in resp.json().get("data", []):
                    scores[entry["cve"]] = {
                        "epss": float(entry.get("epss", 0)),
                        "percentile": float(entry.get("percentile", 0)),
                    }
    return scores


# ---------------------------------------------------------------------------
# Background task: sync CVEs + EPSS + KEV
# ---------------------------------------------------------------------------
async def sync_cve_feed(keyword: Optional[str] = None, days_back: int = 7):
    """Background task to sync CVE data from NVD + EPSS + KEV."""
    try:
        db = get_client()

        # Fetch from NVD
        nvd_data = await fetch_nvd_cves(keyword=keyword, days_back=days_back, results_per_page=50)
        vulnerabilities = nvd_data.get("vulnerabilities", [])
        if not vulnerabilities:
            return

        # Parse CVEs
        parsed = [parse_nvd_cve(v) for v in vulnerabilities]
        cve_ids = [p["cve_id"] for p in parsed]

        # Fetch EPSS scores
        epss = await fetch_epss_scores(cve_ids)

        # Fetch KEV list
        kev_list = await fetch_cisa_kev()
        kev_ids = {v["cveID"] for v in kev_list}
        kev_dates = {v["cveID"]: v.get("dueDate") for v in kev_list}

        # Upsert into database
        for cve in parsed:
            cve_id = cve["cve_id"]
            epss_data = epss.get(cve_id, {})
            cve["epss_score"] = epss_data.get("epss", 0)
            cve["epss_percentile"] = epss_data.get("percentile", 0)
            cve["cisa_kev"] = cve_id in kev_ids
            cve["kev_due_date"] = kev_dates.get(cve_id)
            cve["fetched_at"] = datetime.utcnow().isoformat()

            try:
                db.table("cve_entries").upsert(cve, on_conflict="cve_id").execute()
            except Exception as e:
                logger.warning("Failed to upsert CVE %s: %s", cve_id, e)

        logger.info("Synced %d CVEs (keyword=%s)", len(parsed), keyword)
    except Exception as e:
        logger.error("CVE sync failed: %s", e)


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@router.get("/feed")
async def get_cve_feed(
    x_org_id: str = Header(...),
    severity: Optional[str] = Query(None),
    kev_only: bool = Query(False),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Get CVE intelligence feed with filtering."""
    try:
        db = get_client()
        query = db.table("cve_entries").select("*", count="exact")

        if severity:
            query = query.eq("severity", severity)
        if kev_only:
            query = query.eq("cisa_kev", True)
        if search:
            query = query.or_(f"cve_id.ilike.%{search}%,description.ilike.%{search}%")

        offset = (page - 1) * per_page
        result = query.order("published_at", desc=True).range(offset, offset + per_page - 1).execute()

        return {
            "data": result.data or [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        logger.error("CVE feed error: %s", e)
        raise HTTPException(500, f"Failed to fetch CVE feed: {e}")


@router.get("/lookup/{cve_id}")
async def lookup_cve(cve_id: str, x_org_id: str = Header(...)):
    """Look up a specific CVE by ID."""
    try:
        # Check cache first
        db = get_client()
        cached = db.table("cve_entries").select("*").eq("cve_id", cve_id.upper()).execute()
        if cached.data:
            return cached.data[0]

        # Fetch from NVD
        nvd_data = await fetch_nvd_cves(cve_id=cve_id.upper())
        vulns = nvd_data.get("vulnerabilities", [])
        if not vulns:
            raise HTTPException(404, f"CVE {cve_id} not found")

        parsed = parse_nvd_cve(vulns[0])
        epss = await fetch_epss_scores([parsed["cve_id"]])
        epss_data = epss.get(parsed["cve_id"], {})
        parsed["epss_score"] = epss_data.get("epss", 0)
        parsed["epss_percentile"] = epss_data.get("percentile", 0)

        kev_list = await fetch_cisa_kev()
        kev_ids = {v["cveID"] for v in kev_list}
        parsed["cisa_kev"] = parsed["cve_id"] in kev_ids
        parsed["fetched_at"] = datetime.utcnow().isoformat()

        # Cache it
        try:
            db.table("cve_entries").upsert(parsed, on_conflict="cve_id").execute()
        except Exception:
            pass

        return parsed
    except HTTPException:
        raise
    except Exception as e:
        logger.error("CVE lookup error: %s", e)
        raise HTTPException(500, f"CVE lookup failed: {e}")


@router.post("/sync")
async def trigger_cve_sync(
    background_tasks: BackgroundTasks,
    x_org_id: str = Header(...),
    keyword: Optional[str] = Query(None),
    days_back: int = Query(7, ge=1, le=120),
):
    """Trigger a CVE feed sync from NVD + CISA KEV + EPSS."""
    background_tasks.add_task(sync_cve_feed, keyword=keyword, days_back=days_back)
    return {"status": "sync_started", "keyword": keyword, "days_back": days_back}


@router.get("/kev")
async def get_kev_feed(
    x_org_id: str = Header(...),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Get CISA Known Exploited Vulnerabilities from our cache."""
    try:
        db = get_client()
        offset = (page - 1) * per_page
        result = (
            db.table("cve_entries")
            .select("*", count="exact")
            .eq("cisa_kev", True)
            .order("published_at", desc=True)
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
        logger.error("KEV feed error: %s", e)
        raise HTTPException(500, f"Failed to fetch KEV feed: {e}")


@router.get("/stats")
async def cve_stats(x_org_id: str = Header(...)):
    """Get CVE statistics summary."""
    try:
        db = get_client()
        total = db.table("cve_entries").select("id", count="exact").execute()
        critical = db.table("cve_entries").select("id", count="exact").eq("severity", "critical").execute()
        high = db.table("cve_entries").select("id", count="exact").eq("severity", "high").execute()
        kev = db.table("cve_entries").select("id", count="exact").eq("cisa_kev", True).execute()

        # Recent 24h
        yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
        recent = db.table("cve_entries").select("id", count="exact").gte("published_at", yesterday).execute()

        return {
            "total": getattr(total, "count", 0) or 0,
            "critical": getattr(critical, "count", 0) or 0,
            "high": getattr(high, "count", 0) or 0,
            "kev_count": getattr(kev, "count", 0) or 0,
            "last_24h": getattr(recent, "count", 0) or 0,
        }
    except Exception as e:
        logger.error("CVE stats error: %s", e)
        raise HTTPException(500, str(e))


# ---------------------------------------------------------------------------
# CVE Watchlist (per-org tech stack keywords)
# ---------------------------------------------------------------------------
@router.get("/watchlist")
async def get_watchlist(x_org_id: str = Header(...)):
    """Get the org's CVE watchlist keywords."""
    try:
        db = get_client()
        result = db.table("cve_watchlist").select("*").eq("org_id", x_org_id).order("created_at", desc=True).execute()
        return {"data": result.data or []}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/watchlist")
async def add_watchlist_keyword(
    body: dict,
    x_org_id: str = Header(...),
):
    """Add a keyword to the CVE watchlist."""
    keyword = body.get("keyword", "").strip()
    keyword_type = body.get("keyword_type", "product")
    if not keyword:
        raise HTTPException(400, "keyword is required")
    try:
        db = get_client()
        result = db.table("cve_watchlist").insert({
            "org_id": x_org_id,
            "keyword": keyword,
            "keyword_type": keyword_type,
        }).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        if "duplicate" in str(e).lower():
            raise HTTPException(409, "Keyword already in watchlist")
        raise HTTPException(500, str(e))


@router.delete("/watchlist/{item_id}")
async def remove_watchlist_keyword(item_id: str, x_org_id: str = Header(...)):
    """Remove a keyword from the CVE watchlist."""
    try:
        db = get_client()
        db.table("cve_watchlist").delete().eq("id", item_id).eq("org_id", x_org_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(500, str(e))
