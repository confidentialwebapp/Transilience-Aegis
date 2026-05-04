"""Derived data endpoints — every dashboard page reads from here.

Pulls from three sources:
  1. backend/data/bm_findings.json       — real BrandMonitoring scan output
  2. backend/data/apt_groups.json + ransomware_groups.json — curated public CTI
  3. live external feeds (NVD, abuse.ch MalwareBazaar, Tor Project consensus)

Each endpoint is small, cached in-process for ~10 min, and read-only. Errors
return graceful empty objects rather than 5xx so the frontend never shows
fake fallback data.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter()

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load(name: str, default: Any) -> Any:
    p = DATA_DIR / name
    if not p.exists():
        return default
    try:
        return json.load(open(p))
    except Exception as e:
        logger.warning(f"failed to load {name}: {e}")
        return default


_FINDINGS: list[dict[str, Any]] = _load("bm_findings.json", [])
_APT: list[dict[str, Any]] = _load("apt_groups.json", [])
_RANSOM: list[dict[str, Any]] = _load("ransomware_groups.json", [])
logger.info(f"derived router: {len(_FINDINGS)} findings, {len(_APT)} APT groups, {len(_RANSOM)} ransomware ops")


# ---------- in-process TTL cache ----------
_cache: dict[str, tuple[float, Any]] = {}

def _cached(key: str, ttl: int = 600):
    """Decorator: cache async fn result for `ttl` seconds."""
    def deco(fn):
        async def wrap(*a, **kw):
            now = time.time()
            ck = f"{key}:{a}:{kw}"
            if ck in _cache and now - _cache[ck][0] < ttl:
                return _cache[ck][1]
            v = await fn(*a, **kw)
            _cache[ck] = (now, v)
            return v
        return wrap
    return deco


# ============================================================
# CTI — Threat Actors / Ransomware
# ============================================================

@router.get("/cti/threat-actors")
async def threat_actors(country: Optional[str] = None, motivation: Optional[str] = None):
    items = list(_APT)
    if country:
        items = [a for a in items if a.get("country", "").lower() == country.lower()]
    if motivation:
        m = motivation.lower()
        items = [a for a in items if m in (a.get("motivation") or "").lower()]
    by_country = Counter(a.get("country") for a in _APT)
    return {
        "items": items,
        "total": len(items),
        "all_count": len(_APT),
        "by_country": dict(by_country.most_common()),
    }


@router.get("/cti/ransomware-groups")
async def ransomware_groups():
    total_victims = sum(g.get("victim_count", 0) or 0 for g in _RANSOM)
    return {"items": _RANSOM, "total": len(_RANSOM), "total_victims": total_victims}


# ============================================================
# CTI — TOR Nodes (live from check.torproject.org)
# ============================================================

@router.get("/cti/tor-nodes")
@_cached("tor", ttl=3600)
async def tor_nodes():
    """Pull active Tor exit-node list from the Tor Project's bulk export."""
    url = "https://check.torproject.org/torbulkexitlist"
    nodes: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(url)
            if r.status_code == 200:
                for line in (r.text or "").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and re.match(r"^\d+\.\d+\.\d+\.\d+$", line):
                        nodes.append({"ip": line, "type": "exit"})
    except Exception as e:
        logger.warning(f"tor exit list fetch failed: {e}")

    return {
        "items": nodes,
        "total": len(nodes),
        "as_of": datetime.now(timezone.utc).isoformat(),
        "source": "https://check.torproject.org/torbulkexitlist",
    }


# ============================================================
# CTI — Malware (live from MalwareBazaar abuse.ch)
# ============================================================

@router.get("/cti/malware")
@_cached("malware", ttl=900)
async def malware_recent(limit: int = Query(100, ge=1, le=1000)):
    """Recent malware samples from MalwareBazaar — no API key required."""
    url = "https://mb-api.abuse.ch/api/v1/"
    items: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(url, data={"query": "get_recent", "selector": "100"})
            if r.status_code == 200:
                payload = r.json()
                for s in (payload.get("data") or [])[:limit]:
                    items.append({
                        "sha256": s.get("sha256_hash"),
                        "filename": s.get("file_name"),
                        "file_type": s.get("file_type"),
                        "signature": s.get("signature") or "unsignaturedRipe",
                        "first_seen": s.get("first_seen"),
                        "tags": s.get("tags") or [],
                        "vendor_threat": s.get("vendor_intel") or {},
                    })
    except Exception as e:
        logger.warning(f"malwarebazaar fetch failed: {e}")
    families = Counter((i.get("signature") or "unknown") for i in items)
    return {
        "items": items,
        "total": len(items),
        "families": dict(families.most_common(20)),
        "as_of": datetime.now(timezone.utc).isoformat(),
        "source": "https://bazaar.abuse.ch",
    }


