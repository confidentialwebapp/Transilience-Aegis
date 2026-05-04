"""Wrapper around the Maigret CLI tool (richer username enumeration)."""
from __future__ import annotations

import asyncio
import json
import shutil
import tempfile
from pathlib import Path
from typing import Any


def is_available() -> bool:
    return shutil.which("maigret") is not None


async def find_username(username: str, timeout: int = 240) -> list[dict[str, Any]]:
    if not is_available():
        return []
    with tempfile.TemporaryDirectory() as td:
        proc = await asyncio.create_subprocess_exec(
            "maigret", username, "--json", "ndjson",
            "--folderoutput", td, "-T", "30", "--no-recursion",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        try:
            await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            return []
        results: list[dict[str, Any]] = []
        for ndjson_file in Path(td).glob("*.ndjson"):
            try:
                for line in ndjson_file.read_text().splitlines():
                    if not line.strip():
                        continue
                    rec = json.loads(line)
                    if rec.get("status", "").lower() == "claimed":
                        results.append({"site": rec.get("sitename"), "url": rec.get("url_user")})
            except Exception:
                continue
        return results
