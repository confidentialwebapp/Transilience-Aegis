"""
Threat Actor Directory Router
Sources: MITRE ATT&CK API, Ransomware.live
"""
import logging
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Header, Query, BackgroundTasks

from config import get_settings
from db import get_client

logger = logging.getLogger(__name__)
router = APIRouter()

# Ransomware.live PRO API (api-pro.ransomware.live) — authenticated
RANSOMWARE_LIVE_BASE = "https://api-pro.ransomware.live"


def _rl_headers() -> dict:
    """Headers for ransomware.live pro API (X-API-KEY auth)."""
    key = get_settings().RANSOMWARE_LIVE_API_KEY
    h: dict[str, str] = {"User-Agent": "Transilience-Aegis/1.0", "Accept": "application/json"}
    if key:
        h["X-API-KEY"] = key
    return h


async def _rl_get(path: str, params: Optional[dict] = None, timeout: int = 30) -> Optional[dict | list]:
    """Shared ransomware.live GET helper. Returns parsed JSON or None on failure."""
    url = f"{RANSOMWARE_LIVE_BASE}{path}"
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url, headers=_rl_headers(), params=params)
            if resp.status_code == 200:
                return resp.json()
            logger.warning("ransomware.live %s returned %s", path, resp.status_code)
    except Exception as e:
        logger.error("ransomware.live %s failed: %s", path, e)
    return None


# ---------------------------------------------------------------------------
# MITRE ATT&CK — Free, unlimited
# ---------------------------------------------------------------------------
async def fetch_mitre_groups() -> list:
    """Fetch threat actor groups from MITRE ATT&CK STIX data."""
    url = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                groups = []
                # Build lookup maps
                objects = data.get("objects", [])
                malware_map = {}
                tool_map = {}
                technique_map = {}

                for obj in objects:
                    obj_type = obj.get("type", "")
                    if obj_type == "malware":
                        malware_map[obj.get("id")] = obj.get("name", "")
                    elif obj_type == "tool":
                        tool_map[obj.get("id")] = obj.get("name", "")
                    elif obj_type == "attack-pattern":
                        ext = obj.get("external_references", [])
                        mitre_id = next((r.get("external_id") for r in ext if r.get("source_name") == "mitre-attack"), "")
                        technique_map[obj.get("id")] = mitre_id

                # Get relationships
                group_techniques = {}
                group_malware = {}
                for obj in objects:
                    if obj.get("type") == "relationship":
                        source = obj.get("source_ref", "")
                        target = obj.get("target_ref", "")
                        rel_type = obj.get("relationship_type", "")
                        if source.startswith("intrusion-set"):
                            if rel_type == "uses":
                                if target.startswith("attack-pattern"):
                                    group_techniques.setdefault(source, []).append(technique_map.get(target, ""))
                                elif target.startswith("malware"):
                                    group_malware.setdefault(source, []).append(malware_map.get(target, ""))
                                elif target.startswith("tool"):
                                    group_malware.setdefault(source, []).append(tool_map.get(target, ""))

                for obj in objects:
                    if obj.get("type") == "intrusion-set":
                        ext_refs = obj.get("external_references", [])
                        mitre_id = next((r.get("external_id") for r in ext_refs if r.get("source_name") == "mitre-attack"), "")
                        mitre_url = next((r.get("url") for r in ext_refs if r.get("source_name") == "mitre-attack"), "")

                        aliases = obj.get("aliases", [])
                        name = obj.get("name", "")
                        if name in aliases:
                            aliases.remove(name)

                        # Extract country from description heuristic
                        desc = obj.get("description", "")
                        country = ""
                        for c in ["China", "Russia", "Iran", "North Korea", "Israel", "Vietnam", "Pakistan", "India", "Turkey"]:
                            if c.lower() in desc.lower():
                                country = c
                                break

                        # Motivation
                        goals = obj.get("goals", [])
                        motivation = ""
                        if goals:
                            motivation = goals[0]
                        elif "espionage" in desc.lower():
                            motivation = "Espionage"
                        elif "financial" in desc.lower():
                            motivation = "Financial"
                        elif "destructive" in desc.lower():
                            motivation = "Destructive"

                        # Target sectors from description
                        sectors = []
                        for sector in ["financial", "government", "healthcare", "energy", "defense", "technology",
                                       "telecommunications", "education", "manufacturing", "retail", "aviation"]:
                            if sector in desc.lower():
                                sectors.append(sector.capitalize())

                        group = {
                            "mitre_id": mitre_id,
                            "name": name,
                            "aliases": aliases[:10],
                            "description": desc[:1500],
                            "country": country,
                            "motivation": motivation,
                            "first_seen": obj.get("first_seen", ""),
                            "last_seen": obj.get("last_seen", ""),
                            "target_sectors": sectors[:10],
                            "techniques": list(set(group_techniques.get(obj.get("id"), [])))[:20],
                            "malware_used": list(set(group_malware.get(obj.get("id"), [])))[:15],
                            "source": "mitre_attack",
                            "mitre_url": mitre_url,
                        }
                        groups.append(group)

                return groups
    except Exception as e:
        logger.error("MITRE ATT&CK fetch failed: %s", e)
    return []


