"""Domain abuse: typosquats, lookalikes, homoglyphs, IDN, expired/parked, NRDs.

Strategy:
  1. Generate permutations of each primary domain via dnstwist.
  2. Resolve each permutation; flag those with active DNS / web / MX.
  3. Enrich with WHOIS (recently registered? privacy-protected?), VirusTotal,
     URLScan, IPQS, OTX for malicious reputation.
  4. Capture screenshot via URLScan submit (lightweight) or HTTP fetch.
  5. Subdomain discovery on owned domains via DNSDumpster + Netlas + CT.
"""
from __future__ import annotations

import asyncio
import socket
from datetime import datetime, timezone
from typing import Any

import tldextract

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from integrations import (
    crtsh_client,
    dnsdumpster_client,
    ipqs_client,
    netlas_client,
    otx_client,
    shodan_client,
    urlscan_client,
    virustotal_client,
)


def _dnstwist_permutations(domain: str, full: bool = True) -> list[dict[str, Any]]:
    try:
        import dnstwist  # type: ignore
    except Exception:
        return []
    try:
        fuzz = dnstwist.Fuzzer(domain)
        fuzz.generate()
        perms = list(fuzz.permutations(registered=False))
        return [p.copy() for p in perms]
    except Exception:
        return []


def _resolve(domain: str) -> str | None:
    try:
        return socket.gethostbyname(domain)
    except Exception:
        return None


def _whois_age_days(domain: str) -> int | None:
    try:
        import whois  # type: ignore
        w = whois.whois(domain)
        cd = w.creation_date
        if isinstance(cd, list):
            cd = cd[0]
        if cd is None:
            return None
        if isinstance(cd, str):
            return None
        if cd.tzinfo is None:
            cd = cd.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - cd).days
    except Exception:
        return None


