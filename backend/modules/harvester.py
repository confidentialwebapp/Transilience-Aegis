"""theHarvester subprocess wrapper.

Runs theHarvester out-of-process, captures the JSON output it writes
when given `-f <basename>`, normalizes the result, and persists it to
the `recon_runs` table.
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


async def run(
    domain: str,
    *,
    sources: str = DEFAULT_SOURCES,
    limit: int = 200,
    timeout: int = 120,
    org_id: Optional[str] = None,
    binary: str = "theHarvester",
) -> dict:
    """Execute theHarvester and return a normalized result dict.

    The result is also written to `recon_runs` (best-effort).
    """
    started = datetime.now(timezone.utc)
    binary_path = shutil.which(binary) or binary
    workdir = tempfile.mkdtemp(prefix="harvester-")
    out_base = os.path.join(workdir, f"th-{uuid.uuid4().hex[:8]}")
    json_path = f"{out_base}.json"

    cmd = [
        binary_path,
        "-d", domain,
        "-b", sources,
        "-l", str(limit),
        "-f", out_base,
    ]

    proc = None
    error: Optional[str] = None
    raw: dict = {}
    status = "failed"

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            error = f"timeout after {timeout}s"
            status = "failed"
        else:
            if os.path.isfile(json_path):
                try:
                    with open(json_path, "r", encoding="utf-8") as f:
                        raw = json.load(f)
                    status = "success" if proc.returncode == 0 else "partial"
                except Exception as e:
                    error = f"json parse failed: {e}"
                    status = "failed"
            else:
                error = (stderr.decode("utf-8", errors="ignore")[:500]) or "no JSON output"
                status = "failed"
    except FileNotFoundError:
        error = f"theHarvester binary not found at {binary_path}"
    except Exception as e:
        error = f"subprocess failed: {e}"
    finally:
        try:
            shutil.rmtree(workdir, ignore_errors=True)
        except Exception:
            pass

    normalized = _normalize(raw) if raw else {
        "emails": [], "hosts": [], "ips": [], "asns": [],
        "urls": [], "linkedin": [], "twitter": [], "vulnerabilities": [], "trello": [],
    }

    completed = datetime.now(timezone.utc)
    response = {
        "domain": domain,
        "tool": "theHarvester",
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
            "raw": raw,
            "started_at": started.isoformat(),
            "completed_at": completed.isoformat(),
            "error": error,
        }).execute()
    except Exception as e:
        logger.warning("recon_runs insert failed: %s", e)

    return response