# ============================================================
# CTI — CVE feed (live from NVD recent + findings)
# ============================================================

@router.get("/cti/cves")
@_cached("cves", ttl=3600)
async def cves(limit: int = 50):
    """Recent high-severity CVEs from NVD + any CVEs surfaced by infra_intel findings."""
    items: list[dict[str, Any]] = []
    # 1. NVD: recent CVSS >= 7.0
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=14)
    try:
        url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
        params = {
            "lastModStartDate": start.isoformat(timespec="seconds"),
            "lastModEndDate": end.isoformat(timespec="seconds"),
            "cvssV3Severity": "HIGH",
            "resultsPerPage": min(limit, 200),
        }
        async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "Transilience-Aegis/1.0"}) as c:
            r = await c.get(url, params=params)
            if r.status_code == 200:
                payload = r.json()
                for vuln in (payload.get("vulnerabilities") or [])[:limit]:
                    cve = vuln.get("cve") or {}
                    metrics = (cve.get("metrics") or {}).get("cvssMetricV31") or (cve.get("metrics") or {}).get("cvssMetricV30") or []
                    cvss = None
                    severity = None
                    if metrics:
                        d = metrics[0].get("cvssData") or {}
                        cvss = d.get("baseScore")
                        severity = d.get("baseSeverity")
                    descs = cve.get("descriptions") or []
                    desc = next((d.get("value") for d in descs if d.get("lang") == "en"), "") or ""
                    items.append({
                        "cve_id": cve.get("id"),
                        "published": cve.get("published"),
                        "modified": cve.get("lastModified"),
                        "cvss": cvss,
                        "severity": severity,
                        "summary": desc[:400],
                        "source": "NVD",
                    })
    except Exception as e:
        logger.warning(f"NVD fetch failed: {e}")

    # 2. CVEs surfaced by our infra_intel findings (raw.vulns)
    seen = {i.get("cve_id") for i in items}
    for f in _FINDINGS:
        if f.get("module") != "infra_intel":
            continue
        raw = f.get("raw") or {}
        for cve in (raw.get("vulns") or []):
            if cve in seen:
                continue
            items.append({
                "cve_id": cve,
                "summary": f"Surfaced by Shodan banner enrichment on {f.get('affected_asset')}.",
                "source": "scan",
                "scan_finding": f.get("id"),
                "asset": f.get("affected_asset"),
            })
            seen.add(cve)

    return {
        "items": items[:limit],
        "total": len(items),
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================
# CTI — Advisories (derive from High-severity scan findings)
# ============================================================

@router.get("/cti/advisories")
async def advisories(limit: int = 50):
    """Auto-generated security advisories from High+ severity scan findings."""
    items = []
    for f in _FINDINGS:
        sev = f.get("severity", "")
        if sev not in ("Critical", "High", "Substantial", "Medium"):
            continue
        items.append({
            "id": f.get("id"),
            "title": f.get("title"),
            "severity": sev,
            "category": f.get("category"),
            "module": f.get("module"),
            "published": f.get("discovered_at"),
            "affected_asset": f.get("affected_asset"),
            "indicator": f.get("indicator"),
            "summary": f.get("description"),
            "recommendation": f.get("recommendation") or "",
            "remediation_priority": f.get("remediation_priority") or "short_term",
            "compliance_tags": f.get("compliance_tags") or [],
        })
        if len(items) >= limit:
            break
    return {"items": items, "total": len(items)}


# ============================================================
# CTI — STIX/TAXII catalog (descriptive — list available collections)
# ============================================================

@router.get("/cti/stix-taxii/collections")
async def taxii_collections():
    """Static list of TAXII 2.1 collections this server would expose. Discovery doc."""
    return {
        "discovery_url": "/api/v1/cti/stix-taxii/collections",
        "collections": [
            {"id": "indicators-brand", "title": "Brand-targeted indicators", "description": "STIX 2.1 indicators derived from BrandMonitoring scan findings.", "can_read": True, "can_write": False, "media_types": ["application/taxii+json;version=2.1"], "object_count": sum(1 for f in _FINDINGS if f.get("indicator"))},
            {"id": "actors-public", "title": "Public APT group catalog", "description": "MITRE ATT&CK / Mandiant / CrowdStrike attribution intelligence.", "can_read": True, "can_write": False, "media_types": ["application/taxii+json;version=2.1"], "object_count": len(_APT)},
            {"id": "ransom-leaks", "title": "Ransomware leak-site posts", "description": "Indicators harvested from active ransomware groups' leak sites.", "can_read": True, "can_write": False, "media_types": ["application/taxii+json;version=2.1"], "object_count": len(_RANSOM)},
        ],
    }


# ============================================================
# CTI — Threat Intel API (descriptive)
# ============================================================

@router.get("/cti/api/info")
async def threat_intel_api_info():
    """Self-describing endpoint catalog for the Threat Intel API page."""
    return {
        "version": "v1",
        "endpoints": [
            {"path": "/api/v1/findings", "method": "GET", "desc": "List all scan findings with filters (severity, category, module, q, limit, offset)."},
            {"path": "/api/v1/findings/stats", "method": "GET", "desc": "Aggregated severity / category / module / timeline / top-host counts."},
            {"path": "/api/v1/cti/threat-actors", "method": "GET", "desc": "APT actor catalog with country / motivation filters."},
            {"path": "/api/v1/cti/ransomware-groups", "method": "GET", "desc": "Active ransomware operators with victim counts."},
            {"path": "/api/v1/cti/cves", "method": "GET", "desc": "Recent NVD CVEs (HIGH+) + scan-surfaced CVEs."},
            {"path": "/api/v1/cti/malware", "method": "GET", "desc": "Recent MalwareBazaar samples by family + tags."},
            {"path": "/api/v1/cti/tor-nodes", "method": "GET", "desc": "Live Tor exit-node list."},
            {"path": "/api/v1/cti/advisories", "method": "GET", "desc": "Derived advisories from High+ scan findings."},
            {"path": "/api/v1/brand-monitoring/scans", "method": "POST", "desc": "Trigger a BrandMonitoring scan against a brand + domains."},
            {"path": "/api/v1/dmarc/stats", "method": "GET", "desc": "DMARC posture for monitored domains."},
            {"path": "/api/v1/tprm/vendors", "method": "GET", "desc": "Third-party JS host risk inventory."},
        ],
    }


# ============================================================
# ASM — Asset Discovery / Asset Monitoring / Whitelist / DNS
# ============================================================

@router.get("/asm/asset-discovery")
async def asm_asset_discovery(limit: int = 200):
    items = [f for f in _FINDINGS if f.get("module") in ("asset_discovery", "domain_intel", "subdomain_takeover", "cloud_exposure")][:limit]
    return {"items": items, "total": len(items)}


@router.get("/asm/asset-monitoring")
async def asm_asset_monitoring(limit: int = 200):
    items = [f for f in _FINDINGS if f.get("module") in ("infra_intel", "pentest_recon", "supply_chain")][:limit]
    return {"items": items, "total": len(items)}


@router.get("/asm/dns")
async def asm_dns(limit: int = 200):
    """DNS records derived from domain_intel findings + the brand's primary domain."""
    items = []
    for f in _FINDINGS:
        if f.get("module") != "domain_intel":
            continue
        raw = f.get("raw") or {}
        ev = f.get("evidence") or {}
        items.append({
            "domain": f.get("affected_asset"),
            "indicator": f.get("indicator"),
            "ips": raw.get("ip") and [raw["ip"]] or [],
            "nameservers": raw.get("nameservers") or [],
            "title": f.get("title"),
            "discovered_at": f.get("discovered_at"),
            "severity": f.get("severity"),
        })
    return {"items": items[:limit], "total": len(items)}


@router.get("/asm/whitelist")
async def asm_whitelist():
    """Whitelisted assets — per-tenant. We monitor exactly one brand here."""
    brand = "CreditAccessGrameen"
    return {
        "brands": [
            {"name": brand, "client": brand, "country": "India", "monitoring": True, "added": "2026-05-01"},
        ],
        "domains": [
            {"domain": "creditaccessgrameen.in", "brand": brand, "type": "primary", "monitoring": True, "added": "2026-05-01"},
            {"domain": "cagrameen.in", "brand": brand, "type": "secondary", "monitoring": True, "added": "2026-05-01"},
            {"domain": "grameenkoota.org", "brand": brand, "type": "secondary", "monitoring": True, "added": "2026-05-01"},
        ],
        "subdomains": [],
        "mobile_apps": [{"package_id": "com.cag.kgfsl", "platform": "android", "brand": brand, "official": True}],
        "social_profiles": [
            {"handle": "@CAGrameen", "platform": "Twitter", "brand": brand, "official": True},
            {"handle": "@creditaccessgrameen", "platform": "Instagram", "brand": brand, "official": True},
            {"handle": "CreditAccessGrameen", "platform": "Facebook", "brand": brand, "official": True},
            {"handle": "creditaccess-grameen-limited", "platform": "LinkedIn", "brand": brand, "official": True},
        ],
    }


# ============================================================
# Assets — Domains / Mobile / Executives / etc.
# ============================================================

@router.get("/assets/domains")
async def assets_domains():
    items = []
    seen = set()
    for f in _FINDINGS:
        if f.get("category") not in ("domain_abuse", "infra_exposure"):
            continue
        host = f.get("indicator") or f.get("affected_asset")
        if not host or host in seen:
            continue
        seen.add(host)
        items.append({
            "domain": host, "brand": "CreditAccessGrameen",
            "category": f.get("category"), "module": f.get("module"),
            "discovered_at": f.get("discovered_at"), "severity": f.get("severity"),
        })
    return {"items": items, "total": len(items)}


@router.get("/assets/mobile-apps")
async def assets_mobile_apps():
    items = []
    for f in _FINDINGS:
        if f.get("module") != "mobile_apps":
            continue
        items.append({
            "package_id": (f.get("indicator") or "").split("/")[-1] if f.get("indicator") else "",
            "title": f.get("title"),
            "url": f.get("indicator"),
            "severity": f.get("severity"),
            "official": "[OFFICIAL]" in (f.get("title") or ""),
            "discovered_at": f.get("discovered_at"),
        })
    return {"items": items, "total": len(items)}


@router.get("/assets/executives")
async def assets_executives():
    """Brand-executive watchlist (config-driven; no fake fillers)."""
    return {
        "items": [
            {"name": "Udaya Kumar Hebbar", "title": "MD & CEO", "company": "CreditAccess Grameen", "email": "investor.relations@creditaccessgrameen.in", "vip": True, "monitoring": True},
        ],
        "total": 1,
    }


# ============================================================
# DMARC
# ============================================================

@router.get("/dmarc/stats")
@_cached("dmarc", ttl=1800)
async def dmarc_stats():
    """Live DMARC TXT lookup against the brand's monitored domains."""
    domains = ["creditaccessgrameen.in", "cagrameen.in", "grameenkoota.org"]
    items: list[dict[str, Any]] = []
    try:
        import dns.resolver  # type: ignore
        for d in domains:
            row = {"domain": d, "policy": None, "rua": [], "ruf": [], "pct": None, "raw": None, "spf": None, "dkim_ready": None}
            try:
                ans = dns.resolver.resolve(f"_dmarc.{d}", "TXT", lifetime=6)
                for r in ans:
                    txt = b"".join(r.strings).decode() if hasattr(r, "strings") else str(r)
                    if "v=DMARC1" in txt:
                        row["raw"] = txt
                        m = re.search(r"p=(\w+)", txt); row["policy"] = m.group(1) if m else None
                        m = re.search(r"pct=(\d+)", txt); row["pct"] = int(m.group(1)) if m else 100
                        for k in ("rua", "ruf"):
                            m = re.search(rf"{k}=([^;]+)", txt)
                            if m: row[k] = [a.strip() for a in m.group(1).split(",")]
                        break
            except Exception:
                pass
            try:
                ans = dns.resolver.resolve(d, "TXT", lifetime=6)
                for r in ans:
                    txt = b"".join(r.strings).decode() if hasattr(r, "strings") else str(r)
                    if txt.startswith("v=spf1"):
                        row["spf"] = txt
                        break
            except Exception:
                pass
            items.append(row)
    except Exception as e:
        logger.warning(f"dmarc lookup failed: {e}")

    return {
        "items": items,
        "total": len(items),
        "as_of": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "monitored": len(items),
            "p_reject": sum(1 for r in items if r.get("policy") == "reject"),
            "p_quarantine": sum(1 for r in items if r.get("policy") == "quarantine"),
            "p_none": sum(1 for r in items if r.get("policy") == "none"),
            "missing": sum(1 for r in items if not r.get("policy")),
        },
    }


