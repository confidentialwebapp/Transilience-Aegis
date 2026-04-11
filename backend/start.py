"""Minimal startup that works on Render free tier (512MB)."""
import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def create_app():
    """Create app with imports inside function to control load order."""
    logger.info("Importing FastAPI...")
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI(title="TAI-AEGIS API", version="2.0.0")

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health():
        return {"status": "healthy", "service": "tai-aegis-api"}

    @app.get("/debug/imports")
    async def debug_imports():
        results = {}
        modules_to_test = [
            "db", "config", "routers.assets", "routers.alerts",
            "routers.scans", "routers.intel", "routers.dashboard",
        ]
        for mod in modules_to_test:
            try:
                __import__(mod)
                results[mod] = "OK"
            except Exception as e:
                results[mod] = str(e)
        return results

    app_env = os.environ.get("APP_ENV", "development")
    is_production = app_env == "production"

    logger.info("Loading routers...")
    try:
        from routers import assets, alerts, scans, intel, dashboard, investigate
        from routers import cve, vendors, infrastructure, ioc_watchlist
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
        logger.info("All routers loaded successfully.")
    except Exception as e:
        import traceback
        logger.error("Failed to load routers: %s\n%s", e, traceback.format_exc())
        if not is_production:
            # In development, fail loudly so the developer sees the error
            raise

    @app.on_event("startup")
    async def startup():
        logger.info("App startup...")
        try:
            supabase_url = os.environ.get("SUPABASE_URL", "")
            if supabase_url:
                from db import get_client
                get_client()
                logger.info("Supabase connected.")
            else:
                logger.warning("SUPABASE_URL not set, database operations will fail.")
        except Exception as e:
            logger.warning("Supabase deferred: %s", e)

        try:
            from scheduler import start_scheduler
            start_scheduler()
            logger.info("Scheduler started.")
        except Exception as e:
            logger.warning("Scheduler deferred: %s", e)

    @app.on_event("shutdown")
    async def shutdown():
        try:
            from scheduler import stop_scheduler
            stop_scheduler()
        except Exception:
            pass

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    logger.info("Starting on port %d", port)
    uvicorn.run(app, host="0.0.0.0", port=port)
