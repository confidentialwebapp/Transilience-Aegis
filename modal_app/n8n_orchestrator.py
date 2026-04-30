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

            # Auth — user management is the n8n 1.x default; basic auth is deprecated
            # The owner is created via /rest/owner/setup (one-time, scripted).
            "N8N_BASIC_AUTH_ACTIVE": "false",
            "N8N_USER_MANAGEMENT_DISABLED": "false",

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
    cpu=2.05,
    memory=2048,
)
@modal.web_server(port=5678, startup_timeout=240)
def server():
    """Start n8n — Modal proxies external HTTPS to this internal port.

    Before booting n8n, syncs /data/imports/*.json into the SQLite workflow
    table. This sidesteps Modal volume sync delays between containers: the
    server always boots with the freshest workflow definitions.
    """
    import os
    import sqlite3
    import subprocess
    from pathlib import Path

    env = os.environ.copy()
    os.makedirs("/data", exist_ok=True)

    # Bootstrap workflows from /data/imports/ into SQLite before n8n starts.
    # This way every server restart picks up the latest workflow JSONs.
    db_path = "/data/database.sqlite"
    imports_dir = Path("/data/imports")

    # Ensure n8n has run once before us so the schema exists
    if not Path(db_path).exists():
        # First-ever boot: let n8n create the DB, then we'll sync on next restart
        print("[server] no database yet; running n8n once to create schema")
        subprocess.run(["n8n", "start", "--tunnel=false"], env=env, timeout=15,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       check=False)
        # The above will time out / get killed; we ignore — schema will exist

    if Path(db_path).exists() and imports_dir.exists():
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            # Confirm workflow_entity table exists
            existing = cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_entity'"
            ).fetchone()
            if existing:
                # Use the n8n CLI to do clean import: wipe then re-insert
                cur.execute("DELETE FROM workflow_entity")
                cur.execute("DELETE FROM webhook_entity")
                conn.commit()
                conn.close()
                # Now use CLI import (works because n8n is NOT running yet)
                for f in sorted(imports_dir.glob("*.json")):
                    print(f"[server] importing {f.name}")
                    subprocess.run(
                        ["n8n", "import:workflow", f"--input={f}"],
                        env=env, capture_output=True, text=True, timeout=60,
                        check=False,
                    )
                # Activate
                conn = sqlite3.connect(db_path)
                cur = conn.cursor()
                cur.execute("UPDATE workflow_entity SET active=1")
                print(f"[server] activated {cur.rowcount} workflows")
                conn.commit()
                conn.close()
            else:
                print("[server] workflow_entity table not yet present, skipping bootstrap")
        except Exception as e:
            print(f"[server] bootstrap warning: {e}")

    print("[server] starting n8n (Popen, Python stays alive for Modal proxy)...")
    # IMPORTANT: with @modal.web_server, the Python process must keep running so
    # Modal's internal ASGI proxy can forward requests to the child's port.
    # execvp would replace Python and break the proxy. Popen + don't-block lets
    # Modal initialize the proxy before this function returns; n8n keeps running
    # as a child of the still-alive Python process.
    subprocess.Popen(
        ["n8n", "start"],
        env=env,
        stdout=None,
        stderr=None,
    )


