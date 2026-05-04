"""Executive / employee email exposure: HIBP breaches + Holehe service discovery."""
from __future__ import annotations

import asyncio
from typing import Any

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from integrations import hibp_client, holehe_runner


class EmailExposureModule(DetectionModule):
    name = "email_exposure"
    category = "credential_leak"
    description = "Breach exposure for executives, employees, and the corporate domain."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        execs: list[dict[str, Any]] = (self.brand.get("people") or {}).get("executives") or []
        primary_domains: list[str] = (self.brand.get("assets") or {}).get("primary_domains") or []
        support: list[str] = (self.brand.get("people") or {}).get("support_handles") or []
        emails: list[str] = []
        for e in execs:
            if e.get("email"):
                emails.append(e["email"])
        emails.extend([s for s in support if "@" in s])

        # 1. HIBP per email
        if self.cfg.get("use_hibp", True):
            tasks = [hibp_client.breaches_for_account(e) for e in emails]
            for email, breaches in zip(emails, await asyncio.gather(*tasks, return_exceptions=True)):
                if not isinstance(breaches, list) or not breaches:
                    continue
                self.store.save_raw(self.name, f"hibp_{email}", breaches)
                names = [b.get("Name") for b in breaches]
                pwd_classes = sorted({c for b in breaches for c in (b.get("DataClasses") or []) if c.lower() == "passwords"})
                impact = 5 if pwd_classes else 4
                findings.append(Finding.build(
                    title=f"{email} appears in {len(breaches)} breach(es)",
                    category="credential_leak",
                    module=self.name,
                    affected_asset=email,
                    indicator=email,
                    likelihood=4, impact=impact,
                    description=f"Breaches: {', '.join(names[:8])}{'…' if len(names) > 8 else ''}",
                    recommendation="Force password reset; rotate any reused passwords; enroll in MFA; subscribe to HIBP domain monitoring.",
                    remediation_priority="immediate" if pwd_classes else "short_term",
                    evidence=[Evidence(type="url", label="HIBP", value=f"https://haveibeenpwned.com/account/{email}")],
                    raw={"breaches": breaches},
                ))

        # 2. HIBP per domain (all corporate accounts)
        for d in primary_domains:
            r = await hibp_client.all_breaches(domain=d)
            if r:
                self.store.save_raw(self.name, f"hibp_domain_{d}", r)
                findings.append(Finding.build(
                    title=f"Corporate domain {d} has {len(r)} associated breaches",
                    category="credential_leak",
                    module=self.name,
                    affected_asset=d,
                    indicator=d,
                    likelihood=3, impact=4,
                    description="Public breaches reference accounts on this domain. Enable HIBP enterprise monitoring for live alerts.",
                    recommendation="Enable HIBP domain monitoring (free for verified domain owners). Force resets on flagged users.",
                    remediation_priority="short_term",
                    evidence=[Evidence(type="url", label="HIBP", value="https://haveibeenpwned.com/DomainSearch")],
                ))

        # 3. Holehe per email
        if self.cfg.get("use_holehe", True) and holehe_runner.is_available():
            tasks = [holehe_runner.find_email(e) for e in emails]
            for email, hits in zip(emails, await asyncio.gather(*tasks, return_exceptions=True)):
                if isinstance(hits, list) and hits:
                    self.store.save_raw(self.name, f"holehe_{email}", hits)
                    services = sorted({h.get("service") for h in hits if h.get("service")})
                    findings.append(Finding.build(
                        title=f"{email} registered on {len(services)} services (Holehe)",
                        category="credential_leak",
                        module=self.name,
                        affected_asset=email,
                        indicator=email,
                        likelihood=2, impact=2,
                        description=f"Discovered services: {', '.join(services[:15])}{'…' if len(services)>15 else ''}",
                        recommendation="Inventory exec personal-service exposure; encourage MFA on all listed services.",
                        remediation_priority="long_term",
                    ))
        elif self.cfg.get("use_holehe", True) and not holehe_runner.is_available():
            self.log.info("holehe CLI not installed — skipping (pip install holehe)")
        return findings
