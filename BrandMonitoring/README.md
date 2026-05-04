# BrandMonitoring — Enterprise Brand & Cyber Threat Intelligence

End-to-end OSINT-driven brand monitoring + cybersecurity exposure scanning, with a PDF deliverable suitable for board / CISO consumption.

## Capabilities

| Domain                          | What it covers |
|---------------------------------|----------------|
| Domain abuse                    | Typosquats, lookalikes, homoglyphs, IDN, expired/parked, newly registered |
| Phishing infrastructure         | Active phishing URLs, hosting, registrar, screenshots, kit fingerprints |
| Infra reputation                | Shodan exposure, AbuseIPDB, AlienVault OTX, certificate transparency |
| Social impersonation            | Fake handles across 350+ platforms (Sherlock/Maigret) + IG/FB scraping (Apify) |
| Executive & employee exposure   | HIBP breaches, Holehe account discovery, paste-site search |
| Code / secret leaks             | GitHub/Gitleaks search for tokens, source code, internal docs |
| Dark / deep web                 | IntelX, ransomware leak sites, paste sites |
| Mobile app abuse                | Rogue listings on Play / App Store / APK mirrors |
| Counterfeit & marketplace abuse | Logo / trademark misuse on e-commerce |
| Ad fraud / SEO poisoning        | Malicious ads referencing the brand |
| Deepfake / synthetic media      | Hash + reverse-image hooks (extensible) |
| Pentest recon                   | Port exposure, CVE mapping, TLS hygiene, security headers |

## Quick start

```bash
cd /home/kali/TAI/BrandMonitoring
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
cp config/brand.example.yaml config/brand.yaml
# Edit config/brand.yaml with your brand assets
python scan.py run --config config/brand.yaml
```

The PDF report appears in `reports/<scan_id>/`.

## Claude skill

The skill manifest is installed at `~/.claude/skills/brand-monitoring/SKILL.md`.
Invoke from any Claude Code session by describing a brand monitoring task.

## Architecture

```
scan.py                 CLI entrypoint
core/                   Orchestrator, evidence model, severity, async HTTP
integrations/           One client per OSINT API
modules/                Detection logic - composes integrations into findings
reporting/              Jinja2 → HTML → WeasyPrint PDF, charts, compliance
config/                 Brand config (YAML)
data/<scan_id>/         Raw findings + evidence (JSON, screenshots)
reports/<scan_id>/      Final PDFs (executive + technical)
```

## Compliance mappings included
ISO 27001, NIST CSF, PCI DSS, SOC 2, GDPR, DPDP Act, HIPAA, RBI/SEBI cyber resilience guidelines.

## Authorized use only
This tool is intended for **defensive** brand monitoring on assets you own or are explicitly authorized to assess. Misuse may violate computer fraud, anti-stalking, and platform-abuse laws.
