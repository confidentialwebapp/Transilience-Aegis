"""IOC enrichment fan-out.

Single entry point: `enrich(ioc_type, value)`.

Fans out to every enabled provider in parallel, merges their results, and
caches the merged response in Redis (24h TTL by default). Falls back to the
Postgres `enrichment_cache` table when Redis is unavailable.

Adding a new provider:
    1. Create `modules/providers/<name>.py` with an async `query(ioc_type, value, settings)` function.
    2. Append `(<name>, module.query)` to PROVIDERS below.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional

from config import get_settings
from utils.redis_cache import get_cache

logger = logging.getLogger(__name__)

ProviderFn = Callable[[str, str, Any], Awaitable[Optional[dict]]]


def _load_providers() -> list[tuple[str, ProviderFn]]:
    from modules.providers import abuseipdb, ipqs, netlas, dnsdumpster, threatminer

    providers: list[tuple[str, ProviderFn]] = [
        ("abuseipdb", abuseipdb.query),
        ("ipqs", ipqs.query),
        ("netlas", netlas.query),
        ("dnsdumpster", dnsdumpster.query),
        ("threatminer", threatminer.query),
    ]
    return providers


_PROVIDERS: list[tuple[str, ProviderFn]] | None = None


def providers() -> list[tuple[str, ProviderFn]]:
    global _PROVIDERS
    if _PROVIDERS is None:
        _PROVIDERS = _load_providers()
    return _PROVIDERS


def _cache_key(ioc_type: str, value: str) -> str:
    digest = hashlib.sha1(f"{ioc_type}:{value}".encode("utf-8")).hexdigest()
    return f"enrich:v1:{digest}"


def _merge(results: list[dict]) -> dict:
    """Combine provider responses into a single verdict + tag bag."""
    severity_rank = {"unknown": 0, "info": 1, "clean": 1, "suspicious": 2, "malicious": 3}
    final_verdict = "unknown"
    final_severity = 0
    confidences: list[int] = []
    tags: set[str] = set()
    sources: list[str] = []

    for r in results:
        if not r:
            continue
        sources.append(r.get("source", "unknown"))
        v = r.get("verdict", "unknown")
        sev = severity_rank.get(v, 0)
        if sev > final_severity:
            final_severity = sev
            final_verdict = v
        c = r.get("confidence")
        if isinstance(c, (int, float)):
            confidences.append(int(c))
        for t in r.get("tags", []) or []:
            tags.add(str(t))

    avg_conf = int(sum(confidences) / len(confidences)) if confidences else 0
    return {
        "verdict": final_verdict,
        "confidence": avg_conf,
        "tags": sorted(tags),
        "sources": sources,
        "providers": {r["source"]: r for r in results if r and r.get("source")},
    }


async def _persist_cache(ioc_type: str, value: str, response: dict) -> None:
    """Best-effort write of each provider response to Postgres `enrichment_cache`."""
    try:
        from db import get_client

        client = get_client()
        rows = []
        for provider_name, payload in response.get("providers", {}).items():
            rows.append({
                "ioc_type": ioc_type,
                "ioc_value": value,
                "provider": provider_name,
                "response_json": payload,
            })
        if rows:
            client.table("enrichment_cache").upsert(
                rows, on_conflict="provider,ioc_type,ioc_value"
            ).execute()
    except Exception as e:
        logger.warning("enrichment_cache persist failed: %s", e)


async def _bump_quota(provider: str, ok: bool) -> None:
    try:
        from db import get_client

        client = get_client()
        today = datetime.now(timezone.utc).date().isoformat()
        client.rpc("upsert_provider_quota", {
            "p_provider": provider,
            "p_window_start": today,
            "p_increment": 1,
            "p_status": 200 if ok else 0,
        }).execute()
    except Exception:
        pass  # the RPC is optional; quota tracking is best-effort


async def _run_one(name: str, fn: ProviderFn, ioc_type: str, value: str, settings) -> Optional[dict]:
    try:
        result = await fn(ioc_type, value, settings)
        await _bump_quota(name, ok=result is not None)
        return result
    except Exception as e:
        logger.warning("Enrichment provider %s failed for %s/%s: %s", name, ioc_type, value, e)
        await _bump_quota(name, ok=False)
        return None


async def enrich(
    ioc_type: str,
    value: str,
    *,
    use_cache: bool = True,
    only: Optional[list[str]] = None,
) -> dict:
    """Enrich a single IOC across all enabled providers.

    Args:
        ioc_type: ip | domain | url | hash | email | asn | cve
        value: the indicator string
        use_cache: if False, bypass the Redis cache
        only: optional allowlist of provider names

    Returns:
        {
            "ioc_type", "ioc_value",
            "verdict", "confidence", "tags", "sources",
            "providers": {<name>: <provider response>, ...},
            "cached": bool,
            "fetched_at": ISO timestamp,
        }
    """
    settings = get_settings()
    cache = get_cache()
    key = _cache_key(ioc_type, value)

    if use_cache:
        cached = await cache.get_json(key)
        if cached:
            cached["cached"] = True
            return cached

    chosen = [(n, fn) for n, fn in providers() if (only is None or n in only)]
    coros = [_run_one(name, fn, ioc_type, value, settings) for name, fn in chosen]
    raw = await asyncio.gather(*coros, return_exceptions=False)
    results = [r for r in raw if r]

    merged = _merge(results)
    response = {
        "ioc_type": ioc_type,
        "ioc_value": value,
        **merged,
        "cached": False,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    if use_cache:
        await cache.set_json(key, response, ttl=settings.ENRICHMENT_CACHE_TTL)
    asyncio.create_task(_persist_cache(ioc_type, value, response))
    return response


async def invalidate(ioc_type: str, value: str) -> bool:
    """Drop the cached response so the next call re-runs all providers."""
    cache = get_cache()
    return await cache.delete(_cache_key(ioc_type, value))
