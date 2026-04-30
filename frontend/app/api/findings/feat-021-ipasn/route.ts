// FEAT-021 — IP / ASN intelligence helper.
// On-demand enrichment for FEAT-004 phishing findings. Resolves a list
// of domains to IPs, queries ip-api.com (free, no key) for ASN/country/
// hosting metadata. Used by AI Filter to add context, not a primary
// finding source.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

interface IpAsnInfo {
  domain: string;
  ip?: string;
  asn?: string;
  isp?: string;
  org?: string;
  country?: string;
  proxy?: boolean;
  hosting?: boolean;
  error?: string;
}

async function resolveAndEnrich(domain: string): Promise<IpAsnInfo> {
  const out: IpAsnInfo = { domain };
  try {
    const dns = await import("node:dns").then((m) => m.promises);
    const a = await dns.resolve4(domain);
    out.ip = a[0];
    if (out.ip) {
      const r = await fetch(`http://ip-api.com/json/${out.ip}?fields=as,isp,org,country,proxy,hosting,query`, {
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const j = (await r.json()) as { as?: string; isp?: string; org?: string; country?: string; proxy?: boolean; hosting?: boolean };
        out.asn = j.as; out.isp = j.isp; out.org = j.org;
        out.country = j.country; out.proxy = j.proxy; out.hosting = j.hosting;
      }
    }
  } catch (e) {
    out.error = (e as Error).message;
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { domains?: string[] };
    const domains = (body.domains ?? []).filter(Boolean).slice(0, 30);
    if (domains.length === 0) return NextResponse.json({ ok: false, error: "domains required" }, { status: 400 });
    const results = await Promise.all(domains.map(resolveAndEnrich));
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
