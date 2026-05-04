"""Build PDF reports (executive + technical) from a ScanReport."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from config.settings import RUNTIME
from core.evidence import EvidenceStore, Finding, ScanReport
from core.severity import Severity

from . import charts, compliance, kill_chain

PENTEST_CATEGORIES = {"vulnerability", "tls_misconfig", "infra_exposure"}
TEMPLATE_DIR = Path(__file__).parent / "templates"

# AI-triage labels that mean "not a real finding"
NON_FINDING_LABELS = {"OFFICIAL", "IRRELEVANT", "SPAM"}
# Confidence threshold for treating a label as authoritative
LABEL_TRUST_CONFIDENCE = 0.6


def _ai_label(f: Finding) -> tuple[str | None, float]:
    triage = (f.raw or {}).get("ai_triage") or {}
    return triage.get("label"), float(triage.get("confidence") or 0)


def _is_non_finding(f: Finding) -> bool:
    label, conf = _ai_label(f)
    return bool(label and label in NON_FINDING_LABELS and conf >= LABEL_TRUST_CONFIDENCE)


def _overall_severity(findings: list[Finding]) -> str:
    if any(f.severity == Severity.CRITICAL for f in findings):
        return Severity.CRITICAL.value
    if any(f.severity == Severity.HIGH for f in findings):
        return Severity.HIGH.value
    if any(f.severity == Severity.MEDIUM for f in findings):
        return Severity.MEDIUM.value
    if any(f.severity == Severity.LOW for f in findings):
        return Severity.LOW.value
    return Severity.INFO.value


def _exec_takeaway(findings: list[Finding]) -> str:
    crit = [f for f in findings if f.severity == Severity.CRITICAL]
    high = [f for f in findings if f.severity == Severity.HIGH]
    if crit:
        return (
            f"There are {len(crit)} critical findings requiring action within 7 days, "
            f"including credential, infrastructure, or impersonation exposures that materially "
            f"raise the probability of customer fraud or data breach."
        )
    if high:
        return (
            f"{len(high)} high-severity issues are present. None are immediately catastrophic "
            f"in isolation, but several can be chained for credential theft or brand-impersonation "
            f"campaigns. Remediate within 30 days."
        )
    return (
        "No critical or high findings observed in this engagement. Maintain current posture and "
        "continue scheduled monitoring."
    )


def _by_category_summary(findings: list[Finding]) -> list[dict[str, Any]]:
    g: dict[str, list[Finding]] = defaultdict(list)
    for f in findings:
        g[f.category].append(f)
    out = []
    for cat, items in sorted(g.items(), key=lambda x: -len(x[1])):
        max_sev = sorted(items, key=lambda f: f.severity.order)[0].severity.value
        out.append({"category": cat, "count": len(items), "max_severity": max_sev})
    return out


def _by_asset_summary(findings: list[Finding]) -> list[dict[str, Any]]:
    g: dict[str, list[Finding]] = defaultdict(list)
    for f in findings:
        g[f.affected_asset].append(f)
    out = []
    for asset, items in sorted(g.items(), key=lambda x: -len(x[1])):
        max_sev = sorted(items, key=lambda f: f.severity.order)[0].severity.value
        out.append({"asset": asset, "count": len(items), "max_severity": max_sev})
    return out[:25]


def _roadmap(findings: list[Finding]) -> dict[str, list[Finding]]:
    buckets: dict[str, list[Finding]] = {"immediate": [], "short_term": [], "long_term": []}
    for f in sorted(findings, key=lambda f: f.severity.order):
        buckets.setdefault(f.remediation_priority, buckets["short_term"]).append(f)
    return buckets


def _compliance_matrix(findings: list[Finding], frameworks: list[str]) -> list[dict[str, Any]]:
    out = []
    for fw in frameworks:
        touched = [f for f in findings if any(t.startswith(f"{fw}:") for t in f.compliance_tags)]
        if not touched:
            continue
        sample_controls: list[str] = []
        seen: set[str] = set()
        for f in touched:
            for t in f.compliance_tags:
                if t.startswith(f"{fw}:") and t not in seen:
                    seen.add(t)
                    sample_controls.append(t.split(":", 1)[1].strip())
                    if len(sample_controls) >= 6:
                        break
            if len(sample_controls) >= 6:
                break
        out.append({"framework": fw, "count": len(touched), "sample": sample_controls})
    return out


def _raw_evidence_index(scan_dir: Path) -> list[dict[str, Any]]:
    ev_dir = scan_dir / "evidence"
    out = []
    if not ev_dir.exists():
        return out
    for path in sorted(ev_dir.rglob("*")):
        if path.is_file():
            out.append({
                "path": str(path.relative_to(scan_dir)),
                "module": path.parent.name,
                "size": path.stat().st_size,
            })
    return out


def build_reports(report: ScanReport, scan_dir: Path) -> dict[str, Path]:
    """Render executive + technical PDFs and write them under reports/<scan_id>/."""
    from weasyprint import HTML

    raw_findings = report.all_findings

    # Split into real findings vs AI-confirmed non-findings (own assets / unrelated / spam)
    findings = [f for f in raw_findings if not _is_non_finding(f)]
    own_assets = [f for f in raw_findings if (_ai_label(f)[0] == "OFFICIAL" and _ai_label(f)[1] >= LABEL_TRUST_CONFIDENCE)]
    irrelevant = [f for f in raw_findings if (_ai_label(f)[0] == "IRRELEVANT" and _ai_label(f)[1] >= LABEL_TRUST_CONFIDENCE)]
    spam_filtered = [f for f in raw_findings if (_ai_label(f)[0] == "SPAM" and _ai_label(f)[1] >= LABEL_TRUST_CONFIDENCE)]

    brand_cfg = report.config.get("brand", {}) or {}
    engagement = report.config.get("engagement", {}) or {}
    assets = report.config.get("assets", {}) or {}
    people = report.config.get("people", {}) or {}
    report_cfg = report.config.get("report", {}) or {}
    compliance_frameworks = report.config.get("compliance", []) or []

    # 1. Tag findings with compliance controls
    for f in findings:
        compliance.tag_finding(f, compliance_frameworks)

    # 2. Create output dirs
    out_dir = RUNTIME.reports_dir / report.scan_id
    chart_dir = out_dir / "charts"
    chart_dir.mkdir(parents=True, exist_ok=True)

    # 3. Charts
    chart_paths = {
        "severity": charts.severity_distribution(findings, chart_dir / "severity.png"),
        "category": charts.category_breakdown(findings, chart_dir / "category.png"),
        "risk_heatmap": charts.risk_heatmap(findings, chart_dir / "risk_heatmap.png"),
        "top_assets": charts.top_assets(findings, chart_dir / "top_assets.png"),
    }

    # 4. Common context
    by_sev = report.by_severity()
    pentest_findings = [f for f in findings if f.category in PENTEST_CATEGORIES]
    brand_findings = [f for f in findings if f.category not in PENTEST_CATEGORIES]
    top_findings = sorted(findings, key=lambda f: (f.severity.order, -f.risk_score))[:15]

    # AI triage roll-up (if applied)
    ai_triaged = [f for f in findings if (f.raw or {}).get("ai_triage")]
    ai_label_counts: dict[str, int] = {}
    for f in ai_triaged:
        lab = f.raw["ai_triage"]["label"]
        ai_label_counts[lab] = ai_label_counts.get(lab, 0) + 1

    stats = {
        "total": len(findings),
        "by_severity": by_sev,
        "module_count": len(report.module_results),
        "brand_findings": len(brand_findings),
        "pentest_findings": len(pentest_findings),
        "exposed_credentials": sum(1 for f in findings if f.category == "credential_leak"),
        "ai_triaged": len(ai_triaged),
        "ai_labels": ai_label_counts,
        "ai_real_threats": sum(1 for f in ai_triaged if f.raw["ai_triage"]["label"] in ("IMPERSONATION", "SCAM")),
        "raw_findings_total": len(raw_findings),
        "filtered_total": len(raw_findings) - len(findings),
        "own_assets_discovered": len(own_assets),
        "irrelevant_filtered": len(irrelevant),
        "spam_filtered": len(spam_filtered),
    }

    css_text = (TEMPLATE_DIR / "styles.css").read_text(encoding="utf-8")

    common_ctx = {
        "brand": brand_cfg,
        "engagement": engagement,
        "assets": assets,
        "people": people,
        "report": report_cfg,
        "scan_id": report.scan_id,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "stats": stats,
        "by_severity": by_sev,
        "overall_severity": _overall_severity(findings),
        "exec_takeaway": _exec_takeaway(findings),
        "brand_summary": _by_category_summary(brand_findings),
        "pentest_summary": _by_asset_summary(pentest_findings),
        "top_findings": top_findings,
        "kill_chain": kill_chain.build_narrative(findings).replace("\n\n", "<br/><br/>").replace("\n", "<br/>"),
        "charts": {k: v.as_uri() for k, v in chart_paths.items()},
        "roadmap": _roadmap(findings),
        "compliance_matrix": _compliance_matrix(findings, compliance_frameworks),
        "module_results": report.module_results,
        "brand_findings": brand_findings,
        "pentest_findings": pentest_findings,
        "raw_evidence_index": _raw_evidence_index(scan_dir),
        "resolved_assets": assets,
        "own_assets": own_assets,
        "irrelevant_filtered": irrelevant,
        "spam_filtered": spam_filtered,
        "styles": css_text,
    }

    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), autoescape=select_autoescape())

    out: dict[str, Path] = {}
    if report_cfg.get("generate_executive", True):
        exec_html = env.get_template("executive.html").render(variant="executive", **common_ctx)
        exec_pdf = out_dir / f"{report.scan_id}_executive.pdf"
        HTML(string=exec_html, base_url=str(TEMPLATE_DIR)).write_pdf(str(exec_pdf))
        (out_dir / f"{report.scan_id}_executive.html").write_text(exec_html, encoding="utf-8")
        out["executive"] = exec_pdf

    if report_cfg.get("generate_technical", True):
        tech_html = env.get_template("technical.html").render(variant="technical", **common_ctx)
        tech_pdf = out_dir / f"{report.scan_id}_technical.pdf"
        HTML(string=tech_html, base_url=str(TEMPLATE_DIR)).write_pdf(str(tech_pdf))
        (out_dir / f"{report.scan_id}_technical.html").write_text(tech_html, encoding="utf-8")
        out["technical"] = tech_pdf

    # Always emit a JSON dump for downstream tooling
    json_path = out_dir / f"{report.scan_id}_findings.json"
    json_path.write_text(report.model_dump_json(indent=2), encoding="utf-8")
    out["json"] = json_path

    return out
