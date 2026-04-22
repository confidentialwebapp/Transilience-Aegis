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
        #    image small; python3-pip needed so we can pip install tools that
        #    don't ship as binaries (sherlock, holehe).
        "DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "
        "    theharvester nmap subfinder dnstwist dnsutils whois "
        "    amass whatweb wafw00f sslscan python3-pip "
        "    ca-certificates curl wget git unzip",
        # 4. Restore normal policy.
        "rm -f /usr/sbin/policy-rc.d",
    )
    # python httpx + username/email OSINT via pip
    .pip_install(
        "httpx",
        "sherlock-project",   # 400+ social platform username check
        "holehe",              # email -> which services it's registered on
    )
    # projectdiscovery + tomnomnom binaries — installed from GitHub releases.
    # Each zip is ~10-30 MB; keeping all in one layer for cache efficiency.
    .run_commands(
        "wget -qO- https://github.com/projectdiscovery/httpx/releases/download/v1.6.10/httpx_1.6.10_linux_amd64.zip > /tmp/httpx.zip "
        "&& cd /usr/local/bin && unzip -o /tmp/httpx.zip httpx && mv httpx httpx-pd && rm /tmp/httpx.zip || true",
        "wget -qO- https://github.com/projectdiscovery/dnsx/releases/download/v1.2.2/dnsx_1.2.2_linux_amd64.zip > /tmp/dnsx.zip "
        "&& cd /usr/local/bin && unzip -o /tmp/dnsx.zip dnsx && rm /tmp/dnsx.zip || true",
        "wget -qO- https://github.com/projectdiscovery/nuclei/releases/download/v3.3.7/nuclei_3.3.7_linux_amd64.zip > /tmp/nuclei.zip "
        "&& cd /usr/local/bin && unzip -o /tmp/nuclei.zip nuclei && rm /tmp/nuclei.zip || true",
        "wget -qO- https://github.com/projectdiscovery/katana/releases/download/v1.1.0/katana_1.1.0_linux_amd64.zip > /tmp/katana.zip "
        "&& cd /usr/local/bin && unzip -o /tmp/katana.zip katana && rm /tmp/katana.zip || true",
        "wget -qO- https://github.com/projectdiscovery/naabu/releases/download/v2.3.2/naabu_2.3.2_linux_amd64.zip > /tmp/naabu.zip "
        "&& cd /usr/local/bin && unzip -o /tmp/naabu.zip naabu && rm /tmp/naabu.zip || true",
        # Tomnomnom tools are shipped as plain tarballs
        "wget -qO- https://github.com/tomnomnom/waybackurls/releases/download/v0.1.0/waybackurls-linux-amd64-0.1.0.tgz | tar -xz -C /usr/local/bin waybackurls || true",
        "wget -qO- https://github.com/tomnomnom/assetfinder/releases/download/v0.1.1/assetfinder-linux-amd64-0.1.1.tgz | tar -xz -C /usr/local/bin assetfinder || true",
        "wget -qO- https://github.com/lc/gau/releases/download/v2.2.4/gau_2.2.4_linux_amd64.tar.gz | tar -xz -C /usr/local/bin gau || true",
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
        "exit_code": res["exit_code"],
        "json_written": __import__("os").path.exists(json_path),
        "results": {
            "emails": _list("emails"),
            "hosts": _list("hosts"),
            "ips": _list("ips"),
            "asns": _list("asns"),
            "urls": _list("urls", "interesting_urls"),
            "linkedin": _list("linkedin", "linkedin_links"),
        },
        "stdout_tail": (res["stdout"] or "")[-2000:],
        "stderr": res["stderr"] or "(empty)",
        "error": (res["stderr"] or res["stdout"] or "")[-500:] if not res["ok"] else None,
    }


