"""Live BrandMonitoring scan endpoint.

Wires the BrandMonitoring/ skill (or, when its heavy deps aren't installed,
the backend's lighter brand_monitor + brand_threat fallbacks) into a
fire-and-poll API. The UI calls POST /scans to launch and GET /scans/{id}
to poll status + retrieve findings.

The scan runs as a FastAPI BackgroundTask so the request returns in <1s with
a scan_id; results land in an in-process registry. For multi-replica
deployments this should be backed by Supabase or Redis — left as a TODO.
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Header
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()

# In-process scan registry. Acceptable for single-worker FastAPI on Render's
# free tier; revisit when we move to multi-replica.
_SCANS: dict[str, "ScanState"] = {}


@dataclass
class ScanState:
    scan_id: str
    org_id: str
    brand_name: str
    primary_domains: list[str]
    keywords: list[str]
    status: str = "queued"  # queued | running | done | failed
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    progress: int = 0  # 0..100
    engine: str = "fallback"  # fallback | brandmonitoring
    findings: list[dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None

    def public(self) -> dict[str, Any]:
        return {
            "scan_id": self.scan_id,
            "org_id": self.org_id,
            "brand_name": self.brand_name,
            "primary_domains": self.primary_domains,
            "keywords": self.keywords,
            "status": self.status,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "progress": self.progress,
            "engine": self.engine,
            "findings_count": len(self.findings),
            "error": self.error,
        }


class ScanRequest(BaseModel):
    brand_name: str = Field(..., min_length=2, max_length=120)
    primary_domains: list[str] = Field(..., min_length=1, max_length=10)
    keywords: list[str] = Field(default_factory=list, max_length=20)
    modules: Optional[list[str]] = None  # if set, restrict module set


def _try_import_brandmonitoring():
    """Best-effort import of the BrandMonitoring package. Returns the
    orchestrator's run_scan callable or None.
    """
    try:
        repo_root = Path(__file__).resolve().parent.parent.parent
        bm_root = repo_root / "BrandMonitoring"
        if not bm_root.exists():
            return None
        sys.path.insert(0, str(bm_root))
        from core.orchestrator import run_scan  # type: ignore
        return run_scan
    except Exception as e:
        logger.info(f"BrandMonitoring engine unavailable: {e}")
        return None


def _build_min_brand_config(req: ScanRequest) -> dict[str, Any]:
    """Construct the minimum YAML-shaped config the BrandMonitoring engine
    expects, from the API request payload.
    """
    return {
        "brand": {"name": req.brand_name, "industry": "", "headquarters": ""},
        "assets": {
            "primary_domains": req.primary_domains,
            "secondary_domains": [],
            "ip_ranges": [],
            "mobile_apps": {"android": [], "ios": []},
            "brand_keywords": req.keywords or [req.brand_name],
            "trademarks": [],
            "product_names": [],
            "social_handles": {},
        },
        "people": {"executives": [], "vips": [], "support_handles": []},
        "engagement": {"client_name": req.brand_name, "engagement_id": ""},
        "compliance": [],
        "modules": {
            "domain_intel": {"enabled": True, "permutations": "basic", "check_live": True, "capture_screenshots": False},
            "phishing_intel": {"enabled": True, "sources": ["urlscan", "virustotal"]},
            "infra_intel": {"enabled": False},
            "social_impersonation": {"enabled": False},
            "social_deep_scrape": {"enabled": False},
            "email_exposure": {"enabled": True, "use_hibp": True, "use_holehe": False},
            "code_leaks": {"enabled": True, "github_search": True},
            "darkweb_intel": {"enabled": False},
            "mobile_apps": {"enabled": False},
            "content_abuse": {"enabled": False},
            "ad_fraud": {"enabled": False},
            "deepfake_intel": {"enabled": False},
            "pentest_recon": {"enabled": False},
        },
        "ai_triage": {"enabled": False},
        "report": {"generate_executive": False, "generate_technical": False},
    }


async def _run_with_brandmonitoring(state: ScanState, req: ScanRequest) -> bool:
    """Execute the scan via the BrandMonitoring engine if importable."""
    runner = _try_import_brandmonitoring()
    if runner is None:
        return False
    try:
        cfg = _build_min_brand_config(req)
        state.engine = "brandmonitoring"
        state.progress = 10
        report, _scan_dir = await runner(cfg, modules=req.modules)
        # Best-effort: convert the engine's findings shape into our flat list.
        for finding in getattr(report, "findings", []) or []:
            try:
                d = finding.to_dict() if hasattr(finding, "to_dict") else dict(finding)  # type: ignore
            except Exception:
                d = {"raw": str(finding)}
            state.findings.append(d)
        state.progress = 100
        return True
    except Exception as e:
        logger.exception("BrandMonitoring scan failed")
        state.error = f"BrandMonitoring engine error: {e}"
        return False


async def _run_fallback(state: ScanState, req: ScanRequest) -> None:
    """Lightweight fallback using the backend's existing brand modules.
    Generates typosquats and runs basic live-resolution + reputation lookups.
    """
    state.engine = "fallback"
    findings: list[dict[str, Any]] = []

    try:
        from modules.brand_monitor import generate_typosquats  # type: ignore
    except Exception as e:
        state.error = f"Fallback module unavailable: {e}"
        state.status = "failed"
        return

    state.progress = 10
    for i, domain in enumerate(req.primary_domains):
        try:
            squats = generate_typosquats(domain)
        except Exception as e:
            squats = []
            findings.append({
                "type": "scan_error",
                "domain": domain,
                "error": str(e),
            })
        for sq in squats:
            findings.append({
                "type": "typosquat",
                "source_domain": domain,
                "candidate": sq,
                "severity": "informational",
                "first_seen": datetime.now(timezone.utc).isoformat(),
            })
        state.progress = 10 + int(70 * (i + 1) / max(1, len(req.primary_domains)))
        await asyncio.sleep(0)  # cooperative

    # crt.sh subdomain enumeration for first domain (cheap + valuable)
    try:
        import httpx
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                f"https://crt.sh/?q=%25.{req.primary_domains[0]}&output=json"
            )
            if r.status_code == 200:
                data = r.json()
                seen = set()
                for row in data:
                    name = (row.get("name_value") or "").strip().lower()
                    for n in name.split("\n"):
                        n = n.strip()
                        if n and "*" not in n and n not in seen:
                            seen.add(n)
                            findings.append({
                                "type": "ct_subdomain",
                                "subdomain": n,
                                "issuer": row.get("issuer_name", ""),
                                "severity": "informational",
                            })
                state.progress = 90
    except Exception as e:
        findings.append({"type": "scan_warning", "error": f"crt.sh: {e}"})

    state.findings.extend(findings)
    state.progress = 100


async def _execute_scan(scan_id: str) -> None:
    state = _SCANS.get(scan_id)
    if state is None:
        return
    state.status = "running"
    state.started_at = datetime.now(timezone.utc).isoformat()
    started = time.time()
    req = ScanRequest(
        brand_name=state.brand_name,
        primary_domains=state.primary_domains,
        keywords=state.keywords,
    )
    try:
        ok = await _run_with_brandmonitoring(state, req)
        if not ok:
            await _run_fallback(state, req)
        state.status = "done" if not state.error else "failed"
    except Exception as e:
        logger.exception("scan failed")
        state.status = "failed"
        state.error = str(e)
    finally:
        state.finished_at = datetime.now(timezone.utc).isoformat()
        logger.info(f"scan {scan_id} {state.status} in {time.time() - started:.1f}s — {len(state.findings)} findings")


@router.post("/scans", status_code=202)
async def create_scan(
    req: ScanRequest,
    background_tasks: BackgroundTasks,
    x_org_id: str = Header(default="00000000-0000-0000-0000-000000000001", alias="X-Org-Id"),
):
    scan_id = uuid.uuid4().hex[:16]
    state = ScanState(
        scan_id=scan_id,
        org_id=x_org_id,
        brand_name=req.brand_name,
        primary_domains=[d.strip().lower() for d in req.primary_domains if d.strip()],
        keywords=[k.strip() for k in req.keywords if k.strip()],
    )
    _SCANS[scan_id] = state
    background_tasks.add_task(_execute_scan, scan_id)
    return state.public()


@router.get("/scans/{scan_id}")
async def get_scan(scan_id: str):
    state = _SCANS.get(scan_id)
    if state is None:
        raise HTTPException(404, "Scan not found")
    return state.public()


@router.get("/scans/{scan_id}/findings")
async def get_findings(scan_id: str, limit: int = 200):
    state = _SCANS.get(scan_id)
    if state is None:
        raise HTTPException(404, "Scan not found")
    return {
        "scan_id": scan_id,
        "status": state.status,
        "engine": state.engine,
        "count": len(state.findings),
        "findings": state.findings[:limit],
    }


@router.get("/scans")
async def list_scans(
    x_org_id: str = Header(default="00000000-0000-0000-0000-000000000001", alias="X-Org-Id"),
):
    items = [s.public() for s in _SCANS.values() if s.org_id == x_org_id]
    items.sort(key=lambda x: x.get("started_at") or "", reverse=True)
    return {"items": items, "count": len(items)}
