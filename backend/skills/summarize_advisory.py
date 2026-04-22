"""summarize-advisory — produce executive TL;DR + key takeaways from an existing advisory."""

from __future__ import annotations

from typing import Optional

from .base import Skill
from .registry import register


class SummarizeAdvisory(Skill):
    name = "summarize-advisory"
    description = "Generate executive summary + key takeaways for an existing advisory"
    category = "advisory"
    default_model = "claude-haiku-4-5"

    async def fetch_context(self, params: dict, org_id: Optional[str]) -> dict:
        from db import get_client

        advisory_id = params.get("advisory_id")
        if not advisory_id:
            raise ValueError("advisory_id required")

        client = get_client()
        a = client.table("advisories").select("*").eq("id", advisory_id).execute()
        if not a.data:
            raise ValueError(f"advisory {advisory_id} not found")
        return {"advisory": a.data[0]}

    def build_prompt(self, context: dict, params: dict) -> tuple[str, str]:
        a = context["advisory"]
        system = (
            "You are summarizing a security advisory for a board-level audience. "
            "Output STRICT JSON:\n"
            "{\n"
            '  "tldr": "one sentence, max 200 chars",\n'
            '  "key_takeaways": ["bullet 1", "bullet 2", "bullet 3"],\n'
            '  "who_should_act": "role names, e.g. IT Ops, SOC, Legal",\n'
            '  "deadline_pressure": "immediate|24h|1w|none"\n'
            "}\n"
            "No filler. Match the actual content of the advisory."
        )
        user = (
            f"Title: {a.get('title')}\n"
            f"Severity: {a.get('severity')}\n"
            f"Kind: {a.get('kind')}\n\n"
            f"Body:\n{a.get('body_markdown', '')[:6000]}\n\n"
            "Return only the JSON object."
        )
        return system, user


register(SummarizeAdvisory())