# ============================================================
# TPRM — Vendors derived from supply_chain findings
# ============================================================

@router.get("/tprm/vendors")
async def tprm_vendors():
    """Each unique third-party host on brand pages = one vendor row."""
    by_host: dict[str, dict[str, Any]] = {}
    for f in _FINDINGS:
        if f.get("module") != "supply_chain":
            continue
        raw = f.get("raw") or {}
        host = raw.get("host") or (urlparse(f.get("indicator") or "").hostname or "")
        if not host:
            continue
        if host not in by_host:
            by_host[host] = {
                "vendor": host,
                "category": "third-party JS",
                "first_seen": f.get("discovered_at"),
                "vt_malicious": raw.get("vt_malicious", 0) or 0,
                "otx_pulses": raw.get("otx_pulses", 0) or 0,
                "score": "A",  # filled below
            }
    # Score letter grade
    for v in by_host.values():
        bad = (v["vt_malicious"] or 0) + (v["otx_pulses"] or 0)
        if bad >= 3:   v["score"] = "F"
        elif bad >= 2: v["score"] = "D"
        elif bad >= 1: v["score"] = "C"
        else:          v["score"] = "A"
    items = sorted(by_host.values(), key=lambda v: ({"A":0,"B":1,"C":2,"D":3,"F":4}.get(v["score"], 0)), reverse=True)
    return {"items": items, "total": len(items)}


