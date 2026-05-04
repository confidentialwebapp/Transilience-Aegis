"""Scan orchestrator: discovers modules, runs concurrently, aggregates results."""
from __future__ import annotations

import asyncio
import importlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config.settings import RUNTIME

from .base_module import DetectionModule
from .evidence import EvidenceStore, ScanReport
from .http import AsyncHTTP
from .logging_setup import get_logger

log = get_logger(__name__)

# Module registry: name -> "modules.<file>:<ClassName>"
MODULE_REGISTRY: dict[str, str] = {
    "domain_intel":          "modules.domain_intel:DomainIntelModule",
    "phishing_intel":        "modules.phishing_intel:PhishingIntelModule",
    "infra_intel":           "modules.infra_intel:InfraIntelModule",
    "social_impersonation":  "modules.social_impersonation:SocialImpersonationModule",
    "social_deep_scrape":    "modules.social_deep_scrape:SocialDeepScrapeModule",
    "telegram_intel":        "modules.telegram_intel:TelegramIntelModule",
    "document_leaks":        "modules.document_leaks:DocumentLeaksModule",
    "email_exposure":        "modules.email_exposure:EmailExposureModule",
    "code_leaks":            "modules.code_leaks:CodeLeaksModule",
    "darkweb_intel":         "modules.darkweb_intel:DarkwebIntelModule",
    "mobile_apps":           "modules.mobile_apps:MobileAppsModule",
    "content_abuse":         "modules.content_abuse:ContentAbuseModule",
    "ad_fraud":              "modules.ad_fraud:AdFraudModule",
    "deepfake_intel":        "modules.deepfake_intel:DeepfakeIntelModule",
    "pentest_recon":         "modules.pentest_recon:PentestReconModule",
}


def _new_scan_id(brand_name: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    slug = "".join(c.lower() if c.isalnum() else "-" for c in brand_name).strip("-")[:24]
    return f"{slug}-{ts}-{uuid.uuid4().hex[:6]}"


def _instantiate(name: str, brand: dict[str, Any], mod_cfg: dict[str, Any], store: EvidenceStore) -> DetectionModule:
    dotted = MODULE_REGISTRY[name]
    mod_path, cls_name = dotted.split(":")
    module = importlib.import_module(mod_path)
    cls = getattr(module, cls_name)
    return cls(brand, mod_cfg, store)


async def run_scan(brand_config: dict[str, Any], modules: list[str] | None = None) -> tuple[ScanReport, Path]:
    brand_name = brand_config.get("brand", {}).get("name", "Unnamed")
    scan_id = _new_scan_id(brand_name)
    scan_dir = RUNTIME.data_dir / scan_id
    scan_dir.mkdir(parents=True, exist_ok=True)
    store = EvidenceStore(scan_dir)

    log.info(f"[bold]scan {scan_id}[/bold] for brand [cyan]{brand_name}[/cyan]")
    log.info(f"data dir: {scan_dir}")

    selected = modules or list(MODULE_REGISTRY.keys())
    cfg_mods = brand_config.get("modules", {})

    instances: list[DetectionModule] = []
    for name in selected:
        if name not in MODULE_REGISTRY:
            log.warning(f"unknown module: {name}")
            continue
        try:
            inst = _instantiate(name, brand_config, cfg_mods.get(name, {}), store)
            instances.append(inst)
        except Exception as e:
            log.exception(f"failed to load module {name}: {e}")

    report = ScanReport(scan_id=scan_id, brand_name=brand_name, config=brand_config)

    try:
        # Run all modules concurrently — each handles its own retries / rate limits.
        results = await asyncio.gather(*(m.execute() for m in instances), return_exceptions=False)
        report.module_results = list(results)

        # Screenshot capture for high-severity findings (before AI triage so triage sees it)
        ss_cfg = (brand_config.get("screenshots") or {})
        if ss_cfg.get("enabled", True):
            try:
                from .screenshot import capture_priority_findings, shutdown_playwright
                count = await capture_priority_findings(
                    report.all_findings,
                    store,
                    max_count=int(ss_cfg.get("max_count", 30)),
                    concurrency=int(ss_cfg.get("concurrency", 4)),
                )
                log.info(f"[bold]screenshots:[/bold] {count} captured")
                await shutdown_playwright()
            except Exception as e:
                log.exception(f"screenshot capture failed: {e}")

        # AI triage post-processor: classify findings via Claude and adjust severity
        ai_cfg = (brand_config.get("ai_triage") or {})
        if ai_cfg.get("enabled", False):
            try:
                from .ai_triage import AITriageEngine
                engine = AITriageEngine(
                    brand_config=brand_config,
                    model=ai_cfg.get("model", "claude-opus-4-7"),
                    batch_size=int(ai_cfg.get("batch_size", 20)),
                    max_findings=int(ai_cfg.get("max_findings", 200)),
                    concurrency=int(ai_cfg.get("concurrency", 3)),
                )
                all_findings = report.all_findings
                usage = await engine.classify(all_findings)
                report.config["ai_triage_usage"] = usage
                # Re-save updated findings to disk
                for f in all_findings:
                    if "ai_triage" in (f.raw or {}):
                        store.save_finding(f)
            except Exception as e:
                log.exception(f"AI triage failed: {e}")
    finally:
        report.finished_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        await AsyncHTTP.close()

    store.save_report(report)
    log.info(f"[bold green]scan complete[/bold green] — {sum(len(m.findings) for m in report.module_results)} total findings")
    return report, scan_dir
