import asyncio
import time
from collections import defaultdict
from typing import Dict


class RateLimiter:
    def __init__(self):
        self._last_request: Dict[str, float] = defaultdict(float)
        self._lock = asyncio.Lock()

    async def wait(self, source: str, min_interval: float = 1.0):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_request[source]
            if elapsed < min_interval:
                await asyncio.sleep(min_interval - elapsed)
            self._last_request[source] = time.monotonic()
