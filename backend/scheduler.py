import logging
import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

from typing import Optional

_scheduler: Optional[AsyncIOScheduler] = None


async def _run_module_for_all_orgs(module_func, module_name: str):
    logger.info(f"Scheduler: running {module_name} for all orgs")
    try:
        from db import get_client
        client = get_client()
        orgs = client.table("orgs").select("id").execute()
        for org in orgs.data:
            try:
                await module_func(org["id"])
            except Exception as e:
                logger.error(f"Scheduled {module_name} failed for org {org['id']}: {e}")
    except Exception as e:
        logger.error(f"Scheduler failed to fetch orgs for {module_name}: {e}")


async def _cert_monitor_job():
    from modules.cert_monitor import run_cert_monitor
    await _run_module_for_all_orgs(run_cert_monitor, "cert_monitor")


async def _dark_web_job():
    from modules.dark_web import run_dark_web_scan
    await _run_module_for_all_orgs(run_dark_web_scan, "dark_web")


async def _brand_monitor_job():
    from modules.brand_monitor import run_brand_monitor
    await _run_module_for_all_orgs(run_brand_monitor, "brand_monitor")


async def _data_leak_job():
    from modules.data_leak import run_data_leak_scan
    await _run_module_for_all_orgs(run_data_leak_scan, "data_leak")


async def _surface_scan_job():
    from modules.surface_web import run_surface_scan
    await _run_module_for_all_orgs(run_surface_scan, "surface_web")


async def _credential_scan_job():
    from modules.credential_scan import run_credential_scan
    await _run_module_for_all_orgs(run_credential_scan, "credential")


async def _ransomware_sync_job():
    """Pull fresh ransomware group + victim data from ransomware.live into DB,
    then run the customer-profile matcher to surface alerts."""
    try:
        from routers.threat_actors import sync_ransomware_to_db
        await sync_ransomware_to_db()
    except Exception as e:
        logger.error("Ransomware sync job failed: %s", e)
    # Always run the matcher even if the group sync failed — victims come
    # from the same API and are useful independently.
    try:
        from modules.ransomware_matcher import run_sync_and_match
        result = await run_sync_and_match(limit=100)
        logger.info("Ransomware matcher: %s", result)
    except Exception as e:
        logger.error("Ransomware matcher failed: %s", e)


async def _researcher_feed_job():
    """Ingest curated public Telegram researcher channels via RSSHub."""
    try:
        from modules.researcher_feed import run_all
        result = await run_all()
        logger.info("Researcher feed sync: %s channels", result.get("channels", 0))
    except Exception as e:
        logger.error("Researcher feed job failed: %s", e)


async def _blocklist_sync_job():
    """Pull open blocklists (Feodo, OpenPhish, PhishStats, ET, Tor) into DB."""
    try:
        from modules.blocklist_sync import run_all_blocklists
        await run_all_blocklists()
    except Exception as e:
        logger.error("Blocklist sync job failed: %s", e)


_telegram_task = None


async def _start_telegram_loop():
    """Spawn the long-poll loop once at startup. APScheduler fires this on a
    short interval; the loop is idempotent (run_forever is a no-op if already running).
    """
    global _telegram_task
    try:
        from config import get_settings

        settings = get_settings()
        if not settings.TELEGRAM_BOT_TOKEN:
            return
        if _telegram_task and not _telegram_task.done():
            return  # already running
        from modules.telegram_monitor import run_forever

        _telegram_task = asyncio.create_task(
            run_forever(settings.TELEGRAM_BOT_TOKEN, settings.TELEGRAM_POLL_INTERVAL_SECONDS)
        )
        logger.info("Telegram poll loop spawned")
    except Exception as e:
        logger.error("Telegram poll loop start failed: %s", e)


async def _enrichment_cache_cleanup():
    """Drop expired rows from enrichment_cache. Redis handles TTL itself; this
    is just for the Postgres audit trail."""
    try:
        from db import get_client

        client = get_client()
        client.table("enrichment_cache").delete().lt("expires_at", "now()").execute()
    except Exception as e:
        logger.warning("enrichment_cache cleanup failed: %s", e)


def start_scheduler():
    global _scheduler
    _scheduler = AsyncIOScheduler()

    _scheduler.add_job(_cert_monitor_job, IntervalTrigger(hours=1), id="cert_monitor", replace_existing=True, misfire_grace_time=300)
    _scheduler.add_job(_dark_web_job, IntervalTrigger(hours=6), id="dark_web", replace_existing=True, misfire_grace_time=300)
    _scheduler.add_job(_brand_monitor_job, IntervalTrigger(hours=4), id="brand_monitor", replace_existing=True, misfire_grace_time=300)
    _scheduler.add_job(_data_leak_job, IntervalTrigger(hours=12), id="data_leak", replace_existing=True, misfire_grace_time=300)
    _scheduler.add_job(_surface_scan_job, IntervalTrigger(hours=24), id="surface_web", replace_existing=True, misfire_grace_time=300)
    _scheduler.add_job(_credential_scan_job, IntervalTrigger(hours=8), id="credential", replace_existing=True, misfire_grace_time=300)
    # Ransomware.live — refresh every 15 minutes; leak-site posts move fast
    _scheduler.add_job(_ransomware_sync_job, IntervalTrigger(minutes=15), id="ransomware_live", replace_existing=True, misfire_grace_time=120)
    # Open blocklists — hourly refresh is plenty for these feeds
    _scheduler.add_job(_blocklist_sync_job, IntervalTrigger(hours=1), id="blocklist_sync", replace_existing=True, misfire_grace_time=300)
    # Telegram bot — spawn the long-poll loop once at startup. The scheduler also
    # ticks every 5min as a guard so the loop is restarted if it ever exits.
    _scheduler.add_job(_start_telegram_loop, IntervalTrigger(minutes=5), id="telegram_loop", replace_existing=True, next_run_time=None, misfire_grace_time=60)
    # Enrichment cache cleanup — Postgres audit trail prune
    _scheduler.add_job(_enrichment_cache_cleanup, IntervalTrigger(hours=6), id="enrichment_cleanup", replace_existing=True, misfire_grace_time=300)
    # Curated researcher-channel feed (RSSHub bridges) — every 30 minutes
    _scheduler.add_job(_researcher_feed_job, IntervalTrigger(minutes=30), id="researcher_feed", replace_existing=True, misfire_grace_time=300)

    _scheduler.start()
    # Kick the Telegram loop immediately rather than waiting for the first scheduled tick.
    asyncio.create_task(_start_telegram_loop())
    logger.info("APScheduler started with 10 jobs (telegram poll loop + enrichment cleanup added)")


def stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
        _scheduler = None


def get_scheduler() -> Optional[AsyncIOScheduler]:
    return _scheduler
