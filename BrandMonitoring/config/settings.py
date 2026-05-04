"""Centralised settings loaded from .env and config YAML."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


def _env(key: str, default: str | None = None) -> str | None:
    val = os.getenv(key, default)
    return val.strip() if isinstance(val, str) else val


@dataclass(frozen=True)
class APIKeys:
    anthropic: str | None = field(default_factory=lambda: _env("ANTHROPIC_API_KEY"))
    abuseipdb: str | None = field(default_factory=lambda: _env("ABUSEIPDB_API_KEY"))
    virustotal: str | None = field(default_factory=lambda: _env("VIRUSTOTAL_API_KEY"))
    otx: str | None = field(default_factory=lambda: _env("OTX_API_KEY"))
    ipqs: str | None = field(default_factory=lambda: _env("IPQS_API_KEY"))
    urlscan: str | None = field(default_factory=lambda: _env("URLSCAN_API_KEY"))
    shodan: str | None = field(default_factory=lambda: _env("SHODAN_API_KEY"))
    netlas: str | None = field(default_factory=lambda: _env("NETLAS_API_KEY"))
    dnsdumpster: str | None = field(default_factory=lambda: _env("DNSDUMPSTER_API_KEY"))
    hibp: str | None = field(default_factory=lambda: _env("HIBP_API_KEY"))
    intelx: str | None = field(default_factory=lambda: _env("INTELX_API_KEY"))
    ransomware_live: str | None = field(default_factory=lambda: _env("RANSOMWARE_LIVE_API_KEY"))
    nvd: str | None = field(default_factory=lambda: _env("NVD_API_KEY"))
    apify: str | None = field(default_factory=lambda: _env("APIFY_API_TOKEN"))
    github: str | None = field(default_factory=lambda: _env("GITHUB_TOKEN"))


@dataclass(frozen=True)
class RuntimeSettings:
    reports_dir: Path = field(default_factory=lambda: PROJECT_ROOT / (_env("REPORTS_DIR") or "reports"))
    data_dir: Path = field(default_factory=lambda: PROJECT_ROOT / (_env("DATA_DIR") or "data"))
    log_level: str = field(default_factory=lambda: (_env("LOG_LEVEL") or "INFO"))
    http_timeout: int = field(default_factory=lambda: int(_env("HTTP_TIMEOUT") or 30))
    http_concurrency: int = field(default_factory=lambda: int(_env("HTTP_CONCURRENCY") or 10))


def load_brand_config(path: str | Path) -> dict[str, Any]:
    p = Path(path)
    if not p.is_absolute():
        p = PROJECT_ROOT / p
    if not p.exists():
        raise FileNotFoundError(f"Brand config not found: {p}")
    with p.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


KEYS = APIKeys()
RUNTIME = RuntimeSettings()
