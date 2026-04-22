"""Status proxy — wraps Telegram (and any other token-gated probe) so the
public status page can show health WITHOUT putting the bot token in client code.

Lesson learned: a UI agent hardcoded the bot token into a client React file
because the spec said 'probe Telegram'. The token then shipped on the public
repo. Going forward, any probe that needs an API key MUST go through a
backend route like this.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/telegram")
async def telegram_status() -> dict[str, Any]:
    """Hit Telegram's getMe with the server-side token. Returns ok/latency only —
    no token, no full bot details leak to the client."""
    from config import get_settings

    s = get_settings()
    if not s.TELEGRAM_BOT_TOKEN:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN not configured"}

    url = f"https://api.telegram.org/bot{s.TELEGRAM_BOT_TOKEN}/getMe"
    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
        latency_ms = int((time.monotonic() - t0) * 1000)
        if resp.status_code == 200 and resp.json().get("ok"):
            return {"ok": True, "latency_ms": latency_ms}
        return {"ok": False, "error": f"HTTP {resp.status_code}", "latency_ms": latency_ms}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
