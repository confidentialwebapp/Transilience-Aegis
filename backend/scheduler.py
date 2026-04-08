import logging
import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


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


def start_scheduler():
    global _scheduler
    _scheduler = AsyncIOScheduler()

    _scheduler.add_job(_cert_monitor_job, IntervalTrigger(hours=1), id="cert_monitor", replace_existing=True)
    _scheduler.add_job(_dark_web_job, IntervalTrigger(hours=6), id="dark_web", replace_existing=True)
    _scheduler.add_job(_brand_monitor_job, IntervalTrigger(hours=4), id="brand_monitor", replace_existing=True)
    _scheduler.add_job(_data_leak_job, IntervalTrigger(hours=12), id="data_leak", replace_existing=True)
    _scheduler.add_job(_surface_scan_job, IntervalTrigger(hours=24), id="surface_web", replace_existing=True)
    _scheduler.add_job(_credential_scan_job, IntervalTrigger(hours=8), id="credential", replace_existing=True)

    _scheduler.start()
    logger.info("APScheduler started with 6 scan jobs")


def stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
        _scheduler = None


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler
