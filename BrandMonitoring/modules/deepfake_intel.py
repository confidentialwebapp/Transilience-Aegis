"""Deepfake / synthetic media abuse — placeholder for image/video samples.

This module is enabled only when the brand config provides sample image hashes
or YouTube/IG handles to monitor. A full deepfake detector requires per-asset
ML inference (out of scope of OSINT-only); we surface metadata for manual review.
"""
from __future__ import annotations

from core.base_module import DetectionModule
from core.evidence import Finding


class DeepfakeIntelModule(DetectionModule):
    name = "deepfake_intel"
    category = "deepfake_media"
    description = "Synthetic media / deepfake content monitoring (manual-review surface)."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        # Placeholder: in production, integrate Sensity, Reality Defender, or Deepware Scanner APIs
        # and reverse-image search via Apify/Bing.
        execs = (self.brand.get("people") or {}).get("executives") or []
        if execs:
            findings.append(Finding.build(
                title="Deepfake monitoring posture",
                category="deepfake_media",
                module=self.name,
                affected_asset=self.brand.get("brand", {}).get("name", "Brand"),
                likelihood=2, impact=4,
                description=(
                    "Deepfake detection requires reference imagery / voice samples for each VIP. "
                    "Provide assets in config to enable Sensity / Reality Defender integration."
                ),
                recommendation="Submit reference voice and face samples per executive to a deepfake monitoring vendor. Educate customers on verification channels.",
                remediation_priority="long_term",
            ))
        return findings
