import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import get_settings

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Transilience AI API...")
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
        try:
            from db import get_client
            get_client()
            logger.info("Supabase client initialized.")
        except Exception as e:
            logger.warning(f"Supabase init deferred: {e}")
    try:
        from scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        logger.warning(f"Scheduler start deferred: {e}")
    logger.info("Transilience AI API ready.")
    yield
    try:
        from scheduler import stop_scheduler
        stop_scheduler()
    except Exception:
        pass
    logger.info("Transilience AI API shutdown.")


app = FastAPI(
    title="Transilience AI Threat Intelligence API",
    version="1.0.0",
    description="External Threat Intelligence & Digital Risk Monitoring Platform",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import assets, alerts, scans, intel, dashboard, investigate
from routers import cve, vendors, infrastructure, ioc_watchlist, threat_actors, settings
from routers import recon, telegram, maltego_router

app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(assets.router, prefix="/api/v1/assets", tags=["Assets"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(scans.router, prefix="/api/v1/scans", tags=["Scans"])
app.include_router(intel.router, prefix="/api/v1/intel", tags=["Intel"])
app.include_router(investigate.router, prefix="/api/v1/investigate", tags=["Investigate"])
app.include_router(cve.router, prefix="/api/v1/cve", tags=["CVE Intelligence"])
app.include_router(vendors.router, prefix="/api/v1/vendors", tags=["Vendors (SVigil)"])
app.include_router(infrastructure.router, prefix="/api/v1/infrastructure", tags=["Infrastructure"])
app.include_router(ioc_watchlist.router, prefix="/api/v1/ioc-watchlist", tags=["IOC Watchlist"])
app.include_router(threat_actors.router, prefix="/api/v1/threat-actors", tags=["Threat Actors"])
app.include_router(settings.router, prefix="/api/v1/settings", tags=["Settings"])
app.include_router(recon.router, prefix="/api/v1/recon", tags=["Recon (theHarvester)"])
app.include_router(telegram.router, prefix="/api/v1/telegram", tags=["Telegram Bot"])
app.include_router(maltego_router.router, prefix="/api/v1/maltego", tags=["Maltego Transforms"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "transilience-api", "version": "2.0.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
