"""compare-iocs — given a list of IOCs, find shared infrastructure / overlaps / clustering."""

from __future__ import annotations

from typing import Optional

from .base import Skill
from .registry import register


class CompareIocs(Skill):
    name = "compare-iocs"
    description = "Find shared infrastructure, ASN overlaps, or behavioral clusters across multiple IOCs"
    category = "enrichment"
    default_model = "claude-haiku-4-5"

    async def fetch_context(self, params: dict, org_id: Optional[str]) -> dict:
        # Caller passes list of IOCs already enriched
        return {
            "iocs": params.get("iocs", []),    # [{type, value, enrichment_summary}, ...]
        }

    def build_prompt(self, context: dict, params: dict) -> tuple[str, str]:
        system = (
            "You are a threat hunter comparing multiple IOCs to find shared "
            "infrastructure, overlapping attribution, or behavioral clusters.\n\n"
            "Output STRICT JSON:\n"
            "{\n"
            '  "clusters": [\n'
            '    {"member_iocs": ["…"], "shared_attribute": "ASN AS12345", "confidence": "low|medium|high"},\n'
            '  ],\n'
            '  "outliers": ["IOCs that do not cluster with anything"],\n'
            '  "likely_attribution": "if a cluster suggests a known group, name it; else null",\n'
            '  "recommendation": "1-2 sentences on what to do with these clusters"\n'
            "}\n"
            "Be conservative. Do not claim attribution without evidence."
        )
        user = (
            f"IOCs to compare:\n{context['iocs']}\n\n"
            "Return only the JSON object."
        )
        return system, user


register(CompareIocs())
