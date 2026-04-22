"""Async wrapper over Upstash Redis REST API.

Upstash REST takes Redis commands as JSON arrays POSTed to its base URL.
We use that form (not the GET-style /get/<key> URLs) because it round-trips
binary and unusual characters cleanly.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import httpx

from config import get_settings

logger = logging.getLogger(__name__)

_client: Optional["RedisCache"] = None


class RedisCache:
    def __init__(self, url: str, token: str, default_ttl: int = 86400):
        self.url = url.rstrip("/")
        self.token = token
        self.default_ttl = default_ttl
        self.headers = {"Authorization": f"Bearer {token}"}
        self.enabled = bool(url and token)

    async def _exec(self, *cmd: Any) -> Any:
        if not self.enabled:
            return None
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(self.url, headers=self.headers, json=list(cmd))
                if resp.status_code != 200:
                    logger.warning("Upstash %s -> %s: %s", cmd[0], resp.status_code, resp.text[:200])
                    return None
                return resp.json().get("result")
        except Exception as e:
            logger.warning("Upstash %s failed: %s", cmd[0], e)
            return None

    async def get(self, key: str) -> Optional[str]:
        return await self._exec("GET", key)

    async def set(self, key: str, value: str, ttl: Optional[int] = None) -> bool:
        ttl = ttl if ttl is not None else self.default_ttl
        result = await self._exec("SET", key, value, "EX", ttl)
        return result == "OK"

    async def delete(self, key: str) -> bool:
        result = await self._exec("DEL", key)
        return bool(result)

    async def get_json(self, key: str) -> Optional[Any]:
        raw = await self.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (TypeError, ValueError):
            return None

    async def set_json(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        return await self.set(key, json.dumps(value, default=str), ttl=ttl)

    async def incr(self, key: str, ttl: Optional[int] = None) -> Optional[int]:
        result = await self._exec("INCR", key)
        if ttl is not None and result == 1:
            await self._exec("EXPIRE", key, ttl)
        try:
            return int(result) if result is not None else None
        except (TypeError, ValueError):
            return None

    async def ping(self) -> bool:
        return (await self._exec("PING")) == "PONG"


def get_cache() -> RedisCache:
    global _client
    if _client is None:
        settings = get_settings()
        _client = RedisCache(
            url=settings.UPSTASH_REDIS_REST_URL,
            token=settings.UPSTASH_REDIS_REST_TOKEN,
            default_ttl=settings.ENRICHMENT_CACHE_TTL,
        )
    return _client
