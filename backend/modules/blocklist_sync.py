"""
Open-source blocklist ingestion.

Pulls free, no-API-key feeds and upserts into `blocklist_entries`:
  - Abuse.ch Feodo Tracker   (banking trojan C2 IPs)
  - OpenPhish                (phishing URLs)
  - PhishStats               (scored phishing URLs)
  - Emerging Threats         (compromised IPs + blocked IPs)
  - Tor Project              (exit-node IPs)

Each fetcher is self-contained and logs its own run into
`blocklist_sync_runs`. Failures in one source do not affect others.
"""
import csv
import io
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

import httpx

from db import get_client

logger = logging.getLogger(__name__)

# Cap per-source ingestion so a multi-hundred-thousand-line feed
# (e.g. PhishStats) does not dominate the table.
MAX_ENTRIES_PER_SOURCE = 5000


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _start_run(source: str) -> Optional[str]:
    try:
        db = get_client()
        result = db.table("blocklist_sync_runs").insert({
            "source": source,
            "status": "success",  # optimistic; updated in _finish_run
            "started_at": _now_iso(),
        }).execute()
        return result.data[0]["id"] if result.data else None
    except Exception as e:
        logger.warning("Failed to open sync-run row for %s: %s", source, e)
        return None


async def _finish_run(
    run_id: Optional[str],
    source: str,
    status: str,
    fetched: int,
    upserted: int,
    error: Optional[str] = None,
) -> None:
    if not run_id:
        return
    try:
        db = get_client()
        db.table("blocklist_sync_runs").update({
            "status": status,
            "entries_fetched": fetched,
            "entries_upserted": upserted,
            "error": (error or "")[:500] if error else None,
            "completed_at": _now_iso(),
        }).eq("id", run_id).execute()
    except Exception as e:
        logger.warning("Failed to close sync-run row for %s: %s", source, e)


def _upsert_batch(entries: List[Dict[str, Any]]) -> int:
    """Upsert entries in chunks; return count actually written."""
    if not entries:
        return 0
    db = get_client()
    written = 0
    for i in range(0, len(entries), 500):
        batch = entries[i:i + 500]
        try:
            db.table("blocklist_entries").upsert(
                batch, on_conflict="source,ioc_value"
            ).execute()
            written += len(batch)
        except Exception as e:
            logger.warning("Blocklist upsert chunk failed (size=%d): %s", len(batch), e)
    return written


# ---------------------------------------------------------------------------
# Abuse.ch — Feodo Tracker (banking trojan C2 IPs)
# ---------------------------------------------------------------------------
async def sync_feodo_tracker() -> Dict[str, int]:
    source = "feodo_tracker"
    run_id = await _start_run(source)
    fetched = upserted = 0
    error: Optional[str] = None
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(
                "https://feodotracker.abuse.ch/downloads/ipblocklist.json"
            )
            if resp.status_code != 200:
                raise RuntimeError(f"HTTP {resp.status_code}")
            data = resp.json()

        entries: List[Dict[str, Any]] = []
        for row in data[:MAX_ENTRIES_PER_SOURCE]:
            ip = (row.get("ip_address") or "").strip()
            if not ip:
                continue
            entries.append({
                "ioc_type": "ip",
                "ioc_value": ip,
                "source": source,
                "category": "c2",
                "confidence": 90,
                "last_seen": _now_iso(),
                "metadata": {
                    "malware": row.get("malware"),
                    "port": row.get("port"),
                    "first_seen": row.get("first_seen"),
                    "last_online": row.get("last_online"),
                },
            })
        fetched = len(entries)
        upserted = _upsert_batch(entries)
        await _finish_run(run_id, source, "success", fetched, upserted)
    except Exception as e:
        error = str(e)
        logger.error("Feodo Tracker sync failed: %s", error)
        await _finish_run(run_id, source, "failed", fetched, upserted, error)
    return {"source": source, "fetched": fetched, "upserted": upserted, "error": error}


