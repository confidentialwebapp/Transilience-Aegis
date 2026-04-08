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
    logger.info("Starting TAI-AEGIS API...")
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
    logger.info("TAI-AEGIS API ready.")
    yield
    try:
        from scheduler import stop_scheduler
        stop_scheduler()
    except Exception:
        pass
    logger.info("TAI-AEGIS API shutdown.")


app = FastAPI(
    title="TAI-AEGIS Threat Intelligence API",
    version="1.0.0",
    description="External Threat Intelligence & Digital Risk Monitoring Platform",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import assets, alerts, scans, intel, dashboard
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(assets.router, prefix="/api/v1/assets", tags=["Assets"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(scans.router, prefix="/api/v1/scans", tags=["Scans"])
app.include_router(intel.router, prefix="/api/v1/intel", tags=["Intel"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "tai-aegis-api", "version": "1.0.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
