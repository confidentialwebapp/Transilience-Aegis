"""Maltego TRX transform server — exposes TAI-AEGIS data inside Maltego desktop.

Each transform takes one input entity (IP, Domain, Hash, CVE, Threat Actor,
Email) and returns related entities so analysts can pivot inside Maltego.

How to install (Maltego CE / Classic):
  1. In Maltego: Transforms → New Local Transform OR
     Transforms → Manage Transforms → Add Transform → Local
  2. Set transform name, input entity type, command:
     curl -s -X POST -H "Content-Type: text/xml" --data-binary @- \\
       "https://<your-host>/maltego/transforms/<transform-name>"
  3. Or use the included Maltego config XML (see /maltego/config.xml endpoint).

Auth: if MALTEGO_TRX_AUTH_TOKEN is set, every request must include header
`X-AEGIS-TRX-Token: <token>`.
"""
