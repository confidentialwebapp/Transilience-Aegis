#!/usr/bin/env python3
"""
Download MaxMind GeoLite2-City + GeoLite2-ASN MMDB files into the paths
configured via GEOLITE2_CITY_DB and GEOLITE2_ASN_DB.

Requires a free MaxMind account — sign up at
https://www.maxmind.com/en/geolite2/signup — then set:

    MAXMIND_ACCOUNT_ID=...
    MAXMIND_LICENSE_KEY=...

Run:
    python backend/scripts/fetch_geolite2.py
"""
import os
import sys
import tarfile
import tempfile
import urllib.request
import urllib.error
from pathlib import Path

# Allow importing backend.config without PYTHONPATH tricks
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import get_settings  # noqa: E402

EDITIONS = {
    "GeoLite2-City": "GEOLITE2_CITY_DB",
    "GeoLite2-ASN":  "GEOLITE2_ASN_DB",
}


def fetch(edition: str, out_path: str, account_id: str, license_key: str) -> None:
    url = (
        f"https://download.maxmind.com/app/geoip_download"
        f"?edition_id={edition}&license_key={license_key}&suffix=tar.gz"
    )
    print(f"[{edition}] downloading → {out_path}")
    req = urllib.request.Request(url)
    # Basic-auth with account ID and license key is accepted by MaxMind
    import base64
    auth = base64.b64encode(f"{account_id}:{license_key}".encode()).decode()
    req.add_header("Authorization", f"Basic {auth}")

    try:
        with urllib.request.urlopen(req, timeout=120) as resp, \
             tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
            tmp.write(resp.read())
            tmp_path = tmp.name
    except urllib.error.HTTPError as e:
        print(f"[{edition}] HTTP {e.code}: {e.reason}", file=sys.stderr)
        sys.exit(1)

    # Extract just the .mmdb out of the tarball
    with tarfile.open(tmp_path, "r:gz") as tar:
        mmdb_member = next(
            (m for m in tar.getmembers() if m.name.endswith(".mmdb")),
            None,
        )
        if not mmdb_member:
            print(f"[{edition}] no .mmdb inside archive", file=sys.stderr)
            sys.exit(1)
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        extracted = tar.extractfile(mmdb_member)
        if not extracted:
            sys.exit(f"[{edition}] could not read {mmdb_member.name}")
        with open(out_path, "wb") as dst:
            dst.write(extracted.read())

    os.unlink(tmp_path)
    print(f"[{edition}] saved → {out_path}")


def main() -> int:
    s = get_settings()
    if not s.MAXMIND_ACCOUNT_ID or not s.MAXMIND_LICENSE_KEY:
        print(
            "MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY are required.\n"
            "Sign up free at https://www.maxmind.com/en/geolite2/signup",
            file=sys.stderr,
        )
        return 1
    for edition, attr in EDITIONS.items():
        out = getattr(s, attr)
        fetch(edition, out, s.MAXMIND_ACCOUNT_ID, s.MAXMIND_LICENSE_KEY)
    print("GeoLite2 databases installed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
