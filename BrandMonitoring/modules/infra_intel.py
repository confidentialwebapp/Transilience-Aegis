"""Infrastructure exposure: Shodan + AbuseIPDB + OTX + Netlas + DNSDumpster."""
from __future__ import annotations

import asyncio
import ipaddress
import socket
from typing import Any

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from integrations import abuseipdb_client, netlas_client, otx_client, shodan_client


def _expand_cidr(cidr: str, max_hosts: int = 32) -> list[str]:
    try:
        net = ipaddress.ip_network(cidr, strict=False)
        return [str(h) for h in list(net.hosts())[:max_hosts]]
    except Exception:
        return []


def _resolve_sync(domain: str) -> str | None:
    try:
        return socket.gethostbyname(domain)
    except Exception:
        return None


class InfraIntelModule(DetectionModule):
    name = "infra_intel"
    category = "infra_exposure"
    description = "Exposed services, open ports, CVE matches, IP reputation."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        assets = self.brand.get("assets") or {}
        ips: list[str] = []
        for cidr in (assets.get("ip_ranges") or []):
            ips.extend(_expand_cidr(cidr))
        # Resolve domains too
        loop = asyncio.get_event_loop()
        for d in (assets.get("primary_domains") or []) + (assets.get("secondary_domains") or []):
            ip = await loop.run_in_executor(None, _resolve_sync, d)
            if ip:
                ips.append(ip)
        ips = list(dict.fromkeys(ips))[:64]
        if not ips:
            return findings

        cve_min = float(self.cfg.get("cve_min_cvss", 7.0))

        for ip in ips:
            shodan_host, abuse, otx_ip = await asyncio.gather(
                shodan_client.host(ip),
                abuseipdb_client.check(ip),
                otx_client.ip(ip),
                return_exceptions=True,
            )
            if isinstance(shodan_host, dict):
                self.store.save_raw(self.name, f"shodan_{ip}", shodan_host)
                cves = (shodan_host.get("vulns") or [])
                ports = shodan_host.get("ports") or []
                hostnames = shodan_host.get("hostnames") or []
                org = shodan_host.get("org")

                # CVE-based finding
                high_cves = [c for c in cves if isinstance(c, str) and c.upper().startswith("CVE-")]
                if high_cves:
                    findings.append(Finding.build(
                        title=f"{len(high_cves)} CVEs exposed on {ip}",
                        category="vulnerability",
                        module=self.name,
                        affected_asset=ip,
                        indicator=ip,
                        likelihood=4, impact=5,
                        description=(
                            f"Shodan reports {len(high_cves)} CVEs on {ip} (org: {org}). "
                            f"Open ports: {ports}. Hostnames: {hostnames}."
                        ),
                        recommendation="Triage CVEs against affected services; patch or compensate via WAF/IPS rules; verify with internal vuln scanner.",
                        remediation_priority="immediate",
                        cwe="CWE-1395",
                        owasp="A06:2021 - Vulnerable and Outdated Components",
                        mitre_attack=["T1190", "T1133"],
                        references=[f"https://nvd.nist.gov/vuln/detail/{c}" for c in high_cves[:10]],
                        evidence=[Evidence(type="url", label="Shodan host", value=f"https://www.shodan.io/host/{ip}")],
                        raw={"cves": high_cves, "ports": ports, "hostnames": hostnames},
                    ))
                # Generic exposure finding (informational unless risky ports)
                risky = sorted(set(ports) & {21, 23, 445, 3389, 5900, 6379, 9200, 27017, 11211, 5984})
                if risky:
                    findings.append(Finding.build(
                        title=f"Risky / management ports exposed on {ip}",
                        category="infra_exposure",
                        module=self.name,
                        affected_asset=ip,
                        indicator=",".join(map(str, risky)),
                        likelihood=4, impact=4,
                        description=f"Management / DB / legacy ports exposed publicly: {risky}",
                        recommendation="Restrict to allowlisted source IPs via security group / firewall; require VPN for management plane.",
                        remediation_priority="immediate",
                        evidence=[Evidence(type="url", label="Shodan", value=f"https://www.shodan.io/host/{ip}")],
                    ))

            if isinstance(abuse, dict):
                data = abuse.get("data") or {}
                conf = data.get("abuseConfidenceScore", 0)
                if conf and conf >= 25:
                    findings.append(Finding.build(
                        title=f"IP {ip} has bad reputation (AbuseIPDB confidence {conf})",
                        category="infra_exposure",
                        module=self.name,
                        affected_asset=ip,
                        indicator=ip,
                        likelihood=3, impact=3,
                        description=f"AbuseIPDB reports {data.get('totalReports', 0)} reports against {ip}. Last reported: {data.get('lastReportedAt')}.",
                        recommendation="If this IP is owned by you, investigate compromise / outbound abuse. If not, block at perimeter and notify hosting provider.",
                        remediation_priority="short_term",
                        evidence=[Evidence(type="url", label="AbuseIPDB", value=f"https://www.abuseipdb.com/check/{ip}")],
                        raw=data,
                    ))

            if isinstance(otx_ip, dict):
                pulses = (otx_ip.get("pulse_info") or {}).get("count", 0)
                if pulses > 0:
                    findings.append(Finding.build(
                        title=f"IP {ip} appears in {pulses} threat-intel pulses (OTX)",
                        category="infra_exposure",
                        module=self.name,
                        affected_asset=ip,
                        indicator=ip,
                        likelihood=3, impact=3,
                        description=f"AlienVault OTX has {pulses} pulses referencing {ip}. Possible compromise / known C2.",
                        recommendation="Investigate associated TTPs; correlate with EDR/SIEM telemetry; consider IP rotation if compromise confirmed.",
                        remediation_priority="short_term",
                        evidence=[Evidence(type="url", label="OTX", value=f"https://otx.alienvault.com/indicator/ip/{ip}")],
                    ))
        return findings
