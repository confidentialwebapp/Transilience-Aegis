"""Customer email digest — daily/weekly threat-brief delivery.

Per customer_profile (not per user), gathers everything that's interesting
since the last digest and sends a single HTML email via Resend.

Cadence is decided by `digest_frequency` on the profile (off/daily/weekly).
The Modal cron tick fires every hour; this module decides which profiles
are actually due to receive a digest right now.

Anti-bombardment guards:
  * `digest_frequency = 'off'` (default) → never send
  * `notify_email` empty → never send
  * `digest_last_sent_at` within frequency interval → skip
  * No matching alerts AND no matching researcher posts since last sent → skip
"""

from __future__ import annotations

import html
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


def _client_db():
    from db import get_client
    return get_client()


# ---------------------------------------------------------------------------
# Eligibility
# ---------------------------------------------------------------------------
FREQUENCY_DELTA = {
    "daily": timedelta(hours=23, minutes=30),  # leave 30min slack for cron drift
    "weekly": timedelta(days=6, hours=23),
}


def _is_due(profile: dict, now: datetime) -> bool:
    freq = profile.get("digest_frequency", "off")
    if freq not in FREQUENCY_DELTA:
        return False
    if not profile.get("notify_email"):
        return False
    last = profile.get("digest_last_sent_at")
    if not last:
        return True
    try:
        last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
    except Exception:
        return True
    return (now - last_dt) >= FREQUENCY_DELTA[freq]