# ---------------------------------------------------------------------------
# OpenPhish — phishing URLs (free community feed, hourly refresh upstream)
# ---------------------------------------------------------------------------
async def sync_openphish() -> Dict[str, int]:
    source = "openphish"
    run_id = await _start_run(source)
    fetched = upserted = 0
    error: Optional[str] = None
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get("https://openphish.com/feed.txt")
            if resp.status_code != 200:
                raise RuntimeError(f"HTTP {resp.status_code}")
            lines = [ln.strip() for ln in resp.text.splitlines() if ln.strip()]

        entries: List[Dict[str, Any]] = []
        for url in lines[:MAX_ENTRIES_PER_SOURCE]:
            entries.append({
                "ioc_type": "url",
                "ioc_value": url[:2000],
                "source": source,
                "category": "phishing",
                "confidence": 85,
                "last_seen": _now_iso(),
            })
        fetched = len(entries)
        upserted = _upsert_batch(entries)
        await _finish_run(run_id, source, "success", fetched, upserted)
    except Exception as e:
        error = str(e)
        logger.error("OpenPhish sync failed: %s", error)
        await _finish_run(run_id, source, "failed", fetched, upserted, error)
    return {"source": source, "fetched": fetched, "upserted": upserted, "error": error}


# ---------------------------------------------------------------------------
# PhishStats — CSV of scored phishing URLs
# Format: "Date","Score","URL","IP"
# Only ingest the top-scored N so we stay bounded.
# ---------------------------------------------------------------------------
async def sync_phishstats() -> Dict[str, int]:
    source = "phishstats"
    run_id = await _start_run(source)
    fetched = upserted = 0
    error: Optional[str] = None
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            resp = await client.get("https://phishstats.info/phish_score.csv")
            if resp.status_code != 200:
                raise RuntimeError(f"HTTP {resp.status_code}")
            text = resp.text

        reader = csv.reader(io.StringIO(text))
        entries: List[Dict[str, Any]] = []
        for row in reader:
            if not row or row[0].startswith("#"):
                continue
            if len(row) < 3:
                continue
            try:
                score = float(row[1])
            except (TypeError, ValueError):
                continue
            url = (row[2] or "").strip().strip('"')
            if not url:
                continue
            # PhishStats score 0..10 → map to confidence 50..95
            confidence = max(50, min(95, int(50 + score * 4.5)))
            entries.append({
                "ioc_type": "url",
                "ioc_value": url[:2000],
                "source": source,
                "category": "phishing",
                "confidence": confidence,
                "last_seen": _now_iso(),
                "metadata": {
                    "score": score,
                    "ip": row[3] if len(row) > 3 else None,
                    "seen": row[0],
                },
            })
            if len(entries) >= MAX_ENTRIES_PER_SOURCE:
                break
        fetched = len(entries)
        upserted = _upsert_batch(entries)
        await _finish_run(run_id, source, "success", fetched, upserted)
    except Exception as e:
        error = str(e)
        logger.error("PhishStats sync failed: %s", error)
        await _finish_run(run_id, source, "failed", fetched, upserted, error)
    return {"source": source, "fetched": fetched, "upserted": upserted, "error": error}


# ---------------------------------------------------------------------------
# Emerging Threats — compromised + blocked IPs
# ---------------------------------------------------------------------------
_ET_FEEDS = {
    "et_compromised": (
        "https://rules.emergingthreats.net/blockrules/compromised-ips.txt",
        "compromised",
        80,
    ),
    "et_block_ips": (
        "https://rules.emergingthreats.net/fwrules/emerging-Block-IPs.txt",
        "blocked",
        85,
    ),
}


async def _sync_et_feed(source: str) -> Dict[str, int]:
    url, category, confidence = _ET_FEEDS[source]
    run_id = await _start_run(source)
    fetched = upserted = 0
    error: Optional[str] = None
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                raise RuntimeError(f"HTTP {resp.status_code}")
            text = resp.text

        ip_re = re.compile(r"^\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b")
        entries: List[Dict[str, Any]] = []
        for line in text.splitlines():
            if not line or line.lstrip().startswith("#"):
                continue
            m = ip_re.match(line)
            if not m:
                continue
            entries.append({
                "ioc_type": "ip",
                "ioc_value": m.group(1),
                "source": source,
                "category": category,
                "confidence": confidence,
                "last_seen": _now_iso(),
            })
            if len(entries) >= MAX_ENTRIES_PER_SOURCE:
                break
        fetched = len(entries)
        upserted = _upsert_batch(entries)
        await _finish_run(run_id, source, "success", fetched, upserted)
    except Exception as e:
        error = str(e)
        logger.error("ET feed %s sync failed: %s", source, error)
        await _finish_run(run_id, source, "failed", fetched, upserted, error)
    return {"source": source, "fetched": fetched, "upserted": upserted, "error": error}


