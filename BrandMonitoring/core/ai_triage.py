"""AI-powered triage of findings via Claude.

Sends findings to Claude in batches with prompt caching:
  - System prompt + brand context: cached (stable across batches)
  - Per-batch findings: variable (the only thing that changes)

Returns a label, confidence, reasoning, and suggested severity per finding.
The orchestrator uses these to:
  - Demote false positives (label IRRELEVANT/SPAM/FAN/NEWS) to Informational
  - Confirm real impersonation/scam (and bump severity if model recommends)
  - Distinguish OFFICIAL/EMPLOYEE/PARTNER content from impersonation

Design notes:
  - Structured output via Pydantic + messages.parse() — no JSON parsing.
  - Prompt caching on system + brand context. Min cacheable prefix is 4096 tokens
    on Opus / Haiku, so the system prompt + brand context are intentionally rich.
  - Async client; batches dispatched concurrently up to a small concurrency limit
    to avoid hitting the per-org RPM cap.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, Literal

import anthropic
from pydantic import BaseModel, Field, ValidationError

from config.settings import KEYS
from core.evidence import Finding
from core.logging_setup import get_logger
from core.severity import Severity

log = get_logger(__name__)


# ============================================================================
# Pydantic schemas — Claude returns structured output matching this shape
# ============================================================================

Label = Literal[
    "IMPERSONATION",   # Real impersonation / unauthorized brand use
    "SCAM",            # Active scam targeting customers (loan/kyc/giveaway/support)
    "OFFICIAL",        # Brand's own owned channel / content
    "EMPLOYEE",        # Employee personal account/post mentioning brand
    "PARTNER",         # Authorized partner / distributor / reseller
    "FAN",             # Genuine customer / fan / user
    "NEWS",            # News article / financial coverage / industry analysis
    "SPAM",            # Low-quality SEO spam / clickbait / not actually about brand
    "IRRELEVANT",      # False positive — surfaced by keyword match but unrelated
    "INDETERMINATE",   # Cannot decide from available evidence
]

SuggestedSeverity = Literal["Critical", "High", "Medium", "Low", "Informational"]


class FindingLabel(BaseModel):
    finding_id: str = Field(description="The exact finding ID (F-XXXXXXXXXX) from the input")
    label: Label = Field(description="Best-fit category for this finding")
    confidence: float = Field(ge=0, le=1, description="Confidence 0.0-1.0")
    suggested_severity: SuggestedSeverity = Field(
        description="Adjusted severity given the label and brand context"
    )
    reasoning: str = Field(
        description="One concise sentence explaining the classification"
    )


class BatchOutput(BaseModel):
    classifications: list[FindingLabel]


# ============================================================================
# Prompts — kept rich so the cacheable prefix exceeds the 4096-token minimum
# ============================================================================

SYSTEM_PROMPT = """You are a senior cyber-threat intelligence analyst specialising in brand monitoring for large enterprises.

Your job is to triage automatically-detected findings about a specific brand. For each finding, decide which of the following labels best describes it:

LABELS
======

IMPERSONATION
  An unauthorized account, page, app, or domain that pretends to be the brand,
  a brand subsidiary, an executive, or a brand-affiliated person/entity.
  Includes: typosquat domains, fake support handles, lookalike profiles,
  rogue mobile apps. Severity is High or Critical.

SCAM
  Content actively defrauding customers in the brand's name. Common patterns
  for financial brands: "instant loan approval", "KYC update urgent",
  "support number 1-800-XXX", fake recovery agents, fake customer-care numbers.
  Often hosted on WhatsApp groups, Telegram channels, or rogue Play Store apps.
  Severity is High or Critical regardless of reach.

OFFICIAL
  Content the brand itself publishes — corporate film, official press release,
  the brand's verified social handle, the brand's actual mobile app, the
  brand's own subdomains. Severity is Informational.

EMPLOYEE
  Employee or ex-employee personal account mentioning the brand
  (e.g. "Software Engineer at <Brand>" on LinkedIn, employee personal Twitter
  with brand in bio). Not impersonation; benign. Severity is Informational
  unless the post leaks confidential information.

