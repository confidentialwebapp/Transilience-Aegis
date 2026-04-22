"""suggest-remediation — given an IOC + verdict context, suggest concrete defenses."""

from __future__ import annotations

from typing import Optional

from .base import Skill
from .registry import register


class SuggestRemediation(Skill):
    name = "suggest-remediation"
    description = "Given an IOC enrichment result, suggest concrete defensive controls"
    category = "enrichment"
    default_model = "claude-haiku-4-5"

    async def fetch_context(self, params: dict, org_id: Optional[str]) -> dict:
        # Caller passes the enrichment result directly — no extra fetch needed.
        return {
            "ioc_type": params.get("ioc_type"),
            "ioc_value": params.get("ioc_value"),
            "enrichment": params.get("enrichment", {}),
        }

    def build_prompt(self, context: dict, params: dict) -> tuple[str, str]:
        system = (
            "You are a SOC engineer recommending concrete defensive actions for a "
            "specific IOC. Output STRICT JSON:\n"
            "{\n"
            '  "block_now": ["specific action 1", "specific action 2"],\n'
            '  "investigate": ["check X in Y system", ...],\n'
            '  "monitor": ["set up alert for Z", ...],\n'
            '  "false_positive_check": "1-2 sentences on how to confirm legit before blocking"\n'
            "}\n"
            "Actions must be runnable today (specific tool, specific config). "
            "If the IOC looks benign, say so and recommend a watch only."
        )
        user = (
            f"IOC: {context['ioc_value']} (type: {context['ioc_type']})\n\n"
            f"Enrichment data: {context['enrichment']}\n\n"
            "Return only the JSON object."
        )
        return system, user


register(SuggestRemediation())
