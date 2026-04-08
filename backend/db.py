from typing import Optional
from config import get_settings

_client = None


def get_client():
    global _client
    if _client is None:
        from supabase import create_client
        settings = get_settings()
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _client


def reset_client():
    global _client
    _client = None
