"""Severity scoring for brand-monitoring findings.

Brand findings don't fit cleanly into CVSS — we use a hybrid:
  Likelihood (1-5) x Impact (1-5) -> Risk score (1-25)

Plus a categorical severity for executive reporting.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Severity(str, Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"
    INFO = "Informational"

    @property
    def color(self) -> str:
        return {
            Severity.CRITICAL: "#7c1d1d",
            Severity.HIGH: "#c0392b",
            Severity.MEDIUM: "#e67e22",
            Severity.LOW: "#f1c40f",
            Severity.INFO: "#3498db",
        }[self]

    @property
    def order(self) -> int:
        return {
            Severity.CRITICAL: 0,
            Severity.HIGH: 1,
            Severity.MEDIUM: 2,
            Severity.LOW: 3,
            Severity.INFO: 4,
        }[self]


@dataclass(frozen=True)
class RiskScore:
    likelihood: int  # 1-5
    impact: int      # 1-5

    @property
    def score(self) -> int:
        return max(1, min(self.likelihood, 5)) * max(1, min(self.impact, 5))

    @property
    def severity(self) -> Severity:
        s = self.score
        if s >= 20:
            return Severity.CRITICAL
        if s >= 12:
            return Severity.HIGH
        if s >= 6:
            return Severity.MEDIUM
        if s >= 3:
            return Severity.LOW
        return Severity.INFO


def cvss_to_severity(cvss: float | None) -> Severity:
    if cvss is None:
        return Severity.INFO
    if cvss >= 9.0:
        return Severity.CRITICAL
    if cvss >= 7.0:
        return Severity.HIGH
    if cvss >= 4.0:
        return Severity.MEDIUM
    if cvss > 0:
        return Severity.LOW
    return Severity.INFO
