"""Base classes + shared infra for the AI skills framework."""

from __future__ import annotations

import hashlib
import json
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Anthropic pricing as of 2026-04 (USD per million tokens)
PRICING = {
    "claude-haiku-4-5":  {"input": 0.80, "output": 4.00},
    "claude-sonnet-4-6": {"input": 3.00, "output": 15.00},
    "claude-opus-4-7":   {"input": 15.00, "output": 75.00},
}


@dataclass
class SkillResult:
    """What every skill invocation returns."""
    skill: str
    model: str
    result: Any                       # the structured payload the skill produced
    input_tokens: int
    output_tokens: int
    cost_usd: float
    duration_ms: int
    cached: bool = False
    error: Optional[str] = None


class Skill(ABC):
    """Abstract base — implement this to add a new AI capability."""

    name: str = ""                    # unique kebab-case id, e.g. "triage-alert"
    description: str = ""             # one-sentence what-it-does for the UI
    category: str = "general"         # alert | advisory | actor | enrichment | general
    default_model: str = "claude-haiku-4-5"
    requires_org: bool = True

    # ---- to be implemented per skill ----
    @abstractmethod
    async def fetch_context(self, params: dict, org_id: Optional[str]) -> dict:
        """Pull the rows from Supabase that the LLM needs to answer.
        Return a dict that will be json-serialized into the prompt."""

    @abstractmethod
    def build_prompt(self, context: dict, params: dict) -> tuple[str, str]:
        """Return (system_prompt, user_prompt) for the LLM call."""

    def parse_response(self, raw: str) -> Any:
        """Convert the model's raw text into a structured result.
        Default: try JSON parse, fall back to raw text."""
        text = (raw or "").strip()
        # Strip optional fenced code block
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
            text = text.strip()
        try:
            return json.loads(text)
        except Exception:
            return {"text": text}

    # ---- shared invoke pipeline (don't override unless you must) ----
    async def invoke(
        self,
        params: dict,
        *,
        org_id: Optional[str] = None,
        model: Optional[str] = None,
        bypass_cache: bool = False,
    ) -> SkillResult:
        from config import get_settings

        settings = get_settings()
        chosen_model = model or self.default_model

        if not settings.ANTHROPIC_API_KEY:
            return SkillResult(
                skill=self.name, model=chosen_model, result=None,
                input_tokens=0, output_tokens=0, cost_usd=0.0, duration_ms=0,
                error="ANTHROPIC_API_KEY not configured on backend",
            )

        # Pull context
        try:
            context = await self.fetch_context(params, org_id)
        except Exception as e:
            return SkillResult(
                skill=self.name, model=chosen_model, result=None,
                input_tokens=0, output_tokens=0, cost_usd=0.0, duration_ms=0,
                error=f"context fetch failed: {type(e).__name__}: {e}",
            )

        # Cache lookup (1h TTL)
        cache_key = self._cache_key(chosen_model, params, context)
        if not bypass_cache:
            cached = await _cache_get(cache_key)
            if cached:
                return SkillResult(
                    skill=self.name, model=chosen_model,
                    result=cached.get("result"),
                    input_tokens=cached.get("input_tokens", 0),
                    output_tokens=cached.get("output_tokens", 0),
                    cost_usd=cached.get("cost_usd", 0.0),
                    duration_ms=cached.get("duration_ms", 0),
                    cached=True,
                )

        # Build prompt
        system_prompt, user_prompt = self.build_prompt(context, params)

        # Call Claude
        t0 = time.monotonic()
        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
            resp = await client.messages.create(
                model=chosen_model,
                max_tokens=2048,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            duration_ms = int((time.monotonic() - t0) * 1000)
            raw_text = resp.content[0].text if resp.content else ""
            input_tokens = resp.usage.input_tokens
            output_tokens = resp.usage.output_tokens
        except Exception as e:
            return SkillResult(
                skill=self.name, model=chosen_model, result=None,
                input_tokens=0, output_tokens=0, cost_usd=0.0,
                duration_ms=int((time.monotonic() - t0) * 1000),
                error=f"anthropic call failed: {type(e).__name__}: {e}",
            )

        # Parse
        try:
            parsed = self.parse_response(raw_text)
        except Exception as e:
            parsed = {"text": raw_text, "parse_error": str(e)}

        # Cost
        price = PRICING.get(chosen_model, PRICING["claude-haiku-4-5"])
        cost_usd = (input_tokens / 1_000_000) * price["input"] + \
                   (output_tokens / 1_000_000) * price["output"]

        result = SkillResult(
            skill=self.name, model=chosen_model, result=parsed,
            input_tokens=input_tokens, output_tokens=output_tokens,
            cost_usd=round(cost_usd, 6), duration_ms=duration_ms,
        )

        # Cache + log (best-effort)
        await _cache_set(cache_key, {
            "result": parsed, "input_tokens": input_tokens,
            "output_tokens": output_tokens, "cost_usd": cost_usd,
            "duration_ms": duration_ms,
        })
        _log_invocation(self.name, chosen_model, params, result, org_id)

        return result

    def _cache_key(self, model: str, params: dict, context: dict) -> str:
        h = hashlib.sha256()
        h.update(self.name.encode())
        h.update(model.encode())
        h.update(json.dumps(params, sort_keys=True, default=str).encode())
        h.update(json.dumps(context, sort_keys=True, default=str).encode())
        return f"skill:v1:{h.hexdigest()}"


# ---------------------------------------------------------------------------
# Cache (Redis with 1h TTL)
# ---------------------------------------------------------------------------
async def _cache_get(key: str) -> Optional[dict]:
    try:
        from utils.redis_cache import get_cache
        return await get_cache().get_json(key)
    except Exception:
        return None


async def _cache_set(key: str, value: dict, ttl: int = 3600) -> None:
    try:
        from utils.redis_cache import get_cache
        await get_cache().set_json(key, value, ttl=ttl)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Invocation log
# ---------------------------------------------------------------------------
def _log_invocation(skill_name: str, model: str, params: dict,
                    result: SkillResult, org_id: Optional[str]) -> None:
    try:
        from db import get_client
        get_client().table("skill_invocations").insert({
            "skill": skill_name,
            "org_id": org_id,
            "model": model,
            "input_hash": hashlib.sha1(
                json.dumps(params, sort_keys=True, default=str).encode()
            ).hexdigest()[:16],
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens,
            "cost_usd": result.cost_usd,
            "duration_ms": result.duration_ms,
            "cached": result.cached,
            "error": result.error,
            "result_preview": (json.dumps(result.result, default=str)[:1000]
                               if result.result else None),
        }).execute()
    except Exception as e:
        logger.warning("skill_invocations insert failed: %s", e)