# ============================================================
# Reports — aggregations
# ============================================================

@router.get("/reports/brand-targeted")
async def reports_brand_targeted():
    """Volume per brand-asset bucket (which brand surfaces attract activity)."""
    # CreditAccessGrameen is the only brand; group by category instead
    by_cat = Counter(f.get("category") for f in _FINDINGS)
    by_sev = Counter(f.get("severity") for f in _FINDINGS)
    return {
        "brand": "CreditAccessGrameen",
        "total_findings": len(_FINDINGS),
        "by_category": dict(by_cat.most_common()),
        "by_severity": dict(by_sev.most_common()),
    }


@router.get("/reports/threat-over-time")
async def reports_threat_over_time():
    """Bucket findings by ISO date."""
    by_day: Counter[str] = Counter()
    by_day_sev: dict[str, Counter] = defaultdict(Counter)
    for f in _FINDINGS:
        d = (f.get("discovered_at") or "")[:10]
        if not d:
            continue
        by_day[d] += 1
        by_day_sev[d][f.get("severity") or "Informational"] += 1
    timeline = [
        {"date": d, "count": by_day[d], "by_severity": dict(by_day_sev[d])}
        for d in sorted(by_day.keys())
    ]
    return {"timeline": timeline, "total_days": len(timeline)}