async def sync_emerging_threats() -> List[Dict[str, int]]:
    results = []
    for src in _ET_FEEDS:
        results.append(await _sync_et_feed(src))
    return results


# ---------------------------------------------------------------------------
# Tor Project — exit-node list (enrichment flag)
# ---------------------------------------------------------------------------
async def sync_tor_exit_nodes() -> Dict[str, int]:
    source = "tor_exit"
    run_id = await _start_run(source)
    fetched = upserted = 0
    error: Optional[str] = None
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get("https://check.torproject.org/torbulkexitlist")
            if resp.status_code != 200:
                raise RuntimeError(f"HTTP {resp.status_code}")
            lines = [ln.strip() for ln in resp.text.splitlines() if ln.strip()]

        ip_re = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")
        entries: List[Dict[str, Any]] = []
        for line in lines[:MAX_ENTRIES_PER_SOURCE]:
            if not ip_re.match(line):
                continue
            entries.append({
                "ioc_type": "ip",
                "ioc_value": line,
                "source": source,
                "category": "tor_exit",
                "confidence": 100,
                "last_seen": _now_iso(),
            })
        fetched = len(entries)
        upserted = _upsert_batch(entries)
        await _finish_run(run_id, source, "success", fetched, upserted)
    except Exception as e:
        error = str(e)
        logger.error("Tor exit-list sync failed: %s", error)
        await _finish_run(run_id, source, "failed", fetched, upserted, error)
    return {"source": source, "fetched": fetched, "upserted": upserted, "error": error}


# ---------------------------------------------------------------------------
# Orchestrator — runs every source sequentially so any single failure is
# contained. Called from the APScheduler job.
# ---------------------------------------------------------------------------
async def run_all_blocklists() -> Dict[str, Any]:
    logger.info("Starting open-blocklist sync")
    summary: List[Dict[str, int]] = []
    summary.append(await sync_feodo_tracker())
    summary.append(await sync_openphish())
    summary.append(await sync_phishstats())
    summary.extend(await sync_emerging_threats())
    summary.append(await sync_tor_exit_nodes())
    total_fetched = sum(int(r.get("fetched", 0)) for r in summary)
    total_upserted = sum(int(r.get("upserted", 0)) for r in summary)
    logger.info(
        "Blocklist sync done: fetched=%d upserted=%d across %d sources",
        total_fetched, total_upserted, len(summary),
    )
    return {
        "total_fetched": total_fetched,
        "total_upserted": total_upserted,
        "sources": summary,
    }


# ---------------------------------------------------------------------------
# Lookup helpers used by routers/intel.py and routers/investigate.py.
# These read from the local DB only — no outbound HTTP.
# ---------------------------------------------------------------------------
def lookup_blocklist(ioc_type: str, ioc_value: str) -> List[Dict[str, Any]]:
    """Return every blocklist hit for the given IOC across all sources."""
    try:
        db = get_client()
        result = (
            db.table("blocklist_entries")
            .select("source,category,confidence,first_seen,last_seen,metadata")
            .eq("ioc_type", ioc_type)
            .eq("ioc_value", ioc_value)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.warning("blocklist lookup failed for %s/%s: %s", ioc_type, ioc_value, e)
        return []


def blocklist_stats() -> Dict[str, Any]:
    """Return per-source counts + freshness for the admin dashboard."""
    try:
        db = get_client()
        runs = (
            db.table("blocklist_sync_runs")
            .select("source,status,entries_upserted,completed_at")
            .order("completed_at", desc=True)
            .limit(200)
            .execute()
        )
        latest: Dict[str, Dict[str, Any]] = {}
        for row in runs.data or []:
            src = row["source"]
            if src not in latest:
                latest[src] = row
        return {"latest_runs": list(latest.values())}
    except Exception as e:
        logger.warning("blocklist_stats failed: %s", e)
        return {"latest_runs": []}
