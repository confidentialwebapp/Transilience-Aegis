"""crt.sh certificate-transparency client.

CT logs reveal every TLS cert ever issued for a name. Phishers usually issue
Let's Encrypt certs hours before going live, so this is the earliest signal
for typosquats / lookalike domains.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from core.http import request_json

BASE = "https://crt.sh"


async def search(query: str, exclude_expired: bool = False) -> list[dict[str, Any]]:
    """Free-form search. Use % for wildcards e.g. '%creditaccess%'."""
    params = {"q": query, "output": "json"}
    if exclude_expired:
        params["exclude"] = "expired"
    r = await request_json("GET", f"{BASE}/", params=params, retries=2, timeout=45)
    if isinstance(r, list):
        return r
    return []


def names_from_records(records: list[dict[str, Any]]) -> set[str]:
    """Extract unique domain names from cert records (CN + SANs)."""
    out: set[str] = set()
    for r in records:
        nv = r.get("name_value") or ""
        for n in nv.replace("\\n", "\n").split("\n"):
            n = n.strip().lower().lstrip("*.")
            if n and "." in n and " " not in n:
                out.add(n)
    return out


def newly_issued(records: list[dict[str, Any]], days: int = 90) -> list[dict[str, Any]]:
    """Filter records to those whose cert was issued in the last N days."""
    cutoff = datetime.now(timezone.utc).timestamp() - (days * 86400)
    out = []
    for r in records:
        ts = r.get("entry_timestamp") or r.get("not_before")
        if not ts:
            continue
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if dt.timestamp() >= cutoff:
                out.append(r)
        except Exception:
            continue
    return out
