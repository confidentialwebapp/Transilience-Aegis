"""Advisories CRUD + preview/export endpoints."""

from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Header, Query
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()


class AdvisoryIn(BaseModel):
    kind: str = "threat"  # threat | breach | product
    title: str
    summary: Optional[str] = None
    body_markdown: Optional[str] = None
    iocs: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    ref_links: list[str] = Field(default_factory=list)
    severity: str = "medium"
    tlp: str = "WHITE"
    status: str = "draft"


@router.get("/")
async def list_advisories(
    x_org_id: str = Header(...),
    kind: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    from db import get_client

    try:
        client = get_client()
        offset = (page - 1) * per_page
        q = (
            client.table("advisories")
            .select("id,kind,status,tlp,severity,title,summary,tags,published_at,created_at,generated_by_skill", count="exact")
            .eq("org_id", x_org_id)
            .order("created_at", desc=True)
            .range(offset, offset + per_page - 1)
        )
        if kind:
            q = q.eq("kind", kind)
        if status:
            q = q.eq("status", status)
        result = q.execute()
        return {
            "data": result.data or [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        logger.error("list_advisories failed: %s", e)
        raise HTTPException(500, str(e))


@router.get("/{advisory_id}")
async def get_advisory(advisory_id: str, x_org_id: str = Header(...)):
    from db import get_client

    try:
        result = (
            get_client().table("advisories").select("*")
            .eq("id", advisory_id).eq("org_id", x_org_id).execute()
        )
        if not result.data:
            raise HTTPException(404, "advisory not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/")
async def create_advisory(body: AdvisoryIn, x_org_id: str = Header(...)):
    from db import get_client
    from utils import audit

    try:
        result = get_client().table("advisories").insert({
            "org_id": x_org_id,
            **body.model_dump(),
        }).execute()
        row = result.data[0] if result.data else {}
        audit.record(x_org_id, "advisory.created",
                     entity_type="advisory", entity_id=row.get("id"),
                     details={"kind": body.kind, "title": body.title})
        return row
    except Exception as e:
        logger.error("create_advisory failed: %s", e)
        raise HTTPException(500, str(e))


@router.patch("/{advisory_id}")
async def update_advisory(advisory_id: str, body: dict = Body(...), x_org_id: str = Header(...)):
    from db import get_client
    from utils import audit

    allowed = {"kind", "title", "summary", "body_markdown", "iocs", "tags",
               "ref_links", "severity", "tlp", "status"}
    payload = {k: v for k, v in body.items() if k in allowed}
    if not payload:
        raise HTTPException(400, "no editable fields")
    payload["updated_at"] = "now()"
    if payload.get("status") == "published":
        payload["published_at"] = "now()"
    try:
        result = (
            get_client().table("advisories").update(payload)
            .eq("id", advisory_id).eq("org_id", x_org_id).execute()
        )
        audit.record(x_org_id, "advisory.updated",
                     entity_type="advisory", entity_id=advisory_id,
                     details={"changed_fields": list(payload.keys())})
        return result.data[0] if result.data else {}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.delete("/{advisory_id}")
async def delete_advisory(advisory_id: str, x_org_id: str = Header(...)):
    from db import get_client
    from utils import audit

    try:
        get_client().table("advisories").delete().eq("id", advisory_id).eq("org_id", x_org_id).execute()
        audit.record(x_org_id, "advisory.deleted", entity_type="advisory", entity_id=advisory_id)
        return {"deleted": advisory_id}
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------------------------------------------------------------------------
# Exports / preview
# ---------------------------------------------------------------------------
@router.get("/{advisory_id}/preview", response_class=HTMLResponse)
async def preview_html(advisory_id: str, x_org_id: str = Header(...)):
    """Render a styled HTML preview — works as both UI preview AND a downloadable file."""
    from db import get_client
    from modules.advisory_export import to_html

    a = get_client().table("advisories").select("*").eq("id", advisory_id).eq("org_id", x_org_id).execute()
    if not a.data:
        raise HTTPException(404, "advisory not found")
    return HTMLResponse(content=to_html(a.data[0]))


@router.get("/{advisory_id}/stix")
async def export_stix(advisory_id: str, x_org_id: str = Header(...)):
    """Return a STIX 2.1 Bundle JSON — direct ingest by MISP/OpenCTI/etc."""
    from db import get_client
    from modules.advisory_export import to_stix_bundle

    a = get_client().table("advisories").select("*").eq("id", advisory_id).eq("org_id", x_org_id).execute()
    if not a.data:
        raise HTTPException(404, "advisory not found")
    bundle = to_stix_bundle(a.data[0])
    body = json.dumps(bundle, indent=2).encode("utf-8")
    return Response(
        content=body,
        media_type="application/stix+json",
        headers={"Content-Disposition": f'attachment; filename="advisory-{advisory_id}.stix.json"'},
    )


@router.get("/{advisory_id}/html")
async def download_html(advisory_id: str, x_org_id: str = Header(...)):
    """Same as /preview but with a Content-Disposition header for download."""
    from db import get_client
    from modules.advisory_export import to_html

    a = get_client().table("advisories").select("*").eq("id", advisory_id).eq("org_id", x_org_id).execute()
    if not a.data:
        raise HTTPException(404, "advisory not found")
    return Response(
        content=to_html(a.data[0]),
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="advisory-{advisory_id}.html"'},
    )


# ---------------------------------------------------------------------------
# AI generation — call the draft-advisory skill, persist as draft
# ---------------------------------------------------------------------------
@router.post("/generate")
async def generate_with_ai(body: dict = Body(...), x_org_id: str = Header(...)):
    """Use the draft-advisory skill to produce a markdown advisory + persist as draft.
    Body: {kind, topic, facts: [...], iocs: {...}}"""
    from skills.registry import get as get_skill

    skill = get_skill("draft-advisory")
    if not skill:
        raise HTTPException(500, "draft-advisory skill not registered")

    result = await skill.invoke(params=body, org_id=x_org_id)
    if result.error:
        raise HTTPException(502, f"AI draft failed: {result.error}")

    drafted = result.result or {}
    if not isinstance(drafted, dict):
        raise HTTPException(502, "AI returned unexpected format")

    # Persist as draft so the user can review + edit
    from db import get_client
    from utils import audit

    insert_payload = {
        "org_id": x_org_id,
        "kind": body.get("kind", "threat"),
        "status": "draft",
        "title": drafted.get("title") or body.get("topic", "Untitled advisory"),
        "summary": drafted.get("summary") or "",
        "body_markdown": drafted.get("body_markdown") or "",
        "tags": drafted.get("tags") or [],
        "severity": drafted.get("severity") or "medium",
        "tlp": drafted.get("tlp") or "WHITE",
        "iocs": body.get("iocs", {}),
        "generated_by_skill": "draft-advisory",
    }
    try:
        row = get_client().table("advisories").insert(insert_payload).execute()
        created = row.data[0] if row.data else {}
        audit.record(x_org_id, "advisory.ai_drafted",
                     entity_type="advisory", entity_id=created.get("id"),
                     details={"model": result.model, "cost_usd": result.cost_usd})
        return {
            "advisory": created,
            "ai": {
                "model": result.model,
                "cost_usd": result.cost_usd,
                "duration_ms": result.duration_ms,
            },
        }
    except Exception as e:
        raise HTTPException(500, str(e))
