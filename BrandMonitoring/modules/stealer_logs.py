"""Infostealer log exposure (DRP).

Two complementary backends:
  1. Hudson Rock free count-only API — given a corporate domain or executive
     email, returns the count of bot infections present in their corpus
     (RedLine, Vidar, Raccoon, Lumma, StealC, etc.). No API key required.
  2. IntelX brand-keyword stealer-log search — paid, hits stealer-log dumps
     IntelX has indexed (RussianMarket, Genesis successors, etc.).
"""
from __future__ import annotations

import asyncio
from typing import Any

import httpx

from core.base_module import DetectionModule
from core.evidence import Finding
from integrations import intelx_client


HR_DOMAIN_URL = "https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-domain"
HR_EMAIL_URL = "https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-email"


async def _hudson_rock_domain(domain: str) -> dict[str, Any] | None:
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(HR_DOMAIN_URL, params={"domain": domain})
            if r.status_code == 200:
                return r.json()
    except Exception:
        return None
    return None


async def _hudson_rock_email(email: str) -> dict[str, Any] | None:
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(HR_EMAIL_URL, params={"email": email})
            if r.status_code == 200:
                return r.json()
    except Exception:
        return None
    return None


class StealerLogsModule(DetectionModule):
    name = "stealer_logs"
    category = "credential_leak"
    description = "Infostealer-log exposure via Hudson Rock count API + IntelX stealer-log search."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        primary = (self.brand.get("assets") or {}).get("primary_domains") or []
        execs = (self.brand.get("people") or {}).get("executives") or []

        # Domain-level Hudson Rock
        for d in primary:
            data = await _hudson_rock_domain(d)
            if not isinstance(data, dict):
                continue
            emp = (data.get("total") or {}).get("employees", 0) or data.get("employees_count", 0) or 0
            cust = (data.get("total") or {}).get("users", 0) or data.get("users_count", 0) or 0
            if emp == 0 and cust == 0:
                continue
            sev_l = 5 if emp >= 5 else 4
            findings.append(Finding.build(
                title=f"[STEALER] {d} appears in stealer-log corpus ({emp} employees, {cust} customers)",
                category="credential_leak",
                module=self.name,
                affected_asset=d,
                indicator=d,
                description=f"Hudson Rock reports {emp} employee and {cust} customer infostealer-log records mentioning {d}. Each record contains plaintext credentials, browser cookies, autofill data, and crypto-wallet artifacts harvested from a compromised endpoint.",
                likelihood=sev_l, impact=5,
                recommendation="Force password reset for impacted users. Hunt for session-cookie reuse on inbound traffic. Engage IR to identify the compromised endpoints if customers are involved.",
                remediation_priority="immediate",
                references=["https://www.hudsonrock.com/free-tools"],
                raw={"hudson_rock": {k: v for k, v in data.items() if k in ("total", "employees_count", "users_count", "third_parties_count")}},
            ))

        # Per-executive Hudson Rock
        for exe in execs:
            email = (exe or {}).get("email")
            if not email:
                continue
            data = await _hudson_rock_email(email)
            if not isinstance(data, dict):
                continue
            count = data.get("total", {}).get("count", 0) if isinstance(data.get("total"), dict) else (data.get("count") or 0)
            if count == 0:
                continue
            findings.append(Finding.build(
                title=f"[STEALER-EXEC] {email} compromised in stealer-log corpus ({count} record(s))",
                category="credential_leak",
                module=self.name,
                affected_asset=email,
                indicator=email,
                description=f"Hudson Rock reports {count} stealer-log record(s) for {email}. The executive's endpoint was infected at some point — assume credentials, MFA seeds, and session cookies are compromised.",
                likelihood=5, impact=5,
                recommendation="Re-image the executive's endpoint. Force MFA re-enrolment, revoke all sessions, rotate API keys, and engage IR.",
                remediation_priority="immediate",
                references=["https://www.hudsonrock.com/free-tools"],
                raw={"email": email, "records": count},
            ))

        # IntelX stealer-log brand keyword search (paid)
        keywords = (self.brand.get("assets") or {}).get("brand_keywords") or []
        cap = int(self.cfg.get("intelx_max_per_keyword", 10))
        for kw in keywords:
            try:
                rows = await intelx_client.search(f'"{kw}" stealer', max_results=cap, buckets=["leaks.private", "leaks.public", "darknet.tor"])
            except Exception:
                rows = []
            for r in rows or []:
                url = r.get("name") or r.get("systemid") or ""
                snippet = (r.get("metadata") or "")[:300]
                lower = (snippet + " " + url).lower()
                if not any(s in lower for s in ("stealer", "redline", "vidar", "raccoon", "lumma", "stealc", "russianmarket")):
                    continue
                findings.append(Finding.build(
                    title=f"[STEALER-CORPUS] '{kw}' mentioned in stealer-log dataset",
                    category="credential_leak",
                    module=self.name,
                    affected_asset=kw,
                    indicator=url or None,
                    description=f"IntelX result references '{kw}' alongside stealer-log keywords. Snippet: {snippet}",
                    likelihood=4, impact=5,
                    raw={"source": "intelx"},
                ))
        return findings
