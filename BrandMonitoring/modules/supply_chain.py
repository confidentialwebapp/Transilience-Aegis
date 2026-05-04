"""Supply chain (DRP) — Magecart / web-skimmer surface monitoring.

Crawls the brand's own pages, enumerates third-party JavaScript hosts that
load on those pages, enriches each with VirusTotal + AlienVault OTX, and
flags any unknown / malicious host as a supply-chain risk. This is the
class of attack behind the British Airways and Magecart breaches.
"""
from __future__ import annotations

import asyncio
import re
from urllib.parse import urlparse

import httpx

from core.base_module import DetectionModule
from core.evidence import Finding
from integrations import otx_client, virustotal_client


SCRIPT_RE = re.compile(r'<script[^>]+src=["\']([^"\']+)["\']', re.I)


def _absolute(url: str, base: str) -> str | None:
    if not url:
        return None
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("http"):
        return url
    if url.startswith("/") and base:
        try:
            p = urlparse(base)
            return f"{p.scheme}://{p.netloc}{url}"
        except Exception:
            return None
    return None


def _host(url: str) -> str | None:
    try:
        return urlparse(url).hostname
    except Exception:
        return None


async def _fetch(client: httpx.AsyncClient, url: str) -> str:
    try:
        r = await client.get(url, timeout=15, follow_redirects=True)
        if r.status_code == 200:
            return r.text or ""
    except Exception:
        return ""
    return ""


class SupplyChainModule(DetectionModule):
    name = "supply_chain"
    category = "infra_exposure"
    description = "Detect third-party JS hosts loading on brand pages — supply-chain / Magecart surface."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        primary = (self.brand.get("assets") or {}).get("primary_domains") or []
        if not primary:
            return findings

        target_pages: list[str] = []
        for d in primary:
            target_pages.append(f"https://{d}/")
            for path in ("/login", "/checkout", "/account", "/payment", "/contact"):
                target_pages.append(f"https://{d}{path}")

        cap = int(self.cfg.get("max_pages", 6))
        target_pages = target_pages[:cap]

        async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0 BrandMonitoring/1.0"}, verify=False) as client:
            seen_hosts: set[str] = set()
            host_to_page: dict[str, str] = {}
            for page in target_pages:
                html = await _fetch(client, page)
                if not html:
                    continue
                for m in SCRIPT_RE.finditer(html):
                    script_url = _absolute(m.group(1), page)
                    if not script_url:
                        continue
                    h = _host(script_url)
                    if not h:
                        continue
                    if any(h.endswith(d) for d in primary):
                        continue  # first-party
                    if h in seen_hosts:
                        continue
                    seen_hosts.add(h)
                    host_to_page[h] = page

        if not seen_hosts:
            return findings

        self.log.info(f"supply_chain: {len(seen_hosts)} unique third-party JS hosts on brand pages")

        # Enrich each unique host with VT + OTX, flag malicious
        for host in sorted(seen_hosts):
            try:
                vt = await virustotal_client.domain_report(host)
                otx = await otx_client.domain(host)
            except Exception:
                vt, otx = None, None

            malicious = 0
            if isinstance(vt, dict):
                malicious = ((vt.get("data") or {}).get("attributes") or {}).get("last_analysis_stats", {}).get("malicious", 0) or 0
            otx_pulses = 0
            if isinstance(otx, dict):
                otx_pulses = ((otx.get("pulse_info") or {}).get("count")) or 0

            sev_l, sev_i = 1, 2
            if malicious >= 1 or otx_pulses >= 1:
                sev_l, sev_i = 4, 4
                tag = "[MALICIOUS]"
            else:
                tag = "[THIRD-PARTY]"

            findings.append(Finding.build(
                title=f"{tag} {host} loads JS on brand pages",
                category="infra_exposure",
                module=self.name,
                affected_asset=host_to_page.get(host) or primary[0],
                indicator=f"https://{host}",
                description=f"Third-party JavaScript host {host} loads on {host_to_page.get(host)}. VirusTotal malicious detections: {malicious}. OTX pulse mentions: {otx_pulses}. Any compromise of this host can inject code into your customer-facing pages.",
                likelihood=sev_l, impact=sev_i,
                recommendation="Audit each third-party host. Remove unused tags. Use Subresource Integrity (SRI) hashes for any tag you must keep.",
                raw={"host": host, "vt_malicious": malicious, "otx_pulses": otx_pulses},
            ))

        return findings
