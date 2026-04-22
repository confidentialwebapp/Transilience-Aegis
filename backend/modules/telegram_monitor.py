"""Telegram bot monitor for @aegisdarkwebbot.

Long-poll loop that:
  * Tracks chats the bot is added to in `telegram_channels`.
  * Stores every incoming message in `telegram_messages`.
  * Extracts IOCs (IP, domain, hash, URL, BTC/ETH/TON wallets) from text and saves them on the row.
  * Responds to slash commands (`/start`, `/lookup <type> <value>`, `/stats`).

Note on visibility: a Bot API account can only read messages in chats it has been
added to (and where Privacy Mode is off / it's been promoted to admin). This is
fine for owned channels and analyst-curated groups; it does NOT crawl arbitrary
public cybercrime channels. That requires MTProto (Telethon/TDLib).
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

API_BASE = "https://api.telegram.org/bot{token}"

IOC_PATTERNS = {
    "ipv4": re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b"),
    "domain": re.compile(r"\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b", re.IGNORECASE),
    "url": re.compile(r"\bhttps?://[^\s'\"<>]+", re.IGNORECASE),
    "md5": re.compile(r"\b[a-f0-9]{32}\b", re.IGNORECASE),
    "sha1": re.compile(r"\b[a-f0-9]{40}\b", re.IGNORECASE),
    "sha256": re.compile(r"\b[a-f0-9]{64}\b", re.IGNORECASE),
    "btc": re.compile(r"\b(?:bc1[a-z0-9]{25,90}|[13][a-zA-HJ-NP-Z0-9]{25,34})\b"),
    "eth": re.compile(r"\b0x[a-fA-F0-9]{40}\b"),
    "cve": re.compile(r"\bCVE-\d{4}-\d{4,7}\b", re.IGNORECASE),
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
}

_running = False


def _extract_iocs(text: str) -> dict[str, list[str]]:
    if not text:
        return {}
    out: dict[str, list[str]] = {}
    for kind, pattern in IOC_PATTERNS.items():
        matches = list({m.group(0) for m in pattern.finditer(text)})
        if matches:
            out[kind] = matches[:50]
    return out


async def _api(token: str, method: str, **params: Any) -> Optional[dict]:
    url = API_BASE.format(token=token) + f"/{method}"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=params)
            if resp.status_code != 200:
                logger.warning("Telegram %s -> HTTP %s: %s", method, resp.status_code, resp.text[:200])
                return None
            data = resp.json()
            if not data.get("ok"):
                logger.warning("Telegram %s error: %s", method, data.get("description"))
                return None
            return data.get("result")
    except Exception as e:
        logger.warning("Telegram %s request failed: %s", method, e)
        return None


def _client_db():
    from db import get_client
    return get_client()


def _get_poll_state() -> int:
    try:
        client = _client_db()
        result = client.table("telegram_poll_state").select("last_update_id").eq("id", 1).execute()
        if result.data:
            return int(result.data[0].get("last_update_id") or 0)
    except Exception as e:
        logger.warning("telegram_poll_state read failed: %s", e)
    return 0


def _set_poll_state(last_update_id: int, error: Optional[str] = None) -> None:
    try:
        client = _client_db()
        client.table("telegram_poll_state").update({
            "last_update_id": last_update_id,
            "last_polled_at": datetime.now(timezone.utc).isoformat(),
            "last_error": error,
        }).eq("id", 1).execute()
    except Exception as e:
        logger.warning("telegram_poll_state write failed: %s", e)


def _upsert_channel(chat: dict) -> None:
    try:
        client = _client_db()
        client.table("telegram_channels").upsert({
            "chat_id": chat["id"],
            "chat_type": chat.get("type", "unknown"),
            "title": chat.get("title") or chat.get("username"),
            "username": chat.get("username"),
        }, on_conflict="chat_id").execute()
    except Exception as e:
        logger.warning("telegram_channels upsert failed: %s", e)


def _save_message(msg: dict) -> None:
    chat = msg.get("chat") or {}
    sender = msg.get("from") or {}
    text = msg.get("text") or msg.get("caption") or ""
    has_media = bool(msg.get("photo") or msg.get("video") or msg.get("document") or msg.get("audio"))
    media_type = None
    for k in ("photo", "video", "document", "audio", "voice", "animation", "sticker"):
        if msg.get(k):
            media_type = k
            break

    try:
        client = _client_db()
        client.table("telegram_messages").upsert({
            "chat_id": chat.get("id"),
            "message_id": msg.get("message_id"),
            "sender_id": sender.get("id"),
            "sender_name": (sender.get("username") or sender.get("first_name") or "")[:200],
            "message_date": datetime.fromtimestamp(msg.get("date", 0), tz=timezone.utc).isoformat(),
            "text": text[:8000] if text else None,
            "has_media": has_media,
            "media_type": media_type,
            "extracted_iocs": _extract_iocs(text),
            "raw": msg,
        }, on_conflict="chat_id,message_id").execute()
    except Exception as e:
        logger.warning("telegram_messages insert failed: %s", e)


async def _handle_command(token: str, msg: dict) -> None:
    chat_id = (msg.get("chat") or {}).get("id")
    text = (msg.get("text") or "").strip()
    if not text.startswith("/") or not chat_id:
        return

    parts = text.split()
    cmd = parts[0].split("@")[0].lower()  # strip optional @botname

    if cmd == "/start":
        await _api(token, "sendMessage", chat_id=chat_id, text=(
            "🛡️ *AEGIS Threat Intel Bot*\n\n"
            "Add me to a channel and I'll watch every message for IOCs (IPs, domains, hashes, wallets).\n\n"
            "*Commands*\n"
            "`/lookup <type> <value>` — multi-source enrichment\n"
            "`/stats` — channels & message counts\n"
        ), parse_mode="Markdown")

    elif cmd == "/lookup" and len(parts) >= 3:
        ioc_type, value = parts[1].lower(), parts[2]
        if ioc_type not in {"ip", "domain", "url", "hash", "email"}:
            await _api(token, "sendMessage", chat_id=chat_id, text="type must be ip|domain|url|hash|email")
            return
        try:
            from enrichment import enrich

            result = await enrich(ioc_type, value)
            verdict = result.get("verdict", "unknown")
            confidence = result.get("confidence", 0)
            sources = ", ".join(result.get("sources", []))
            tags = ", ".join(result.get("tags", []))
            text_out = (
                f"🔎 *{value}* ({ioc_type})\n"
                f"Verdict: *{verdict}* ({confidence}/100)\n"
                f"Sources: {sources or '—'}\n"
                f"Tags: {tags or '—'}\n"
            )
            await _api(token, "sendMessage", chat_id=chat_id, text=text_out, parse_mode="Markdown")
        except Exception as e:
            await _api(token, "sendMessage", chat_id=chat_id, text=f"lookup failed: {e}")

    elif cmd == "/stats":
        try:
            client = _client_db()
            chans = client.table("telegram_channels").select("chat_id", count="exact").execute()
            msgs = client.table("telegram_messages").select("id", count="exact").execute()
            await _api(token, "sendMessage", chat_id=chat_id, text=(
                f"📊 *AEGIS bot stats*\n"
                f"Channels: {chans.count or 0}\n"
                f"Messages: {msgs.count or 0}\n"
            ), parse_mode="Markdown")
        except Exception as e:
            await _api(token, "sendMessage", chat_id=chat_id, text=f"stats failed: {e}")


async def _process_update(token: str, update: dict) -> None:
    msg = update.get("message") or update.get("channel_post") or update.get("edited_message")
    if not msg:
        return
    chat = msg.get("chat") or {}
    if chat.get("id") is not None:
        _upsert_channel(chat)
    _save_message(msg)
    if msg.get("text", "").startswith("/"):
        await _handle_command(token, msg)


async def poll_once(token: str) -> int:
    """Fetch new updates and process them. Returns count of updates processed."""
    last = _get_poll_state()
    updates = await _api(
        token,
        "getUpdates",
        offset=last + 1 if last else 0,
        timeout=30,
        allowed_updates=["message", "channel_post", "edited_message"],
    )
    if not updates:
        return 0
    max_id = last
    for u in updates:
        try:
            await _process_update(token, u)
        except Exception as e:
            logger.warning("Telegram update %s failed: %s", u.get("update_id"), e)
        uid = u.get("update_id", 0)
        if uid > max_id:
            max_id = uid
    if max_id != last:
        _set_poll_state(max_id)
    return len(updates)


async def run_forever(token: str, poll_interval: int = 20) -> None:
    """Long-poll loop. Survives transient errors."""
    global _running
    if _running:
        logger.info("Telegram poll loop already running")
        return
    _running = True
    logger.info("Telegram poll loop started (interval=%ss)", poll_interval)
    try:
        while _running:
            try:
                count = await poll_once(token)
                if count == 0:
                    await asyncio.sleep(poll_interval)
            except Exception as e:
                logger.warning("Telegram poll error: %s", e)
                _set_poll_state(_get_poll_state(), error=str(e)[:500])
                await asyncio.sleep(poll_interval)
    finally:
        _running = False
        logger.info("Telegram poll loop stopped")


def stop():
    global _running
    _running = False