async def sync_mitre_actors():
    """Background task: sync MITRE ATT&CK threat actors to database."""
    try:
        db = get_client()
        groups = await fetch_mitre_groups()
        for group in groups:
            try:
                existing = db.table("threat_actors").select("id").eq("mitre_id", group["mitre_id"]).execute()
                if existing.data:
                    db.table("threat_actors").update(group).eq("id", existing.data[0]["id"]).execute()
                else:
                    db.table("threat_actors").insert(group).execute()
            except Exception as e:
                logger.warning("Failed to upsert actor %s: %s", group["name"], e)
        logger.info("Synced %d MITRE ATT&CK groups", len(groups))
    except Exception as e:
        logger.error("MITRE sync failed: %s", e)


# ---------------------------------------------------------------------------
# Ransomware.live Pro — Authenticated API
# ---------------------------------------------------------------------------
async def fetch_ransomware_groups() -> list:
    """Fetch active ransomware groups + recent-victim counts."""
    groups_envelope = await _rl_get("/groups")
    groups_list = (groups_envelope or {}).get("groups", []) if isinstance(groups_envelope, dict) else []
    if not groups_list:
        return []

    # Pull the most recent victims and aggregate last_seen + 30d counts per group.
    recent_env = await _rl_get("/victims/recent", params={"limit": 200})
    recent = (recent_env or {}).get("victims", []) if isinstance(recent_env, dict) else []

    recent_counts: dict[str, int] = {}
    last_seen: dict[str, str] = {}
    for v in recent:
        g = (v.get("group") or v.get("group_name") or "").strip()
        if not g:
            continue
        recent_counts[g] = recent_counts.get(g, 0) + 1
        ts = v.get("discovered") or v.get("published") or ""
        if ts and (g not in last_seen or ts > last_seen[g]):
            last_seen[g] = ts

    result = []
    for g in groups_list:
        name = (g.get("group") or g.get("name") or "").strip()
        if not name:
            continue
        total_victims = int(g.get("victims") or 0)
        alt = g.get("altname") or ""
        url = g.get("url") or ""
        # Pro API often includes more fields — pick up what's there
        result.append({
            "name": name,
            "altname": alt,
            "url": url,
            "last_seen": last_seen.get(name, ""),
            "victim_count": total_victims,
            "recent_victims": recent_counts.get(name, 0),
            "status": "active" if recent_counts.get(name, 0) > 0 else "dormant",
            "description": g.get("description") or f"Tracked ransomware operator · {total_victims} known victims",
            "country": g.get("country") or "",
            "source": "ransomware.live",
        })

    # Sort: active first, then by total victims desc
    result.sort(key=lambda x: (0 if x["status"] == "active" else 1, -int(x.get("victim_count") or 0)))
    return result