class DomainIntelModule(DetectionModule):
    name = "domain_intel"
    category = "domain_abuse"
    description = "Typosquats, lookalikes, homoglyphs, NRDs, parked domains, subdomain enumeration."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        primary = (self.brand.get("assets") or {}).get("primary_domains") or []
        keywords = (self.brand.get("assets") or {}).get("brand_keywords") or []
        brand_name = (self.brand.get("brand") or {}).get("name") or ""

        # Combine all permutation-base names
        all_names: list[str] = list(primary)
        owned_basenames = {d.split(".")[0] for d in primary}

        for domain in primary:
            findings.extend(await self._inspect_primary(domain))
            findings.extend(await self._hunt_permutations(domain))

        # CT-log search: every cert ever issued for our brand's name space
        ct_terms: list[str] = []
        for d in primary:
            ct_terms.append(f"%{d.split('.')[0]}%")
        for k in keywords:
            kn = k.lower().replace(" ", "")
            if len(kn) >= 5:
                ct_terms.append(f"%{kn}%")
        ct_terms = list(dict.fromkeys(ct_terms))[:6]

        findings.extend(await self._crtsh(ct_terms, primary, owned_basenames, brand_name))
        return findings

    async def _inspect_primary(self, domain: str) -> list[Finding]:
        """Subdomain enumeration + cert intel for owned domain (informational)."""
        out: list[Finding] = []
        sub_jobs = await asyncio.gather(
            dnsdumpster_client.domain(domain),
            netlas_client.domains_search(f"domain:*.{domain}", size=100),
            return_exceptions=True,
        )
        dd_data, netlas_data = (sub_jobs + [None, None])[:2]
        subdomains: set[str] = set()

        if isinstance(dd_data, dict):
            for rec in (dd_data.get("a") or []) + (dd_data.get("cname") or []):
                host = rec.get("host") if isinstance(rec, dict) else None
                if host:
                    subdomains.add(host)
            self.store.save_raw(self.name, f"{domain}_dnsdumpster", dd_data)

        if isinstance(netlas_data, dict):
            for item in (netlas_data.get("items") or []):
                d = (item.get("data") or {}).get("domain")
                if d and d.endswith(domain):
                    subdomains.add(d)
            self.store.save_raw(self.name, f"{domain}_netlas_subs", netlas_data)

        if subdomains:
            out.append(Finding.build(
                title=f"Subdomain inventory enumerated for {domain}",
                category="domain_abuse",
                module=self.name,
                affected_asset=domain,
                likelihood=1, impact=2,
                description=f"{len(subdomains)} subdomains discovered passively for {domain}. Review for unauthorized / forgotten assets.",
                indicator=domain,
                recommendation="Review subdomain list against asset inventory; decommission orphaned services; ensure all are TLS-enabled and patched.",
                remediation_priority="short_term",
                raw={"subdomains": sorted(subdomains)},
            ))
        return out

    async def _hunt_permutations(self, domain: str) -> list[Finding]:
        out: list[Finding] = []
        full = (self.cfg.get("permutations") or "full") == "full"
        max_perms = int(self.cfg.get("max_permutations", 800))
        max_enrich = int(self.cfg.get("max_enrich", 30))
        dns_concurrency = int(self.cfg.get("dns_concurrency", 32))

        perms = _dnstwist_permutations(domain, full=full)[:max_perms]
        if not perms:
            self.log.warning("dnstwist returned no permutations (library missing?). Falling back to no permutation hunt.")
            return out

        # Bounded-concurrency async DNS resolution
        loop = asyncio.get_event_loop()
        sem = asyncio.Semaphore(dns_concurrency)

        async def resolve(p: dict[str, Any]) -> dict[str, Any] | None:
            d = p.get("domain")
            if not d or d == domain:
                return None
            async with sem:
                ip = await loop.run_in_executor(None, _resolve, d)
            if ip:
                p["ip"] = ip
                return p
            return None

        resolved = await asyncio.gather(*(resolve(p) for p in perms), return_exceptions=False)
        registered = [r for r in resolved if r]

        self.log.info(f"{domain}: {len(perms)} permutations, {len(registered)} resolve to live IPs")
        self.store.save_raw(self.name, f"{domain}_permutations", registered)

        # Enrich live ones (cap to avoid burning quota)
        for p in registered[:max_enrich]:
            d = p["domain"]
            ip = p.get("ip")
            fuzzer = p.get("fuzzer") or "unknown"

            vt, urlscan, ipqs, otx = await asyncio.gather(
                virustotal_client.domain_report(d),
                urlscan_client.search(f"domain:{d}", size=5),
                ipqs_client.domain_check(d),
                otx_client.domain(d),
                return_exceptions=True,
            )

            mal_score = 0
            evidence: list[Evidence] = []

            if isinstance(vt, dict):
                stats = ((vt.get("data") or {}).get("attributes") or {}).get("last_analysis_stats") or {}
                mal_score += int(stats.get("malicious", 0)) * 5 + int(stats.get("suspicious", 0)) * 2
                evidence.append(Evidence(type="json", label="VirusTotal", value=f"https://www.virustotal.com/gui/domain/{d}"))

            if isinstance(ipqs, dict):
                if ipqs.get("phishing") or ipqs.get("malware"):
                    mal_score += 10
                if (ipqs.get("risk_score") or 0) >= 75:
                    mal_score += 5

            screenshot_url = None
            if isinstance(urlscan, dict):
                results = urlscan.get("results") or []
                if results:
                    uuid = results[0].get("_id")
                    if uuid:
                        screenshot_url = f"https://urlscan.io/screenshots/{uuid}.png"
                        evidence.append(Evidence(type="screenshot", label=f"URLScan {uuid}", value=screenshot_url))
                        evidence.append(Evidence(type="url", label="URLScan result", value=results[0].get("result")))

            if isinstance(otx, dict):
                pulses = (otx.get("pulse_info") or {}).get("count") or 0
                if pulses > 0:
                    mal_score += min(pulses, 5) * 2

            age_days = _whois_age_days(d)

            # Score
            likelihood = 2
            impact = 3
            if mal_score >= 10:
                likelihood = 5
                impact = 5
            elif mal_score >= 5:
                likelihood = 4
                impact = 4
            elif age_days is not None and age_days < 90:
                likelihood = 4   # newly-registered = higher phishing prior
                impact = 3

            title = f"Lookalike / typosquat domain detected: {d}"
            if fuzzer in ("homoglyph", "idn", "homophones"):
                title = f"Homoglyph domain detected: {d}"

            evidence.append(Evidence(type="dns", label="A record", value=str(ip)))
            if age_days is not None:
                evidence.append(Evidence(type="text", label="WHOIS age (days)", value=str(age_days)))

            description = (
                f"Permutation of {domain} ({fuzzer}) is registered and resolves to {ip}. "
                f"Reputation signals: VT/IPQS/OTX flagged={mal_score>0}, "
                f"WHOIS age={age_days if age_days is not None else 'unknown'} days."
            )

            out.append(Finding.build(
                title=title,
                category="domain_abuse",
                module=self.name,
                affected_asset=domain,
                indicator=d,
                likelihood=likelihood,
                impact=impact,
                description=description,
                recommendation=(
                    "Initiate registrar / hosting provider takedown via abuse contact. "
                    "Submit to Google Safe Browsing, APWG, and add to internal blocklists. "
                    "Consider defensive registration of high-risk variants."
                ),
                remediation_priority="immediate" if mal_score >= 10 else "short_term",
                evidence=evidence,
                mitre_attack=["T1583.001", "T1566.002"],
                raw={"permutation": p, "vt_stats": (vt.get("data") if isinstance(vt, dict) else None), "ipqs": ipqs, "otx_pulses": otx.get("pulse_info") if isinstance(otx, dict) else None},
            ))

        return out

    async def _crtsh(self, ct_terms: list[str], owned_domains: list[str], owned_basenames: set[str], brand_name: str) -> list[Finding]:
        """Certificate Transparency: every cert ever issued matching brand-related strings."""
        out: list[Finding] = []
        owned_set = {d.lower() for d in owned_domains}
        all_names: set[str] = set()
        recent_names: set[str] = set()

        for term in ct_terms:
            self.log.info(f"crt.sh query: {term}")
            records = await crtsh_client.search(term)
            if not records:
                continue
            self.store.save_raw(self.name, f"crtsh_{term.strip('%')}", records[:500])
            names = crtsh_client.names_from_records(records)
            recent = crtsh_client.names_from_records(crtsh_client.newly_issued(records, days=90))
            all_names |= names
            recent_names |= recent

        # Filter: skip names that are owned, or subdomains of owned domains
        suspicious: set[str] = set()
        for n in all_names:
            if n in owned_set:
                continue
            if any(n.endswith("." + od) for od in owned_set):
                continue
            # Must contain at least one owned-basename or brand keyword as substring
            if not any(b in n.replace(".", "").replace("-", "") for b in owned_basenames):
                continue
            suspicious.add(n)

        if not suspicious:
            return out

        self.log.info(f"crt.sh: {len(all_names)} certs total, {len(suspicious)} suspicious, {len(recent_names & suspicious)} newly-issued")
        # One bulk inventory finding (informational), then per-name findings for the most suspicious
        out.append(Finding.build(
            title=f"Certificate Transparency: {len(suspicious)} suspicious certs reference brand",
            category="domain_abuse",
            module=self.name,
            affected_asset=brand_name or (owned_domains[0] if owned_domains else "brand"),
            indicator=f"crt.sh search ({len(suspicious)} hits)",
            likelihood=2, impact=3,
            description=f"crt.sh CT-log search surfaced {len(suspicious)} unique TLS-cert names referencing brand keywords (excluding owned domains). {len(recent_names & suspicious)} were issued in the last 90 days.",
            recommendation="Triage list against asset inventory; flag any unrecognized name for takedown / defensive registration.",
            remediation_priority="short_term",
            evidence=[Evidence(type="url", label="crt.sh search", value=f"https://crt.sh/?q=%25{(owned_basenames or {''}).pop()}%25")],
            raw={"suspicious": sorted(suspicious)[:300]},
        ))

        # Individual findings for newly-issued (high-confidence phishing prep)
        for name in sorted(recent_names & suspicious)[:25]:
            out.append(Finding.build(
                title=f"Newly-issued TLS cert for suspicious name: {name}",
                category="domain_abuse",
                module=self.name,
                affected_asset=brand_name or owned_domains[0],
                indicator=name,
                likelihood=4, impact=4,
                description=f"A TLS certificate for {name} was issued within the last 90 days. Phishers commonly issue Let's Encrypt certs hours before launching campaigns.",
                recommendation="Resolve the domain; capture screenshot if live; file abuse report with hosting provider and CA. Consider defensive registration if available.",
                remediation_priority="immediate",
                evidence=[Evidence(type="url", label="crt.sh", value=f"https://crt.sh/?q={name}")],
                mitre_attack=["T1583.001", "T1608.005"],
            ))

        # Older certs but still suspicious (medium severity)
        older_suspicious = sorted(suspicious - recent_names)[:25]
        for name in older_suspicious:
            out.append(Finding.build(
                title=f"Historic suspicious cert reference: {name}",
                category="domain_abuse",
                module=self.name,
                affected_asset=brand_name or owned_domains[0],
                indicator=name,
                likelihood=2, impact=3,
                description=f"crt.sh shows a TLS cert for {name}, which references brand keywords but is not declared as owned.",
                recommendation="Verify ownership; if unauthorized, treat as historical or active typosquat per domain status.",
                remediation_priority="short_term",
                evidence=[Evidence(type="url", label="crt.sh", value=f"https://crt.sh/?q={name}")],
            ))
        return out
