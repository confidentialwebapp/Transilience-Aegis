"""Transilience AI — context-aware chat with the user's threat-intel data.

Customer asks anything in natural language, optionally attaches files (images
via Anthropic Vision; text/PDF/CSV/JSON inline), and gets a Claude response
grounded in their org's actual data: alerts, profiles, advisories, threat
actors, recent researcher posts.

MVP scope (this file):
  * Single conversation per request — no streaming yet
  * Image (PNG/JPEG/WebP/GIF) + plain text + JSON + CSV attachments
  * History trimmed to last 20 turns to bound context cost
  * System prompt auto-injects the org's data summary
  * Default Haiku, opt-in Sonnet for hard questions

Future:
  * Server-Sent Events streaming (Anthropic SDK supports it natively)
  * Tool use — let Claude call our /skills/* and /intel/enrich endpoints
  * Vector search over the org's advisory + post corpus for retrieval
"""

from __future__ import annotations

import base64
import json
import logging
import time
from typing import Optional

from fastapi import APIRouter, Body, HTTPException, Header, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Pricing (mirror of skills/base.py — duplicated to avoid coupling)
# ---------------------------------------------------------------------------
PRICING = {
    "claude-haiku-4-5":  {"input": 0.80, "output": 4.00},
    "claude-sonnet-4-6": {"input": 3.00, "output": 15.00},
    "claude-opus-4-7":   {"input": 15.00, "output": 75.00},
}

MAX_HISTORY_TURNS = 20            # cap on messages sent back as context
MAX_ATTACHMENT_BYTES = 4_000_000  # 4 MB per attachment (Anthropic-friendly)
MAX_ATTACHMENTS_PER_MSG = 5
SUPPORTED_IMAGE_MIMES = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}
SUPPORTED_TEXT_MIMES = {"text/plain", "text/csv", "application/json",
                        "text/markdown", "text/html", "application/xml"}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class Attachment(BaseModel):
    type: str = "auto"            # image | text | auto (we infer from mime)
    name: str
    mime: str = "application/octet-stream"
    size_bytes: int = 0
    data_b64: str = ""            # full base64 of the file


class ConversationCreate(BaseModel):
    title: Optional[str] = None
    default_model: Optional[str] = None


class MessageSend(BaseModel):
    content: str
    attachments: list[Attachment] = Field(default_factory=list)
    model: Optional[str] = None    # override the conversation default for this turn


# ---------------------------------------------------------------------------
# Conversations CRUD
# ---------------------------------------------------------------------------
@router.get("/conversations")
async def list_conversations(x_org_id: str = Header(...), limit: int = 30):
    from db import get_client

    try:
        result = (
            get_client().table("chat_conversations")
            .select("id,title,default_model,total_cost_usd,message_count,last_message_at,created_at")
            .eq("org_id", x_org_id).is_("archived_at", "null")
            .order("last_message_at", desc=True, nullsfirst=False)
            .order("created_at", desc=True)
            .limit(limit).execute()
        )
        return {"data": result.data or []}
    except Exception as e:
        logger.error("list_conversations failed: %s", e)
        raise HTTPException(500, str(e))


@router.post("/conversations")
async def create_conversation(body: ConversationCreate, x_org_id: str = Header(...)):
    from config import get_settings
    from db import get_client

    settings = get_settings()
    try:
        result = get_client().table("chat_conversations").insert({
            "org_id": x_org_id,
            "title": body.title or "New conversation",
            "default_model": body.default_model or settings.ANTHROPIC_DEFAULT_MODEL,
        }).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, x_org_id: str = Header(...)):
    from db import get_client

    try:
        c = (
            get_client().table("chat_conversations").select("*")
            .eq("id", conv_id).eq("org_id", x_org_id).execute()
        )
        if not c.data:
            raise HTTPException(404, "conversation not found")
        return c.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.delete("/conversations/{conv_id}")
async def archive_conversation(conv_id: str, x_org_id: str = Header(...)):
    from db import get_client

    try:
        get_client().table("chat_conversations").update({
            "archived_at": "now()"
        }).eq("id", conv_id).eq("org_id", x_org_id).execute()
        return {"archived": conv_id}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.patch("/conversations/{conv_id}")
