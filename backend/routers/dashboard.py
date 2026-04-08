import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Query

from db import get_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/summary")
async def dashboard_summary(
    x_org_id: str = Header(...),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    try:
        client = get_client()

        # Fetch alerts
        alerts_query = client.table("alerts").select("severity, module, status, asset_id, created_at").eq("org_id", x_org_id)
        if date_from:
            alerts_query = alerts_query.gte("created_at", date_from)
        if date_to:
            alerts_query = alerts_query.lte("created_at", date_to)
        alerts_result = alerts_query.execute()
        alerts = alerts_result.data if alerts_result.data else []

        # Fetch assets
        assets_result = client.table("assets").select("id, type, status").eq("org_id", x_org_id).execute()
        assets = assets_result.data if assets_result.data else []

        # Aggregate alerts by severity
        by_severity = {}
        for a in alerts:
            sev = a.get("severity", "unknown")
            by_severity[sev] = by_severity.get(sev, 0) + 1

        # Aggregate alerts by module (for donut chart)
        by_module = {}
        for a in alerts:
            mod = a.get("module", "unknown")
            by_module[mod] = by_module.get(mod, 0) + 1

        # Aggregate assets by type
        assets_by_type = {}
        for asset in assets:
            t = asset.get("type", "unknown")
            assets_by_type[t] = assets_by_type.get(t, 0) + 1

        # Top assets by mention count
        asset_mentions = {}
        for a in alerts:
            aid = a.get("asset_id")
            if aid:
                asset_mentions[aid] = asset_mentions.get(aid, 0) + 1

        top_asset_ids = sorted(asset_mentions, key=lambda x: asset_mentions[x], reverse=True)[:10]
        top_assets = []
        if top_asset_ids:
            try:
                top_result = client.table("assets").select("id, type, value").in_("id", top_asset_ids).execute()
                asset_map = {a["id"]: a for a in (top_result.data or [])}
                for aid in top_asset_ids:
                    if aid in asset_map:
                        top_assets.append({
                            **asset_map[aid],
                            "mentions": asset_mentions[aid],
                        })
            except Exception as e:
                logger.warning("Failed to fetch top assets: %s", e)

        # Recent alerts
        try:
            recent_result = (
                client.table("alerts")
                .select("id, severity, title, module, created_at, risk_score")
                .eq("org_id", x_org_id)
                .order("created_at", desc=True)
                .limit(20)
                .execute()
            )
            recent_alerts = recent_result.data if recent_result.data else []
        except Exception as e:
            logger.warning("Failed to fetch recent alerts: %s", e)
            recent_alerts = []

        # Exposure sources
        total_mentions = len(alerts)
        suspects = len([a for a in alerts if a.get("severity") in ("critical", "high")])
        incidents = len([a for a in alerts if a.get("status") == "open"])

        return {
            "exposure_sources": {
                "total_mentions": total_mentions,
                "suspects_identified": suspects,
                "incidents": incidents,
            },
            "monitored_assets": assets_by_type,
            "total_assets": len(assets),
            "alerts_by_severity": by_severity,
            "alerts_by_module": by_module,
            "top_assets": top_assets,
            "recent_alerts": recent_alerts,
            "total_alerts": len(alerts),
        }
    except Exception as e:
        logger.error("Failed to get dashboard summary: %s", e)
        raise HTTPException(500, f"Failed to get dashboard summary: {str(e)}")