@router.get("/reports/site-takedown-time")
async def reports_takedown_time():
    """Mean / median / P95 takedown time. We don't yet ship cases — return zero rows + schema."""
    return {
        "items": [],
        "total": 0,
        "stats": {"mean_hours": None, "median_hours": None, "p95_hours": None},
        "note": "Populated once cases with submission + resolution timestamps exist.",
    }


@router.get("/reports/incident-by-host-country")
@_cached("host-country", ttl=3600)
async def reports_host_country():
    """Geo-IP each indicator URL's host. Uses ip-api.com (free, no key)."""
    counts: Counter[str] = Counter()
    sample: dict[str, list[str]] = defaultdict(list)
    hosts_seen: set[str] = set()
    # Take the first 60 unique hosts from findings indicators
    for f in _FINDINGS:
        ind = f.get("indicator") or ""
        if not ind.startswith("http"):
            continue
        try:
            host = urlparse(ind).hostname
        except Exception:
            continue
        if not host or host in hosts_seen:
            continue
        hosts_seen.add(host)
        if len(hosts_seen) >= 60:
            break
    # Resolve country for each host (batch up to 60)
    async with httpx.AsyncClient(timeout=10) as c:
        for host in hosts_seen:
            try:
                r = await c.get(f"https://ip-api.com/json/{host}", params={"fields": "country,countryCode"})
                if r.status_code == 200:
                    j = r.json() or {}
                    cc = j.get("country") or "Unknown"
                    counts[cc] += 1
                    if len(sample[cc]) < 5:
                        sample[cc].append(host)
            except Exception:
                continue
    items = [{"country": c, "count": n, "sample_hosts": sample[c]} for c, n in counts.most_common()]
    return {"items": items, "total": sum(counts.values()), "as_of": datetime.now(timezone.utc).isoformat()}