async def rename_conversation(conv_id: str, body: dict = Body(...), x_org_id: str = Header(...)):
    from db import get_client

    title = body.get("title")
    if not title or not isinstance(title, str):
        raise HTTPException(400, "title required")
    try:
        result = (
            get_client().table("chat_conversations")
            .update({"title": title[:200], "updated_at": "now()"})
            .eq("id", conv_id).eq("org_id", x_org_id).execute()
        )
        return result.data[0] if result.data else {}
    except Exception as e:
        raise HTTPException(500, str(e))


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------
@router.get("/conversations/{conv_id}/messages")
async def list_messages(conv_id: str, x_org_id: str = Header(...)):
    from db import get_client

    try:
        result = (
            get_client().table("chat_messages")
            .select("id,role,content,attachments,model,input_tokens,output_tokens,cost_usd,duration_ms,cached,error,created_at")
            .eq("conversation_id", conv_id).eq("org_id", x_org_id)
            .order("created_at").execute()
        )
        return {"data": result.data or []}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: str, body: MessageSend, x_org_id: str = Header(...)):
    """The main chat endpoint. Records the user message, sends to Claude with
    org context + history + attachments, records the assistant reply, returns both."""
    from config import get_settings
    from db import get_client

    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY not configured on backend")

    # Validate attachments
    if len(body.attachments) > MAX_ATTACHMENTS_PER_MSG:
        raise HTTPException(400, f"max {MAX_ATTACHMENTS_PER_MSG} attachments per message")
    for a in body.attachments:
        if a.size_bytes > MAX_ATTACHMENT_BYTES:
            raise HTTPException(413, f"attachment {a.name} exceeds 4 MB limit")

    client = get_client()

    # 1. Confirm conversation exists & belongs to org
    conv_q = (
        client.table("chat_conversations").select("*")
        .eq("id", conv_id).eq("org_id", x_org_id).execute()
    )
    if not conv_q.data:
        raise HTTPException(404, "conversation not found")
    conv = conv_q.data[0]
    chosen_model = body.model or conv.get("default_model") or settings.ANTHROPIC_DEFAULT_MODEL

    # 2. Persist the user message immediately (so partial failures still capture intent)
    # Strip data_b64 from what we store (DB bloat) — keep just the metadata.
    stored_attachments = [
        {"type": a.type, "name": a.name, "mime": a.mime, "size_bytes": a.size_bytes}
        for a in body.attachments
    ]
    try:
        client.table("chat_messages").insert({
            "conversation_id": conv_id, "org_id": x_org_id,
            "role": "user", "content": body.content,
            "attachments": stored_attachments,
        }).execute()
    except Exception as e:
        logger.warning("user message persist failed: %s", e)

    # 3. Build the conversation history Claude sees
    history = await _build_history(client, conv_id)

    # 4. Build the system prompt grounded in this org's data
    system_prompt = await _build_system_prompt(client, x_org_id)

    # 5. Build the new user message including attachments in Anthropic format
    new_user_msg = _build_anthropic_user_message(body.content, body.attachments)

    # 6. Call Claude
    t0 = time.monotonic()
    error = None
    reply_text = ""
    input_tokens = output_tokens = 0
    try:
        from anthropic import AsyncAnthropic

        anthropic_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        resp = await anthropic_client.messages.create(
            model=chosen_model,
            max_tokens=4096,
            system=system_prompt,
            messages=history + [new_user_msg],
        )
        reply_text = resp.content[0].text if resp.content else ""
        input_tokens = resp.usage.input_tokens
        output_tokens = resp.usage.output_tokens
    except Exception as e:
        error = f"{type(e).__name__}: {str(e)[:200]}"
        logger.warning("transilience-ai claude call failed: %s", error)

    duration_ms = int((time.monotonic() - t0) * 1000)
    price = PRICING.get(chosen_model, PRICING["claude-haiku-4-5"])
    cost_usd = round(
        (input_tokens / 1_000_000) * price["input"] + (output_tokens / 1_000_000) * price["output"],
        6,
    )

    # 7. Persist the assistant reply
    try:
        client.table("chat_messages").insert({
            "conversation_id": conv_id, "org_id": x_org_id,
            "role": "assistant", "content": reply_text or (error and f"[error] {error}"),
            "model": chosen_model,
            "input_tokens": input_tokens, "output_tokens": output_tokens,
            "cost_usd": cost_usd, "duration_ms": duration_ms,
            "error": error,
        }).execute()
    except Exception as e:
        logger.warning("assistant message persist failed: %s", e)

    # 8. Update conversation aggregates
    try:
        client.table("chat_conversations").update({
            "total_cost_usd": float(conv.get("total_cost_usd") or 0) + cost_usd,
            "total_input_tokens": int(conv.get("total_input_tokens") or 0) + input_tokens,
            "total_output_tokens": int(conv.get("total_output_tokens") or 0) + output_tokens,
            "message_count": int(conv.get("message_count") or 0) + 2,  # user + assistant
            "last_message_at": "now()",
            "updated_at": "now()",
            # Auto-title using first user message if still default
            **({"title": body.content[:80] + ("…" if len(body.content) > 80 else "")}
               if (conv.get("title") == "New conversation"
                   and (conv.get("message_count") or 0) == 0
                   and body.content) else {}),
        }).eq("id", conv_id).execute()
    except Exception as e:
        logger.warning("conversation aggregate update failed: %s", e)

    if error:
        return {
            "ok": False, "error": error, "model": chosen_model,
            "duration_ms": duration_ms,
        }
    return {
        "ok": True,
        "reply": reply_text,
        "model": chosen_model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": cost_usd,
        "duration_ms": duration_ms,
    }


