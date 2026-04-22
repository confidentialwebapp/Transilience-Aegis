"""STIX 2.1 + HTML exporters for advisories.

STIX 2.1 = JSON bundle the rest of the CTI ecosystem (MISP, OpenCTI, threat
intel platforms) can ingest directly. This is the federation lever.

PDF generation is delegated to a Modal function (see modal_app/main.py),
because weasyprint pulls heavy native deps we don't want in the Render image.
"""

from __future__ import annotations

import html
import json
import uuid as uuidlib
from datetime import datetime, timezone
from typing import Any


# ---------------------------------------------------------------------------
# STIX 2.1
# ---------------------------------------------------------------------------
def _stix_id(obj_type: str) -> str:
    return f"{obj_type}--{uuidlib.uuid4()}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def to_stix_bundle(advisory: dict) -> dict:
    """Build a STIX 2.1 Bundle containing a Report object + Indicator objects
    for every IOC. Other CTI platforms can ingest this directly."""
    now = _now_iso()
    bundle_id = _stix_id("bundle")

    iocs = advisory.get("iocs", {}) or {}
    indicators: list[dict] = []
    for ioc_type, values in iocs.items():
        for v in (values or []):
            pattern = _ioc_to_stix_pattern(ioc_type, v)
            if not pattern:
                continue
            indicators.append({
                "type": "indicator",
                "spec_version": "2.1",
                "id": _stix_id("indicator"),
                "created": now,
                "modified": now,
                "name": f"{ioc_type}: {v}",
                "pattern": pattern,
                "pattern_type": "stix",
                "valid_from": now,
                "labels": ["malicious-activity"],
                "indicator_types": ["malicious-activity"],
            })

    severity_to_score = {"low": 30, "medium": 60, "high": 80, "critical": 95}
    report = {
        "type": "report",
        "spec_version": "2.1",
        "id": _stix_id("report"),
        "created": now,
        "modified": now,
        "name": advisory.get("title", "Advisory"),
        "description": advisory.get("summary") or "",
        "published": advisory.get("published_at") or now,
        "report_types": [advisory.get("kind", "threat-report")],
        "labels": advisory.get("tags", []) or [],
        "object_refs": [i["id"] for i in indicators] or ["indicator--00000000-0000-0000-0000-000000000000"],
        "confidence": severity_to_score.get(advisory.get("severity", "medium"), 60),
        "object_marking_refs": [_tlp_marking_ref(advisory.get("tlp", "WHITE"))],
    }

    objects = [report] + indicators
    return {
        "type": "bundle",
        "id": bundle_id,
        "objects": objects,
    }


def _ioc_to_stix_pattern(ioc_type: str, value: str) -> str | None:
    """Turn a raw IOC into a STIX pattern expression."""
    v = value.replace("'", "\\'")
    t = ioc_type.lower()
    if t in ("ipv4", "ip"):
        return f"[ipv4-addr:value = '{v}']"
    if t == "ipv6":
        return f"[ipv6-addr:value = '{v}']"
    if t == "domain":
        return f"[domain-name:value = '{v}']"
    if t == "url":
        return f"[url:value = '{v}']"
    if t == "email":
        return f"[email-addr:value = '{v}']"
    if t in ("md5", "sha1", "sha256"):
        return f"[file:hashes.'{t.upper()}' = '{v}']"
    if t == "cve":
        return f"[vulnerability:name = '{v}']"
    return None


# Standard TLP marking definition IDs (from STIX 2.1 spec)
_TLP_MARKINGS = {
    "WHITE": "marking-definition--613f2e26-407d-48c7-9eca-b8e91df99dc9",
    "GREEN": "marking-definition--34098fce-860f-48ae-8e50-ebd3cc5e41da",
    "AMBER": "marking-definition--f88d31f6-486f-44da-b317-01333bde0b82",
    "RED":   "marking-definition--5e57c739-391a-4eb3-b6be-7d15ca92d5ed",
}


