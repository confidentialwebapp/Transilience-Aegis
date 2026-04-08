import logging

import httpx

logger = logging.getLogger(__name__)


def _get_settings():
    from config import get_settings
    return get_settings()


async def send_email_alert(to: str, subject: str, body: str):
    settings = _get_settings()
    if not settings.RESEND_API_KEY:
        logger.debug("Resend API key not configured, skipping email")
        return

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={
                "from": "TAI-AEGIS <alerts@tai-aegis.com>",
                "to": [to],
                "subject": subject,
                "html": body,
            },
            timeout=30,
        )
        if resp.status_code not in (200, 201):
            logger.error("Failed to send email: %s", resp.text)


async def send_webhook(url: str, payload: dict):
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=30)
        if resp.status_code >= 400:
            logger.error("Webhook delivery failed (%d): %s", resp.status_code, resp.text)


async def send_telegram(message: str):
    settings = _get_settings()
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
        logger.debug("Telegram not configured, skipping")
        return

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
            json={
                "chat_id": settings.TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": "HTML",
            },
            timeout=30,
        )
        if resp.status_code != 200:
            logger.error("Telegram send failed: %s", resp.text)


async def dispatch_alert(alert: dict, notification_settings: dict):
    severity = alert.get("severity", "info")
    title = alert.get("title", "Alert")
    description = alert.get("description", "")
    module = alert.get("module", "unknown")

    severity_rank = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
    min_sev = notification_settings.get("min_severity", "medium")
    if severity_rank.get(severity, 0) < severity_rank.get(min_sev, 2):
        return

    subject = f"[TAI-AEGIS] [{severity.upper()}] {title}"
    html_body = f"""
    <h2>{title}</h2>
    <p><strong>Severity:</strong> {severity.upper()}</p>
    <p><strong>Module:</strong> {module}</p>
    <p>{description}</p>
    """
    telegram_text = f"<b>[{severity.upper()}]</b> {title}\n{module}: {description[:200]}"

    if notification_settings.get("email_enabled"):
        for recipient in notification_settings.get("email_recipients", []):
            try:
                await send_email_alert(recipient, subject, html_body)
            except Exception as e:
                logger.error("Email notification failed: %s", e)

    if notification_settings.get("webhook_enabled") and notification_settings.get("webhook_url"):
        try:
            await send_webhook(notification_settings["webhook_url"], {
                "text": subject,
                "severity": severity,
                "module": module,
                "title": title,
                "description": description,
            })
        except Exception as e:
            logger.error("Webhook notification failed: %s", e)

    if notification_settings.get("telegram_enabled"):
        try:
            await send_telegram(telegram_text)
        except Exception as e:
            logger.error("Telegram notification failed: %s", e)