@app.function(
    image=n8n_image,
    volumes={"/data": n8n_volume},
    secrets=[modal.Secret.from_name("aegis-n8n-env")],
    timeout=300,
    cpu=1.0,
    memory=1024,
)
def import_workflows():
    """One-shot: import workflow JSONs from /data/imports/ and activate them.

    Run via:  modal run modal_app/n8n_orchestrator.py::import_workflows
    """
    import os
    import subprocess
    from pathlib import Path

    env = os.environ.copy()
    imports_dir = Path("/data/imports")
    if not imports_dir.exists():
        print("No /data/imports directory; nothing to import")
        return {"imported": 0}

    files = sorted(imports_dir.glob("*.json"))
    if not files:
        print("No JSON files in /data/imports")
        return {"imported": 0}

    imported = []
    for f in files:
        print(f"Importing {f.name}...")
        result = subprocess.run(
            ["n8n", "import:workflow", f"--input={f}"],
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )
        print(f"  stdout: {result.stdout[:500]}")
        if result.returncode != 0:
            print(f"  stderr: {result.stderr[:500]}")
        else:
            imported.append(f.name)

    # Now activate everything
    print("Activating all imported workflows...")
    result = subprocess.run(
        ["n8n", "update:workflow", "--all", "--active=true"],
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    print(f"  activate stdout: {result.stdout[:500]}")
    if result.returncode != 0:
        print(f"  activate stderr: {result.stderr[:500]}")

    # Persist volume changes to next container
    try:
        n8n_volume.commit()
    except Exception as e:
        print(f"volume commit warning: {e}")

    return {"imported": imported, "count": len(imported)}


@app.function(
    image=n8n_image,
    volumes={"/data": n8n_volume},
    secrets=[modal.Secret.from_name("aegis-n8n-env")],
    timeout=60,
    cpu=0.5,
    memory=256,
)
def latest_execution_error():
    """Print the most recent failed execution's error context."""
    import sqlite3, json as _j
    try:
        n8n_volume.reload()
    except Exception:
        pass
    conn = sqlite3.connect("/data/database.sqlite")
    cur = conn.cursor()
    row = cur.execute(
        "SELECT id, status, finished, data FROM execution_entity ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if not row:
        print("no executions yet")
        return
    eid, st, fin, data = row
    print(f"execution id={eid} status={st} finished={fin}")
    try:
        arr = _j.loads(data) if isinstance(data, str) else data
        txt = _j.dumps(arr) if not isinstance(arr, str) else arr
    except Exception as e:
        print(f"parse error: {e}")
        return
    # Surface any error-y context
    keywords = ['"message":"', 'invalid input', 'NodeOperationError', 'Cannot read', 'undefined',
                'is not defined', 'AxiosError', 'ENOTFOUND', 'ECONNREFUSED', '"name":"NodeApi',
                'Authentication required', '402 ', '401 ', '403 ', '429 ',
                '"description":"', '"httpCode":']
    seen = set()
    for kw in keywords:
        idx = 0
        while idx < len(txt):
            i = txt.find(kw, idx)
            if i == -1: break
            snippet = txt[max(0, i-40):i+220].replace('\\n', ' ').replace('\\"', '"')
            if snippet not in seen:
                seen.add(snippet)
                print(f"  ... {snippet} ...")
            idx = i + len(kw)
    conn.close()


@app.function(
    image=n8n_image,
    volumes={"/data": n8n_volume},
    secrets=[modal.Secret.from_name("aegis-n8n-env")],
    timeout=60,
    cpu=0.5,
    memory=256,
)
def dump_workflows():
    """Print URLs of all workflow nodes that hit scan_runs."""
    import sqlite3, json as _j
    from pathlib import Path
    # Force a fresh read of the volume from remote storage
    try:
        n8n_volume.reload()
    except Exception as e:
        print(f"reload warning: {e}")
    db_path = "/data/database.sqlite"
    if not Path(db_path).exists():
        return {"error": "no db"}
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    rows = cur.execute("SELECT id, name, active, nodes FROM workflow_entity").fetchall()
    out = []
    for wid, name, active, nodes_blob in rows:
        try:
            nodes = _j.loads(nodes_blob) if isinstance(nodes_blob, str) else nodes_blob
        except Exception:
            nodes = None
        scan_urls = []
        if nodes:
            for n in nodes:
                p = n.get('parameters', {})
                url = p.get('url', '')
                if 'scan_runs' in url:
                    scan_urls.append(f"{n.get('name')}: {url}")
        out.append({"id": wid, "name": name, "active": active, "scan_urls": scan_urls})
        print(f"workflow id={wid} name={name} active={active}")
        for s in scan_urls:
            print(f"  {s}")
    conn.close()
    return {"workflows": out}


@app.function(
    image=n8n_image,
    volumes={"/data": n8n_volume},
    secrets=[modal.Secret.from_name("aegis-n8n-env")],
    timeout=120,
    cpu=1.0,
    memory=512,
)
def reset_and_reimport():
    """Wipe all existing workflows then import fresh from /data/imports/.

    Run via:  modal run modal_app/n8n_orchestrator.py::reset_and_reimport
    """
    import os
    import sqlite3
    import subprocess
    from pathlib import Path

    env = os.environ.copy()
    db_path = "/data/database.sqlite"

    # 1. Wipe all workflows from SQLite directly (CLI doesn't have a "delete all")
    if Path(db_path).exists():
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        # Tables that hold workflow state
        for tbl in ("workflow_entity", "webhook_entity", "execution_entity",
                    "workflows_tags", "shared_workflow"):
            try:
                cur.execute(f"DELETE FROM {tbl}")
                print(f"  cleared {tbl}: {cur.rowcount} rows")
            except sqlite3.OperationalError as e:
                print(f"  skip {tbl}: {e}")
        conn.commit()
        conn.close()

    # 2. Re-import fresh
    imports_dir = Path("/data/imports")
    files = sorted(imports_dir.glob("*.json"))
    for f in files:
        print(f"Importing {f.name}...")
        r = subprocess.run(
            ["n8n", "import:workflow", f"--input={f}"],
            env=env, capture_output=True, text=True, timeout=60,
        )
        print(f"  stdout: {r.stdout[:300]}")
        if r.stderr:
            print(f"  stderr: {r.stderr[:300]}")

    # 3. Activate all
    r = subprocess.run(
        ["n8n", "update:workflow", "--all", "--active=true"],
        env=env, capture_output=True, text=True, timeout=60,
    )
    print(f"  activate: {r.stdout[:200]}")

    # 4. Force-activate every workflow by patching SQLite directly
    if Path(db_path).exists():
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("UPDATE workflow_entity SET active=1")
        print(f"  set active=1 on {cur.rowcount} workflows")
        rows = cur.execute("SELECT id, name, active FROM workflow_entity").fetchall()
        for r in rows:
            print(f"    workflow id={r[0]} name={r[1]} active={r[2]}")
        # Also dump a sample of the workflow nodes to verify the imported JSON
        for r in rows:
            row = cur.execute(
                "SELECT nodes FROM workflow_entity WHERE id=?", (r[0],)
            ).fetchone()
            if row:
                import json as _j
                try:
                    nodes = _j.loads(row[0]) if isinstance(row[0], str) else row[0]
                except Exception:
                    nodes = row[0]
                # Print just node URLs that contain scan_runs
                for n in (nodes or []):
                    p = n.get("parameters", {})
                    url = p.get("url", "")
                    if "scan_runs" in url:
                        print(f"    node {n.get('name')} url: {url}")
        conn.commit()
        conn.close()

    try:
        n8n_volume.commit()
    except Exception as e:
        print(f"volume commit warning: {e}")

    return {"ok": True, "files": [f.name for f in files]}
