"""Screenshot capture for evidence preservation.

Strategy (in order):
  1. URLScan.io if a finding's evidence already references a URLScan UUID
     (free, immediate — they already screenshotted it)
  2. Local Playwright (Chromium) — reliable, runs in-process, no API quota
  3. URLScan submit (slow but free fallback)
  4. Apify dedicated screenshot actor (last resort, costs Apify credits)
"""
from __future__ import annotations

import asyncio
import base64
import re
from pathlib import Path
from typing import Any

from config.settings import KEYS
from core.evidence import Evidence, EvidenceStore, Finding
from core.http import get_bytes, request_json
from core.logging_setup import get_logger

log = get_logger(__name__)

URLSCAN_UUID_RE = re.compile(r"https?://urlscan\.io/(?:result|screenshots)/([0-9a-f-]{36})")

APIFY_BASE = "https://api.apify.com/v2"
APIFY_SCREENSHOT_ACTOR = "apify~web-scraper"


_playwright_lock = asyncio.Lock()
_playwright_browser: Any = None
_playwright_ctx: Any = None


async def _ensure_playwright():
    """Lazy-init a single shared Chromium browser for the scan."""
    global _playwright_browser, _playwright_ctx
    if _playwright_browser is not None:
        return _playwright_browser, _playwright_ctx
    async with _playwright_lock:
        if _playwright_browser is not None:
            return _playwright_browser, _playwright_ctx
        try:
            from playwright.async_api import async_playwright
            pw = await async_playwright().start()
            _playwright_browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            )
            _playwright_ctx = await _playwright_browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                ignore_https_errors=True,
            )
        except Exception as e:
            log.warning(f"playwright init failed: {e}")
            _playwright_browser = None
            _playwright_ctx = None
    return _playwright_browser, _playwright_ctx


async def shutdown_playwright():
    global _playwright_browser, _playwright_ctx
    if _playwright_browser:
        try:
            await _playwright_browser.close()
        except Exception:
            pass
    _playwright_browser = None
    _playwright_ctx = None


async def _from_playwright(url: str, full_page: bool = False, timeout_ms: int = 25000) -> bytes | None:
    """Capture via local headless Chromium."""
    _, ctx = await _ensure_playwright()
    if ctx is None:
        return None
    page = None
    try:
        page = await ctx.new_page()
        await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
        # Settle dynamic content
        await asyncio.sleep(2)
        return await page.screenshot(full_page=full_page, type="png")
    except Exception as e:
        log.debug(f"playwright capture {url} failed: {e}")
        return None
    finally:
        if page:
            try:
                await page.close()
            except Exception:
                pass


async def _from_urlscan(finding: Finding) -> bytes | None:
    """If finding evidence references a URLScan UUID, fetch the existing screenshot."""
    for e in finding.evidence:
        for v in (e.value, e.label):
            if not v:
                continue
            m = URLSCAN_UUID_RE.search(v)
            if m:
                uuid = m.group(1)
                img = await get_bytes(f"https://urlscan.io/screenshots/{uuid}.png", timeout=20)
                if img:
                    return img
    return None


async def _from_apify(url: str, full_page: bool = False, timeout: int = 90) -> bytes | None:
    """Capture a URL screenshot via apify/screenshot-url actor (purpose-built)."""
    if not KEYS.apify or not url:
        return None
    # Try the dedicated screenshot actor first
    payload = {
        "urls": [{"url": url}],
        "fullPage": full_page,
        "format": "png",
        "delay": 3000,
        "viewportWidth": 1280,
        "viewportHeight": 800,
    }
    actor = "apify~screenshot-url"
    r = await request_json(
        "POST",
        f"{APIFY_BASE}/acts/{actor}/run-sync-get-dataset-items",
        headers={"Authorization": f"Bearer {KEYS.apify}"},
        params={"timeout": timeout, "format": "json"},
        json=payload,
        retries=1,
        timeout=timeout + 30,
    )
    if isinstance(r, list) and r:
        item = r[0]
        if isinstance(item, dict):
            # actor returns either a base64 image or a screenshot URL on a CDN
            img_b64 = item.get("image") or item.get("screenshot")
            if img_b64:
                try:
                    return base64.b64decode(img_b64)
                except Exception:
                    pass
            screenshot_url = item.get("screenshotUrl") or item.get("imageUrl")
            if screenshot_url:
                return await get_bytes(screenshot_url, timeout=20)
    return None


async def _from_urlscan_submit(url: str, timeout: int = 45) -> bytes | None:
    """Submit URL to urlscan.io and fetch the resulting screenshot."""
    from integrations import urlscan_client
    submission = await urlscan_client.submit(url, visibility="public")
    if not isinstance(submission, dict):
        return None
    uuid = submission.get("uuid")
    if not uuid:
        return None
    # urlscan needs ~10-30s to render
    for _ in range(8):
        await asyncio.sleep(5)
        img = await get_bytes(f"https://urlscan.io/screenshots/{uuid}.png", timeout=15)
        if img:
            return img
    return None


async def capture_for_finding(finding: Finding, store: EvidenceStore) -> Path | None:
    """Capture a screenshot for the finding and attach it as Evidence."""
    if not finding.indicator or not finding.indicator.startswith("http"):
        return None
    # 1. Free path: existing URLScan UUID in the finding's evidence
    img = await _from_urlscan(finding)
    source = "urlscan-existing"
    # 2. Local Playwright (most reliable; in-process)
    if not img:
        img = await _from_playwright(finding.indicator)
        source = "playwright"
    # 3. URLScan public submit (slow, free, captures social-media URLs well)
    if not img:
        img = await _from_urlscan_submit(finding.indicator)
        source = "urlscan-submit"
    # 4. Last resort: Apify dedicated screenshot actor
    if not img:
        img = await _from_apify(finding.indicator)
        source = "apify"
    if not img:
        return None
    name = f"screenshot_{finding.id}.png"
    path = store.save_bytes("screenshots", name, img)
    # Attach to finding
    finding.evidence.append(Evidence(
        type="screenshot",
        label=f"Captured ({source})",
        file_path=str(path),
        hash_sha256=EvidenceStore.hash_bytes(img),
    ))
    log.info(f"screenshot: captured {len(img)//1024} KB for {finding.id} via {source}")
    return path


async def capture_priority_findings(
    findings: list[Finding],
    store: EvidenceStore,
    max_count: int = 30,
    concurrency: int = 4,
    severity_min: tuple[str, ...] = ("Critical", "High"),
) -> int:
    """Capture screenshots for top findings — in priority order."""
    targets = [f for f in findings if f.severity.value in severity_min and f.indicator and f.indicator.startswith("http")]
    targets = sorted(targets, key=lambda f: (f.severity.order, -f.risk_score))[:max_count]
    if not targets:
        return 0
    log.info(f"screenshot: capturing {len(targets)} priority findings")
    sem = asyncio.Semaphore(concurrency)

    async def _one(f: Finding) -> int:
        async with sem:
            try:
                p = await capture_for_finding(f, store)
                return 1 if p else 0
            except Exception as e:
                log.debug(f"screenshot {f.id} failed: {e}")
                return 0

    results = await asyncio.gather(*(_one(f) for f in targets), return_exceptions=False)
    return sum(results)
