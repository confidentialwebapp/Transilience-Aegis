import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Query, UploadFile, File
from pydantic import BaseModel

from db import get_client

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_ASSET_TYPES = {"domain", "ip", "email", "keyword", "github_org", "social", "certificate"}
VALID_STATUSES = {"active", "inactive", "compromised", "expiring"}


class AssetCreate(BaseModel):
    type: str
    value: str
    label: Optional[str] = None
    tags: list[str] = []


class AssetUpdate(BaseModel):
    label: Optional[str] = None
    tags: Optional[list[str]] = None
    status: Optional[str] = None


@router.post("/")
async def create_asset(body: AssetCreate, x_org_id: str = Header(...)):
    if body.type not in VALID_ASSET_TYPES:
        raise HTTPException(400, f"Invalid asset type. Must be one of: {VALID_ASSET_TYPES}")

    client = get_client()
    result = (
        client.table("assets")
        .insert({
            "org_id": x_org_id,
            "type": body.type,
            "value": body.value,
            "label": body.label,
            "tags": body.tags,
            "status": "active",
        })
        .execute()
    )
    return result.data[0] if result.data else {}


@router.get("/")
async def list_assets(
    x_org_id: str = Header(...),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
):
    client = get_client()
    query = client.table("assets").select("*", count="exact").eq("org_id", x_org_id)

    if type:
        query = query.eq("type", type)
    if status:
        query = query.eq("status", status)
    if search:
        query = query.ilike("value", f"%{search}%")

    offset = (page - 1) * per_page
    query = query.order("created_at", desc=True).range(offset, offset + per_page - 1)
    result = query.execute()

    return {
        "data": result.data,
        "total": result.count,
        "page": page,
        "per_page": per_page,
    }


@router.get("/{asset_id}")
async def get_asset(asset_id: str, x_org_id: str = Header(...)):
    client = get_client()
    result = (
        client.table("assets")
        .select("*")
        .eq("id", asset_id)
        .eq("org_id", x_org_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Asset not found")
    return result.data[0]


@router.patch("/{asset_id}")
async def update_asset(asset_id: str, body: AssetUpdate, x_org_id: str = Header(...)):
    client = get_client()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    if "status" in updates and updates["status"] not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Must be one of: {VALID_STATUSES}")

    result = (
        client.table("assets")
        .update(updates)
        .eq("id", asset_id)
        .eq("org_id", x_org_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Asset not found")
    return result.data[0]


@router.delete("/{asset_id}")
async def delete_asset(asset_id: str, x_org_id: str = Header(...)):
    client = get_client()
    result = (
        client.table("assets")
        .delete()
        .eq("id", asset_id)
        .eq("org_id", x_org_id)
        .execute()
    )
    return {"deleted": True}


@router.post("/bulk")
async def bulk_import(file: UploadFile = File(...), x_org_id: str = Header(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are accepted")

    content = await file.read()
    lines = content.decode("utf-8").strip().split("\n")

    if len(lines) < 2:
        raise HTTPException(400, "CSV must have a header row and at least one data row")

    headers = [h.strip().lower() for h in lines[0].split(",")]
    if "type" not in headers or "value" not in headers:
        raise HTTPException(400, "CSV must have 'type' and 'value' columns")

    type_idx = headers.index("type")
    value_idx = headers.index("value")
    label_idx = headers.index("label") if "label" in headers else None

    records = []
    for line in lines[1:]:
        cols = [c.strip() for c in line.split(",")]
        if len(cols) <= max(type_idx, value_idx):
            continue
        asset_type = cols[type_idx]
        if asset_type not in VALID_ASSET_TYPES:
            continue
        record = {
            "org_id": x_org_id,
            "type": asset_type,
            "value": cols[value_idx],
            "label": cols[label_idx] if label_idx and len(cols) > label_idx else None,
            "status": "active",
            "tags": [],
        }
        records.append(record)

    if not records:
        raise HTTPException(400, "No valid records found in CSV")

    client = get_client()
    result = client.table("assets").insert(records).execute()
    return {"imported": len(result.data)}