async def fetch_recent_victims(limit: int = 50) -> list:
    """Recent victims across all groups — normalized for frontend cards."""
    envelope = await _rl_get("/victims/recent", params={"limit": min(limit, 200)})
    victims = (envelope or {}).get("victims", []) if isinstance(envelope, dict) else []
    out = []
    for v in victims[:limit]:
        out.append({
            "victim": v.get("victim") or v.get("post_title") or v.get("website") or "Unknown",
            "website": v.get("website") or "",
            "group": v.get("group") or v.get("group_name") or "",
            "country": v.get("country") or "",
            "activity": v.get("activity") or v.get("sector") or "",
            "description": (v.get("description") or v.get("summary") or "")[:800],
            "discovered": v.get("discovered") or v.get("published") or "",
            "post_url": v.get("post_url") or v.get("claim_url") or v.get("url") or "",
            "screenshot": v.get("screenshot") or v.get("image") or "",
            "id": v.get("id") or "",
            "source": "ransomware.live",
        })
    return out


async def fetch_country_victims(country: str) -> list:
    """Victims in a given country — uses /victims/search with country filter."""
    envelope = await _rl_get("/victims/search", params={"country": country.upper(), "limit": 200})
    if not isinstance(envelope, dict):
        return []
    return envelope.get("victims", []) or envelope.get("results", []) or []


async def fetch_group_victims(group: str) -> list:
    """All tracked victims for a single group."""
    envelope = await _rl_get("/victims/", params={"group": group, "limit": 500})
    if not isinstance(envelope, dict):
        return []
    return envelope.get("victims", []) or envelope.get("results", []) or []


async def fetch_ransomware_stats() -> dict:
    """Aggregate statistics — total victims, groups, press releases."""
    data = await _rl_get("/stats")
    if not data or not isinstance(data, dict):
        return {}
    return data


async def fetch_recent_press(limit: int = 50) -> list:
    """Recent public press releases / SEC 8-K filings announcing breaches."""
    envelope = await _rl_get("/press/recent", params={"limit": min(limit, 200)})
    if not isinstance(envelope, dict):
        return []
    return envelope.get("results", []) or envelope.get("press", []) or []


async def fetch_ransomware_iocs(group: Optional[str] = None) -> list:
    """IOCs for all groups or a specific group — hashes, IPs, BTC addresses."""
    path = f"/iocs/{group}" if group else "/iocs"
    envelope = await _rl_get(path)
    if not isinstance(envelope, dict):
        return []
    return envelope.get("iocs", []) or envelope.get("groups", []) or []


async def fetch_yara_rules(group: Optional[str] = None) -> list:
    """YARA rules associated with ransomware families."""
    path = f"/yara/{group}" if group else "/yara"
    envelope = await _rl_get(path)
    if not isinstance(envelope, dict):
        return []
    return envelope.get("rules", []) or envelope.get("yara", []) or []


async def sync_ransomware_to_db():
    """Scheduled task: pull groups + recent victims into Supabase for offline queries."""
    try:
        db = get_client()
        groups = await fetch_ransomware_groups()
        for g in groups:
            try:
                record = {
                    "name": g["name"],
                    "url": g.get("url", ""),
                    "last_seen": g.get("last_seen") or None,
                    "victim_count": g.get("victim_count", 0),
                    "status": g.get("status", "inactive"),
                    "description": g.get("description", ""),
                }
                existing = db.table("ransomware_groups").select("id").eq("name", g["name"]).execute()
                if existing.data:
                    db.table("ransomware_groups").update(record).eq("id", existing.data[0]["id"]).execute()
                else:
                    db.table("ransomware_groups").insert(record).execute()
            except Exception as e:
                # Table might not exist yet — log and keep going
                logger.warning("upsert ransomware group %s: %s", g["name"], e)
        logger.info("Synced %d ransomware groups from ransomware.live", len(groups))
    except Exception as e:
        logger.error("ransomware sync failed: %s", e)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/")
