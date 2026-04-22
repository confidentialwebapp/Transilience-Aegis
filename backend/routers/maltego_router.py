"""Maltego TRX HTTP endpoints.

Exposes one POST per transform under /api/v1/maltego/transforms/<name>.
Maltego desktop sends MaltegoTransformRequestMessage XML and expects
MaltegoTransformResponseMessage XML back.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException, Request, Response

from config import get_settings
from maltego.transforms import TRANSFORMS
from maltego.trx import build_error, build_response, parse_request

logger = logging.getLogger(__name__)
router = APIRouter()


def _check_auth(token_header: str | None) -> None:
    settings = get_settings()
    if not settings.MALTEGO_TRX_AUTH_TOKEN:
        return  # disabled
    if token_header != settings.MALTEGO_TRX_AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="invalid X-AEGIS-TRX-Token")


@router.get("/transforms")
async def list_transforms():
    """Human-friendly list of available transforms."""
    return {
        "transforms": [
            {
                "name": name,
                "input_entities": cfg["input"],
                "endpoint": f"/api/v1/maltego/transforms/{name}",
            }
            for name, cfg in TRANSFORMS.items()
        ]
    }


@router.post("/transforms/{name}")
async def run_transform(
    name: str,
    request: Request,
    x_aegis_trx_token: str | None = Header(None),
):
    _check_auth(x_aegis_trx_token)

    cfg = TRANSFORMS.get(name)
    if not cfg:
        raise HTTPException(404, f"unknown transform: {name}")

    try:
        body = await request.body()
        req = parse_request(body)
    except Exception as e:
        return Response(content=build_error(f"bad request: {e}"), media_type="text/xml", status_code=400)

    if cfg["input"] and req.entity_type not in cfg["input"]:
        return Response(
            content=build_error(f"transform {name} expects one of {cfg['input']}, got {req.entity_type}"),
            media_type="text/xml",
            status_code=400,
        )

    try:
        entities = await cfg["fn"](req)
    except Exception as e:
        logger.exception("transform %s failed", name)
        return Response(content=build_error(str(e)), media_type="text/xml", status_code=500)

    body_xml = build_response(entities, message=f"AEGIS returned {len(entities)} entities")
    return Response(content=body_xml, media_type="text/xml")
