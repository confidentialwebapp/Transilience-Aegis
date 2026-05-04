"""Evidence model — every finding produced by every module is a Finding."""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field

from .severity import RiskScore, Severity


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _uid(prefix: str = "F") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10].upper()}"


# Categories align with the "60+ detection categories" requested by the user
# but collapsed onto a manageable taxonomy.
Category = Literal[
    "domain_abuse",
    "phishing",
    "infra_exposure",
    "social_impersonation",
    "exec_impersonation",
    "credential_leak",
    "code_leak",
    "darkweb_exposure",
    "ransomware_mention",
    "mobile_app_abuse",
    "counterfeit_listing",
    "logo_misuse",
    "ad_fraud",
    "deepfake_media",
    "vulnerability",
    "tls_misconfig",
    "misc",
]


class Evidence(BaseModel):
    """A single piece of evidence attached to a finding."""

    type: Literal["url", "screenshot", "json", "text", "file", "dns", "whois", "cert"]
    label: str
    value: str | None = None        # url / text content / DNS record / etc.
    file_path: str | None = None    # path on disk (for screenshots, json blobs)
    hash_sha256: str | None = None
    captured_at: str = Field(default_factory=_utcnow)


class Finding(BaseModel):
    """One detection result."""

    id: str = Field(default_factory=_uid)
    title: str
    category: Category
    module: str
    severity: Severity
    risk_score: int = 0           # 1-25 (likelihood x impact)
    likelihood: int = 1
    impact: int = 1

    description: str
    affected_asset: str           # e.g. "example.com" or "Jane Doe (CEO)"
    indicator: str | None = None  # the rogue URL / handle / hash / domain
    discovered_at: str = Field(default_factory=_utcnow)

    # Optional pentest / vulnerability data
    cvss: float | None = None
    cvss_vector: str | None = None
    cwe: str | None = None
    owasp: str | None = None
    mitre_attack: list[str] = Field(default_factory=list)
    references: list[str] = Field(default_factory=list)

    # Remediation
    recommendation: str = ""
    remediation_priority: Literal["immediate", "short_term", "long_term"] = "short_term"

    # Evidence
    evidence: list[Evidence] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)

    # Compliance mapping (filled by reporting/compliance.py)
    compliance_tags: list[str] = Field(default_factory=list)

    @classmethod
    def build(
        cls,
        *,
        title: str,
        category: Category,
        module: str,
        affected_asset: str,
        likelihood: int = 3,
        impact: int = 3,
        **kwargs: Any,
    ) -> "Finding":
        rs = RiskScore(likelihood=likelihood, impact=impact)
        return cls(
            title=title,
            category=category,
            module=module,
            affected_asset=affected_asset,
            severity=rs.severity,
            risk_score=rs.score,
            likelihood=likelihood,
            impact=impact,
            **kwargs,
        )


class ModuleResult(BaseModel):
    module: str
    started_at: str = Field(default_factory=_utcnow)
    finished_at: str | None = None
    status: Literal["ok", "partial", "error", "skipped"] = "ok"
    error: str | None = None
    findings: list[Finding] = Field(default_factory=list)
    stats: dict[str, Any] = Field(default_factory=dict)


class ScanReport(BaseModel):
    scan_id: str
    brand_name: str
    started_at: str = Field(default_factory=_utcnow)
    finished_at: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    module_results: list[ModuleResult] = Field(default_factory=list)

    @property
    def all_findings(self) -> list[Finding]:
        out: list[Finding] = []
        for m in self.module_results:
            out.extend(m.findings)
        return out

    def by_severity(self) -> dict[str, int]:
        counts = {s.value: 0 for s in Severity}
        for f in self.all_findings:
            counts[f.severity.value] += 1
        return counts


class EvidenceStore:
    """Persists raw evidence (JSON / screenshots) to disk per scan."""

    def __init__(self, scan_dir: Path):
        self.scan_dir = Path(scan_dir)
        self.findings_dir = self.scan_dir / "findings"
        self.evidence_dir = self.scan_dir / "evidence"
        self.findings_dir.mkdir(parents=True, exist_ok=True)
        self.evidence_dir.mkdir(parents=True, exist_ok=True)

    def save_raw(self, module: str, name: str, data: dict[str, Any] | list[Any]) -> Path:
        d = self.evidence_dir / module
        d.mkdir(parents=True, exist_ok=True)
        path = d / f"{name}.json"
        path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
        return path

    def save_bytes(self, module: str, name: str, blob: bytes) -> Path:
        d = self.evidence_dir / module
        d.mkdir(parents=True, exist_ok=True)
        path = d / name
        path.write_bytes(blob)
        return path

    def save_finding(self, finding: Finding) -> Path:
        path = self.findings_dir / f"{finding.id}.json"
        path.write_text(finding.model_dump_json(indent=2), encoding="utf-8")
        return path

    def save_report(self, report: ScanReport) -> Path:
        path = self.scan_dir / "scan_report.json"
        path.write_text(report.model_dump_json(indent=2), encoding="utf-8")
        return path

    @staticmethod
    def hash_bytes(b: bytes) -> str:
        return hashlib.sha256(b).hexdigest()
