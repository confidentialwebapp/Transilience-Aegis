"""
Threat Actor Directory Router
Sources: MITRE ATT&CK API, Ransomware.live
"""
import logging
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Header, Query, BackgroundTasks

from db import get_client

logger = logging.getLogger(__name__)
router = APIRouter()


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
# Ransomware.live — Free
# ---------------------------------------------------------------------------
async def fetch_ransomware_groups() -> list:
    """Fetch active ransomware groups from Ransomware.live API."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get("https://api.ransomware.live/groups")
            if resp.status_code == 200:
                groups = resp.json()
                return [
                    {
                        "name": g.get("name", ""),
                        "url": g.get("url", ""),
                        "last_seen": g.get("last_seen", ""),
                        "victim_count": len(g.get("locations", [])),
                        "status": "active" if g.get("available") else "inactive",
                        "description": g.get("description", ""),
                    }
                    for g in groups
                    if g.get("name")
                ]
    except Exception as e:
        logger.error("Ransomware.live fetch failed: %s", e)
    return []


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
    """Get active ransomware groups from Ransomware.live."""
    groups = await fetch_ransomware_groups()
    return {"data": groups, "total": len(groups)}


@router.get("/sync")
async def trigger_sync(background_tasks: BackgroundTasks, x_org_id: str = Header(...)):
    """Sync threat actors from MITRE ATT&CK."""
    background_tasks.add_task(sync_mitre_actors)
    return {"status": "sync_started"}


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