# ---------------------------------------------------------------------------
# nmap — port + service detection
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=300, memory=512)
def run_nmap(target: str, args: str = "-sT -Pn -sV -F -T4") -> dict:
    """Default args: TCP-connect service-version scan on top 100 ports,
    no host-discovery ping.

    Modal containers run unprivileged (no CAP_NET_RAW). nmap needs three
    things changed to work in that environment:
      -sT             TCP connect scan (vs SYN scan -sS) — no raw socket
      -Pn             Skip ICMP host discovery — pings need raw socket too
      --unprivileged  Force userland-only mode for any internal nmap ops

    Caller can override args; we always inject -Pn and --unprivileged
    if missing because forgetting them silently fails.
    """
    safe_args = [a for a in args.split() if a and not a.startswith("-iL") and "../" not in a]
    if not any(a in ("-sT", "-sS", "-sU", "-sA") for a in safe_args):
        safe_args = ["-sT"] + safe_args
    if "-Pn" not in safe_args and "-PS" not in safe_args and "-PA" not in safe_args:
        safe_args.append("-Pn")
    if "--unprivileged" not in safe_args and "--privileged" not in safe_args:
        safe_args.append("--unprivileged")
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
# Daily email-digest cron — fires hourly, backend decides which profiles are
# actually due for a digest based on their digest_frequency. Modal cron runs
# even when Render is sleeping, which guarantees alerts get delivered.
# ---------------------------------------------------------------------------
@app.function(image=kali_image, schedule=modal.Cron("17 3 * * *"), timeout=600, memory=512)
def nightly_attack_surface_diff() -> dict:
    """Once per night: ask the Render backend to scan every customer profile's
    domains, diff against last snapshot, and create alerts for new subdomains
    or services. Pay-per-second compute, no keep_warm.
    """
    import os, urllib.request, urllib.error
    backend = os.environ.get("AEGIS_BACKEND_URL", "https://tai-aegis-api.onrender.com")
    secret = os.environ.get("MODAL_TOKEN_ID", "")
    url = f"{backend}/api/v1/attack-surface/run-all?secret={secret}"
    try:
        req = urllib.request.Request(url, method="POST", data=b"")
        with urllib.request.urlopen(req, timeout=540) as r:
            body = r.read().decode("utf-8", errors="ignore")
            return {"http": r.status, "body": body[:500]}
    except urllib.error.HTTPError as e:
        return {"http": e.code, "error": e.read().decode("utf-8", errors="ignore")[:500]}
    except Exception as e:
        return {"http": 0, "error": f"{type(e).__name__}: {e}"}


@app.function(image=kali_image, schedule=modal.Cron("0 * * * *"), timeout=600, memory=512)
def daily_digest_tick() -> dict:
    """Hourly tick that asks the Render backend to fan out all due digests.

    Why call Render rather than do it inside Modal: the digest logic talks to
    Supabase + Resend with creds held by Render. We don't replicate the same
    secrets in Modal — Render is the one place that owns them.
    """
    import os, urllib.request, urllib.error, json
    backend = os.environ.get("AEGIS_BACKEND_URL", "https://tai-aegis-api.onrender.com")
    secret = os.environ.get("MODAL_TOKEN_ID", "")
    url = f"{backend}/api/v1/digest/send-all?secret={secret}"
    try:
        req = urllib.request.Request(url, method="POST", data=b"")
        with urllib.request.urlopen(req, timeout=300) as r:
            body = r.read().decode("utf-8", errors="ignore")
            return {"http": r.status, "body": body[:500]}
    except urllib.error.HTTPError as e:
        return {"http": e.code, "error": e.read().decode("utf-8", errors="ignore")[:500]}
    except Exception as e:
        return {"http": 0, "error": f"{type(e).__name__}: {e}"}


