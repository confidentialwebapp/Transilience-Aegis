from supabase import create_client, Client
from config import get_settings

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        settings = get_settings()
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _client


def reset_client():
    global _client
    _client = None