PARTNER
  Authorized distributor, reseller, channel partner, or business partner
  mentioning the brand. Severity is Informational unless they make claims
  that would mislead customers about the brand's offerings.

FAN
  Genuine customer / fan / user discussing the brand on a personal account.
  Even negative reviews fall here unless they cross into defamation.
  Severity is Informational. Useful for sentiment monitoring.

NEWS
  Press article, broadcast clip, financial-analyst report, regulatory filing,
  or industry-publication content about the brand. Severity is Informational.

SPAM
  Low-quality SEO content, clickbait, content farms, link-bait listicles
  ("Top 10 Microfinance Apps in India") that name the brand. Not malicious,
  not impersonation; just noise. Severity is Low.

IRRELEVANT
  False positive. The finding was surfaced by a keyword match but the content
  does not actually relate to the brand (e.g. word "credit" tripping a search,
  unrelated person sharing brand's name). Severity is Informational.

INDETERMINATE
  Cannot decide from the evidence given. Used when the indicator is ambiguous
  and you would need to manually visit the URL to know. Confidence < 0.5.
  Severity should preserve original.

CLASSIFICATION GUIDANCE
=======================

1. **Compare against the brand's declared official channels.** A finding
   matching a declared official handle is OFFICIAL. A finding closely
   resembling the brand but NOT in the official list is suspicious — most
   often IMPERSONATION, possibly EMPLOYEE if the person clearly identifies
   themselves as employed by the brand.

2. **Lookalike domains and typosquats are IMPERSONATION** unless they're
   secondary domains the brand has declared.

3. **Country-suffix variations matter.** "@brand.in" might be official;
   "@brand.ci" or "@brand.us" for an Indian brand is suspicious.

4. **Industry-lure vocabulary signals SCAM.** For NBFC/banking/microfinance
   brands: "loan", "instant approval", "KYC", "support number", "recovery
   agent", "customer care" combined with brand keywords usually = SCAM.

5. **Reddit / forum threads with scam-related vocabulary** are usually
   customer-victim reports (legitimate complaints) rather than impersonation
   itself. Treat them as informative — typically Low-severity unless many
   victims report the same scam template.

6. **YouTube videos titled with employee role descriptions** ("Software
   Engineer at X", "People Management at X", "Corporate Film: X") are
   typically EMPLOYEE or OFFICIAL content, not impersonation.

7. **Reach matters less than name-similarity for impersonation severity.**
   A small impersonation account is still an active threat; a large
   account with verified status that just mentions the brand is FAN/NEWS.

8. **Confidence calibration:**
   - 0.9-1.0: Indicator clearly matches a single label
   - 0.7-0.9: Most likely a single label, minor uncertainty
   - 0.5-0.7: Two plausible labels, picked the more probable
   - 0.3-0.5: Genuinely ambiguous — usually INDETERMINATE
   - <0.3: Almost no signal — INDETERMINATE

9. **Keep `reasoning` to ONE sentence.** Cite the specific signal that drove
   your decision (handle name, content keyword, follower verification, etc.).

OUTPUT
======

Return a JSON object with `classifications`: an array of objects, one per
input finding, each with `finding_id`, `label`, `confidence`,
`suggested_severity`, and `reasoning`. Process every finding in the input;
do not skip any. The `finding_id` MUST match the input exactly.
"""


def _brand_context_block(brand_config: dict[str, Any]) -> str:
    """Render brand context as a deterministic, cache-friendly block."""
    brand = brand_config.get("brand", {}) or {}
    assets = brand_config.get("assets", {}) or {}
    people = brand_config.get("people", {}) or {}
    handles = assets.get("social_handles", {}) or {}
    mobile = assets.get("mobile_apps", {}) or {}

    def _fmt_list(label: str, items: list[Any]) -> str:
        if not items:
            return f"  {label}: (none declared)"
        return f"  {label}: {', '.join(str(x) for x in items)}"

    lines = [
        "BRAND PROFILE",
        "=============",
        f"Name:            {brand.get('name', 'Unknown')}",
        f"Legal name:      {brand.get('legal_name', 'Unknown')}",
        f"Industry:        {brand.get('industry', 'Unknown')}",
        f"Headquarters:    {brand.get('headquarters', 'Unknown')}",
        f"Founded:         {brand.get('founded', 'Unknown')}",
        f"Description:     {brand.get('description', '')}",
        "",
        "DECLARED OFFICIAL ASSETS",
        "========================",
        _fmt_list("Primary domains  ", assets.get("primary_domains") or []),
        _fmt_list("Secondary domains", assets.get("secondary_domains") or []),
        _fmt_list("IP ranges        ", assets.get("ip_ranges") or []),
        _fmt_list("Brand keywords   ", assets.get("brand_keywords") or []),
        _fmt_list("Trademarks       ", assets.get("trademarks") or []),
        _fmt_list("Product names    ", assets.get("product_names") or []),
        _fmt_list("Android apps     ", mobile.get("android") or []),
        _fmt_list("iOS apps         ", mobile.get("ios") or []),
        "",
        "DECLARED OFFICIAL SOCIAL HANDLES",
        "================================",
    ]
    for platform, hs in (handles or {}).items():
        if hs:
            lines.append(_fmt_list(f"{platform:14}", hs))
    lines.append("")
    lines.append("MONITORED PEOPLE")
    lines.append("================")
    for e in (people.get("executives") or []):
        lines.append(f"  - {e.get('name','')} ({e.get('title','')}) {e.get('email','')}")
    if not (people.get("executives") or []):
        lines.append("  (none declared)")
    lines.append("")
    lines.append("CLASSIFICATION INSTRUCTIONS — APPLY THESE WHEN LABELING")
    lines.append("======================================================")
    lines.append(
        "Any finding whose indicator handle / domain / package-id appears in the "
        "DECLARED OFFICIAL ASSETS or DECLARED OFFICIAL SOCIAL HANDLES section above "
        "MUST be labeled OFFICIAL with high confidence (>= 0.9), regardless of how "
        "the detection module scored it. Use the asset list as ground truth."
    )
    lines.append("")
    return "\n".join(lines)


def _finding_to_payload(f: Finding) -> dict[str, Any]:
    """Compact, classification-relevant projection of a Finding."""
    ev = []
    for e in f.evidence[:5]:
        ev.append({"type": e.type, "label": e.label, "value": e.value})
    raw_str = ""
    if f.raw:
        try:
            raw_str = json.dumps(f.raw, default=str)[:1500]
        except Exception:
            raw_str = str(f.raw)[:1500]
    return {
        "finding_id": f.id,
        "title": f.title,
        "category": f.category,
        "module": f.module,
        "indicator": f.indicator,
        "affected_asset": f.affected_asset,
        "current_severity": f.severity.value,
        "description": f.description[:1200],
        "evidence_samples": ev,
        "raw_excerpt": raw_str,
    }


def _apply_label_to_finding(f: Finding, label: FindingLabel) -> None:
    """Mutate the Finding to incorporate AI triage results."""
    new_sev = Severity(label.suggested_severity)
    f.raw["ai_triage"] = {
        "label": label.label,
        "confidence": label.confidence,
        "reasoning": label.reasoning,
        "original_severity": f.severity.value,
    }
    # Severity update only when confidence is high enough.
    if label.confidence >= 0.6:
        f.severity = new_sev
        f.title = f"[{label.label}] {f.title}"


# ============================================================================
# The engine
# ============================================================================

class AITriageEngine:
    def __init__(
        self,
        brand_config: dict[str, Any],
        model: str = "claude-opus-4-7",
        batch_size: int = 20,
        max_findings: int = 200,
        concurrency: int = 3,
    ):
        if not KEYS.anthropic:
            raise RuntimeError("ANTHROPIC_API_KEY not configured")
        self.brand = brand_config
        self.model = model
        self.batch_size = batch_size
        self.max_findings = max_findings
        self.sem = asyncio.Semaphore(concurrency)
        self.client = anthropic.AsyncAnthropic(api_key=KEYS.anthropic)
        self.brand_context = _brand_context_block(brand_config)
        self.usage = {"cache_creation": 0, "cache_read": 0, "input": 0, "output": 0, "batches": 0}

    def _select_findings(self, findings: list[Finding]) -> list[Finding]:
        """Prioritise: Critical / High first, then Medium, then Low, capped at max_findings."""
        ordered = sorted(findings, key=lambda f: (f.severity.order, -f.risk_score))
        return ordered[: self.max_findings]

    async def classify(self, findings: list[Finding]) -> dict[str, Any]:
        """Classify findings in-place. Returns usage statistics."""
        targets = self._select_findings(findings)
        if not targets:
            return self.usage

        log.info(f"AI triage: classifying {len(targets)} of {len(findings)} findings via {self.model}")

        # Slice into batches and dispatch concurrently
        batches = [targets[i : i + self.batch_size] for i in range(0, len(targets), self.batch_size)]
        results = await asyncio.gather(*(self._classify_batch(b) for b in batches), return_exceptions=True)

        # Apply labels back to findings
        labels_by_id: dict[str, FindingLabel] = {}
        for batch_result in results:
            if isinstance(batch_result, BatchOutput):
                for c in batch_result.classifications:
                    labels_by_id[c.finding_id] = c
            elif isinstance(batch_result, Exception):
                log.warning(f"AI triage batch failed: {batch_result}")

        applied = 0
        for f in findings:
            if f.id in labels_by_id:
                _apply_label_to_finding(f, labels_by_id[f.id])
                applied += 1

        log.info(
            f"AI triage: applied {applied} labels. "
            f"Cache hits: {self.usage['cache_read']}/{self.usage['cache_read']+self.usage['cache_creation']} tokens. "
            f"Total: {self.usage['input']} in / {self.usage['output']} out."
        )
        return self.usage

    async def _classify_batch(self, batch: list[Finding]) -> BatchOutput | None:
        async with self.sem:
            payload = [_finding_to_payload(f) for f in batch]
            user_msg = (
                "Classify each of the following findings. Return a `classifications` "
                f"array with exactly {len(payload)} entries — one per finding, matched "
                "by `finding_id`.\n\nFINDINGS:\n```json\n"
                + json.dumps(payload, indent=2, default=str)
                + "\n```"
            )

            try:
                # Caching: stable system prompt + brand context. Both blocks are
                # cached; the per-batch user message is the only varying input.
                # Use messages.create + tool use rather than parse to control
                # cache_control and thinking together.
                response = await self.client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    system=[
                        {"type": "text", "text": SYSTEM_PROMPT},
                        {"type": "text", "text": self.brand_context, "cache_control": {"type": "ephemeral"}},
                    ],
                    tools=[{
                        "name": "submit_classifications",
                        "description": "Submit the classification results for the batch of findings.",
                        "input_schema": BatchOutput.model_json_schema(),
                    }],
                    tool_choice={"type": "tool", "name": "submit_classifications"},
                    messages=[{"role": "user", "content": user_msg}],
                )
            except anthropic.APIError as e:
                log.warning(f"AI triage API error: {e}")
                return None

            # Track usage
            u = response.usage
            self.usage["batches"] += 1
            self.usage["input"] += getattr(u, "input_tokens", 0) or 0
            self.usage["output"] += getattr(u, "output_tokens", 0) or 0
            self.usage["cache_creation"] += getattr(u, "cache_creation_input_tokens", 0) or 0
            self.usage["cache_read"] += getattr(u, "cache_read_input_tokens", 0) or 0

            # Extract tool-use block
            for block in response.content:
                if getattr(block, "type", None) == "tool_use" and block.name == "submit_classifications":
                    try:
                        return BatchOutput.model_validate(block.input)
                    except ValidationError as e:
                        log.warning(f"AI triage validation failed: {e}")
                        return None
            return None