# ---------------------------------------------------------------------------
# Content gathering
# ---------------------------------------------------------------------------
def _gather_alerts(client, org_id: str, since: datetime) -> list[dict]:
    """Pull this org's alerts since the cutoff (most recent first)."""
    try:
        res = (
            client.table("alerts")
            .select("id,title,description,severity,module,risk_score,source_url,created_at")
            .eq("org_id", org_id)
            .gte("created_at", since.isoformat())
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.warning("digest gather alerts failed for org %s: %s", org_id, e)
        return []


def _gather_researcher_posts(client, profile: dict, since: datetime) -> list[dict]:
    """Researcher posts that mention any of the profile's brand keywords or domains.

    Done as a substring match on the post text — cheap and good-enough at this scale.
    """
    keywords = [k.lower() for k in (profile.get("brand_keywords") or []) if k]
    domains = [d.lower() for d in (profile.get("domains") or []) if d]
    needles = [n for n in (keywords + domains) if n]
    if not needles:
        return []
    try:
        # Pull recent posts then filter in Python — Postgres ILIKE-OR over many
        # needles is expensive; result set is small at our scale.
        res = (
            client.table("researcher_posts")
            .select("id,channel,title,text,link,published_at,extracted_iocs")
            .gte("published_at", since.isoformat())
            .order("published_at", desc=True)
            .limit(500)
            .execute()
        )
        out = []
        for row in res.data or []:
            text = (row.get("text") or "").lower() + " " + (row.get("title") or "").lower()
            if any(n in text for n in needles):
                out.append(row)
        return out[:25]
    except Exception as e:
        logger.warning("digest gather posts failed: %s", e)
        return []


# ---------------------------------------------------------------------------
# HTML rendering
# ---------------------------------------------------------------------------
SEV_COLOR = {"critical": "#dc2626", "high": "#ea580c", "medium": "#ca8a04",
             "low": "#16a34a", "info": "#64748b"}


def _render_html(profile: dict, alerts: list[dict], posts: list[dict],
                 unsubscribe_url: str, dashboard_url: str) -> str:
    name = html.escape(profile.get("display_name") or "your organization")
    freq = profile.get("digest_frequency", "daily")
    period = "the last 24 hours" if freq == "daily" else "the last 7 days"

    sev_count = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for a in alerts:
        sev_count[a.get("severity", "info")] = sev_count.get(a.get("severity", "info"), 0) + 1

    counters = "".join(
        f'<span style="display:inline-block;margin-right:14px;padding:3px 9px;border-radius:6px;'
        f'background:{SEV_COLOR.get(s,"#64748b")}1a;color:{SEV_COLOR.get(s,"#64748b")};'
        f'font-weight:600;font-size:12px">{n} {s}</span>'
        for s, n in sev_count.items() if n > 0
    ) or "<em style='color:#64748b'>No new alerts in this window.</em>"

    alert_rows = []
    for a in alerts[:30]:
        sev = a.get("severity", "info")
        color = SEV_COLOR.get(sev, "#64748b")
        title = html.escape(a.get("title") or "")
        desc = html.escape((a.get("description") or "")[:300])
        url = a.get("source_url") or ""
        url_html = (f'<a href="{html.escape(url)}" style="color:#3b82f6;font-size:12px">view source →</a>'
                    if url else "")
        alert_rows.append(f"""
<tr>
  <td style="padding:12px 0;border-top:1px solid #e2e8f0">
    <div>
      <span style="display:inline-block;padding:2px 8px;border-radius:4px;background:{color}1a;color:{color};
                   font-size:10px;font-weight:700;text-transform:uppercase;margin-right:8px">{sev}</span>
      <span style="font-weight:600;color:#0f172a">{title}</span>
    </div>
    <div style="color:#475569;font-size:13px;margin-top:6px;white-space:pre-wrap">{desc}</div>
    <div style="margin-top:6px">{url_html}</div>
  </td>
</tr>""")

    post_rows = []
    for p in posts:
        title = html.escape((p.get("title") or p.get("channel") or "")[:120])
        chan = html.escape(p.get("channel") or "")
        text = html.escape((p.get("text") or "")[:240])
        link = p.get("link") or ""
        link_html = (f'<a href="{html.escape(link)}" style="color:#3b82f6;font-size:12px">open →</a>'
                     if link else "")
        post_rows.append(f"""
<tr>
  <td style="padding:10px 0;border-top:1px solid #e2e8f0">
    <div style="color:#7c3aed;font-size:11px;font-weight:600;text-transform:uppercase">{chan}</div>
    <div style="color:#0f172a;font-weight:600;margin-top:3px">{title}</div>
    <div style="color:#475569;font-size:12px;margin-top:4px">{text}</div>
    <div style="margin-top:4px">{link_html}</div>
  </td>
</tr>""")

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>AEGIS digest</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0">
<tr><td align="center">
<table width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:linear-gradient(135deg,#1e293b 0%,#312e81 100%);padding:24px 32px">
    <div style="color:#a5b4fc;font-size:11px;font-weight:700;letter-spacing:1.5px">TAI-AEGIS</div>
    <h1 style="color:#fff;font-size:22px;margin:6px 0 0">Threat brief for {name}</h1>
    <p style="color:#cbd5e1;font-size:13px;margin:4px 0 0">{period.capitalize()}</p>
  </td></tr>

  <tr><td style="padding:24px 32px">
    <h2 style="color:#0f172a;font-size:14px;letter-spacing:0.5px;text-transform:uppercase;margin:0 0 12px">
      Summary
    </h2>
    <div>{counters}</div>
  </td></tr>

  {f'''<tr><td style="padding:0 32px 8px">
    <h2 style="color:#0f172a;font-size:14px;letter-spacing:0.5px;text-transform:uppercase;margin:24px 0 0">
      Alerts ({len(alerts)})
    </h2>
    <table width="100%" cellspacing="0">{"".join(alert_rows)}</table>
  </td></tr>''' if alerts else ""}

  {f'''<tr><td style="padding:0 32px 8px">
    <h2 style="color:#0f172a;font-size:14px;letter-spacing:0.5px;text-transform:uppercase;margin:24px 0 0">
      Researcher mentions ({len(posts)})
    </h2>
    <table width="100%" cellspacing="0">{"".join(post_rows)}</table>
  </td></tr>''' if posts else ""}

  <tr><td style="padding:24px 32px;text-align:center;background:#f8fafc">
    <a href="{html.escape(dashboard_url)}"
       style="display:inline-block;padding:10px 24px;background:#4f46e5;color:#fff;
              text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
      Open dashboard
    </a>
  </td></tr>

  <tr><td style="padding:16px 32px 24px;text-align:center;color:#94a3b8;font-size:11px">
    You're receiving this because <code>{html.escape(profile.get("notify_email") or "")}</code>
    is the contact for the "{name}" watchlist profile.<br>
    <a href="{html.escape(unsubscribe_url)}" style="color:#94a3b8">Unsubscribe</a>
    &nbsp;·&nbsp; AEGIS by Transilience
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


# ---------------------------------------------------------------------------
# Resend
# ---------------------------------------------------------------------------
async def _send_via_resend(to: str, subject: str, html_body: str, from_addr: str) -> dict:
    from config import get_settings
    s = get_settings()
    if not s.RESEND_API_KEY:
        return {"ok": False, "error": "RESEND_API_KEY not configured"}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {s.RESEND_API_KEY}"},
                json={"from": from_addr, "to": [to], "subject": subject, "html": html_body},
            )
            if resp.status_code in (200, 201, 202):
                return {"ok": True, "message_id": resp.json().get("id")}
            return {"ok": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
async def send_digest_for_profile(profile: dict, *, force: bool = False) -> dict:
    """Compute + send a single digest. Returns a status dict.

    `force=True` skips the eligibility check (for /preview and /send-now endpoints).
    """
    from config import get_settings
    settings = get_settings()
    now = datetime.now(timezone.utc)

    if not force and not _is_due(profile, now):
        return {"status": "skipped", "reason": "not due"}

    if not profile.get("notify_email"):
        return {"status": "skipped", "reason": "no notify_email set"}

    client = _client_db()
    freq = profile.get("digest_frequency") or "daily"
    last = profile.get("digest_last_sent_at")
    try:
        cutoff = (datetime.fromisoformat(last.replace("Z", "+00:00"))
                  if last else now - FREQUENCY_DELTA.get(freq, timedelta(days=1)))
    except Exception:
        cutoff = now - FREQUENCY_DELTA.get(freq, timedelta(days=1))

    alerts = _gather_alerts(client, profile["org_id"], cutoff)
    posts = _gather_researcher_posts(client, profile, cutoff)

    if not alerts and not posts and not force:
        # don't bombard with empty digests
        try:
            client.table("customer_profiles").update({
                "digest_last_sent_at": now.isoformat()  # bump anyway so we don't re-check until next cycle
            }).eq("id", profile["id"]).execute()
        except Exception:
            pass
        client.table("digest_log").insert({
            "profile_id": profile["id"], "org_id": profile["org_id"],
            "email": profile["notify_email"], "frequency": freq, "status": "skipped",
            "error": "no new content", "alerts_count": 0, "posts_count": 0,
        }).execute()
        return {"status": "skipped", "reason": "no new content", "alerts": 0, "posts": 0}

    unsubscribe_url = f"{settings.FRONTEND_URL.rstrip('/')}/api/unsubscribe?token={profile.get('unsubscribe_token','')}"
    dashboard_url = f"{settings.FRONTEND_URL.rstrip('/')}/profile"

    html_body = _render_html(profile, alerts, posts, unsubscribe_url, dashboard_url)
    subject = (f"[AEGIS] {len(alerts)} alerts, {len(posts)} mentions"
               if (alerts or posts) else "[AEGIS] threat brief")

    # Resend default sender (you can verify a custom domain later)
    from_addr = "AEGIS <onboarding@resend.dev>"

    result = await _send_via_resend(profile["notify_email"], subject, html_body, from_addr)

    if result["ok"]:
        try:
            client.table("customer_profiles").update({
                "digest_last_sent_at": now.isoformat()
            }).eq("id", profile["id"]).execute()
        except Exception as e:
            logger.warning("digest last_sent update failed: %s", e)

    client.table("digest_log").insert({
        "profile_id": profile["id"], "org_id": profile["org_id"],
        "email": profile["notify_email"], "frequency": freq,
        "status": "sent" if result["ok"] else "failed",
        "error": result.get("error"),
        "alerts_count": len(alerts), "posts_count": len(posts),
        "resend_message_id": result.get("message_id"),
    }).execute()

    return {
        "status": "sent" if result["ok"] else "failed",
        "alerts": len(alerts), "posts": len(posts),
        "error": result.get("error"),
        "message_id": result.get("message_id"),
    }


async def send_digests_for_all_due() -> dict:
    """Iterate every customer_profile, send digests for any that are due.

    Called by the Modal hourly cron.
    """
    client = _client_db()
    now = datetime.now(timezone.utc)
    try:
        res = (
            client.table("customer_profiles")
            .select("*")
            .neq("digest_frequency", "off")
            .neq("notify_email", None)
            .eq("enabled", True)
            .execute()
        )
        profiles = res.data or []
    except Exception as e:
        return {"ok": False, "error": str(e)}

    sent = skipped = failed = 0
    for p in profiles:
        try:
            r = await send_digest_for_profile(p)
            if r["status"] == "sent":
                sent += 1
            elif r["status"] == "skipped":
                skipped += 1
            else:
                failed += 1
        except Exception as e:
            failed += 1
            logger.warning("digest send for profile %s crashed: %s", p.get("id"), e)
    return {"ok": True, "checked": len(profiles), "sent": sent, "skipped": skipped, "failed": failed}


def unsubscribe_by_token(token: str) -> bool:
    """Set digest_frequency to 'off' for the profile with this token."""
    if not token:
        return False
    client = _client_db()
    try:
        res = (
            client.table("customer_profiles")
            .update({"digest_frequency": "off"})
            .eq("unsubscribe_token", token)
            .execute()
        )
        return bool(res.data)
    except Exception as e:
        logger.warning("unsubscribe_by_token failed: %s", e)
        return False