# ---------------------------------------------------------------------------
# History reconstruction (stripped of attachment bytes — only metadata kept)
# ---------------------------------------------------------------------------
async def _build_history(client, conv_id: str) -> list[dict]:
    """Last N messages, formatted for Anthropic. Attachments lost for prior turns
    (we don't store the bytes by default — too expensive)."""
    try:
        result = (
            client.table("chat_messages")
            .select("role,content,attachments,error")
            .eq("conversation_id", conv_id)
            .order("created_at", desc=True).limit(MAX_HISTORY_TURNS * 2)
            .execute()
        )
        rows = list(reversed(result.data or []))
    except Exception as e:
        logger.warning("history fetch failed: %s", e)
        return []

    # Drop the message that was just inserted (the user turn we're about to send) —
    # we add it freshly with attachment data below.
    if rows and rows[-1].get("role") == "user":
        rows = rows[:-1]

    out: list[dict] = []
    for r in rows:
        role = r.get("role")
        if role not in ("user", "assistant"):
            continue
        text = r.get("content") or ""
        att_meta = r.get("attachments") or []
        if att_meta:
            att_str = ", ".join(f"{a.get('name')} ({a.get('mime')})" for a in att_meta)
            text = f"[Previously attached: {att_str}]\n\n{text}"
        if not text:
            continue
        out.append({"role": role, "content": text})
    return out


# ---------------------------------------------------------------------------
# System prompt — auto-grounds in this org's data
# ---------------------------------------------------------------------------
async def _build_system_prompt(client, org_id: str) -> str:
    """Pull a snapshot of the org's data + general capabilities."""
    org_name = "your organization"
    profiles_list: list[dict] = []
    recent_alerts: list[dict] = []
    advisories_count = 0

    try:
        org = client.table("orgs").select("name").eq("id", org_id).execute()
        if org.data:
            org_name = org.data[0].get("name") or org_name
    except Exception:
        pass

    try:
        p = (
            client.table("customer_profiles").select("display_name,sectors,countries,domains,brand_keywords")
            .eq("org_id", org_id).eq("enabled", True).limit(10).execute()
        )
        profiles_list = p.data or []
    except Exception:
        pass

    try:
        a = (
            client.table("alerts").select("title,severity,module,created_at")
            .eq("org_id", org_id).order("created_at", desc=True).limit(8).execute()
        )
        recent_alerts = a.data or []
    except Exception:
        pass

    try:
        adv = (
            client.table("advisories").select("id", count="exact")
            .eq("org_id", org_id).limit(1).execute()
        )
        advisories_count = getattr(adv, "count", None) or 0
    except Exception:
        pass

    profile_lines = "\n".join(
        f"  - {p.get('display_name') or 'Unnamed'}: "
        f"sectors={p.get('sectors') or '—'}, "
        f"countries={p.get('countries') or '—'}, "
        f"domains={p.get('domains') or '—'}, "
        f"keywords={p.get('brand_keywords') or '—'}"
        for p in profiles_list
    ) or "  (none configured yet)"

    alert_lines = "\n".join(
        f"  - [{a.get('severity','?')}] [{a.get('module','?')}] {a.get('title','')[:120]}"
        for a in recent_alerts
    ) or "  (no alerts in the last few days)"

    return (
        "You are **Transilience AI**, a senior threat-intelligence analyst built into the "
        f"TAI-AEGIS platform. You're chatting with a customer at *{org_name}*.\n\n"

        "## Your role\n"
        "Help the customer make sense of their threat-intel data, draft advisories, "
        "triage alerts, suggest defensive actions, and explain threat actors. Use "
        "**plain CISO language** unless the user is clearly technical.\n\n"

        "## What you know about this customer's data right now\n"
        f"**Customer Watchlist profiles** (what they want monitored):\n{profile_lines}\n\n"
        f"**Most recent alerts** (last few days):\n{alert_lines}\n\n"
        f"**Advisories on file**: {advisories_count}\n\n"

        "## What the platform can do (refer the user to these features when relevant)\n"
        "- /profile — Customer Watchlist (sectors, countries, domains, brand keywords) — matched against ransomware leak sites every 15 min\n"
        "- /advisories — categorised threat/breach/product advisories with STIX 2.1 + HTML export\n"
        "- /scan — Active scanners (subfinder, dnstwist, nmap, nuclei) on Modal serverless\n"
        "- /investigate — multi-source IOC enrichment (12+ sources via one query)\n"
        "- /threat-actors — MITRE ATT&CK + ransomware.live tracked groups\n"
        "- /researcher-feed — curated intel from public security-researcher Telegram channels\n"
        "- /webhooks — Slack/Teams/Discord/generic alert delivery\n"
        "- /api-keys — programmatic access for integrations\n\n"

        "## Style rules\n"
        "- Be specific, brief, and confident. Cite the user's own data when relevant.\n"
        "- If the user asks for an advisory, ask which kind (threat/breach/product) before drafting unless obvious.\n"
        "- If a question requires data you don't have (e.g. 'what's in this PDF'), say what you'd need.\n"
        "- Use markdown for structure (headings, lists, code blocks) — the UI renders it.\n"
        "- Never invent CVE numbers, threat-actor names, or victim names not present in the input.\n"
        "- If the customer's data is empty, gently nudge them to set up a watchlist profile first.\n"
    )


