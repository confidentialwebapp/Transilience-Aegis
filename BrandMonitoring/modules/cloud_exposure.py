"""Cloud exposure (DRP) — public bucket discovery.

Generates likely brand-named bucket candidates from naming templates and
HEAD-checks them against AWS S3 / Azure Blob / GCS endpoints. Two outcomes
matter:
  - 200 with public listing → "public-read" bucket containing brand data
  - 403 with bucket-exists header → bucket exists privately under brand name
    (a phisher could squat the matching name on another cloud, etc.)
"""
from __future__ import annotations

import asyncio
import re
from typing import Any

import httpx

from core.base_module import DetectionModule
from core.evidence import Finding


def _candidates(brand: str, keywords: list[str]) -> list[str]:
    """Build bucket-name guesses from brand + keywords."""
    seeds: set[str] = set()
    norm = re.sub(r"[^a-z0-9-]+", "-", brand.lower()).strip("-")
    for s in [norm] + [re.sub(r"[^a-z0-9-]+", "-", k.lower()).strip("-") for k in keywords]:
        if not s or len(s) < 3:
            continue
        seeds.add(s)
        for suffix in ("", "-prod", "-dev", "-staging", "-backup", "-data", "-files",
                       "-uploads", "-static", "-cdn", "-assets", "-public", "-private",
                       "-internal", "-reports", "-docs"):
            seeds.add(f"{s}{suffix}")
    return sorted(seeds)


def _aws_url(name: str) -> str:
    return f"https://{name}.s3.amazonaws.com/"


def _azure_url(name: str) -> str:
    return f"https://{name}.blob.core.windows.net/?comp=list"


def _gcs_url(name: str) -> str:
    return f"https://storage.googleapis.com/{name}/"


async def _probe(client: httpx.AsyncClient, url: str) -> tuple[int, dict[str, str], str]:
    try:
        r = await client.get(url, timeout=8)
        return r.status_code, dict(r.headers), (r.text or "")[:512]
    except Exception:
        return 0, {}, ""


def _classify(provider: str, status: int, body: str, headers: dict[str, str]) -> str | None:
    """Return 'public', 'private_exists', or None."""
    if status == 200 and "ListBucketResult" in body:
        return "public"
    if status == 200 and ("BlobPrefix" in body or "<Blobs>" in body):
        return "public"
    if status == 200 and "<ListBucketResult" in body:
        return "public"
    if provider == "aws":
        if status == 403 and "AccessDenied" in body and "BucketName" in body:
            return "private_exists"
    if provider == "azure":
        if status == 400 and "InvalidQueryParameterValue" in body:
            return "private_exists"
    if provider == "gcs":
        if status == 403 and ("AccessDenied" in body or "<Code>AccessDenied</Code>" in body):
            return "private_exists"
    return None


class CloudExposureModule(DetectionModule):
    name = "cloud_exposure"
    category = "infra_exposure"
    description = "Public S3 / Azure Blob / GCS bucket discovery via brand-named candidates."

    async def run(self) -> list[Finding]:
        findings: list[Finding] = []
        assets = self.brand.get("assets") or {}
        keywords = assets.get("brand_keywords") or []
        brand = (self.brand.get("brand") or {}).get("name") or ""
        names = _candidates(brand, keywords)
        cap = int(self.cfg.get("max_candidates", 80))
        names = names[:cap]
        self.log.info(f"cloud_exposure: probing {len(names)} bucket candidates")

        async with httpx.AsyncClient(headers={"User-Agent": "BrandMonitoring/1.0"}, follow_redirects=False) as client:
            for n in names:
                for provider, url in (("aws", _aws_url(n)), ("azure", _azure_url(n)), ("gcs", _gcs_url(n))):
                    status, headers, body = await _probe(client, url)
                    label = _classify(provider, status, body, headers)
                    if label is None:
                        continue
                    sev = (4, 5) if label == "public" else (3, 3)
                    findings.append(Finding.build(
                        title=f"[CLOUD] {provider.upper()} bucket {n} is {label.replace('_', '-')}",
                        category="infra_exposure",
                        module=self.name,
                        affected_asset=n,
                        indicator=url,
                        description=f"{provider.upper()} bucket '{n}' returned HTTP {status}. Classification: {label}. {('Bucket lists public objects — review for sensitive data.' if label == 'public' else 'Bucket name is yours by reservation; consider squatting any unclaimed equivalents on other clouds.')}",
                        likelihood=sev[0], impact=sev[1],
                        recommendation=("Audit and lock down the bucket; remove sensitive content from public listing." if label == "public" else "Reserve the matching name on the other major clouds to prevent typosquat impersonation."),
                        remediation_priority=("immediate" if label == "public" else "short_term"),
                        raw={"status": status, "provider": provider, "snippet": body[:200]},
                    ))
        return findings