def _tlp_marking_ref(tlp: str) -> str:
    return _TLP_MARKINGS.get(tlp.upper(), _TLP_MARKINGS["WHITE"])


# ---------------------------------------------------------------------------
# HTML export — pretty-printed advisory for in-browser preview / save-as.
# ---------------------------------------------------------------------------
def to_html(advisory: dict) -> str:
    """Render advisory as standalone HTML (for download or preview)."""
    title = html.escape(advisory.get("title", "Advisory"))
    summary = html.escape(advisory.get("summary") or "")
    severity = html.escape(advisory.get("severity", "medium"))
    kind = html.escape(advisory.get("kind", "threat"))
    tlp = html.escape(advisory.get("tlp", "WHITE"))
    body = (advisory.get("body_markdown") or "")
    # Naive markdown → HTML (good enough for preview without a markdown lib)
    body_html = _markdown_lite(body)
    iocs = advisory.get("iocs", {}) or {}
    iocs_html = ""
    for kind_name, values in iocs.items():
        if not values:
            continue
        items = "".join(f"<li><code>{html.escape(str(v))}</code></li>" for v in values)
        iocs_html += f"<h3>{html.escape(kind_name)}</h3><ul>{items}</ul>"
    severity_color = {"low": "#16a34a", "medium": "#ca8a04", "high": "#ea580c", "critical": "#dc2626"}.get(severity, "#64748b")

    return f"""<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>{title}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #0f172a; line-height: 1.6; }}
    .meta {{ display: flex; gap: 12px; margin-bottom: 24px; }}
    .pill {{ padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; }}
    .severity {{ background: {severity_color}1a; color: {severity_color}; border: 1px solid {severity_color}40; }}
    .kind {{ background: #6366f11a; color: #6366f1; border: 1px solid #6366f140; }}
    .tlp {{ background: #eab30822; color: #92400e; border: 1px solid #eab30844; }}
    h1 {{ font-size: 28px; margin: 0 0 8px; }}
    h2 {{ font-size: 18px; margin-top: 32px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }}
    h3 {{ font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-top: 20px; }}
    code {{ background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; }}
    .summary {{ background: #f8fafc; padding: 16px; border-left: 3px solid {severity_color}; border-radius: 4px; }}
    footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }}
  </style>
</head><body>
  <div class="meta">
    <span class="pill kind">{kind}</span>
    <span class="pill severity">{severity}</span>
    <span class="pill tlp">TLP:{tlp}</span>
  </div>
  <h1>{title}</h1>
  <div class="summary">{summary}</div>
  {body_html}
  {('<h2>Indicators</h2>' + iocs_html) if iocs_html else ''}
  <footer>
    Generated by TAI-AEGIS · {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}
  </footer>
</body></html>"""


def _markdown_lite(text: str) -> str:
    """Tiny markdown renderer — headings, bold, code, lists, paragraphs.
    Good enough for advisories without pulling a markdown lib."""
    import re

    lines = text.split("\n")
    out: list[str] = []
    in_list = False

    for line in lines:
        stripped = line.rstrip()
        if not stripped:
            if in_list:
                out.append("</ul>")
                in_list = False
            continue

        # Headings
        m = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if m:
            if in_list:
                out.append("</ul>")
                in_list = False
            level = len(m.group(1)) + 1  # ## → h3
            content = _inline(m.group(2))
            out.append(f"<h{level}>{content}</h{level}>")
            continue

        # Bullets
        if stripped.startswith("- ") or stripped.startswith("* "):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{_inline(stripped[2:])}</li>")
            continue

        # Plain paragraph
        if in_list:
            out.append("</ul>")
            in_list = False
        out.append(f"<p>{_inline(stripped)}</p>")

    if in_list:
        out.append("</ul>")
    return "\n".join(out)


def _inline(text: str) -> str:
    import re
    text = html.escape(text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    return text
