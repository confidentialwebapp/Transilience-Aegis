"""Ad fraud / SEO poisoning: malicious ads & SERP results referencing the brand."""
from __future__ import annotations

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from integrations import apify_client, ipqs_client


class AdFraudModule(DetectionModule):
    name = "ad_fraud"
    category = "ad_fraud"
    description = "Malicious ads / SEO-poisoned results referencing brand keywords."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        brand = self.brand.get("brand", {}).get("name", "")
        keywords = (self.brand.get("assets") or {}).get("brand_keywords") or [brand]
        queries = [f'{k} login', f'{k} support number', f'{k} customer care', f'{k} download'] if brand else []
        queries = list(dict.fromkeys(queries))[:8]
        if not queries:
            return findings

        results = await apify_client.google_search(queries, results_per_query=10)
        if not results:
            return findings
        self.store.save_raw(self.name, "seo_search", results)

        primary_domains = set((self.brand.get("assets") or {}).get("primary_domains") or [])

        for r in results[:60]:
            url = r.get("url") or ""
            title = r.get("title") or ""
            if not url:
                continue
            host = url.split("/")[2] if "://" in url else ""
            if not host:
                continue
            # If host doesn't match an owned domain, treat as suspicious for "support number" / "login" queries
            if any(host.endswith(d) for d in primary_domains):
                continue

            ipqs = await ipqs_client.url_check(url)
            risk = (ipqs or {}).get("risk_score", 0)
            phishing = (ipqs or {}).get("phishing")
            if phishing or risk >= 75:
                findings.append(Finding.build(
                    title=f"SEO-poisoned / suspicious ad result: {title[:80]}",
                    category="ad_fraud",
                    module=self.name,
                    affected_asset=brand,
                    indicator=url,
                    likelihood=4, impact=4,
                    description=f"SERP for brand support / login query returned non-owned domain {host}. IPQS risk={risk}, phishing={phishing}.",
                    recommendation="File Google Ads brand-misuse / trademark complaint. Notify SOC. Block domain at customer DNS-level if applicable.",
                    remediation_priority="immediate",
                    evidence=[Evidence(type="url", label="SERP result", value=url)],
                    raw={"ipqs": ipqs, "serp": r},
                ))
        return findings
