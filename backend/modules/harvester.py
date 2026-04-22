"""theHarvester wrapper — calls Modal `aegis-scanners.run_theharvester` so we
don't need the Kali toolchain on the Render container.

Falls back to local subprocess if the binary is on PATH AND Modal isn't
configured (useful for dev on a Kali laptop).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_SOURCES = "crtsh,duckduckgo,bing,otx,hackertarget,rapiddns,anubis,urlscan"


def _normalize(raw: dict) -> dict:
    """theHarvester JSON keys vary by version; collapse to a stable shape."""
    def _list(*keys: str) -> list[str]:
        for k in keys:
            if k in raw and isinstance(raw[k], list):
                return [x for x in raw[k] if x]
        return []

    return {
        "emails": _list("emails"),
        "hosts": _list("hosts"),
        "ips": _list("ips"),
        "asns": _list("asns"),
        "urls": _list("urls", "interesting_urls"),
        "linkedin": _list("linkedin", "linkedin_links"),
        "twitter": _list("twitter"),
        "vulnerabilities": _list("vulns", "vulnerabilities"),
        "trello": _list("trello_urls"),
    }


async def _run_local(domain: str, sources: str, limit: int, timeout: int, binary: str) -> tuple[dict, Optional[str], str]:
    """Local subprocess execution. Returns (raw_json, error, status)."""
    binary_path = shutil.which(binary) or binary
    workdir = tempfile.mkdtemp(prefix="harvester-")
    out_base = os.path.join(workdir, f"th-{uuid.uuid4().hex[:8]}")
    json_path = f"{out_base}.json"
    raw: dict = {}
    error: Optional[str] = None
    status = "failed"
    try:
        proc = await asyncio.create_subprocess_exec(
            binary_path, "-d", domain, "-b", sources, "-l", str(limit), "-f", out_base,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill(); await proc.wait()
            return raw, f"timeout after {timeout}s", "failed"
        if os.path.isfile(json_path):
            try:
                with open(json_path) as f:
                    raw = json.load(f)
                status = "success" if proc.returncode == 0 else "partial"
            except Exception as e:
                error = f"json parse failed: {e}"
        else:
            error = (stderr.decode("utf-8", errors="ignore")[:500]) or "no JSON output"
    except FileNotFoundError:
        error = f"theHarvester binary not found at {binary_path}"
    except Exception as e:
        error = f"subprocess failed: {e}"
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    return raw, error, status


async def run(
    domain: str,
    *,
    sources: str = DEFAULT_SOURCES,
    limit: int = 200,
    timeout: int = 120,
    org_id: Optional[str] = None,
    binary: str = "theHarvester",
) -> dict:
    """Execute theHarvester (Modal preferred, local subprocess fallback) and
    persist to `recon_runs`. Returns a normalized response dict.
    """
    started = datetime.now(timezone.utc)

    # Prefer Modal — works on Render where there's no Kali toolchain
    raw: dict = {}
    error: Optional[str] = None
    status = "failed"
    used = "unknown"

    try:
        from modules import modal_recon
        modal_result = await modal_recon.theharvester(domain=domain, sources=sources, limit=limit)
        if modal_result.get("ok"):
            r = modal_result.get("results", {}) or {}
            # Modal already returns the same normalized shape; keep raw too
            raw = {
                "emails": r.get("emails", []),
                "hosts": r.get("hosts", []),
                "ips": r.get("ips", []),
                "asns": r.get("asns", []),
                "urls": r.get("urls", []),
                "linkedin": r.get("linkedin", []),
            }
            status = "success"
            used = "modal"
        else:
            err_msg = modal_result.get("error") or "modal call failed"
            # Fall back to local subprocess if Modal isn't configured
            if "MODAL_TOKEN" in err_msg or "not configured" in err_msg:
                raw, error, status = await _run_local(domain, sources, limit, timeout, binary)
                used = "local"
            else:
                error = f"modal: {err_msg}"
                used = "modal"
    except Exception as e:
        logger.warning("Modal harvester call failed, falling back to local: %s", e)
        raw, error, status = await _run_local(domain, sources, limit, timeout, binary)
        used = "local"

    normalized = _normalize(raw) if raw else {
        "emails": [], "hosts": [], "ips": [], "asns": [],
        "urls": [], "linkedin": [], "twitter": [], "vulnerabilities": [], "trello": [],
    }

    completed = datetime.now(timezone.utc)
    response = {
        "domain": domain,
        "tool": "theHarvester",
        "executor": used,
        "status": status,
        "sources": sources.split(","),
        "started_at": started.isoformat(),
        "completed_at": completed.isoformat(),
        "duration_seconds": (completed - started).total_seconds(),
        "error": error,
        "results": normalized,
        "counts": {k: len(v) for k, v in normalized.items()},
    }

    # Persist to recon_runs (best-effort)
    try:
        from db import get_client

        client = get_client()
        client.table("recon_runs").insert({
            "org_id": org_id,
            "domain": domain,
            "tool": "theHarvester",
            "status": status,
            "emails": normalized["emails"][:1000],
            "hosts": normalized["hosts"][:1000],
            "ips": normalized["ips"][:1000],
            "asns": normalized["asns"][:1000],
            "urls": normalized["urls"][:1000],
            "raw": {**raw, "_executor": used},
            "started_at": started.isoformat(),
            "completed_at": completed.isoformat(),
            "error": error,
        }).execute()
    except Exception as e:
        logger.warning("recon_runs insert failed: %s", e)

    return response
