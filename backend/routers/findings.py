"""Real BrandMonitoring findings exposed as a queryable API.

Source of truth: backend/data/bm_findings.json — produced by aggregating the
per-finding JSON files emitted by a real BrandMonitoring scan against
CreditAccess Grameen. Loaded once at module-import time.

This is the single endpoint set the frontend dashboard, threat feed,
incidents, asset-discovery, social-media, dark-web, code-leaks, and reports
pages call to render real data instead of mock-data generators.
"""
from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter()

# Severity weighting used for both sorting and KPI summarisation.
SEV_WEIGHT = {"Critical": 5, "High": 4, "Substantial": 3, "Medium": 3, "Moderate": 2, "Low": 1, "Informational": 0}


def _load_findings() -> list[dict[str, Any]]:
    p = Path(__file__).resolve().parent.parent / "data" / "bm_findings.json"
    if not p.exists():
        logger.warning(f"findings file missing at {p}")
        return []
    try:
        with p.open("r") as f:
            data = json.load(f)
        if not isinstance(data, list):
            logger.warning(f"findings file at {p} is not a list — got {type(data)}")
            return []
        return data
    except Exception as e:
        logger.exception(f"failed to load findings: {e}")
        return []


_FINDINGS: list[dict[str, Any]] = _load_findings()
logger.info(f"findings router loaded {len(_FINDINGS)} CreditAccessGrameen findings")


def _matches(f: dict[str, Any], q: str | None, severity: str | None,
             category: str | None, module: str | None) -> bool:
    if severity:
        wanted = {s.strip() for s in severity.split(",") if s.strip()}
        if f.get("severity") not in wanted:
            return False
    if category:
        wanted = {c.strip() for c in category.split(",") if c.strip()}
        if f.get("category") not in wanted:
            return False
    if module:
        wanted = {m.strip() for m in module.split(",") if m.strip()}
        if f.get("module") not in wanted:
            return False
    if q:
        ql = q.lower()
        haystack = " ".join(str(v) for v in (
            f.get("title") or "",
            f.get("description") or "",
            f.get("indicator") or "",
            f.get("affected_asset") or "",
        )).lower()
        if ql not in haystack:
            return False
    return True


@router.get("")
async def list_findings(
    q: Optional[str] = Query(None, description="Free-text search (title/description/indicator)"),
    severity: Optional[str] = Query(None, description="Comma-separated severity filter"),
    category: Optional[str] = Query(None, description="Comma-separated category filter"),
    module: Optional[str] = Query(None, description="Comma-separated module filter"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List findings with optional filters. Already pre-sorted by severity desc."""
    filtered = [f for f in _FINDINGS if _matches(f, q, severity, category, module)]
    total = len(filtered)
    items = filtered[offset:offset + limit]
    return {
        "items": items,
        "count": len(items),
        "total": total,
        "offset": offset,
        "limit": limit,
        "filters": {"q": q, "severity": severity, "category": category, "module": module},
    }


@router.get("/stats")
async def stats():
    """Aggregated counts the dashboard + KPI cards consume."""
    sev_counts = Counter(f.get("severity") or "Unknown" for f in _FINDINGS)
    cat_counts = Counter(f.get("category") or "uncategorised" for f in _FINDINGS)
    mod_counts = Counter(f.get("module") or "unknown" for f in _FINDINGS)

    # Distinct affected assets (e.g. "CreditAccess Grameen" + executive emails)
    affected = sorted({(f.get("affected_asset") or "").strip() for f in _FINDINGS if f.get("affected_asset")})

    # Naive timeline: count findings by ISO-date (discovered_at)
    by_day: Counter[str] = Counter()
    for f in _FINDINGS:
        ts = f.get("discovered_at") or ""
        if isinstance(ts, str) and len(ts) >= 10:
            by_day[ts[:10]] += 1
    timeline = [{"date": d, "count": c} for d, c in sorted(by_day.items())]

    # Top indicators by raw frequency of host
    host_counts: Counter[str] = Counter()
    for f in _FINDINGS:
        ind = f.get("indicator") or ""
        if isinstance(ind, str) and "://" in ind:
            try:
                host = ind.split("://", 1)[1].split("/", 1)[0]
                host_counts[host] += 1
            except Exception:
                pass
    top_hosts = [{"host": h, "count": c} for h, c in host_counts.most_common(20)]

    high_or_above = sum(1 for f in _FINDINGS if SEV_WEIGHT.get(f.get("severity", ""), 0) >= 3)

    return {
        "total_findings": len(_FINDINGS),
        "high_or_above": high_or_above,
        "severity_counts": dict(sev_counts),
        "category_counts": dict(cat_counts),
        "module_counts": dict(mod_counts),
        "affected_assets": affected,
        "timeline": timeline,
        "top_hosts": top_hosts,
        "as_of": datetime.now(timezone.utc).isoformat(),
        "brand": "CreditAccess Grameen",
        "scan_id": "creditaccess-grameen-20260501T130634-e2aefe",
    }


@router.get("/categories")
async def categories():
    """Distinct categories with counts — feeds filter dropdowns."""
    counts = Counter(f.get("category") or "uncategorised" for f in _FINDINGS)
    return {"items": [{"category": c, "count": n} for c, n in counts.most_common()]}


@router.get("/modules")
async def modules():
    counts = Counter(f.get("module") or "unknown" for f in _FINDINGS)
    return {"items": [{"module": m, "count": n} for m, n in counts.most_common()]}


@router.get("/{finding_id}")
async def get_finding(finding_id: str):
    for f in _FINDINGS:
        if f.get("id") == finding_id:
            return f
    raise HTTPException(404, f"Finding {finding_id} not found")
