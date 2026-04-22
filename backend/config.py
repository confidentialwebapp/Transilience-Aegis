import os
from typing import Optional

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_ANON_KEY: str = ""

    # Intelligence APIs
    HIBP_API_KEY: str = ""
    VIRUSTOTAL_API_KEY: str = ""
    URLSCAN_API_KEY: str = ""
    GITHUB_PAT: str = ""
    GREYNOISE_API_KEY: str = ""
    SHODAN_API_KEY: str = ""
    OTX_API_KEY: str = ""
    INTELX_API_KEY: str = ""
    NVD_API_KEY: str = ""
    RANSOMWARE_LIVE_API_KEY: str = ""
    ABUSECH_AUTH_KEY: str = ""  # threatfox / urlhaus / malwarebazaar

    # New keyed providers
    ABUSEIPDB_API_KEY: str = ""
    IPQS_API_KEY: str = ""
    NETLAS_API_KEY: str = ""
    DNSDUMPSTER_API_KEY: str = ""

    # Upstash Redis (REST)
    UPSTASH_REDIS_REST_URL: str = ""
    UPSTASH_REDIS_REST_TOKEN: str = ""
    ENRICHMENT_CACHE_TTL: int = 86400

    # MaxMind GeoLite2 — free account required for license key
    MAXMIND_ACCOUNT_ID: str = ""
    MAXMIND_LICENSE_KEY: str = ""
    GEOLITE2_CITY_DB: str = "/tmp/GeoLite2-City.mmdb"
    GEOLITE2_ASN_DB: str = "/tmp/GeoLite2-ASN.mmdb"

    # Notifications + Telegram bot
    RESEND_API_KEY: str = ""
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    TELEGRAM_POLL_INTERVAL_SECONDS: int = 20

    # theHarvester
    HARVESTER_BIN: str = "theHarvester"
    HARVESTER_TIMEOUT_SECONDS: int = 120

    # Maltego TRX
    MALTEGO_TRX_AUTH_TOKEN: str = ""

    # Modal — for calling the scanner workers (Kali tools as serverless functions)
    MODAL_TOKEN_ID: str = ""
    MODAL_TOKEN_SECRET: str = ""

    # Anthropic — for the AI skills framework (alert triage, advisory drafting, etc.)
    # Get from https://console.anthropic.com/settings/keys
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_DEFAULT_MODEL: str = "claude-haiku-4-5"  # cheap fast default
    ANTHROPIC_PREMIUM_MODEL: str = "claude-sonnet-4-6"  # for high-stakes operations

    # App
    APP_ENV: str = "development"
    LOG_LEVEL: str = "info"
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        # Only load .env file if it exists; on Render env vars come from the environment
        env_file = ".env" if os.path.isfile(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")) else None
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
