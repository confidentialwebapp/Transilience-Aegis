"""triage-alert — explain an alert in CISO language + suggest next actions."""

from __future__ import annotations

from typing import Optional

from .base import Skill
from .registry import register


class TriageAlert(Skill):
    name = "triage-alert"
    description = "Explain an alert in plain language and recommend the next 1-3 actions"
    category = "alert"
    default_model = "claude-haiku-4-5"

    async def fetch_context(self, params: dict, org_id: Optional[str]) -> dict:
        from db import get_client

        alert_id = params.get("alert_id")
        if not alert_id:
            raise ValueError("alert_id required")

        client = get_client()
        alert = client.table("alerts").select("*").eq("id", alert_id).execute()
        if not alert.data:
            raise ValueError(f"alert {alert_id} not found")
        a = alert.data[0]

        # Pull related context: 5 most recent alerts of same module + same severity
        related = (
            client.table("alerts")
            .select("id,title,description,severity,created_at")
            .eq("org_id", a.get("org_id"))
            .eq("module", a.get("module"))
            .neq("id", alert_id)
            .order("created_at", desc=True).limit(5).execute()
        )

        return {
            "alert": {
                "id": a["id"],
                "module": a["module"],
                "severity": a["severity"],
                "title": a["title"],
                "description": a.get("description", ""),
                "tags": a.get("tags", []),
                "raw_data": a.get("raw_data", {}),
                "created_at": a.get("created_at"),
            },
            "related_count": len(related.data or []),
            "related_titles": [r.get("title") for r in (related.data or [])][:5],
        }

    def build_prompt(self, context: dict, params: dict) -> tuple[str, str]:
        system = (
            "You are a senior threat intelligence analyst at TAI-AEGIS, briefing a "
            "mid-market CISO. Your job: explain a security alert in plain language "
            "and recommend the 1-3 highest-priority actions.\n\n"
            "Output STRICT JSON with this schema:\n"
            "{\n"
            '  "tldr": "one sentence, max 120 chars, what happened",\n'
            '  "why_it_matters": "2-3 sentences on business impact for the customer",\n'
            '  "next_actions": [\n'
            '    {"action": "…", "urgency": "now|today|this week", "owner": "SOC|IT|Legal|Comms"},\n'
            '    ... 1 to 3 items\n'
            '  ],\n'
            '  "false_positive_likelihood": "low|medium|high",\n'
            '  "related_pattern": "if related_count > 2, name the pattern; else null"\n'
            "}\n"
            "Be specific and actionable. No fluff. No 'consider'."
        )
        user = (
            f"Alert to triage:\n```json\n{context['alert']}\n```\n\n"
            f"Related recent alerts ({context['related_count']}): "
            f"{context['related_titles']}\n\n"
            "Return only the JSON object."
        )
        return system, user


register(TriageAlert())