async def list_threat_actors(
    x_org_id: str = Header(...),
    search: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    try:
        db = get_client()
        query = db.table("threat_actors").select("*", count="exact")
        if search:
            query = query.or_(f"name.ilike.%{search}%,description.ilike.%{search}%,aliases.cs.{{{search}}}")
        if country:
            query = query.eq("country", country)
        offset = (page - 1) * per_page
        result = query.order("name").range(offset, offset + per_page - 1).execute()
        return {
            "data": result.data or [],
            "total": getattr(result, "count", None) or 0,
            "page": page,
            "per_page": per_page,
        }
    except Exception as e:
        logger.error("Threat actors list error: %s", e)
        raise HTTPException(500, str(e))


@router.get("/ransomware")
async def get_ransomware_groups(x_org_id: str = Header(...)):
    """Active ransomware groups — live from ransomware.live."""
    groups = await fetch_ransomware_groups()
    return {"data": groups, "total": len(groups), "source": "ransomware.live"}


@router.get("/ransomware/victims/recent")
async def get_recent_victims(
    x_org_id: str = Header(...),
    limit: int = Query(50, ge=1, le=200),
):
    """Most recent ransomware victim posts across all groups."""
    victims = await fetch_recent_victims(limit=limit)
    return {"data": victims, "total": len(victims), "source": "ransomware.live"}


@router.get("/ransomware/victims/country/{country}")
async def get_country_victims(
    country: str,
    x_org_id: str = Header(...),
):
    """Ransomware victims in a given country (ISO code)."""
    victims = await fetch_country_victims(country)
    return {"data": victims, "total": len(victims), "country": country.upper()}


@router.get("/ransomware/group/{group}/victims")
async def get_group_victims(group: str, x_org_id: str = Header(...)):
    """All known victims for a specific ransomware group."""
    victims = await fetch_group_victims(group)
    return {"data": victims, "total": len(victims), "group": group}


@router.get("/ransomware/stats")
async def get_ransomware_stats(x_org_id: str = Header(...)):
    """Ransomware.live aggregate statistics."""
    stats = await fetch_ransomware_stats()
    return stats


@router.get("/ransomware/press")
async def get_recent_press(
    x_org_id: str = Header(...),
    limit: int = Query(50, ge=1, le=200),
):
    """Recent press releases + SEC 8-K breach disclosures."""
    press = await fetch_recent_press(limit=limit)
    return {"data": press, "total": len(press), "source": "ransomware.live"}


@router.get("/ransomware/iocs")
async def get_ransomware_iocs(
    x_org_id: str = Header(...),
    group: Optional[str] = Query(None, description="Filter by group name"),
):
    """IOCs published by ransomware groups (hashes, IPs, BTC addresses)."""
    iocs = await fetch_ransomware_iocs(group=group)
    return {"data": iocs, "total": len(iocs), "group": group, "source": "ransomware.live"}


@router.get("/ransomware/yara")
async def get_yara_rules(
    x_org_id: str = Header(...),
    group: Optional[str] = Query(None, description="Filter by group name"),
):
    """YARA detection rules for ransomware families."""
    rules = await fetch_yara_rules(group=group)
    return {"data": rules, "total": len(rules), "group": group, "source": "ransomware.live"}


@router.get("/sync")
async def trigger_sync(background_tasks: BackgroundTasks, x_org_id: str = Header(...)):
    """Sync threat actors from MITRE ATT&CK + ransomware.live."""
    background_tasks.add_task(sync_mitre_actors)
    background_tasks.add_task(sync_ransomware_to_db)
    return {"status": "sync_started", "sources": ["mitre_attack", "ransomware.live"]}


@router.get("/stats")
async def actor_stats(x_org_id: str = Header(...)):
    try:
        db = get_client()
        total = db.table("threat_actors").select("id", count="exact").execute()
        return {"total": getattr(total, "count", 0) or 0}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/{actor_id}")
async def get_actor(actor_id: str, x_org_id: str = Header(...)):
    try:
        db = get_client()
        result = db.table("threat_actors").select("*").eq("id", actor_id).execute()
        if not result.data:
            raise HTTPException(404, "Actor not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