# ---------------------------------------------------------------------------
# Anthropic content block builder
# ---------------------------------------------------------------------------
def _build_anthropic_user_message(text: str, attachments: list[Attachment]) -> dict:
    """Build the user message in Anthropic content-block format.
    Images use the `image` content block; text files inline as text."""
    blocks: list[dict] = []

    for a in attachments:
        if a.mime in SUPPORTED_IMAGE_MIMES and a.data_b64:
            blocks.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": a.mime,
                    "data": a.data_b64,
                },
            })
        elif a.mime in SUPPORTED_TEXT_MIMES or a.type == "text":
            # Decode and inline as text
            try:
                raw = base64.b64decode(a.data_b64) if a.data_b64 else b""
                text_content = raw.decode("utf-8", errors="replace")[:50_000]
                blocks.append({
                    "type": "text",
                    "text": f"--- File: {a.name} ({a.mime}) ---\n{text_content}\n--- end file ---",
                })
            except Exception as e:
                blocks.append({"type": "text", "text": f"[Could not read attachment {a.name}: {e}]"})
        else:
            blocks.append({"type": "text", "text": f"[Unsupported attachment: {a.name} ({a.mime})]"})

    # Always include the text body (last block so it's the user's actual ask)
    if text:
        blocks.append({"type": "text", "text": text})
    elif not blocks:
        blocks.append({"type": "text", "text": "(empty message)"})

    return {"role": "user", "content": blocks}


# ---------------------------------------------------------------------------
# Quick chat (no conversation persistence) — for /transilience-ai sidebar widgets
# ---------------------------------------------------------------------------
@router.post("/quick")
async def quick_chat(body: dict = Body(...), x_org_id: str = Header(...)):
    """One-shot question without saving to conversation history.
    Body: {prompt: str, model?: str}"""
    from config import get_settings

    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY not configured")
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(400, "prompt required")
    model = body.get("model") or settings.ANTHROPIC_DEFAULT_MODEL

    from db import get_client
    system = await _build_system_prompt(get_client(), x_org_id)

    t0 = time.monotonic()
    try:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        resp = await client.messages.create(
            model=model, max_tokens=2048, system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text if resp.content else ""
        in_t = resp.usage.input_tokens
        out_t = resp.usage.output_tokens
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}

    price = PRICING.get(model, PRICING["claude-haiku-4-5"])
    return {
        "ok": True,
        "reply": text,
        "model": model,
        "input_tokens": in_t,
        "output_tokens": out_t,
        "cost_usd": round((in_t / 1e6) * price["input"] + (out_t / 1e6) * price["output"], 6),
        "duration_ms": int((time.monotonic() - t0) * 1000),
    }
