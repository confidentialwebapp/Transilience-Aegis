"""Base class for all detection modules."""
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Any

from .evidence import EvidenceStore, Finding, ModuleResult
from .logging_setup import get_logger

DEFAULT_MODULE_TIMEOUT = 600   # seconds — per-module hard cap


class DetectionModule(ABC):
    name: str = "unnamed"
    category: str = "misc"
    description: str = ""

    def __init__(self, brand_config: dict[str, Any], module_config: dict[str, Any], store: EvidenceStore):
        self.brand = brand_config
        self.cfg = module_config or {}
        self.store = store
        self.log = get_logger(f"module.{self.name}")

    def enabled(self) -> bool:
        return bool(self.cfg.get("enabled", True))

    @property
    def timeout(self) -> int:
        return int(self.cfg.get("timeout", DEFAULT_MODULE_TIMEOUT))

    @abstractmethod
    async def run(self) -> list[Finding]:
        """Execute the module and return findings."""

    async def execute(self) -> ModuleResult:
        from datetime import datetime, timezone

        result = ModuleResult(module=self.name)
        if not self.enabled():
            result.status = "skipped"
            result.finished_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
            self.log.info(f"[dim]skipped[/dim] (disabled in config)")
            return result

        self.log.info(f"[cyan]running[/cyan] {self.name} (timeout {self.timeout}s)")
        try:
            findings = await asyncio.wait_for(self.run(), timeout=self.timeout)
            result.findings = findings or []
            result.status = "ok"
            for f in result.findings:
                self.store.save_finding(f)
            self.log.info(f"[green]done[/green] {self.name} — {len(result.findings)} findings")
        except asyncio.TimeoutError:
            result.status = "error"
            result.error = f"timeout after {self.timeout}s"
            self.log.warning(f"[yellow]timeout[/yellow] {self.name} after {self.timeout}s")
        except Exception as e:
            result.status = "error"
            result.error = f"{type(e).__name__}: {e}"
            self.log.exception(f"[red]error[/red] in {self.name}: {e}")
        finally:
            result.finished_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        return result
