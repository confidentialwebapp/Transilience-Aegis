"""Phishing infrastructure detection.

Sources:
  - URLScan + IPQS + VirusTotal (existing)
  - PhishTank, OpenPhish, URLhaus, ThreatFox (new — daily-refreshed open feeds)
  - crt.sh recent certs matching brand + scam-lure keywords
"""
from __future__ import annotations

import asyncio
from typing import Any

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from core.lures import expand_keywords
from integrations import crtsh_client, ipqs_client, phish_feeds, urlscan_client, virustotal_client


class PhishingIntelModule(DetectionModule):
    name = "phishing_intel"
    category = "phishing"
    description = "Active phishing URLs (URLScan/VT/IPQS) + open feeds (PhishTank/OpenPhish/URLhaus/ThreatFox)."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        keywords: list[str] = list((self.brand.get("assets") or {}).get("brand_keywords") or [])
        primary = list((self.brand.get("assets") or {}).get("primary_domains") or [])
        industry = (self.brand.get("brand") or {}).get("industry")

        base_terms = list({*keywords, *(p.split(".")[0] for p in primary)})
        # Industry-lure expansion (e.g. "creditaccess loan", "creditaccess kyc")
        expanded_terms = expand_keywords(base_terms, industry, max_combinations=30)

        # 1. URLScan hunt for each base term (no per-lure to keep cost down)
        for term in base_terms[:8]:
            findings.extend(await self._urlscan_hunt(term))

        # 2. Open feeds (PhishTank / OpenPhish / URLhaus / ThreatFox)
        findings.extend(await self._open_feeds(base_terms))

        # 3. VirusTotal passive intel on each owned domain
        for d in primary:
            findings.extend(await self._vt_passive_dns(d))

        # 4. crt.sh recent certs containing brand + lure (e.g. "creditaccess-loan*")
        findings.extend(await self._crtsh_lures(base_terms, expanded_terms, primary))

        return findings

    async def _urlscan_hunt(self, term: str) -> list[Finding]:
        out: list[Finding] = []
        # Broader query (no malicious-only filter); we score with IPQS afterward
        q = f'page.url:"{term}" OR domain:"{term}"'
        r = await urlscan_client.search(q, size=30)
        if not isinstance(r, dict):
            return out
        self.store.save_raw(self.name, f"urlscan_{term}", r)
        seen_urls: set[str] = set()
        for hit in (r.get("results") or [])[:30]:
            page = hit.get("page") or {}
            task = hit.get("task") or {}
            verdicts = hit.get("verdicts") or {}
            url = page.get("url") or task.get("url")
            uuid = hit.get("_id")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            screenshot = f"https://urlscan.io/screenshots/{uuid}.png" if uuid else None

            mal_verdict = bool(verdicts.get("overall", {}).get("malicious"))
            ipqs = await ipqs_client.url_check(url)
            risk = (ipqs or {}).get("risk_score", 0)
            phishing = (ipqs or {}).get("phishing")
            malware = (ipqs or {}).get("malware")

            # Only report if at least one signal is positive — otherwise it's just noise
            if not (mal_verdict or phishing or malware or risk >= 70):
                continue

            likelihood = 5 if (mal_verdict and (phishing or malware)) else 4 if phishing or malware else 3
            impact = 4

            ev = [
                Evidence(type="url", label="Phishing URL", value=url),
                Evidence(type="url", label="URLScan result", value=hit.get("result")),
            ]
            if screenshot:
                ev.append(Evidence(type="screenshot", label="Page screenshot", value=screenshot))

            out.append(Finding.build(
                title=f"Phishing page targeting brand: {url[:80]}",
                category="phishing",
                module=self.name,
                affected_asset=term,
                indicator=url,
                likelihood=likelihood,
                impact=impact,
                description=(
                    f"URLScan + IPQS flagged a phishing page referencing '{term}'. "
                    f"IPQS risk={risk}, phishing={phishing}, malware={malware}. "
                    f"URLScan verdict malicious={mal_verdict}."
                ),
                recommendation=(
                    "Submit takedown request to hosting provider and registrar. "
                    "Report to Google Safe Browsing, APWG, PhishTank. "
                    "Push IOCs to internal SOC and customer-facing security alerts."
                ),
                remediation_priority="immediate",
                mitre_attack=["T1566.002", "T1583.001"],
                owasp="A07:2021 - Identification and Authentication Failures",
                evidence=ev,
                raw={"urlscan_hit": hit, "ipqs": ipqs},
            ))
        return out

    async def _open_feeds(self, base_terms: list[str]) -> list[Finding]:
        out: list[Finding] = []
        # Pull all four feeds in parallel
        phishtank, openphish, urlhaus, threatfox_results = await asyncio.gather(
            phish_feeds.phishtank_urls(),
            phish_feeds.openphish_urls(),
            phish_feeds.urlhaus_recent(),
            asyncio.gather(*(phish_feeds.threatfox_search(t) for t in base_terms[:5]), return_exceptions=True),
            return_exceptions=True,
        )

        # PhishTank
        if isinstance(phishtank, list) and phishtank:
            self.log.info(f"PhishTank: {len(phishtank)} active URLs in feed")
            hits = phish_feeds.grep_urls_for(phishtank, base_terms)
            self.store.save_raw(self.name, "phishtank_hits", hits)
            for h in hits[:50]:
                out.append(Finding.build(
                    title=f"PhishTank-confirmed phishing URL: {h['url'][:70]}",
                    category="phishing",
                    module=self.name,
                    affected_asset=base_terms[0] if base_terms else "brand",
                    indicator=h["url"],
                    likelihood=5, impact=4,
                    description=f"PhishTank verified phishing URL. Submitted: {h.get('submission_time','')}. Target: {h.get('target','')}.",
                    recommendation="Already verified malicious by PhishTank. File takedown immediately; push to corporate DNS / proxy blocklist.",
                    remediation_priority="immediate",
                    mitre_attack=["T1566.002"],
                    evidence=[
                        Evidence(type="url", label="Phishing URL", value=h["url"]),
                        Evidence(type="url", label="PhishTank details", value=h.get("details_url")),
                    ],
                    raw=h,
                ))

        # OpenPhish (URL-only)
        if isinstance(openphish, list) and openphish:
            self.log.info(f"OpenPhish: {len(openphish)} URLs in feed")
            hits = phish_feeds.grep_urls_for(openphish, base_terms)
            self.store.save_raw(self.name, "openphish_hits", hits)
            for h in hits[:50]:
                u = h.get("url") if isinstance(h, dict) else h
                out.append(Finding.build(
                    title=f"OpenPhish-confirmed phishing URL: {u[:70]}",
                    category="phishing",
                    module=self.name,
                    affected_asset=base_terms[0] if base_terms else "brand",
                    indicator=u,
                    likelihood=5, impact=4,
                    description="OpenPhish community-verified phishing URL targeting brand keyword.",
                    recommendation="File takedown; push to blocklist; alert customers.",
                    remediation_priority="immediate",
                    mitre_attack=["T1566.002"],
                    evidence=[Evidence(type="url", label="Phishing URL", value=u)],
                ))

        # URLhaus (malware delivery)
        if isinstance(urlhaus, list) and urlhaus:
            self.log.info(f"URLhaus: {len(urlhaus)} recent URLs in feed")
            hits = phish_feeds.grep_urls_for(urlhaus, base_terms)
            self.store.save_raw(self.name, "urlhaus_hits", hits)
            for h in hits[:30]:
                out.append(Finding.build(
                    title=f"URLhaus malware-delivery URL: {h['url'][:70]}",
                    category="phishing",
                    module=self.name,
                    affected_asset=base_terms[0] if base_terms else "brand",
                    indicator=h["url"],
                    likelihood=5, impact=5,
                    description=f"URLhaus reports this URL as serving malware. Threat: {h.get('threat','')}. Tags: {h.get('tags','')}.",
                    recommendation="Treat as live malware host. Block at DNS/proxy; coordinate with hosting provider for takedown; preserve sample for IR.",
                    remediation_priority="immediate",
                    mitre_attack=["T1566.002", "T1204"],
                    evidence=[Evidence(type="url", label="Malware URL", value=h["url"])],
                    raw=h,
                ))

        # ThreatFox (per-term lookups)
        if isinstance(threatfox_results, list):
            for term, batch in zip(base_terms[:5], threatfox_results):
                if not isinstance(batch, list) or not batch:
                    continue
                self.store.save_raw(self.name, f"threatfox_{term}", batch)
                for ioc in batch[:20]:
                    out.append(Finding.build(
                        title=f"ThreatFox IOC matching brand keyword: {ioc.get('ioc','')[:70]}",
                        category="phishing",
                        module=self.name,
                        affected_asset=term,
                        indicator=ioc.get("ioc", ""),
                        likelihood=4, impact=4,
                        description=f"ThreatFox indicator type={ioc.get('ioc_type')}, malware={ioc.get('malware_printable','')}, confidence={ioc.get('confidence_level','')}.",
                        recommendation="Add IOC to SIEM/SOC blocklist; correlate with internal telemetry.",
                        remediation_priority="short_term",
                        evidence=[Evidence(type="url", label="ThreatFox", value=f"https://threatfox.abuse.ch/ioc/{ioc.get('id','')}")],
                        raw=ioc,
                    ))
        return out

    async def _vt_passive_dns(self, domain: str) -> list[Finding]:
        out: list[Finding] = []
        vt = await virustotal_client.domain_report(domain)
        if not isinstance(vt, dict):
            return out
        attrs = ((vt.get("data") or {}).get("attributes")) or {}
        last = attrs.get("last_analysis_stats") or {}
        if last.get("malicious", 0) > 0:
            out.append(Finding.build(
                title=f"Brand domain {domain} flagged by VirusTotal engines",
                category="phishing",
                module=self.name,
                affected_asset=domain,
                indicator=domain,
                likelihood=3, impact=4,
                description=f"{last.get('malicious')} engines flagged {domain} as malicious. Investigate possible compromise.",
                recommendation="Investigate web logs, check for cross-site scripting / open redirect; request VT re-analysis after remediation.",
                remediation_priority="immediate",
                evidence=[Evidence(type="url", label="VirusTotal", value=f"https://www.virustotal.com/gui/domain/{domain}")],
                raw={"vt_stats": last},
            ))
        return out

    async def _crtsh_lures(self, base_terms: list[str], expanded_terms: list[str], primary: list[str]) -> list[Finding]:
        """crt.sh search for cert names containing brand + scam lure ('creditaccess-loan*' etc)."""
        out: list[Finding] = []
        # Skip — domain_intel already does the brand-only crt.sh scan.
        # Here we look for patterns that combine the brand with lures: stronger phishing signal.
        if len(expanded_terms) <= len(base_terms):
            return out
        owned_set = {d.lower() for d in primary}
        owned_basenames = {d.split(".")[0] for d in primary}
        seen: set[str] = set()
        # Take expanded-only terms
        lure_terms = [t for t in expanded_terms if t not in base_terms]
        for term in lure_terms[:8]:
            # Build %word1%word2% for each lure pair
            parts = [p for p in term.lower().split() if p]
            if len(parts) < 2:
                continue
            q = "%" + "%".join(parts) + "%"
            records = await crtsh_client.search(q)
            if not records:
                continue
            self.store.save_raw(self.name, f"crtsh_lure_{term.replace(' ','_')}", records[:200])
            names = crtsh_client.names_from_records(records)
            recent = crtsh_client.names_from_records(crtsh_client.newly_issued(records, days=120))
            for n in (names & recent):
                if n in owned_set or n in seen:
                    continue
                if any(n.endswith("." + od) for od in owned_set):
                    continue
                seen.add(n)
                out.append(Finding.build(
                    title=f"Phishing-pattern cert detected: {n}",
                    category="phishing",
                    module=self.name,
                    affected_asset=primary[0] if primary else "brand",
                    indicator=n,
                    likelihood=5, impact=4,
                    description=(
                        f"crt.sh cert {n} matches brand+scam-lure pattern '{term}'. "
                        "Combination of brand keyword with scam vocabulary in a TLS cert is a strong indicator of phishing infrastructure preparation."
                    ),
                    recommendation="Resolve domain, capture content if live, file emergency takedown with CA + hosting provider; alert customers via security channel.",
                    remediation_priority="immediate",
                    mitre_attack=["T1583.001", "T1608.005"],
                    evidence=[Evidence(type="url", label="crt.sh", value=f"https://crt.sh/?q={n}")],
                ))
        return out
