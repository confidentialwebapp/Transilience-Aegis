"""HTTP front-door for the aegis-scanners Modal app.

n8n calls these endpoints over HTTPS. Each endpoint forwards to the
corresponding scanner Function defined in modal_app/main.py — we don't
duplicate the Kali image, just expose existing functions as web routes.

After `modal deploy modal_app/osint_api.py`, the public URL is:
  https://transilience--aegis-osint-api-web.modal.run/<endpoint>

Endpoints (all GET):
  /sherlock?username=...
  /maigret?username=...        (alias to sherlock — sherlock covers more sites)
  /holehe?email=...
  /dnstwist?domain=...
  /theharvester?domain=...
  /subfinder?domain=...
  /whatweb?url=...
  /health
"""

from __future__ import annotations

import modal

# Lightweight image — just FastAPI; the heavy Kali image lives in main.py
web_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "fastapi[standard]==0.115.4",
    "modal==1.4.2",
)

app = modal.App("aegis-osint-api")


@app.function(image=web_image, timeout=300, scaledown_window=120, max_containers=10)
@modal.asgi_app()
def web():
    from fastapi import FastAPI, HTTPException, Query

    api = FastAPI(title="Transilience Aegis OSINT API", version="1.0.0")

    def _lookup(fn_name: str):
        """Look up a Modal function from the aegis-scanners app."""
        try:
            return modal.Function.from_name("aegis-scanners", fn_name)
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"function {fn_name} unavailable: {e}")

    @api.get("/health")
    async def health():
        return {"ok": True, "service": "aegis-osint-api"}

    @api.get("/sherlock")
    async def sherlock(username: str = Query(..., min_length=1, max_length=64),
                        timeout: int = Query(20, ge=5, le=60)):
        fn = _lookup("run_sherlock")
        result = fn.remote(username, timeout)
        return result

    # Maigret isn't in main.py; alias to sherlock for now (sherlock covers ~400 sites)
    @api.get("/maigret")
    async def maigret(username: str = Query(..., min_length=1, max_length=64)):
        fn = _lookup("run_sherlock")
        result = fn.remote(username, 25)
        return {**result, "tool": "maigret-alias"}

    @api.get("/holehe")
    async def holehe(email: str = Query(..., min_length=3, max_length=128)):
        fn = _lookup("run_holehe")
        return fn.remote(email)

    @api.get("/dnstwist")
    async def dnstwist(domain: str = Query(..., min_length=3, max_length=253)):
        fn = _lookup("run_dnstwist")
        return fn.remote(domain, True)

    @api.get("/theharvester")
    async def theharvester(domain: str = Query(..., min_length=3, max_length=253)):
        fn = _lookup("run_theharvester")
        return fn.remote(domain)

    @api.get("/subfinder")
    async def subfinder(domain: str = Query(..., min_length=3, max_length=253)):
        fn = _lookup("run_subfinder")
        return fn.remote(domain)

    @api.get("/whatweb")
    async def whatweb(url: str = Query(..., min_length=4, max_length=512)):
        fn = _lookup("run_whatweb")
        return fn.remote(url)

    @api.get("/")
    async def root():
        return {
            "service": "aegis-osint-api",
            "endpoints": [
                "/sherlock?username=", "/maigret?username=", "/holehe?email=",
                "/dnstwist?domain=", "/theharvester?domain=", "/subfinder?domain=",
                "/whatweb?url=", "/health",
            ],
        }

    return api
