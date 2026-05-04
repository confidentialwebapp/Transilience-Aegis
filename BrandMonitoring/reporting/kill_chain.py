"""Build a plausible attack-narrative chaining the most severe findings."""
from __future__ import annotations

from core.evidence import Finding
from core.severity import Severity

CATEGORY_PHASES = {
    "code_leak":            "Reconnaissance / Initial Access (leaked credentials)",
    "credential_leak":      "Reconnaissance / Initial Access (breached creds)",
    "darkweb_exposure":     "Reconnaissance (intel sourced from underground)",
    "ransomware_mention":   "Impact (existing victimisation)",
    "domain_abuse":         "Resource Development (lookalike domain)",
    "phishing":             "Initial Access (phishing delivery)",
    "social_impersonation": "Initial Access (social engineering)",
    "exec_impersonation":   "Initial Access (BEC / pretexting)",
    "infra_exposure":       "Initial Access / Lateral Movement (exposed services)",
    "vulnerability":        "Initial Access / Privilege Escalation",
    "tls_misconfig":        "Defence Evasion (downgraded transport)",
    "mobile_app_abuse":     "Initial Access (rogue mobile install)",
    "counterfeit_listing":  "Impact (revenue / reputation loss)",
    "ad_fraud":             "Initial Access (malicious ad delivery)",
    "deepfake_media":       "Defence Evasion (synthetic media abuse)",
}


def build_narrative(findings: list[Finding]) -> str:
    if not findings:
        return "No findings to construct a narrative from."

    sevs = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM]
    relevant = [f for f in findings if f.severity in sevs]
    if not relevant:
        relevant = findings

    # Order: recon -> resource dev -> initial access -> impact
    order = ["code_leak", "credential_leak", "darkweb_exposure", "domain_abuse",
             "phishing", "social_impersonation", "exec_impersonation",
             "infra_exposure", "vulnerability", "tls_misconfig",
             "mobile_app_abuse", "ad_fraud", "ransomware_mention",
             "counterfeit_listing", "deepfake_media"]
    relevant_sorted = sorted(relevant, key=lambda f: (order.index(f.category) if f.category in order else 999, -f.risk_score))

    paragraphs = ["**Composite attack narrative — derived from observed findings:**"]
    chosen = []
    seen_cats: set[str] = set()
    for f in relevant_sorted:
        if f.category in seen_cats:
            continue
        seen_cats.add(f.category)
        chosen.append(f)
        if len(chosen) >= 6:
            break

    if not chosen:
        return "Findings are mostly informational — no plausible kill chain to construct."

    paragraphs.append(
        "An attacker enumerating the brand's exposed surface could chain the following observed weaknesses:"
    )
    for i, f in enumerate(chosen, 1):
        phase = CATEGORY_PHASES.get(f.category, "Unknown phase")
        paragraphs.append(
            f"{i}. **{phase}** — {f.title} ({f.severity.value}). {f.description.split('.')[0]}."
        )

    paragraphs.append(
        "**Net effect:** the chain enables credential theft → unauthorized access to "
        "customer / employee data → ransomware deployment or financial fraud. "
        "Disrupting any single link materially raises the attacker's cost."
    )

    return "\n\n".join(paragraphs)
