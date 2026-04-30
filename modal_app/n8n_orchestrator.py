"""n8n workflow orchestrator — runs 24/7 on Modal, single container.

Why Modal: keeps everything on one platform (auth, billing, ops). With
min_containers=1 there's no cold start; Modal handles rolling 24h container
recycle transparently. Workflow defs + SQLite metadata persist on a Modal
Volume across recycles.

Note on the image: n8n's official Docker image (n8nio/n8n) is Alpine-based,
which is incompatible with Modal's add_python injection (musl vs glibc). We
instead start from debian_slim, install Node 20, and `npm install -g n8n`.

After `modal deploy modal_app/n8n_orchestrator.py`, the stable URL is:
  https://transilience--aegis-n8n-server.modal.run

Required Modal Secret: `aegis-n8n-env` containing
  N8N_BASIC_AUTH_USER          (login user)
  N8N_BASIC_AUTH_PASSWORD      (login pass — long random)
  N8N_ENCRYPTION_KEY           (32-byte hex — credentials sealed with this; back it up externally)
  APIFY_TOKEN                  (referenced from workflow nodes)
  HIBP_API_KEY
  ANTHROPIC_API_KEY
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  OSINT_API_BASE               (https://transilience--aegis-osint-api-web.modal.run)
"""

from __future__ import annotations

import modal

# Debian-based image with Node 20 + n8n. First build ~3-5 min, then cached.
n8n_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("curl", "ca-certificates", "gnupg", "tini")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
        "npm install -g --omit=dev n8n@1.69.2",
    )
    .env(
        {
            # Network
            "N8N_PORT": "5678",
            "N8N_PROTOCOL": "https",
            "N8N_HOST": "transilience--aegis-n8n-server.modal.run",
            "WEBHOOK_URL": "https://transilience--aegis-n8n-server.modal.run/",
            "N8N_EDITOR_BASE_URL": "https://transilience--aegis-n8n-server.modal.run/",

            # Persistence
            "N8N_USER_FOLDER": "/data",
            "DB_TYPE": "sqlite",
            "DB_SQLITE_DATABASE": "/data/database.sqlite",

            # Auth — basic auth turned on, encryption key from secret
            "N8N_BASIC_AUTH_ACTIVE": "true",

            # Sane defaults
            "EXECUTIONS_DATA_PRUNE": "true",
            "EXECUTIONS_DATA_MAX_AGE": "168",   # 7 days history
            "GENERIC_TIMEZONE": "Asia/Kolkata",
            "TZ": "Asia/Kolkata",
            "N8N_DIAGNOSTICS_ENABLED": "false",
            "N8N_PERSONALIZATION_ENABLED": "false",
            "N8N_HIRING_BANNER_ENABLED": "false",
            "N8N_VERSION_NOTIFICATIONS_ENABLED": "false",
            "N8N_RUNNERS_ENABLED": "true",
            "N8N_LOG_LEVEL": "info",
        }
    )
)

# Persistent storage: SQLite, workflow defs, encrypted credentials
n8n_volume = modal.Volume.from_name("aegis-n8n-data", create_if_missing=True)

app = modal.App("aegis-n8n")


@app.function(
    image=n8n_image,
    volumes={"/data": n8n_volume},
    secrets=[modal.Secret.from_name("aegis-n8n-env")],
    min_containers=1,        # ALWAYS at least one warm container; no cold-start
    max_containers=1,        # SQLite is single-writer; never scale up
    scaledown_window=3600,
    timeout=86400,           # 24h ceiling — Modal does rolling recycle
    cpu=2.0,
    memory=2048,
)
@modal.web_server(port=5678, startup_timeout=240)
def server():
    """Start n8n — Modal proxies external HTTPS to this internal port."""
    import os
    import subprocess

    env = os.environ.copy()
    # Make sure the data dir exists with right perms (volume is fresh on first run)
    os.makedirs("/data", exist_ok=True)

    subprocess.Popen(
        ["n8n", "start"],
        env=env,
        stdout=None,
        stderr=None,
    )
