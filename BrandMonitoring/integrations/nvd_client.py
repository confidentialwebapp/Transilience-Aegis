"""NVD CVE API client."""
from __future__ import annotations

from typing import Any

from config.settings import KEYS
from core.http import request_json

BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"


def _headers() -> dict[str, str]:
    h = {"Accept": "application/json"}
    if KEYS.nvd:
        h["apiKey"] = KEYS.nvd
    return h


async def cve(cve_id: str) -> dict[str, Any] | None:
    return await request_json("GET", BASE, headers=_headers(), params={"cveId": cve_id})  # type: ignore[return-value]


async def search_keyword(keyword: str, results_per_page: int = 20) -> dict[str, Any] | None:
    return await request_json(
        "GET", BASE, headers=_headers(),
        params={"keywordSearch": keyword, "resultsPerPage": results_per_page},
    )  # type: ignore[return-value]
