"""Document / file leak detection.

Searches for PDFs, DOC/DOCX, XLSX, PPTX, CSV, and known paste-/document-sharing
sites that contain the brand name. The output captures URL, filetype, snippet,
and (where possible) a fetched preview.

Sources:
  - Google `filetype:` operator via Apify SERP scraper
  - Common doc-sharing platforms: DocPlayer, Scribd, SlideShare, Issuu, Anyflip,
    Yumpu, Calameo, FlipHTML5
  - Paste sites: Pastebin, Gist, GitLab snippets, Rentry, ControlC, PasteIO
  - Public S3 buckets via grayhatwarfare (free tier — anonymous)
"""
from __future__ import annotations

import asyncio
import re
from typing import Any
from urllib.parse import urlparse

from core.base_module import DetectionModule
from core.evidence import Evidence, Finding
from core.http import get_text
from integrations import apify_client, intelx_client


DOC_FILETYPES = ("pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "txt", "log", "json", "sql", "env", "yaml", "yml", "key", "pem")

DOC_SHARING_SITES = {
    "docplayer.net":     "DocPlayer (mirror site — often hosts leaked docs)",
    "scribd.com":        "Scribd (document sharing)",
    "slideshare.net":    "SlideShare",
    "issuu.com":         "Issuu",
    "anyflip.com":       "AnyFlip",
    "yumpu.com":         "Yumpu",
    "calameo.com":       "Calameo",
    "fliphtml5.com":     "FlipHTML5",
    "pdfcoffee.com":     "PDFCoffee",
    "studocu.com":       "Studocu",
    "academia.edu":      "Academia.edu",
}

PASTE_SITES = {
    "pastebin.com":     "Pastebin",
    "gist.github.com":  "GitHub Gist",
    "gitlab.com":       "GitLab snippet",
    "rentry.co":        "Rentry",
    "controlc.com":     "ControlC",
    "pasteio.com":      "PasteIO",
    "ghostbin.co":      "GhostBin",
    "justpaste.it":     "JustPaste.it",
    "telegra.ph":       "Telegraph (Telegram-published article)",
}

SECRET_HINTS = re.compile(
    r"(?i)(password|secret|api[_-]?key|access[_-]?key|aws|bearer|jwt|"
    r"client[_-]?secret|database[_-]?url|connection[_-]?string|"
    r"private[_-]?key|begin\s+(?:rsa|ec|dsa|openssh|pgp)\s+private)"
)


def _filetype_from_url(url: str) -> str | None:
    p = urlparse(url).path.lower()
    if "." in p:
        ext = p.rsplit(".", 1)[-1]
        if ext in DOC_FILETYPES:
            return ext
    return None


def _site_kind(url: str) -> tuple[str, str] | None:
    host = urlparse(url).netloc.lower()
    for s, label in DOC_SHARING_SITES.items():
        if s in host:
            return ("document_share", label)
    for s, label in PASTE_SITES.items():
        if s in host:
            return ("paste_site", label)
    return None


class DocumentLeaksModule(DetectionModule):
    name = "document_leaks"
    category = "code_leak"
    description = "Brand-named documents on the open web: PDF/DOC/XLSX/PPTX leaks, paste-sites, document-share platforms."

    async def run(self) -> list[Finding]:
        brand_cfg = self.brand.get("brand") or {}
        brand = brand_cfg.get("name", "")
        legal = brand_cfg.get("legal_name", "")
        keywords = (self.brand.get("assets") or {}).get("brand_keywords") or []
        domains = (self.brand.get("assets") or {}).get("primary_domains") or []
        terms = [t for t in {brand, legal} | set(keywords) if t]
        if not terms:
            return []

        # === Step 1: Google filetype: queries via SERP ===
        ftype_queries: list[str] = []
        for t in terms[:3]:
            for ftype in ("pdf", "xlsx", "docx", "pptx", "csv", "json", "sql", "env"):
                ftype_queries.append(f'filetype:{ftype} "{t}"')
        # Email leaks
        for d in domains[:2]:
            ftype_queries.append(f'"{d}" filetype:txt')
            ftype_queries.append(f'"{d}" intext:password')
            ftype_queries.append(f'"@{d}" filetype:csv')

        # === Step 2: Site-restricted queries for each known doc-share + paste site ===
        site_queries: list[str] = []
        for t in terms[:3]:
            for site in list(DOC_SHARING_SITES) + list(PASTE_SITES):
                site_queries.append(f'site:{site} "{t}"')

        # Cap queries to control Apify cost
        all_queries = (ftype_queries + site_queries)[: int(self.cfg.get("max_queries", 60))]

        results = await apify_client.google_search(all_queries, results_per_query=10)
        self.store.save_raw(self.name, "doc_serp", results or [])

        # === Step 3: IntelX document buckets ===
        intelx_records: list[dict[str, Any]] = []
        if self.cfg.get("use_intelx", True):
            for t in terms[:5]:
                recs = await intelx_client.search(t, max_results=40)
                if recs:
                    intelx_records.extend(recs)
            self.store.save_raw(self.name, "intelx_docs", intelx_records[:200])

        # === Step 4: Build findings ===
        findings: list[Finding] = []
        seen_urls: set[str] = set()

        # 4a. Google SERP results
        for r in results or []:
            url = r.get("url") or ""
            title = r.get("title") or ""
            desc = r.get("description") or ""
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            if "google.com/search" in url or "bing.com/search" in url:
                continue

            ftype = _filetype_from_url(url)
            site_kind = _site_kind(url)
            if not ftype and not site_kind:
                # Skip generic web pages — only emit if filetype or known share-site
                continue

            findings.append(self._make_doc_finding(url, title, desc, ftype, site_kind, raw=r))

        # 4b. IntelX document records
        for rec in intelx_records[:60]:
            name = rec.get("name") or rec.get("systemid", "")
            bucket = rec.get("bucket", "")
            if "leaks" not in bucket.lower() and "documents" not in bucket.lower() and "pastes" not in bucket.lower():
                continue
            url = f"https://intelx.io/?did={rec.get('storageid')}"
            if url in seen_urls:
                continue
            seen_urls.add(url)
            ftype = (rec.get("media_h", "") or "").lower() or None
            findings.append(Finding.build(
                title=f"IntelX leaked document: {name[:80] or '(unnamed)'}",
                category="code_leak",
                module=self.name,
                affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
                indicator=url,
                likelihood=4, impact=4,
                description=(
                    f"IntelX surfaced a record in bucket '{bucket}' referencing brand keywords. "
                    f"Filename: {name}. Filetype: {ftype}. Date: {rec.get('date','')}. "
                    "Inspect the record on IntelX to determine sensitivity."
                ),
                recommendation=(
                    "Open the IntelX record; if confirmed sensitive (customer PII, internal docs, "
                    "credentials), trigger incident response: classify per data-protection policy, "
                    "notify DPO, file regulatory breach notification (GDPR Art. 33 / DPDP Sec. 8) "
                    "if applicable, request takedown from source."
                ),
                remediation_priority="immediate",
                mitre_attack=["T1567.002", "T1213"],
                evidence=[Evidence(type="url", label="IntelX", value=url)],
                raw=rec,
            ))

        return findings

    def _make_doc_finding(self, url: str, title: str, desc: str, ftype: str | None,
                          site_kind: tuple[str, str] | None, raw: dict[str, Any]) -> Finding:
        kind, label = site_kind or ("file_leak", f"{(ftype or 'file').upper()} document")

        # Try to fetch a preview snippet (best-effort, capped)
        snippet = ""
        # Note: synchronous would block; we skip live fetch here to keep module fast.
        # AI triage will use the SERP description.

        # Hint at sensitivity
        looks_sensitive = bool(SECRET_HINTS.search(title + " " + desc))

        likelihood, impact = (4, 4) if looks_sensitive else (3, 3)
        if kind == "paste_site":
            likelihood = 4   # paste sites are common scam / leak vector
        if ftype in ("env", "key", "pem", "sql"):
            likelihood, impact = 5, 5

        return Finding.build(
            title=f"Public {label} mentioning brand: {title[:70]}",
            category="code_leak" if kind in ("paste_site", "file_leak") else "darkweb_exposure",
            module=self.name,
            affected_asset=(self.brand.get("brand") or {}).get("name", "Brand"),
            indicator=url,
            likelihood=likelihood, impact=impact,
            description=(
                f"{label} found at {url} references brand keywords. "
                f"Snippet: {desc[:240]}"
                + ("  ⚠ SECRET-LIKE STRINGS DETECTED in title/snippet." if looks_sensitive else "")
            ),
            recommendation=(
                "Open the document; if confirmed sensitive (customer PII, employee data, internal "
                "docs, credentials), rotate any exposed secrets immediately, file takedown / DMCA "
                "with hosting provider, classify per DPDP/GDPR breach thresholds."
                if looks_sensitive or ftype in ("env", "key", "pem", "sql")
                else
                "Manual review — confirm sensitivity, file takedown if confidential."
            ),
            remediation_priority="immediate" if looks_sensitive or ftype in ("env", "key", "pem", "sql") else "short_term",
            cwe="CWE-200" if looks_sensitive else None,
            owasp="A01:2021 - Broken Access Control" if looks_sensitive else None,
            mitre_attack=["T1213", "T1552.001"] if looks_sensitive else ["T1213"],
            evidence=[Evidence(type="url", label=label, value=url)],
            raw=raw,
        )