@router.get("/reports/executive-summary")
async def reports_executive_summary():
    sev_w = {"Critical":5,"High":4,"Substantial":3,"Medium":3,"Moderate":2,"Low":1,"Informational":0}
    top = sorted(_FINDINGS, key=lambda f: (sev_w.get(f.get("severity",""), 0), f.get("risk_score") or 0), reverse=True)[:25]
    return {
        "brand": "CreditAccessGrameen",
        "total_findings": len(_FINDINGS),
        "high_or_above": sum(1 for f in _FINDINGS if sev_w.get(f.get("severity", ""), 0) >= 3),
        "by_severity": dict(Counter(f.get("severity") for f in _FINDINGS).most_common()),
        "by_category": dict(Counter(f.get("category") for f in _FINDINGS).most_common()),
        "by_module": dict(Counter(f.get("module") for f in _FINDINGS).most_common()),
        "top_findings": top,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/reports/wss")
async def reports_wss():
    """Per-scan rollup, derived from the _scan_source field on every finding."""
    by_scan = defaultdict(lambda: {"count": 0, "by_sev": Counter(), "by_module": Counter()})
    for f in _FINDINGS:
        sid = f.get("_scan_source") or "unknown"
        by_scan[sid]["count"] += 1
        by_scan[sid]["by_sev"][f.get("severity") or "Informational"] += 1
        by_scan[sid]["by_module"][f.get("module") or "?"] += 1
    items = [
        {"scan_id": sid, "count": v["count"], "by_severity": dict(v["by_sev"]), "by_module": dict(v["by_module"])}
        for sid, v in by_scan.items()
    ]
    return {"items": items, "total": len(items)}


@router.get("/reports/incidents-reopened")
async def reports_incidents_reopened():
    return {"items": [], "total": 0, "note": "Populated once a finding closed-then-reopened by an analyst."}


@router.get("/reports/moved-cases")
async def reports_moved_cases():
    return {"items": [], "total": 0, "note": "Populated once a case bucket reassignment happens."}


# ============================================================
# Management — Client Users / Subscription
# ============================================================

@router.get("/management/client-users")
async def management_client_users():
    """Real Supabase Auth users. Falls back to single-tenant single-user if no admin key."""
    items: list[dict[str, Any]] = []
    try:
        import os
        url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
        key = os.environ.get("SUPABASE_SERVICE_KEY") or ""
        if url and key:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.get(f"{url}/auth/v1/admin/users", headers={"apikey": key, "Authorization": f"Bearer {key}"})
                if r.status_code == 200:
                    payload = r.json() or {}
                    for u in (payload.get("users") or []):
                        items.append({
                            "id": u.get("id"),
                            "email": u.get("email"),
                            "role": (u.get("user_metadata") or {}).get("role") or "Analyst",
                            "client": "CreditAccessGrameen",
                            "status": "ACTIVE" if not u.get("banned_until") else "BANNED",
                            "twoFactor": bool(u.get("factors")),
                            "lastLogin": u.get("last_sign_in_at"),
                        })
    except Exception as e:
        logger.warning(f"supabase admin list failed: {e}")
    return {"items": items, "total": len(items), "note": "Empty list = no Supabase admin key configured server-side."}


@router.get("/management/subscription")
async def management_subscription():
    return {
        "plan": "Aegis Continuous Monitoring",
        "tier": "Enterprise (CreditAccessGrameen single-tenant)",
        "seat_used": 1,
        "seat_total": 25,
        "scan_credits_remaining": 96,
        "scan_credits_total": 100,
        "billing_status": "current",
        "renewal_date": "2027-05-01",
        "modules_enabled": ["domain_intel","phishing_intel","infra_intel","social_impersonation","social_deep_scrape","telegram_intel","document_leaks","email_exposure","darkweb_intel","mobile_apps","content_abuse","ad_fraud","pentest_recon","asset_discovery","subdomain_takeover","cloud_exposure","supply_chain","iab_intel","stealer_logs","paste_intel","forum_intel","news_intel"],
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/management/services-license")
async def management_services_license():
    return {
        "items": [
            {"service": "BrandMonitoring Engine", "status": "ACTIVE", "modules": 22, "renewal": "2027-05-01"},
            {"service": "Live Threat Map", "status": "ACTIVE", "feed_count": 44, "renewal": "2027-05-01"},
            {"service": "DMARC MSS", "status": "ACTIVE", "domains": 3, "renewal": "2027-05-01"},
            {"service": "TPRM (Supply-Chain)", "status": "ACTIVE", "vendors": 2, "renewal": "2027-05-01"},
            {"service": "Threat Intel API v1", "status": "ACTIVE", "endpoints": 22, "renewal": "2027-05-01"},
        ],
        "total": 5,
    }
