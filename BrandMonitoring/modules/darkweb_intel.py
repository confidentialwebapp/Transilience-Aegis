"""Dark/deep web exposure: IntelX + Ransomware.live + paste sites."""
from __future__ import annotations

import asyncio
from typing import Any

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from integrations import intelx_client, ransomware_live_client


class DarkwebIntelModule(DetectionModule):
    name = "darkweb_intel"
    category = "darkweb_exposure"
    description = "Brand mentions on darkweb forums, paste sites, ransomware leak sites."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        brand = self.brand.get("brand", {}).get("name", "")
        legal = self.brand.get("brand", {}).get("legal_name", "")
        domains = (self.brand.get("assets") or {}).get("primary_domains") or []
        execs = (self.brand.get("people") or {}).get("executives") or []
        terms = list({t for t in [brand, legal] + domains + [e.get("email") for e in execs if e.get("email")] if t})

        # 1. IntelX search
        if "intelx" in (self.cfg.get("sources") or ["intelx", "ransomware_live"]):
            for term in terms[:10]:
                records = await intelx_client.search(term, max_results=80)
                if records:
                    self.store.save_raw(self.name, f"intelx_{term.replace('@','_at_')}", records)
                    # Group by media bucket / source
                    paste_count = sum(1 for r in records if (r.get("bucket") or "").startswith("pastes"))
                    leak_count = sum(1 for r in records if "leak" in (r.get("bucket") or "").lower())
                    forum_count = sum(1 for r in records if "forum" in (r.get("bucket") or "").lower())
                    findings.append(Finding.build(
                        title=f"IntelX: {len(records)} records reference '{term}'",
                        category="darkweb_exposure",
                        module=self.name,
                        affected_asset=term,
                        indicator=term,
                        likelihood=3 if len(records) < 25 else 4,
                        impact=4,
                        description=(
                            f"IntelX surfaced {len(records)} records containing '{term}'. "
                            f"Buckets: pastes={paste_count}, leaks={leak_count}, forums={forum_count}."
                        ),
                        recommendation="Triage records via IntelX UI; pull samples to confirm sensitivity; file takedown for pastes; coordinate IR if leak data is current.",
                        remediation_priority="short_term",
                        evidence=[Evidence(type="url", label="IntelX search", value=f"https://intelx.io/?s={term}")],
                        raw={"sample_records": records[:10]},
                    ))

        # 2. Ransomware leak sites
        if "ransomware_live" in (self.cfg.get("sources") or ["intelx", "ransomware_live"]):
            r_terms = [brand, legal] + domains
            tasks = [ransomware_live_client.search_victims(t.split(".")[0]) for t in r_terms if t]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for term, vics in zip([t for t in r_terms if t], results):
                if not isinstance(vics, list) or not vics:
                    continue
                self.store.save_raw(self.name, f"ransom_{term}", vics)
                for v in vics:
                    findings.append(Finding.build(
                        title=f"Ransomware leak-site mention: {v.get('victim') or term}",
                        category="ransomware_mention",
                        module=self.name,
                        affected_asset=term,
                        indicator=v.get("post_url") or v.get("url") or term,
                        likelihood=4, impact=5,
                        description=(
                            f"Ransomware group '{v.get('group_name') or v.get('group')}' has listed a victim matching '{term}'. "
                            f"Discovered: {v.get('discovered')}, published: {v.get('published')}."
                        ),
                        recommendation="Activate IR plan; engage CERT / law enforcement; preserve evidence; assess data exposure scope; notify regulators per GDPR/DPDP timelines.",
                        remediation_priority="immediate",
                        mitre_attack=["T1486", "T1567.002"],
                        evidence=[Evidence(type="url", label="Leak-site post", value=v.get("post_url") or v.get("url"))],
                        raw=v,
                    ))
        return findings
