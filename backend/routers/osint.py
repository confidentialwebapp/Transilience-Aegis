"""OSINT endpoints — username discovery, email recon."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/username")
async def username_search(
    username: str = Query(..., min_length=2, max_length=64),
    top_sites: int = Query(100, ge=10, le=500, description="How many sites to query"),
    x_org_id: str = Header(...),
):
    """Search for `username` across the top N most-popular sites via maigret.

    `top_sites=100` keeps runtime ~60s. 500 is the full set (~3-4 min).
    Returns: {tool, ok, found: [{site, url, tags}], count}
    """
    from modules import modal_recon
    return await modal_recon.maigret(username, top_sites=top_sites)
