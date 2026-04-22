"""explain-threat-actor — generate a CISO-friendly profile card for a threat actor."""

from __future__ import annotations

from typing import Optional

from .base import Skill
from .registry import register


class ExplainThreatActor(Skill):
    name = "explain-threat-actor"
    description = "One-paragraph briefing on a threat actor: who they are, who they target, recent activity"
    category = "actor"
    default_model = "claude-haiku-4-5"

    async def fetch_context(self, params: dict, org_id: Optional[str]) -> dict:
        from db import get_client

        actor = params.get("actor_name") or params.get("name")
        if not actor:
            raise ValueError("actor_name required")

        client = get_client()

        # Try threat_actors table (MITRE-derived) first
        ta = (
            client.table("threat_actors").select("*")
            .or_(f"name.ilike.%{actor}%,aliases.cs.{{{actor}}}")
            .limit(1).execute()
        )
        actor_row = ta.data[0] if ta.data else None

        # Pull 3 most recent ransomware victims if this is a ransomware group
        rv = (
            client.table("ransomware_victims").select("victim_name,country,activity,discovered")
            .eq("group_name", actor)
            .order("discovered", desc=True).limit(5).execute()
        )

        # Pull 3 most recent researcher posts mentioning the actor
        rp = (
            client.table("researcher_posts").select("title,channel,published_at")
            .ilike("text", f"%{actor}%")
            .order("published_at", desc=True).limit(5).execute()
        )

        return {
            "actor_name": actor,
            "mitre_record": actor_row,
            "recent_victims": rv.data or [],
            "recent_mentions": rp.data or [],
        }

    def build_prompt(self, context: dict, params: dict) -> tuple[str, str]:
        system = (
            "You are a senior threat intelligence analyst writing a profile card "
            "on a threat actor. Output STRICT JSON:\n"
            "{\n"
            '  "headline": "one-line characterization, max 100 chars",\n'
            '  "type": "ransomware-group|apt|cybercrime|hacktivist|insider|unknown",\n'
            '  "active_since": "year or unknown",\n'
            '  "primary_motivation": "financial|espionage|disruption|ideology|unknown",\n'
            '  "typical_targets": "comma-separated list of sectors/regions",\n'
            '  "tradecraft": "2-sentence summary of TTPs in plain language",\n'
            '  "recent_activity": "one paragraph (3-5 sentences) on recent victims and ops",\n'
            '  "what_to_do_if_targeted": ["action 1", "action 2", "action 3"]\n'
            "}\n"
            "Stay grounded in the provided data. If unknown, say so. Do not invent."
        )
        user = (
            f"Actor: {context['actor_name']}\n\n"
            f"MITRE record: {context.get('mitre_record')}\n\n"
            f"Recent victims (ransomware.live): {context.get('recent_victims')}\n\n"
            f"Recent researcher mentions: {context.get('recent_mentions')}\n\n"
            "Return only the JSON object."
        )
        return system, user


register(ExplainThreatActor())
