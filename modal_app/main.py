"""TAI-AEGIS scanner workers — runs Kali Linux + OSINT tools on Modal.

Why Modal: Render free tier is 512MB RAM and can't host the Kali toolchain.
Modal gives us per-second compute (we pay only while a scan runs), each
function gets its own RAM ceiling, and scans run in a sandboxed container.

Cost discipline:
  * No `keep_warm` — every function scales to zero when idle.
  * Conservative timeouts — long scans get capped, never run forever.
  * One shared Kali image — Modal caches layers; cold start ~3-5s after the
    first deploy.

Deployed automatically via .github/workflows/modal-deploy.yml whenever
files in modal_app/ change. Render backend calls these via
modal.Function.lookup("aegis-scanners", "<name>").remote.aio(...).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from typing import Any

import modal

# ---------------------------------------------------------------------------
# Image — one Kali Rolling base for all tools. Heavy first build (~6-10 min),
# then layer-cached for subsequent deploys (~30s).
# ---------------------------------------------------------------------------
# Note on the GPG key dance below: Kali rotates its archive signing key every
# year or so, and the kalilinux/kali-rolling Docker image on Docker Hub
# sometimes lags behind the live key. Without refreshing it ourselves, the
# very first `apt-get update` fails with "Missing key …". The two run_commands
# steps refresh the keyring directly before any apt operations.
kali_image = (
    modal.Image.from_registry("kalilinux/kali-rolling", add_python="3.11")
    .run_commands(
        # 1. Refresh Kali archive signing keys. -o flags allow the first update
        #    to proceed even though the existing key is missing/expired.
        "apt-get update -o Acquire::AllowInsecureRepositories=true "
        "        -o Acquire::AllowDowngradeToInsecureRepositories=true || true",
        "apt-get install -y --allow-unauthenticated kali-archive-keyring",
        "apt-get update",
        # 2. Standard Docker trick: stop any package post-install scripts from
        #    trying to start services (systemd refuses to run in containers).
        "printf '#!/bin/sh\\nexit 101\\n' > /usr/sbin/policy-rc.d && chmod +x /usr/sbin/policy-rc.d",
        # 3. Install the recon toolchain. --no-install-recommends keeps the
        #    image small; no compile-time deps needed since we removed
        #    the only Python tool that required them (maigret/pycairo).
        "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "
        "    theharvester nmap subfinder dnstwist dnsutils whois "
        "    ca-certificates curl wget git unzip",
        # 4. Restore normal policy.
        "rm -f /usr/sbin/policy-rc.d",
    )
    # python httpx for any HTTP we do directly inside Modal functions.
    .pip_install("httpx")
    # projectdiscovery binaries that aren't in Kali apt repos — install via Go releases
    .run_commands(
        "wget -qO- https://github.com/projectdiscovery/httpx/releases/download/v1.6.10/httpx_1.6.10_linux_amd64.zip > /tmp/httpx.zip "
        "&& cd /usr/local/bin && unzip -o /tmp/httpx.zip httpx && mv httpx httpx-pd && rm /tmp/httpx.zip || true",
        "wget -qO- https://github.com/projectdiscovery/dnsx/releases/download/v1.2.2/dnsx_1.2.2_linux_amd64.zip > /tmp/dnsx.zip "
        "&& cd /usr/local/bin && unzip -o /tmp/dnsx.zip dnsx && rm /tmp/dnsx.zip || true",
        "wget -qO- https://github.com/projectdiscovery/nuclei/releases/download/v3.3.7/nuclei_3.3.7_linux_amd64.zip > /tmp/nuclei.zip "
        "&& cd /usr/local/bin && unzip -o /tmp/nuclei.zip nuclei && rm /tmp/nuclei.zip || true",
    )
)

app = modal.App("aegis-scanners")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _run(cmd: list[str], timeout: int = 120) -> dict[str, Any]:
    """Run a command, return stdout/stderr/exit; never raise."""
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, check=False
        )
        return {
            "ok": proc.returncode == 0,
            "exit_code": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr[-2000:] if proc.stderr else "",
        }
    except subprocess.TimeoutExpired as e:
        return {"ok": False, "exit_code": -1, "stdout": e.stdout or "", "stderr": f"timeout after {timeout}s"}
    except FileNotFoundError as e:
        return {"ok": False, "exit_code": -1, "stdout": "", "stderr": f"binary not found: {e}"}
    except Exception as e:
        return {"ok": False, "exit_code": -1, "stdout": "", "stderr": f"{type(e).__name__}: {e}"}


def _lines(s: str) -> list[str]:
    return [line.strip() for line in s.splitlines() if line.strip()]


# ---------------------------------------------------------------------------
# Subdomain enumeration — subfinder
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=180, memory=512)
def run_subfinder(domain: str) -> dict:
    """List subdomains via projectdiscovery's subfinder.

    Returns: {ok, subdomains: [str], count, raw_stderr}
    """
    res = _run(["subfinder", "-d", domain, "-silent", "-all"], timeout=170)
    subs = sorted(set(_lines(res["stdout"])))
    return {
        "tool": "subfinder",
        "ok": res["ok"],
        "subdomains": subs,
        "count": len(subs),
        "stderr": res["stderr"],
    }


# ---------------------------------------------------------------------------
# HTTP probe — projectdiscovery httpx (renamed httpx-pd to avoid clash with python httpx)
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=180, memory=512)
def run_httpx(targets: list[str]) -> dict:
    """Probe each host: returns alive ones with status, title, tech.

    Input: list of hostnames or URLs.
    """
    if not targets:
        return {"tool": "httpx", "ok": True, "results": [], "count": 0}

    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write("\n".join(targets[:500]))  # cap at 500 to keep cost bounded
        infile = f.name

    res = _run(
        ["httpx-pd", "-l", infile, "-silent", "-json",
         "-status-code", "-title", "-tech-detect", "-tls-grab", "-no-color"],
        timeout=170,
    )
    rows = []
    for line in _lines(res["stdout"]):
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    return {
        "tool": "httpx",
        "ok": res["ok"],
        "results": rows,
        "count": len(rows),
        "stderr": res["stderr"],
    }


# ---------------------------------------------------------------------------
# DNS bulk resolver — projectdiscovery dnsx
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=120, memory=512)
def run_dnsx(targets: list[str]) -> dict:
    if not targets:
        return {"tool": "dnsx", "ok": True, "results": [], "count": 0}
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write("\n".join(targets[:1000]))
        infile = f.name
    res = _run(["dnsx", "-l", infile, "-silent", "-json", "-a", "-aaaa", "-cname", "-mx", "-resp"],
               timeout=110)
    rows = []
    for line in _lines(res["stdout"]):
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    return {"tool": "dnsx", "ok": res["ok"], "results": rows, "count": len(rows), "stderr": res["stderr"]}


# ---------------------------------------------------------------------------
# Typosquat detection — dnstwist
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=180, memory=1024)
def run_dnstwist(domain: str, registered_only: bool = True) -> dict:
    """Find lookalike/typo domains. With --registered, only returns ones that resolve."""
    cmd = ["dnstwist", "--format", "json"]
    if registered_only:
        cmd.append("--registered")
    cmd.append(domain)
    res = _run(cmd, timeout=170)
    try:
        data = json.loads(res["stdout"]) if res["stdout"] else []
    except Exception:
        data = []
    return {
        "tool": "dnstwist",
        "ok": res["ok"],
        "results": data,
        "count": len(data),
        "stderr": res["stderr"],
    }


# Note: run_maigret was removed — maigret pulls pycairo which fails to
# compile against Modal's bundled Python (no dev headers ship with
# add_python). The /api/v1/osint/username endpoint stays in the backend
# but returns a clear "not configured" response. Re-introduce later via
# sherlock-project or by switching to a base image with full dev headers.


# ---------------------------------------------------------------------------
# theHarvester — email/host/IP discovery
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=300, memory=1024)
def run_theharvester(domain: str, sources: str = "crtsh,duckduckgo,bing,otx,hackertarget,rapiddns,anubis,urlscan", limit: int = 200) -> dict:
    out_base = tempfile.mktemp(prefix="th-")
    res = _run(
        ["theHarvester", "-d", domain, "-b", sources, "-l", str(limit), "-f", out_base],
        timeout=290,
    )
    # theHarvester writes <out_base>.json
    raw = {}
    json_path = f"{out_base}.json"
    try:
        with open(json_path) as f:
            raw = json.load(f)
    except Exception:
        pass

    def _list(*keys: str) -> list[str]:
        for k in keys:
            v = raw.get(k)
            if isinstance(v, list):
                return [x for x in v if x]
        return []

    return {
        "tool": "theHarvester",
        "ok": res["ok"],
        "domain": domain,
        "sources": sources.split(","),
        "results": {
            "emails": _list("emails"),
            "hosts": _list("hosts"),
            "ips": _list("ips"),
            "asns": _list("asns"),
            "urls": _list("urls", "interesting_urls"),
            "linkedin": _list("linkedin", "linkedin_links"),
        },
        "stderr": res["stderr"],
    }


# ---------------------------------------------------------------------------
# nmap — port + service detection
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=300, memory=512)
def run_nmap(target: str, args: str = "-sT -sV -F -T4") -> dict:
    """Default args: TCP-connect (-sT) service-version scan on top 100 ports.

    -sT (TCP connect) is used instead of the default -sS (SYN scan) because
    Modal containers don't grant CAP_NET_RAW to the runtime user — raw
    sockets fail with "Operation not permitted". -sT works at user level.

    Caller can pass any nmap args; we just split on spaces (no shell escaping).
    -iL is dropped to prevent file-input attacks; ../ is blocked.
    """
    safe_args = [a for a in args.split() if a and not a.startswith("-iL") and "../" not in a]
    # If caller didn't specify any scan-type flag, default to -sT
    if not any(a in ("-sT", "-sS", "-sU", "-sA") for a in safe_args):
        safe_args = ["-sT"] + safe_args
    res = _run(["nmap", *safe_args, "-oN", "-", target], timeout=290)
    return {
        "tool": "nmap",
        "ok": res["ok"],
        "target": target,
        "args": " ".join(safe_args),
        "output": res["stdout"],
        "stderr": res["stderr"],
    }


# ---------------------------------------------------------------------------
# nuclei — templated vulnerability scanner
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=420, memory=1024)
def run_nuclei(target: str, severity: str = "critical,high,medium") -> dict:
    """Run nuclei with a severity filter to keep runtime + noise reasonable.
    Templates auto-update on first run (~30s extra)."""
    res = _run(
        ["nuclei", "-u", target, "-silent", "-jsonl", "-no-color",
         "-severity", severity, "-rate-limit", "150"],
        timeout=410,
    )
    findings = []
    for line in _lines(res["stdout"]):
        try:
            findings.append(json.loads(line))
        except Exception:
            continue
    return {
        "tool": "nuclei",
        "ok": res["ok"],
        "target": target,
        "severity_filter": severity,
        "findings": findings,
        "count": len(findings),
        "stderr": res["stderr"],
    }


# ---------------------------------------------------------------------------
# Composite pipeline: domain → subfinder → dnsx → httpx → alive hosts w/ tech
# Convenient single call for the customer-facing /recon/subdomains endpoint.
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=420, memory=1024)
def attack_surface(domain: str) -> dict:
    """End-to-end attack-surface map for a domain. ~60-120s typically."""
    sub_result = run_subfinder.local(domain)  # call helper directly inside same container
    subdomains = sub_result["subdomains"]
    if not subdomains:
        return {"tool": "attack_surface", "domain": domain, "subdomains": [], "alive": [], "alive_count": 0}

    # Resolve + probe in parallel via the same image
    dnsx_result = run_dnsx.local(subdomains)
    resolved = sorted({r.get("host") for r in dnsx_result["results"] if r.get("host")})

    httpx_result = run_httpx.local(resolved or subdomains[:200])
    alive = [r for r in httpx_result["results"] if r.get("status_code")]

    return {
        "tool": "attack_surface",
        "domain": domain,
        "subdomains": subdomains,
        "subdomain_count": len(subdomains),
        "resolved": resolved,
        "alive": alive,
        "alive_count": len(alive),
    }
