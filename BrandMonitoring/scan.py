#!/usr/bin/env python3
"""BrandMonitoring CLI."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from config.settings import KEYS, RUNTIME, load_brand_config
from core.logging_setup import configure_logging
from core.orchestrator import MODULE_REGISTRY, run_scan
from reporting.builder import build_reports

app = typer.Typer(add_completion=False, help="Enterprise brand monitoring + cyber threat scanner.")
console = Console()


@app.command()
def run(
    config: Path = typer.Option(..., "--config", "-c", help="Path to brand YAML config."),
    modules: str | None = typer.Option(None, "--modules", "-m", help="Comma-separated subset of modules to run."),
    skip_report: bool = typer.Option(False, "--skip-report", help="Skip PDF generation (JSON only)."),
):
    """Run a full brand-monitoring scan."""
    configure_logging(RUNTIME.log_level)
    cfg = load_brand_config(config)
    selected = [m.strip() for m in modules.split(",")] if modules else None

    console.rule("[bold cyan]BrandMonitoring scan starting")
    report, scan_dir = asyncio.run(run_scan(cfg, modules=selected))
    console.rule("[bold cyan]Scan finished — generating report")

    if skip_report:
        console.print(f"[green]JSON saved to {scan_dir}/scan_report.json[/green]")
        return

    outputs = build_reports(report, scan_dir)
    table = Table(title="Report artifacts", show_lines=True)
    table.add_column("Type"); table.add_column("Path")
    for k, v in outputs.items():
        table.add_row(k, str(v))
    console.print(table)
    console.print("[bold green]Done.[/bold green]")


@app.command("list-modules")
def list_modules():
    """Show all modules and whether their dependencies are configured."""
    table = Table(title="Detection modules")
    table.add_column("Module"); table.add_column("Class"); table.add_column("Description")
    import importlib
    for name, dotted in MODULE_REGISTRY.items():
        modpath, cls = dotted.split(":")
        try:
            mod = importlib.import_module(modpath)
            klass = getattr(mod, cls)
            table.add_row(name, cls, getattr(klass, "description", ""))
        except Exception as e:
            table.add_row(name, cls, f"[red]ERROR: {e}[/red]")
    console.print(table)


@app.command()
def doctor():
    """Check API-key presence and external CLI availability."""
    table = Table(title="API key status")
    table.add_column("Service"); table.add_column("Configured")
    for name in ("anthropic","abuseipdb","virustotal","otx","ipqs","urlscan","shodan","netlas","dnsdumpster","hibp","intelx","ransomware_live","nvd","apify","github"):
        v = getattr(KEYS, name)
        table.add_row(name, "[green]yes[/green]" if v else "[red]missing[/red]")
    console.print(table)

    cli_table = Table(title="External CLI tools")
    cli_table.add_column("Tool"); cli_table.add_column("Available")
    from integrations import holehe_runner, maigret_runner, sherlock_runner
    for tool, fn in (("sherlock", sherlock_runner.is_available), ("maigret", maigret_runner.is_available), ("holehe", holehe_runner.is_available)):
        cli_table.add_row(tool, "[green]yes[/green]" if fn() else "[yellow]not installed[/yellow]")
    console.print(cli_table)
    console.print(f"[dim]Reports dir: {RUNTIME.reports_dir}[/dim]")
    console.print(f"[dim]Data dir:    {RUNTIME.data_dir}[/dim]")


if __name__ == "__main__":
    app()
