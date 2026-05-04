"""Wrapper around the Sherlock CLI tool for username enumeration."""
from __future__ import annotations

import asyncio
import json
import shutil
import tempfile
from pathlib import Path
from typing import Any


def is_available() -> bool:
    return shutil.which("sherlock") is not None


async def find_username(username: str, timeout: int = 120) -> list[dict[str, Any]]:
    """Run `sherlock` against a username and return list of {site, url}."""
    if not is_available():
        return []
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / f"{username}.json"
        proc = await asyncio.create_subprocess_exec(
            "sherlock", username, "--print-found", "--no-color",
            "--output", str(out),
            "--timeout", "10",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            return []
        results: list[dict[str, Any]] = []
        if out.exists():
            try:
                data = json.loads(out.read_text())
                for site, info in data.items():
                    if isinstance(info, dict) and info.get("status", {}).get("status") == "Claimed":
                        results.append({"site": site, "url": info.get("url_user")})
            except Exception:
                pass
        # Also parse stdout for `[+] Site: URL` lines as a fallback
        if not results and stdout:
            for line in stdout.decode(errors="ignore").splitlines():
                if line.startswith("[+]"):
                    parts = line.replace("[+]", "").strip().split(":", 1)
                    if len(parts) == 2:
                        results.append({"site": parts[0].strip(), "url": parts[1].strip()})
        return results
