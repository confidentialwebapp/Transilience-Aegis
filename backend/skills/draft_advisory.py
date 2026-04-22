"""draft-advisory — generate a structured threat/breach/product advisory in markdown."""

from __future__ import annotations

from typing import Optional

from .base import Skill
from .registry import register


class DraftAdvisory(Skill):
    name = "draft-advisory"
    description = "Generate a structured threat/breach/product advisory in markdown"
    category = "advisory"
    default_model = "claude-sonnet-4-6"  # high-stakes — use the better model

    async def fetch_context(self, params: dict, org_id: Optional[str]) -> dict:
        # Caller provides everything; this skill is a transformer, not a fetcher.
        return {
            "kind": params.get("kind", "threat"),    # threat | breach | product
            "topic": params.get("topic", ""),
            "facts": params.get("facts", []),         # list of bullet points / known data
            "iocs": params.get("iocs", {}),           # {ipv4: [...], domain: [...], hash: [...]}
            "audience": params.get("audience", "mid-market CISO"),
        }

    def build_prompt(self, context: dict, params: dict) -> tuple[str, str]:
        kind = context["kind"]
        kind_guidance = {
            "threat": "Active threat advisory — describe the attacker, TTPs, indicators, and immediate defensive actions.",
            "breach": "Breach advisory — describe what was leaked, who's affected, what they should do (rotate creds, etc.).",
            "product": "Product advisory — describe a vulnerability or compromise in a software product, with versioning and patches.",
        }

        system = (
            f"You are drafting a {kind} advisory for {context['audience']}. "
            f"{kind_guidance[kind]}\n\n"
            "Output STRICT JSON:\n"
            "{\n"
            '  "title": "concise headline, max 100 chars",\n'
            '  "summary": "1-paragraph TL;DR for executive consumption",\n'
            '  "severity": "low|medium|high|critical",\n'
            '  "body_markdown": "full advisory body in markdown with sections: ## Background, ## Impact, ## Indicators, ## Recommended Actions, ## References",\n'
            '  "tags": ["short", "lowercase", "comma-separated keywords"],\n'
            '  "tlp": "WHITE|GREEN|AMBER|RED"\n'
            "}\n"
            "Be specific and technically accurate. Cite the provided facts. Don't invent CVEs/groups/dates not in the input."
        )
        user = (
            f"Kind: {kind}\n"
            f"Topic: {context['topic']}\n\n"
            f"Known facts:\n{chr(10).join('- ' + str(f) for f in context['facts'])}\n\n"
            f"IOCs to include in the indicators section:\n{context['iocs']}\n\n"
            "Return only the JSON object."
        )
        return system, user


register(DraftAdvisory())
