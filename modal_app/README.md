# TAI-AEGIS — Modal scanner workers

Runs Kali/OSINT tools as serverless Modal functions. Called from the Render
backend whenever the user clicks a "Run scan" button.

## Tools deployed

| Modal function | Tool | Use |
|---|---|---|
| `run_subfinder` | subfinder | Subdomain enumeration |
| `run_httpx` | projectdiscovery/httpx | HTTP probing (status, title, tech) |
| `run_dnsx` | projectdiscovery/dnsx | Bulk DNS resolution |
| `run_dnstwist` | dnstwist | Typosquat detection |
| `run_maigret` | maigret | Username OSINT (500+ sites) |
| `run_theharvester` | theHarvester | Email/host/IP/ASN discovery |
| `run_nmap` | nmap | Port + service detection |
| `run_nuclei` | nuclei | Templated vuln scanning |
| `attack_surface` | composite | subfinder → dnsx → httpx pipeline |

## Deployment

Auto-deployed by `.github/workflows/modal-deploy.yml` on every push to
`main` that touches `modal_app/**`.

Manual deploy (if you have the CLI):
```bash
modal deploy modal_app/main.py
```

Required GitHub secrets:
- `MODAL_TOKEN_ID`
- `MODAL_TOKEN_SECRET`

Get them from: https://modal.com/settings/tokens

## Cost guardrails

- All functions: **no keep_warm** (scale to zero when idle)
- Hard timeouts: 2-7 min depending on tool
- Set monthly spend cap in Modal dashboard: https://modal.com/settings/billing
- Recommended: $5/mo cap during early development

Per-scan cost estimates (1 CPU, 512 MB-1 GB RAM):
- subfinder, dnstwist: ~30-60s = $0.001-0.002
- maigret, theHarvester: 1-3 min = $0.005-0.015
- nuclei: 3-7 min = $0.015-0.04
- 500 mixed scans/month ≈ $1-3 total

## How the backend calls these

```python
import modal
fn = modal.Function.lookup("aegis-scanners", "run_subfinder")
result = await fn.remote.aio(domain="example.com")
# result is the dict returned by the function
```

Render reads `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` from its env vars to
authenticate the lookup. Same secrets as GitHub.
