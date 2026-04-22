"""AI skills HTTP API."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Header, Query

from skills.registry import get as get_skill, list_all

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def list_skills(x_org_id: str = Header(...)):
    """Catalog of all registered skills, for the UI to render 'Ask AI' menus."""
    return {
        "data": [
            {
                "name": s.name,
                "description": s.description,
                "category": s.category,
                "default_model": s.default_model,
            }
            for s in list_all()
        ]
    }


@router.post("/invoke")
async def invoke_skill(
    body: dict = Body(...),
    x_org_id: str = Header(...),
):
    """Run a skill. Body: {skill: 'triage-alert', params: {...}, model: optional, bypass_cache: optional}"""
    skill_name = body.get("skill")
    if not skill_name:
        raise HTTPException(400, "skill required")
    skill = get_skill(skill_name)
    if not skill:
        raise HTTPException(404, f"unknown skill: {skill_name}")

    result = await skill.invoke(
        params=body.get("params", {}),
        org_id=x_org_id,
        model=body.get("model"),
        bypass_cache=bool(body.get("bypass_cache", False)),
    )

    if result.error:
        # Don't 500 — return a 200 with the error in body so the UI can render it
        return {
            "ok": False,
            "skill": result.skill,
            "error": result.error,
            "model": result.model,
        }
    return {
        "ok": True,
        "skill": result.skill,
        "model": result.model,
        "result": result.result,
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens,
        "cost_usd": result.cost_usd,
        "duration_ms": result.duration_ms,
        "cached": result.cached,
    }


@router.get("/usage")
async def usage_stats(x_org_id: str = Header(...), days: int = Query(7, ge=1, le=90)):
    """Aggregate spend + invocation count over the window — for the AI Cost dashboard widget."""
    from datetime import datetime, timedelta, timezone

    from db import get_client

    try:
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        result = (
            get_client().table("skill_invocations")
            .select("skill,model,cost_usd,input_tokens,output_tokens,cached")
            .eq("org_id", x_org_id).gte("created_at", since)
            .limit(5000).execute()
        )
        rows = result.data or []
        total_cost = sum(r.get("cost_usd") or 0 for r in rows)
        total_in = sum(r.get("input_tokens") or 0 for r in rows)
        total_out = sum(r.get("output_tokens") or 0 for r in rows)
        cache_hits = sum(1 for r in rows if r.get("cached"))
        per_skill: dict[str, dict] = {}
        for r in rows:
            k = r.get("skill", "?")
            d = per_skill.setdefault(k, {"invocations": 0, "cost_usd": 0.0})
            d["invocations"] += 1
            d["cost_usd"] += r.get("cost_usd") or 0
        return {
            "window_days": days,
            "invocations": len(rows),
            "cache_hits": cache_hits,
            "total_cost_usd": round(total_cost, 4),
            "total_input_tokens": total_in,
            "total_output_tokens": total_out,
            "per_skill": [{"skill": k, **v, "cost_usd": round(v["cost_usd"], 4)} for k, v in per_skill.items()],
        }
    except Exception as e:
        logger.error("skills usage failed: %s", e)
        raise HTTPException(500, str(e))
