import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Header, Query, BackgroundTasks
from pydantic import BaseModel

from db import get_client

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_scan_modules():
    """Lazy-load scan modules to avoid import-time failures."""
    modules = {}
    try:
        from modules.dark_web import run_dark_web_scan
        modules["dark_web"] = run_dark_web_scan
    except ImportError as e:
        logger.warning("Could not load dark_web module: %s", e)

    try:
        from modules.brand_monitor import run_brand_monitor
        modules["brand"] = run_brand_monitor
    except ImportError as e:
        logger.warning("Could not load brand_monitor module: %s", e)

    try:
        from modules.data_leak import run_data_leak_scan
        modules["data_leak"] = run_data_leak_scan
    except ImportError as e:
        logger.warning("Could not load data_leak module: %s", e)

    try:
        from modules.surface_web import run_surface_scan
        modules["surface_web"] = run_surface_scan
    except ImportError as e:
        logger.warning("Could not load surface_web module: %s", e)

    try:
        from modules.cert_monitor import run_cert_monitor
        modules["cert_monitor"] = run_cert_monitor
    except ImportError as e:
        logger.warning("Could not load cert_monitor module: %s", e)

    try:
        from modules.credential_scan import run_credential_scan
        modules["credential"] = run_credential_scan
    except ImportError as e:
        logger.warning("Could not load credential_scan module: %s", e)

    return modules


SCAN_MODULE_NAMES = {"dark_web", "brand", "data_leak", "surface_web", "cert_monitor", "credential"}


class ScanTrigger(BaseModel):
    module: str
    asset_id: Optional[str] = None


async def _run_scan_background(module_name: str, org_id: str):
    try:
        modules = _get_scan_modules()
        if module_name not in modules:
            logger.error("Scan module '%s' is not available", module_name)
            return
        scan_func = modules[module_name]
        await scan_func(org_id)
    except Exception as e:
        logger.error("Background scan %s failed for org %s: %s", module_name, org_id, e)


@router.post("/trigger")
async def trigger_scan(
    body: ScanTrigger,
    background_tasks: BackgroundTasks,
    x_org_id: str = Header(...),
):
    if body.module not in SCAN_MODULE_NAMES:
        raise HTTPException(400, f"Invalid module. Must be one of: {sorted(SCAN_MODULE_NAMES)}")

    try:
        client = get_client()
        job = (
            client.table("scan_jobs")
            .insert({
                "org_id": x_org_id,
                "module": body.module,
                "status": "pending",
                "metadata": {"asset_id": body.asset_id} if body.asset_id else {},
            })
            .execute()
        )

        if not job.data:
            raise HTTPException(500, "Failed to create scan job")

        background_tasks.add_task(_run_scan_background, body.module, x_org_id)

        return {"job_id": job.data[0]["id"], "module": body.module, "status": "pending"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to trigger scan: %s", e)
        raise HTTPException(500, f"Failed to trigger scan: {str(e)}")


@router.get("/")
async def list_scans(
    x_org_id: str = Header(...),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
):
    try:
        client = get_client()
        offset = (page - 1) * per_page
        result = (
            client.table("scan_jobs")
            .select("*", count="exact")
            .eq("org_id", x_org_id)
            .order("started_at", desc=True)
            .range(offset, offset + per_page - 1)
            .execute()
        )
        return {
            "data": result.data if result.data else [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        logger.error("Failed to list scans: %s", e)
        raise HTTPException(500, f"Failed to list scans: {str(e)}")


@router.get("/{scan_id}/status")
async def get_scan_status(scan_id: str, x_org_id: str = Header(...)):
    try:
        client = get_client()
        result = (
            client.table("scan_jobs")
            .select("*")
            .eq("id", scan_id)
            .eq("org_id", x_org_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(404, "Scan job not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get scan status %s: %s", scan_id, e)
        raise HTTPException(500, f"Failed to get scan status: {str(e)}")
