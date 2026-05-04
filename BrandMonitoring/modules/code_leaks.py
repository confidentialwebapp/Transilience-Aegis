"""Code & secret leaks: GitHub code search for brand-related secrets / source."""
from __future__ import annotations

import re
from typing import Any

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from integrations import github_client

SECRET_PATTERNS = [
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS Access Key"),
    (re.compile(r"AIza[0-9A-Za-z\-_]{35}"), "Google API key"),
    (re.compile(r"sk_live_[0-9a-zA-Z]{24,}"), "Stripe live key"),
    (re.compile(r"xox[baprs]-[0-9a-zA-Z\-]{10,}"), "Slack token"),
    (re.compile(r"-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"), "Private key"),
    (re.compile(r"ghp_[A-Za-z0-9]{36,}"), "GitHub personal access token"),
    (re.compile(r"glpat-[A-Za-z0-9_\-]{20,}"), "GitLab personal access token"),
]


class CodeLeaksModule(DetectionModule):
    name = "code_leaks"
    category = "code_leak"
    description = "GitHub code search for brand-related secrets / source code."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        if not self.cfg.get("github_search", True):
            return findings
        brand = self.brand.get("brand", {}).get("name", "")
        domains = (self.brand.get("assets") or {}).get("primary_domains") or []
        keywords = (self.brand.get("assets") or {}).get("brand_keywords") or []

        queries = []
        for d in domains:
            queries += [
                f'"{d}" password',
                f'"{d}" secret',
                f'"{d}" api_key',
                f'"@{d}" smtp',
            ]
        for k in keywords:
            queries.append(f'"{k}" credentials')

        seen_repos: set[str] = set()

        for q in queries[:24]:
            items = await github_client.code_search(q, per_page=20)
            self.store.save_raw(self.name, f"gh_{abs(hash(q)) % 100000}", {"q": q, "items": items})
            for it in items:
                repo_full = (it.get("repository") or {}).get("full_name")
                path = it.get("path")
                html_url = it.get("html_url")
                if not html_url:
                    continue
                key = f"{repo_full}:{path}"
                if key in seen_repos:
                    continue
                seen_repos.add(key)

                # Try to fetch the raw snippet to detect actual secrets
                detected: list[str] = []
                text_match = (it.get("text_matches") or [])
                blob = " ".join(t.get("fragment", "") for t in text_match)
                for pat, label in SECRET_PATTERNS:
                    if pat.search(blob):
                        detected.append(label)

                if detected:
                    findings.append(Finding.build(
                        title=f"Potential secret leak in {repo_full}:{path}",
                        category="code_leak",
                        module=self.name,
                        affected_asset=brand,
                        indicator=html_url,
                        likelihood=4, impact=5,
                        description=f"GitHub code search query '{q}' surfaced potential {', '.join(detected)} in {repo_full}.",
                        recommendation="Validate; if confirmed, rotate the secret immediately; request GitHub secret-scanning push protection; file DMCA / private removal if internal source.",
                        remediation_priority="immediate",
                        cwe="CWE-798",
                        owasp="A07:2021 - Identification and Authentication Failures",
                        mitre_attack=["T1552.001", "T1078"],
                        evidence=[Evidence(type="url", label="GitHub file", value=html_url)],
                        raw={"query": q, "fragment": blob[:500]},
                    ))
                else:
                    findings.append(Finding.build(
                        title=f"Brand reference in public repo {repo_full}:{path}",
                        category="code_leak",
                        module=self.name,
                        affected_asset=brand,
                        indicator=html_url,
                        likelihood=2, impact=2,
                        description=f"Public file mentions brand-related term '{q}'. Manual review recommended.",
                        recommendation="Review for confidential information leakage; engage repo owner if necessary.",
                        remediation_priority="long_term",
                        evidence=[Evidence(type="url", label="GitHub file", value=html_url)],
                        raw={"query": q},
                    ))
        return findings
