"""
GeoLite2 MMDB helper.

Looks up city + ASN from local MaxMind GeoLite2 databases when the DB files
are present on disk. Returns None if the geoip2 package is missing or the DB
files are not configured, letting the caller fall back to ip-api.com.

Download the DBs with `python backend/scripts/fetch_geolite2.py` — requires
MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY in env (free signup at maxmind.com).
"""
import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_city_reader = None
_asn_reader = None
_init_attempted = False


def _init_readers() -> None:
    """Open the MMDB readers once. Tolerate missing files / missing lib."""
    global _city_reader, _asn_reader, _init_attempted
    if _init_attempted:
        return
    _init_attempted = True
    try:
        import geoip2.database  # type: ignore
    except ImportError:
        logger.info("geoip2 not installed; GeoLite2 lookups disabled")
        return

    from config import get_settings
    settings = get_settings()

    city_path = settings.GEOLITE2_CITY_DB
    asn_path = settings.GEOLITE2_ASN_DB

    if city_path and os.path.isfile(city_path):
        try:
            _city_reader = geoip2.database.Reader(city_path)
            logger.info("GeoLite2-City loaded from %s", city_path)
        except Exception as e:
            logger.warning("Failed to load GeoLite2-City at %s: %s", city_path, e)

    if asn_path and os.path.isfile(asn_path):
        try:
            _asn_reader = geoip2.database.Reader(asn_path)
            logger.info("GeoLite2-ASN loaded from %s", asn_path)
        except Exception as e:
            logger.warning("Failed to load GeoLite2-ASN at %s: %s", asn_path, e)


def lookup_geolite2(ip: str) -> Optional[Dict[str, Any]]:
    """Return the investigate-shaped geolocation dict, or None if unavailable."""
    _init_readers()
    if not _city_reader and not _asn_reader:
        return None

    out: Dict[str, Any] = {
        "source": "geolocation",
        "provider": "geolite2",
        "status": "found",
    }

    if _city_reader:
        try:
            c = _city_reader.city(ip)
            out.update({
                "country": c.country.name or "",
                "country_iso": c.country.iso_code or "",
                "region": (c.subdivisions.most_specific.name if c.subdivisions else "") or "",
                "city": c.city.name or "",
                "lat": c.location.latitude,
                "lon": c.location.longitude,
                "timezone": c.location.time_zone or "",
                "postal": c.postal.code or "",
                "accuracy_radius": c.location.accuracy_radius,
            })
        except Exception as e:
            logger.debug("GeoLite2-City miss for %s: %s", ip, e)

    if _asn_reader:
        try:
            a = _asn_reader.asn(ip)
            out["as"] = f"AS{a.autonomous_system_number} {a.autonomous_system_organization or ''}".strip()
            out["org"] = a.autonomous_system_organization or ""
            out["asn"] = a.autonomous_system_number
        except Exception as e:
            logger.debug("GeoLite2-ASN miss for %s: %s", ip, e)

    # If nothing usable came out, treat as a miss.
    if not out.get("country") and not out.get("as"):
        return None
    return out
