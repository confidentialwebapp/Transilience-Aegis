"""Subdomain takeover (DRP) — orphaned-CNAME hijack detection.

For each subdomain (re-using asset_discovery's enumeration if that runs first,
or doing its own crt.sh sweep), resolve the CNAME chain and match the target
against a curated set of vulnerable-service fingerprints. If a host's CNAME
points at an unclaimed third-party service (e.g. github.io with no Pages
config, an unbound Heroku app, a parked S3 bucket), it's takeover-able.
"""
from __future__ import annotations

import asyncio
from typing import Any

import dns.resolver  # type: ignore

from core.base_module import DetectionModule
from core.evidence import Finding
from core.http import request_json
from integrations import crtsh_client


# (cname target substring, error string we expect when fetching the host, label)
TAKEOVER_FINGERPRINTS: list[tuple[str, str, str]] = [
    ("github.io",            "There isn't a GitHub Pages site here", "GitHub Pages"),
    ("herokuapp.com",        "No such app", "Heroku"),
    ("herokudns.com",        "No such app", "Heroku DNS"),
    ("s3.amazonaws.com",     "NoSuchBucket", "AWS S3"),
    ("s3-website",           "NoSuchBucket", "AWS S3 Static Website"),
    ("storage.googleapis.com","NoSuchBucket", "GCS"),
    ("blob.core.windows.net","BlobNotFound", "Azure Blob"),
    ("azurewebsites.net",    "404 Web Site not found", "Azure Web App"),
    ("cloudfront.net",       "Bad Request", "CloudFront"),
    ("readthedocs.io",       "unknown to Read the Docs", "Read the Docs"),
    ("ghost.io",             "domain isn't configured", "Ghost.io"),
    ("shopify.com",          "Sorry, this shop is currently unavailable", "Shopify"),
    ("myshopify.com",        "Sorry, this shop is currently unavailable", "Shopify"),
    ("wpengine.com",         "WPEngine cluster not found", "WPEngine"),
    ("zendesk.com",          "Help Center Closed", "Zendesk"),
    ("desk.com",             "Please try again", "Desk"),
    ("statuspage.io",        "You are being", "Statuspage"),
    ("surge.sh",             "project not found", "Surge.sh"),
    ("tumblr.com",           "There's nothing here", "Tumblr"),
    ("uservoice.com",        "This UserVoice subdomain is currently available", "UserVoice"),
    ("worksites.net",        "Hello! Sorry, but this website is", "Worksites"),
    ("acquia-sites.com",     "Web Site Not Found", "Acquia"),
    ("pantheonsite.io",      "404 error unknown site", "Pantheon"),
    ("netlify.app",          "Not Found", "Netlify"),
    ("netlify.com",          "Not Found", "Netlify"),
    ("fastly.net",           "Fastly error: unknown domain", "Fastly"),
    ("bitbucket.io",         "Repository not found", "Bitbucket Pages"),
    ("teamwork.com",         "Oops - We didn't find your site", "Teamwork"),
    ("helpjuice.com",        "We could not find what you're looking for", "Helpjuice"),
    ("helpscoutdocs.com",    "No settings were found", "HelpScout Docs"),
    ("vercel-dns.com",       "404", "Vercel"),
    ("ngrok.io",             "Tunnel", "ngrok"),
    ("readme.io",            "Project doesnt exist... yet!", "Readme.io"),
    ("bigcartel.com",        "Oops! We could", "Bigcartel"),
    ("aerobatic.io",         "Aerobatic", "Aerobatic"),
    ("tilda.ws",             "Domain has been assigned", "Tilda"),
]


def _resolve_cname(host: str) -> str | None:
    try:
        ans = dns.resolver.resolve(host, "CNAME", lifetime=5)
        for r in ans:
            return str(r.target).rstrip(".").lower()
    except Exception:
        return None
    return None


async def _http_body(url: str) -> tuple[int, str]:
    """Fetch a URL and return (status, body[:4k])."""
    try:
        # Reuse the project's request helper but get text via raw client
        import httpx
        async with httpx.AsyncClient(timeout=12, follow_redirects=True, verify=False) as c:
            r = await c.get(url, headers={"User-Agent": "BrandMonitoring/1.0"})
            return r.status_code, (r.text or "")[:4096]
    except Exception:
        return 0, ""


class SubdomainTakeoverModule(DetectionModule):
    name = "subdomain_takeover"
    category = "infra_exposure"
    description = "Detect dangling-CNAME subdomains pointing at unclaimed third-party services."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        primary = (self.brand.get("assets") or {}).get("primary_domains") or []

        # Build candidate subdomain list via CT
        candidates: set[str] = set()
        for d in primary:
            try:
                rows = await crtsh_client.search(f"%.{d}", exclude_expired=True)
                for r in rows or []:
                    for n in (r.get("name_value") or "").split("\n"):
                        n = n.strip().lower()
                        if n and "*" not in n and n.endswith(d.lower()):
                            candidates.add(n)
            except Exception:
                continue

        cap = int(self.cfg.get("max_check", 250))
        candidates_list = sorted(candidates)[:cap]
        self.log.info(f"subdomain_takeover: checking {len(candidates_list)} subdomains")

        for host in candidates_list:
            cname = _resolve_cname(host)
            if not cname:
                continue
            for needle, body_marker, service in TAKEOVER_FINGERPRINTS:
                if needle in cname:
                    status, body = await _http_body(f"http://{host}")
                    if status >= 400 and body_marker.lower() in (body or "").lower():
                        findings.append(Finding.build(
                            title=f"[TAKEOVER] {host} → {service} (unclaimed CNAME)",
                            category="infra_exposure",
                            module=self.name,
                            affected_asset=host,
                            indicator=f"http://{host}",
                            description=f"{host} CNAMEs to {cname} ({service}) but the target service returns '{body_marker[:80]}…' — an attacker who claims that service can take over the subdomain.",
                            likelihood=4, impact=5,
                            references=[
                                "https://github.com/EdOverflow/can-i-take-over-xyz",
                                f"http://{host}",
                            ],
                            recommendation=f"Either reclaim the {service} resource or remove the CNAME record.",
                            remediation_priority="immediate",
                            raw={"cname": cname, "service": service, "http_status": status},
                        ))
                    break
        return findings
