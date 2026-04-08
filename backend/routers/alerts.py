import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel

from db import get_client

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_STATUSES = {"open", "acknowledged", "resolved", "false_positive"}
VALID_SEVERITIES = {"critical", "high", "medium", "low", "info"}
VALID_MODULES = {"dark_web", "brand", "data_leak", "surface_web", "credential", "cert_monitor"}


class StatusUpdate(BaseModel):
    status: str


class AssignUpdate(BaseModel):
    assignee_id: str


@router.get("/")
async def list_alerts(
    x_org_id: str = Header(...),
    severity: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    asset_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
):
    client = get_client()
    query = client.table("alerts").select("*, assets(value, type)", count="exact").eq("org_id", x_org_id)

    if severity:
        query = query.eq("severity", severity)
    if module:
        query = query.eq("module", module)
    if status:
        query = query.eq("status", status)
    if asset_id:
        query = query.eq("asset_id", asset_id)
    if date_from:
        query = query.gte("created_at", date_from)
    if date_to:
        query = query.lte("created_at", date_to)

    offset = (page - 1) * per_page
    query = query.order("created_at", desc=True).range(offset, offset + per_page - 1)
    result = query.execute()

    return {
        "data": result.data,
        "total": result.count,
        "page": page,
        "per_page": per_page,
    }


@router.get("/stats")
async def alert_stats(x_org_id: str = Header(...)):
    client = get_client()

    all_alerts = (
        client.table("alerts")
        .select("severity, module, status")
        .eq("org_id", x_org_id)
        .execute()
    )

    by_severity = {}
    by_module = {}
    by_status = {}

    for alert in all_alerts.data:
        sev = alert["severity"]
        mod = alert["module"]
        sta = alert["status"]
        by_severity[sev] = by_severity.get(sev, 0) + 1
        by_module[mod] = by_module.get(mod, 0) + 1
        by_status[sta] = by_status.get(sta, 0) + 1

    return {
        "total": len(all_alerts.data),
        "by_severity": by_severity,
        "by_module": by_module,
        "by_status": by_status,
    }


@router.get("/{alert_id}")
async def get_alert(alert_id: str, x_org_id: str = Header(...)):
    client = get_client()
    result = (
        client.table("alerts")
        .select("*, assets(value, type)")
        .eq("id", alert_id)
        .eq("org_id", x_org_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Alert not found")
    return result.data[0]


@router.patch("/{alert_id}/status")
async def update_alert_status(alert_id: str, body: StatusUpdate, x_org_id: str = Header(...)):
    if body.status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Must be one of: {VALID_STATUSES}")

    client = get_client()
    result = (
        client.table("alerts")
        .update({"status": body.status, "updated_at": datetime.utcnow().isoformat()})
        .eq("id", alert_id)
        .eq("org_id", x_org_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Alert not found")

    client.table("audit_log").insert({
        "org_id": x_org_id,
        "action": "alert_status_change",
        "entity_type": "alert",
        "entity_id": alert_id,
        "details": {"new_status": body.status},
    }).execute()

    return result.data[0]


@router.patch("/{alert_id}/assign")
async def assign_alert(alert_id: str, body: AssignUpdate, x_org_id: str = Header(...)):
    client = get_client()
    result = (
        client.table("alerts")
        .update({"assignee_id": body.assignee_id, "updated_at": datetime.utcnow().isoformat()})
        .eq("id", alert_id)
        .eq("org_id", x_org_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Alert not found")
    return result.data[0]
