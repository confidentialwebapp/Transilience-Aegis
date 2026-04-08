import logging
from typing import Optional

from config import get_settings

logger = logging.getLogger(__name__)

_client = None


def get_client():
    global _client
    if _client is None:
        try:
            from supabase import create_client, Client
            settings = get_settings()
            if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
                raise RuntimeError(
                    "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set"
                )
            _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
            logger.info("Supabase client created successfully")
        except Exception as e:
            logger.error("Failed to create Supabase client: %s", e)
            raise
    return _client


def reset_client():
    global _client
    _client = None
