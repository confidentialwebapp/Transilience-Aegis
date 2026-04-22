"""Thin async wrapper that calls the Modal `aegis-scanners` app.

Each function looks up the deployed Modal function by name and invokes it
remotely. Failures are caught and returned as `{"ok": False, "error": ...}`
so callers (routers) don't crash on Modal/network issues.

Modal authentication:
  Reads MODAL_TOKEN_ID / MODAL_TOKEN_SECRET from environment (or ~/.modal.toml
  locally). The Render service has these set as env vars; deployment via
  GitHub Actions also uses them.

If MODAL_TOKEN_ID is missing, every call returns a clear "modal not
configured" error rather than crashing.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

APP_NAME = "aegis-scanners"


def _is_configured() -> bool:
    from config import get_settings
    s = get_settings()
    return bool(s.MODAL_TOKEN_ID and s.MODAL_TOKEN_SECRET)


@lru_cache(maxsize=32)
def _lookup(fn_name: str):
    """Cache Modal Function objects so we don't re-resolve each call."""
    import os
    from config import get_settings
    s = get_settings()
    # Modal SDK reads these env names directly when looking up
    if s.MODAL_TOKEN_ID:
        os.environ.setdefault("MODAL_TOKEN_ID", s.MODAL_TOKEN_ID)
    if s.MODAL_TOKEN_SECRET:
        os.environ.setdefault("MODAL_TOKEN_SECRET", s.MODAL_TOKEN_SECRET)
    import modal
    return modal.Function.lookup(APP_NAME, fn_name)


async def _call(fn_name: str, **kwargs: Any) -> dict:
    """Invoke a Modal function asynchronously, returning a normalized dict."""
    if not _is_configured():
        return {
            "ok": False,
            "error": "MODAL_TOKEN_ID / MODAL_TOKEN_SECRET not configured on backend",
            "tool": fn_name.removeprefix("run_").removeprefix("attack_"),
        }
    try:
        fn = _lookup(fn_name)
        return await fn.remote.aio(**kwargs)
    except Exception as e:
        logger.warning("Modal %s failed: %s", fn_name, e)
        return {"ok": False, "error": f"{type(e).__name__}: {e}", "tool": fn_name}


# ---------------------------------------------------------------------------
# Public surface — one function per Modal function. Same names + kwargs.
# ---------------------------------------------------------------------------
async def subfinder(domain: str) -> dict:
    return await _call("run_subfinder", domain=domain)


async def httpx_probe(targets: list[str]) -> dict:
    return await _call("run_httpx", targets=targets)


async def dnsx(targets: list[str]) -> dict:
    return await _call("run_dnsx", targets=targets)


async def dnstwist(domain: str, registered_only: bool = True) -> dict:
    return await _call("run_dnstwist", domain=domain, registered_only=registered_only)


async def maigret(username: str, top_sites: int = 100) -> dict:
    """Username OSINT — currently disabled. maigret's pycairo dep can't compile
    against Modal's bundled Python install. Will be re-added with sherlock."""
    return {
        "tool": "maigret",
        "ok": False,
        "error": "username search temporarily unavailable — maigret/pycairo build issue on Modal",
        "username": username,
        "found": [],
        "count": 0,
    }


async def theharvester(
    domain: str,
    sources: str = "crtsh,duckduckgo,bing,otx,hackertarget,rapiddns,anubis,urlscan",
    limit: int = 200,
) -> dict:
    return await _call("run_theharvester", domain=domain, sources=sources, limit=limit)


async def nmap(target: str, args: str = "-sV -F -T4") -> dict:
    return await _call("run_nmap", target=target, args=args)


async def nuclei(target: str, severity: str = "critical,high,medium") -> dict:
    return await _call("run_nuclei", target=target, severity=severity)


async def attack_surface(domain: str) -> dict:
    return await _call("attack_surface", domain=domain)
