"""Wrapper around the Holehe CLI (email -> registered services)."""
from __future__ import annotations

import asyncio
import json
import shutil
import tempfile
from pathlib import Path
from typing import Any


def is_available() -> bool:
    return shutil.which("holehe") is not None


async def find_email(email: str, timeout: int = 120) -> list[dict[str, Any]]:
    if not is_available():
        return []
    with tempfile.TemporaryDirectory() as td:
        out_dir = Path(td)
        proc = await asyncio.create_subprocess_exec(
            "holehe", email, "--only-used", "--no-color", "-C", str(out_dir / "out.csv"),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            return []
        services: list[dict[str, Any]] = []
        # Parse stdout — lines like "[+] github.com"
        for line in (stdout or b"").decode(errors="ignore").splitlines():
            line = line.strip()
            if line.startswith("[+]"):
                services.append({"service": line.replace("[+]", "").strip(), "email": email})
        # Parse CSV if present
        csv_file = out_dir / "out.csv"
        if csv_file.exists():
            import csv
            try:
                with csv_file.open() as f:
                    for row in csv.DictReader(f):
                        if (row.get("exists") or "").lower() == "true":
                            services.append({"service": row.get("name"), "email": email, "domain": row.get("domain")})
            except Exception:
                pass
        # Dedup
        seen = set()
        out = []
        for s in services:
            k = (s.get("service"), s.get("email"))
            if k not in seen:
                seen.add(k)
                out.append(s)
        return out