# ---------------------------------------------------------------------------
# sherlock — username presence across 400+ social/SaaS sites
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=300, memory=1024)
def run_sherlock(username: str, timeout: int = 20) -> dict:
    """Check which platforms a username exists on. Returns a list of sites
    where the account was found.

    Modern sherlock (0.14+) prints each hit to stdout as '[+] <Site>: <URL>'
    with --print-found, AND writes a text file of URLs (one per line) when
    --folderoutput is set. Parse both for resilience across versions.
    """
    import os, re as _re
    out_dir = tempfile.mkdtemp(prefix="sherlock-")
    res = _run(
        ["sherlock", username, "--timeout", str(timeout),
         "--folderoutput", out_dir, "--print-found"],
        timeout=290,
    )
    found: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    # 1) stdout: strip ANSI codes, look for [+] lines.
    ansi = _re.compile(r"\x1b\[[0-9;]*[mGKH]")
    for raw in (res.get("stdout") or "").splitlines():
        line = ansi.sub("", raw).strip()
        if not line or not line.startswith("[+]"):
            continue
        # Format: "[+] Site: https://..."
        body = line[3:].strip()
        # split only on the first colon-after-space to keep URL intact
        if ": http" in body:
            site, url = body.split(": http", 1)
            url = "http" + url
            if url not in seen_urls:
                seen_urls.add(url)
                found.append({"site": site.strip(), "url": url.strip()})

    # 2) folderoutput .txt file — one URL per line in newer versions.
    txt = os.path.join(out_dir, f"{username}.txt")
    if os.path.exists(txt):
        try:
            with open(txt) as f:
                for raw in f:
                    url = raw.strip()
                    if not url.startswith(("http://", "https://")):
                        continue
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)
                    # Derive site from domain
                    host = url.split("//", 1)[-1].split("/", 1)[0]
                    found.append({"site": host, "url": url})
        except Exception:
            pass

    return {
        "tool": "sherlock",
        "ok": res["ok"] or bool(found),
        "username": username,
        "found_count": len(found),
        "found": found[:80],
        "stderr_tail": (res.get("stderr") or "")[-400:],
    }


# ---------------------------------------------------------------------------
# holehe — which sites is this email registered on?
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=300, memory=1024)
def run_holehe(email: str) -> dict:
    res = _run(["holehe", "--only-used", "--no-color", email], timeout=290)
    used: list[str] = []
    for line in _lines(res["stdout"]):
        # lines like "[+] amazon.com"
        if line.startswith("[+]"):
            used.append(line[3:].strip())
    return {
        "tool": "holehe",
        "ok": res["ok"],
        "email": email,
        "registered_count": len(used),
        "registered_on": used[:100],
        "stderr": res["stderr"],
    }


# ---------------------------------------------------------------------------
# amass — passive DNS / subdomain enumeration (broader than subfinder)
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=360, memory=1024)
def run_amass(domain: str) -> dict:
    res = _run(
        ["amass", "enum", "-passive", "-d", domain, "-silent", "-timeout", "5"],
        timeout=350,
    )
    subs = sorted(set(_lines(res["stdout"])))
    return {
        "tool": "amass",
        "ok": res["ok"],
        "subdomains": subs,
        "count": len(subs),
        "stderr": res["stderr"],
    }


# ---------------------------------------------------------------------------
# whatweb — web technology fingerprinting
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=180, memory=512)
def run_whatweb(url: str) -> dict:
    res = _run(
        ["whatweb", "-a", "3", "--no-errors", "--log-json=-", "--quiet", url],
        timeout=170,
    )
    rows = []
    for line in _lines(res["stdout"]):
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    plugins = []
    if rows:
        for name, data in (rows[0].get("plugins") or {}).items():
            plugins.append({"name": name, "version": data.get("version"), "string": data.get("string")})
    return {
        "tool": "whatweb",
        "ok": res["ok"],
        "url": url,
        "status": rows[0].get("http_status") if rows else None,
        "target_url": rows[0].get("target") if rows else None,
        "plugin_count": len(plugins),
        "plugins": plugins[:40],
    }


# ---------------------------------------------------------------------------
# waybackurls / gau — historical URL corpus for a domain
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=240, memory=1024)
def run_waybackurls(domain: str, limit: int = 500) -> dict:
    res = _run(["waybackurls", domain], timeout=230)
    urls = sorted(set(_lines(res["stdout"])))[:limit]
    return {
        "tool": "waybackurls",
        "ok": res["ok"],
        "domain": domain,
        "count": len(urls),
        "urls": urls,
        "stderr": res["stderr"],
    }


# ---------------------------------------------------------------------------
# naabu — fast port scanner (top ports, syn-less alt to nmap)
# ---------------------------------------------------------------------------
@app.function(image=kali_image, timeout=240, memory=512)
def run_naabu(target: str, top_ports: int = 1000) -> dict:
    res = _run(
        ["naabu", "-host", target, "-silent", "-json", "-top-ports", str(top_ports),
         "-rate", "500"],
        timeout=230,
    )
    rows = []
    for line in _lines(res["stdout"]):
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    return {
        "tool": "naabu",
        "ok": res["ok"],
        "target": target,
        "open_ports_count": len(rows),
        "open_ports": [r.get("port") for r in rows][:200],
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
