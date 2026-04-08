import logging
from datetime import datetime
from typing import Optional, List

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
    tags: List[str] = []


class AssetUpdate(BaseModel):
    label: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None


@router.post("/")
async def create_asset(body: AssetCreate, x_org_id: str = Header(...)):
    if body.type not in VALID_ASSET_TYPES:
        raise HTTPException(400, f"Invalid asset type. Must be one of: {VALID_ASSET_TYPES}")

    try:
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
        if result.data:
            return result.data[0]
        return {}
    except Exception as e:
        logger.error("Failed to create asset: %s", e)
        raise HTTPException(500, f"Failed to create asset: {str(e)}")


@router.get("/")
async def list_assets(
    x_org_id: str = Header(...),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
):
    try:
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
            "data": result.data if result.data else [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        logger.error("Failed to list assets: %s", e)
        raise HTTPException(500, f"Failed to list assets: {str(e)}")


@router.get("/{asset_id}")
async def get_asset(asset_id: str, x_org_id: str = Header(...)):
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get asset %s: %s", asset_id, e)
        raise HTTPException(500, f"Failed to get asset: {str(e)}")


@router.patch("/{asset_id}")
async def update_asset(asset_id: str, body: AssetUpdate, x_org_id: str = Header(...)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    if "status" in updates and updates["status"] not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Must be one of: {VALID_STATUSES}")

    try:
        client = get_client()
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update asset %s: %s", asset_id, e)
        raise HTTPException(500, f"Failed to update asset: {str(e)}")


@router.delete("/{asset_id}")
async def delete_asset(asset_id: str, x_org_id: str = Header(...)):
    try:
        client = get_client()
        result = (
            client.table("assets")
            .delete()
            .eq("id", asset_id)
            .eq("org_id", x_org_id)
            .execute()
        )
        return {"deleted": True}
    except Exception as e:
        logger.error("Failed to delete asset %s: %s", asset_id, e)
        raise HTTPException(500, f"Failed to delete asset: {str(e)}")


@router.post("/bulk")
async def bulk_import(file: UploadFile = File(...), x_org_id: str = Header(...)):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are accepted")

    try:
        content = await file.read()
        text = content.decode("utf-8")
    except Exception as e:
        raise HTTPException(400, f"Failed to read CSV file: {str(e)}")

    lines = text.strip().split("\n")

    if len(lines) < 2:
        raise HTTPException(400, "CSV must have a header row and at least one data row")

    headers = [h.strip().lower() for h in lines[0].split(",")]
    if "type" not in headers or "value" not in headers:
        raise HTTPException(400, "CSV must have 'type' and 'value' columns")

    type_idx = headers.index("type")
    value_idx = headers.index("value")
    label_idx = headers.index("label") if "label" in headers else None

    records = []
    errors = []
    for line_num, line in enumerate(lines[1:], start=2):
        if not line.strip():
            continue
        cols = [c.strip() for c in line.split(",")]
        if len(cols) <= max(type_idx, value_idx):
            errors.append(f"Line {line_num}: not enough columns")
            continue
        asset_type = cols[type_idx]
        if asset_type not in VALID_ASSET_TYPES:
            errors.append(f"Line {line_num}: invalid asset type '{asset_type}'")
            continue
        record = {
            "org_id": x_org_id,
            "type": asset_type,
            "value": cols[value_idx],
            "label": cols[label_idx] if label_idx is not None and len(cols) > label_idx else None,
            "status": "active",
            "tags": [],
        }
        records.append(record)

    if not records:
        raise HTTPException(400, "No valid records found in CSV")

    try:
        client = get_client()
        result = client.table("assets").insert(records).execute()
        imported_count = len(result.data) if result.data else 0
        response = {"imported": imported_count}
        if errors:
            response["warnings"] = errors
        return response
    except Exception as e:
        logger.error("Failed to bulk import assets: %s", e)
        raise HTTPException(500, f"Failed to import assets: {str(e)}")
