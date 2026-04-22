"""summarize-investigation — AI verdict over raw OSINT aggregation.

Takes a completed investigation row and produces:
  - executive_summary (CISO-facing paragraph)
  - risk_verdict (critical/high/medium/low/info) + numeric 0-100
  - key_findings[] with source attribution
  - indicators[] (pivots worth chasing)
  - recommended_actions[] in priority order
  - confidence + contradictions (so the user can judge the AI output)
"""

from __future__ import annotations

from typing import Optional

from .base import Skill
from .registry import register


def _compact(results: dict) -> dict:
    """Strip large arrays (tabular records) down to counts + top-N so the prompt
    stays under token limits while preserving judgment-critical signal."""
    out = {}
    for src, payload in (results or {}).items():
        if not isinstance(payload, dict):
            out[src] = payload
            continue
        slim = {}
        for k, v in payload.items():
            if k in ("results", "hits", "breaches", "pulses", "subdomains", "found_on",
                     "yara_rules", "categories", "tags", "records", "data") and isinstance(v, list):
                slim[k + "_sample"] = v[:5]
                slim[k + "_count"] = len(v)
            elif isinstance(v, str) and len(v) > 400:
                slim[k] = v[:400] + "…"
            else:
                slim[k] = v
        out[src] = slim
    return out


class SummarizeInvestigation(Skill):
    name = "summarize-investigation"
    description = "Synthesize multi-source OSINT aggregation into a CISO-ready verdict"
    category = "enrichment"
    default_model = "claude-haiku-4-5"

    async def fetch_context(self, params: dict, org_id: Optional[str]) -> dict:
        from db import get_client

        inv_id = params.get("investigation_id")
        if not inv_id:
            raise ValueError("investigation_id required")
        row = (
            get_client()
            .table("investigations")
            .select("target_type,target_value,status,results,sources_checked,risk_score")
            .eq("id", inv_id)
            .execute()
        )
        if not row.data:
            raise ValueError(f"investigation {inv_id} not found")
        r = row.data[0]
        return {
            "target_type": r.get("target_type"),
            "target_value": r.get("target_value"),
            "risk_score": r.get("risk_score"),
            "sources_checked": r.get("sources_checked", []),
            "results": _compact(r.get("results") or {}),
        }

    def build_prompt(self, context: dict, params: dict) -> tuple[str, str]:
        system = (
            "You are a senior threat intelligence analyst at TAI-AEGIS. "
            "A junior analyst has aggregated raw OSINT across multiple sources "
            "for a single indicator. Your job is to synthesize a CISO-ready "
            "verdict, reconcile contradictions, and recommend concrete next steps.\n\n"
            "Rules:\n"
            "- Trust raw data over sensational labels. A single 'found' in a low-"
            "confidence feed is not 'critical'.\n"
            "- Name the source on every finding (e.g. 'HIBP: 540 breaches').\n"
            "- If sources contradict, say so.\n"
            "- Be specific. No 'consider', no 'maybe'. Each action must be executable today.\n"
            "- skipped/error sources are NOT findings — do not hallucinate data from them.\n\n"
            "Return STRICT JSON matching this schema (no prose, no code fences):\n"
            "{\n"
            '  "executive_summary": "2-4 sentences for a CISO, plain language",\n'
            '  "risk_verdict": "critical|high|medium|low|info",\n'
            '  "confidence": "high|medium|low",\n'
            '  "key_findings": [\n'
            '     {"source": "…", "finding": "…", "severity": "critical|high|medium|low|info"},\n'
            '     … (3-8 items, ordered by severity)\n'
            '  ],\n'
            '  "indicators": ["pivots worth investigating (IPs, domains, CVEs, actors, breaches)"],\n'
            '  "recommended_actions": [\n'
            '     {"action": "…", "urgency": "now|today|this week", "owner": "SOC|IT|Legal|User"},\n'
            '     … (2-5 items)\n'
            '  ],\n'
            '  "contradictions": "one sentence or null"\n'
            "}"
        )
        user = (
            f"Target: {context['target_type']} = `{context['target_value']}`\n"
            f"Sources checked: {context['sources_checked']}\n"
            f"Raw multi-source results:\n```json\n{context['results']}\n```\n\n"
            "Return only the JSON object."
        )
        return system, user


register(SummarizeInvestigation())
