"""Shared async HTTP client with retry + concurrency limit."""
from __future__ import annotations

import asyncio
from typing import Any

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from config.settings import RUNTIME

from .logging_setup import get_logger

log = get_logger(__name__)


class AsyncHTTP:
    """Singleton-ish wrapper around httpx.AsyncClient."""

    _client: httpx.AsyncClient | None = None
    _sem: asyncio.Semaphore | None = None

    @classmethod
    def client(cls) -> httpx.AsyncClient:
        if cls._client is None:
            cls._client = httpx.AsyncClient(
                timeout=httpx.Timeout(RUNTIME.http_timeout),
                follow_redirects=True,
                http2=True,
                headers={"User-Agent": "BrandMonitoring/1.0 (+enterprise-osint)"},
                limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
            )
        return cls._client

    @classmethod
    def sem(cls) -> asyncio.Semaphore:
        if cls._sem is None:
            cls._sem = asyncio.Semaphore(RUNTIME.http_concurrency)
        return cls._sem

    @classmethod
    async def close(cls) -> None:
        if cls._client is not None:
            await cls._client.aclose()
            cls._client = None


async def request_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    params: dict[str, Any] | None = None,
    json: dict[str, Any] | None = None,
    data: Any = None,
    retries: int = 3,
    timeout: float | None = None,
    expect_status: tuple[int, ...] = (200, 201, 202, 204),
) -> dict[str, Any] | list[Any] | None:
    """JSON request with exponential backoff. Returns parsed body or None on terminal failure."""
    sem = AsyncHTTP.sem()
    client = AsyncHTTP.client()
    async with sem:
        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(retries),
                wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
                retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError, httpx.ReadTimeout)),
                reraise=True,
            ):
                with attempt:
                    r = await client.request(
                        method, url,
                        headers=headers, params=params, json=json, data=data,
                        timeout=timeout or RUNTIME.http_timeout,
                    )
                    if r.status_code in expect_status:
                        if not r.content:
                            return None
                        try:
                            return r.json()
                        except Exception:
                            return {"_raw_text": r.text}
                    if r.status_code in (429, 502, 503, 504):
                        r.raise_for_status()
                    # Client error — don't retry
                    log.debug(f"{method} {url} -> {r.status_code}: {r.text[:300]}")
                    return None
        except Exception as e:
            log.warning(f"HTTP {method} {url} failed: {e}")
            return None


async def get_text(url: str, headers: dict[str, str] | None = None, timeout: float = 15) -> str | None:
    sem = AsyncHTTP.sem()
    async with sem:
        try:
            r = await AsyncHTTP.client().get(url, headers=headers, timeout=timeout)
            if r.status_code == 200:
                return r.text
        except Exception as e:
            log.debug(f"GET {url} failed: {e}")
    return None


async def get_bytes(url: str, headers: dict[str, str] | None = None, timeout: float = 30) -> bytes | None:
    sem = AsyncHTTP.sem()
    async with sem:
        try:
            r = await AsyncHTTP.client().get(url, headers=headers, timeout=timeout)
            if r.status_code == 200:
                return r.content
        except Exception as e:
            log.debug(f"GET-bytes {url} failed: {e}")
    return None
