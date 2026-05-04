"""Map findings to compliance frameworks (ISO27001, NIST CSF, PCI DSS, SOC2, GDPR, DPDP, HIPAA, RBI)."""
from __future__ import annotations

from typing import Iterable

from core.evidence import Finding

# Category -> framework -> control IDs
MAP: dict[str, dict[str, list[str]]] = {
    "domain_abuse": {
        "ISO27001":  ["A.5.7 Threat intelligence", "A.5.20 Supplier agreements"],
        "NIST_CSF":  ["DE.CM-1", "DE.CM-7", "ID.RA-2"],
        "PCI_DSS":   ["12.10.5"],
        "SOC2":      ["CC7.1", "CC7.2"],
        "GDPR":      ["Art. 32"],
        "DPDP_ACT":  ["Sec. 8(5)"],
        "RBI_CYBER_RESILIENCE": ["Annex 1.10 Brand abuse / phishing"],
    },
    "phishing": {
        "ISO27001":  ["A.5.7", "A.6.3", "A.8.7"],
        "NIST_CSF":  ["DE.CM-4", "PR.AT-1", "RS.AN-2"],
        "PCI_DSS":   ["12.6.1"],
        "SOC2":      ["CC7.2", "CC7.3"],
        "GDPR":      ["Art. 32"],
        "RBI_CYBER_RESILIENCE": ["Annex 1.10"],
    },
    "infra_exposure": {
        "ISO27001":  ["A.8.20", "A.8.21", "A.8.22"],
        "NIST_CSF":  ["PR.AC-5", "PR.PT-4", "DE.CM-1"],
        "PCI_DSS":   ["1.2", "1.3", "11.4"],
        "SOC2":      ["CC6.6", "CC7.1"],
        "GDPR":      ["Art. 32"],
        "DPDP_ACT":  ["Sec. 8(5)"],
    },
    "social_impersonation": {
        "ISO27001":  ["A.5.7"],
        "NIST_CSF":  ["DE.CM-1", "DE.AE-2"],
        "RBI_CYBER_RESILIENCE": ["Annex 1.10"],
    },
    "exec_impersonation": {
        "ISO27001":  ["A.6.3"],
        "NIST_CSF":  ["PR.AT-1", "DE.CM-1"],
    },
    "credential_leak": {
        "ISO27001":  ["A.5.17", "A.8.5", "A.8.10"],
        "NIST_CSF":  ["PR.AC-1", "PR.AC-7", "RS.MI-1"],
        "PCI_DSS":   ["8.3", "8.4"],
        "SOC2":      ["CC6.1", "CC6.6"],
        "GDPR":      ["Art. 32(1)(b)", "Art. 33"],
        "DPDP_ACT":  ["Sec. 8(6)"],
        "HIPAA":     ["§164.308(a)(5)"],
        "RBI_CYBER_RESILIENCE": ["Annex 1.5"],
    },
    "code_leak": {
        "ISO27001":  ["A.8.4", "A.8.10"],
        "NIST_CSF":  ["PR.IP-1", "PR.DS-5"],
        "SOC2":      ["CC6.7"],
        "GDPR":      ["Art. 32"],
    },
    "darkweb_exposure": {
        "ISO27001":  ["A.5.7"],
        "NIST_CSF":  ["DE.CM-1", "RS.MI-2"],
        "RBI_CYBER_RESILIENCE": ["Annex 1.10"],
    },
    "ransomware_mention": {
        "ISO27001":  ["A.5.24 Incident management", "A.5.29 BCP"],
        "NIST_CSF":  ["RS.RP-1", "RS.CO-2", "RC.RP-1"],
        "PCI_DSS":   ["12.10"],
        "SOC2":      ["CC7.4", "CC7.5"],
        "GDPR":      ["Art. 33", "Art. 34"],
        "DPDP_ACT":  ["Sec. 8(6)"],
        "HIPAA":     ["§164.308(a)(6)"],
    },
    "mobile_app_abuse": {
        "ISO27001":  ["A.5.7"],
        "NIST_CSF":  ["DE.CM-1"],
    },
    "counterfeit_listing": {
        "ISO27001":  ["A.5.7"],
        "NIST_CSF":  ["DE.CM-1"],
    },
    "logo_misuse": {
        "ISO27001":  ["A.5.7"],
    },
    "ad_fraud": {
        "ISO27001":  ["A.5.7"],
        "NIST_CSF":  ["DE.CM-1", "DE.CM-7"],
    },
    "deepfake_media": {
        "ISO27001":  ["A.5.7"],
        "NIST_CSF":  ["DE.CM-7"],
    },
    "vulnerability": {
        "ISO27001":  ["A.8.8", "A.8.9", "A.8.29"],
        "NIST_CSF":  ["ID.RA-1", "PR.IP-12", "DE.CM-8"],
        "PCI_DSS":   ["6.3", "11.3"],
        "SOC2":      ["CC7.1"],
        "GDPR":      ["Art. 32"],
    },
    "tls_misconfig": {
        "ISO27001":  ["A.8.24"],
        "NIST_CSF":  ["PR.DS-2"],
        "PCI_DSS":   ["4.1", "4.2"],
        "SOC2":      ["CC6.7"],
    },
    "misc": {},
}


def tag_finding(finding: Finding, frameworks: Iterable[str]) -> None:
    fw_set = {f for f in frameworks}
    cat_map = MAP.get(finding.category, {})
    tags: list[str] = []
    for fw, controls in cat_map.items():
        if fw in fw_set:
            for c in controls:
                tags.append(f"{fw}: {c}")
    finding.compliance_tags = tags
