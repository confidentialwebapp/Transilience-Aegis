import logging
import asyncio
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Header, Query, BackgroundTasks
from pydantic import BaseModel

from db import get_client

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_scan_modules():
    from modules.dark_web import run_dark_web_scan
    from modules.brand_monitor import run_brand_monitor
    from modules.data_leak import run_data_leak_scan
    from modules.surface_web import run_surface_scan
    from modules.cert_monitor import run_cert_monitor
    from modules.credential_scan import run_credential_scan
    return {
        "dark_web": run_dark_web_scan,
        "brand": run_brand_monitor,
        "data_leak": run_data_leak_scan,
        "surface_web": run_surface_scan,
        "cert_monitor": run_cert_monitor,
        "credential": run_credential_scan,
    }


SCAN_MODULE_NAMES = {"dark_web", "brand", "data_leak", "surface_web", "cert_monitor", "credential"}


class ScanTrigger(BaseModel):
    module: str
    asset_id: Optional[str] = None


async def _run_scan_background(module_name: str, org_id: str):
    try:
        modules = _get_scan_modules()
        scan_func = modules[module_name]
        await scan_func(org_id)
    except Exception as e:
        logger.error(f"Background scan {module_name} failed for org {org_id}: {e}")


@router.post("/trigger")
async def trigger_scan(
    body: ScanTrigger,
    background_tasks: BackgroundTasks,
    x_org_id: str = Header(...),
):
    if body.module not in SCAN_MODULE_NAMES:
        raise HTTPException(400, f"Invalid module. Must be one of: {list(SCAN_MODULES.keys())}")

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

    background_tasks.add_task(_run_scan_background, body.module, x_org_id)

    return {"job_id": job.data[0]["id"], "module": body.module, "status": "pending"}


@router.get("/")
async def list_scans(
    x_org_id: str = Header(...),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
):
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
        "data": result.data,
        "total": result.count,
        "page": page,
        "per_page": per_page,
    }


@router.get("/{scan_id}/status")
async def get_scan_status(scan_id: str, x_org_id: str = Header(...)):
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
