"""Asset discovery (DRP) — find unmanaged externally-facing assets.

Multi-source subdomain enumeration (crt.sh + DNSDumpster + Netlas), enriched
with Shodan banner / CVE data. Any LIVE subdomain not in the declared
inventory is flagged as `unmanaged_asset` for the asset team to claim or
decommission.
"""
from __future__ import annotations

import asyncio
import socket
from typing import Any

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from integrations import crtsh_client, dnsdumpster_client, netlas_client, shodan_client


def _resolves(host: str) -> bool:
    try:
        socket.gethostbyname(host)
        return True
    except Exception:
        return False


async def _gather_subdomains(domain: str) -> set[str]:
    """Pull subdomains from CT logs + DNSDumpster + Netlas in parallel."""
    out: set[str] = set()

    async def from_crtsh() -> None:
        try:
            rows = await crtsh_client.search(f"%.{domain}", exclude_expired=True)
            for r in rows or []:
                names = (r.get("name_value") or "").split("\n")
                for n in names:
                    n = n.strip().lower()
                    if n and "*" not in n and n.endswith(domain):
                        out.add(n)
        except Exception:
            pass

    async def from_dnsdumpster() -> None:
        try:
            data = await dnsdumpster_client.domain(domain)
            if isinstance(data, dict):
                for sub in (data.get("subdomains") or data.get("a") or []):
                    name = (sub.get("hostname") if isinstance(sub, dict) else sub) or ""
                    name = (name or "").strip().lower()
                    if name and name.endswith(domain):
                        out.add(name)
        except Exception:
            pass

    async def from_netlas() -> None:
        try:
            data = await netlas_client.domains_search(f"domain:*.{domain}", size=100)
            if isinstance(data, dict):
                for item in data.get("items", []) or []:
                    d = item.get("data", {}) if isinstance(item, dict) else {}
                    n = (d.get("domain") if isinstance(d, dict) else "") or ""
                    n = n.strip().lower()
                    if n and n.endswith(domain):
                        out.add(n)
        except Exception:
            pass

    await asyncio.gather(from_crtsh(), from_dnsdumpster(), from_netlas(), return_exceptions=True)
    return out


class AssetDiscoveryModule(DetectionModule):
    name = "asset_discovery"
    category = "infra_exposure"
    description = "Multi-source subdomain discovery + Shodan banner enrichment. Flags subdomains not in declared inventory."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        assets = self.brand.get("assets") or {}
        primary = assets.get("primary_domains") or []
        secondary = assets.get("secondary_domains") or []
        declared = {d.lower() for d in primary + secondary}

        max_subs = int(self.cfg.get("max_subdomains", 500))
        all_subs: set[str] = set()
        for d in primary + secondary:
            subs = await _gather_subdomains(d.lower())
            all_subs.update(subs)
            if len(all_subs) >= max_subs:
                break

        # Filter to subdomains that actually resolve (and aren't already declared roots)
        live: list[str] = []
        for s in sorted(all_subs)[:max_subs]:
            if s in declared:
                continue
            if _resolves(s):
                live.append(s)

        self.log.info(f"asset_discovery: {len(all_subs)} candidates, {len(live)} live unmanaged")

        # Roll up the inventory itself as one informational finding
        if live:
            findings.append(Finding.build(
                title=f"[INVENTORY] {len(live)} live subdomains discovered for {primary[0] if primary else 'brand'}",
                category="infra_exposure",
                module=self.name,
                affected_asset=primary[0] if primary else "unknown",
                indicator=primary[0] if primary else None,
                description=f"Multi-source enumeration found {len(live)} live subdomains (sample: {', '.join(live[:8])}…). Compare against declared inventory and bring unmanaged hosts under monitoring or decommission.",
                likelihood=2, impact=2,
                recommendation="Reconcile each subdomain against the asset register; either onboard it for monitoring or decommission it.",
                raw={"subdomains": live[:200]},
            ))

        # Per-host Shodan enrichment for the first N — flag any with open admin ports / known CVEs
        shodan_cap = int(self.cfg.get("shodan_max", 20))
        for host in live[:shodan_cap]:
            try:
                ip = socket.gethostbyname(host)
                data = await shodan_client.host(ip)
            except Exception:
                continue
            if not isinstance(data, dict):
                continue
            ports = data.get("ports") or []
            vulns = list((data.get("vulns") or []))
            risky_ports = [p for p in ports if p in (21, 22, 23, 3306, 3389, 5432, 5900, 6379, 9200, 27017)]
            if vulns or risky_ports:
                sev_likely = 4 if vulns else 3
                findings.append(Finding.build(
                    title=f"[EXPOSED] {host} exposes risky surface" + (f" ({len(vulns)} CVE matches)" if vulns else ""),
                    category="infra_exposure",
                    module=self.name,
                    affected_asset=host,
                    indicator=f"https://{host}",
                    description=f"Shodan reports {host} ({ip}) exposing ports {ports}. {len(vulns)} CVE matches. Sample vulns: {sorted(vulns)[:5]}.",
                    likelihood=sev_likely, impact=4,
                    references=[f"https://www.shodan.io/host/{ip}"],
                    raw={"ports": ports, "vulns": sorted(vulns)[:15], "ip": ip},
                ))
        return findings
