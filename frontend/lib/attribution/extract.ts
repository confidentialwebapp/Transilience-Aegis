// Identifier extraction — domain/IP/brand/handle from a finding's URL + content.
// Pure function, zero external calls. Runs as the first step of the skill.

import type { FindingForAttribution } from "./types";

const URL_RX = /\b(?:https?:\/\/)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)(?:[\/?#]\S*)?/gi;
const IPV4_RX = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;

export interface ExtractedIdentifiers {
  domains: string[];
  ips: string[];
  brand_mentions: string[];
  person_names: string[];
  url_host: string | null;
}

export function extractFromFinding(
  f: FindingForAttribution,
  brandLexicon: string[],
  knownPeople: string[],
): ExtractedIdentifiers {
  const out: ExtractedIdentifiers = {
    domains: [],
    ips: [],
    brand_mentions: [],
    person_names: [],
    url_host: null,
  };

  const text = [f.url, f.title, f.content, f.domain, f.ip]
    .filter(Boolean).join("\n").toLowerCase();

  // URLs / domains
  if (f.domain) out.domains.push(f.domain.toLowerCase());
  if (f.url) {
    try {
      const u = new URL(f.url.startsWith("http") ? f.url : `https://${f.url}`);
      out.url_host = u.hostname.toLowerCase();
      out.domains.push(u.hostname.toLowerCase());
    } catch {
      // ignore
    }
  }
  for (const m of text.matchAll(URL_RX)) {
    if (m[1] && m[1].includes(".") && !m[1].endsWith(".")) {
      out.domains.push(m[1].toLowerCase());
    }
  }
  out.domains = Array.from(new Set(out.domains));

  // IPs
  if (f.ip) out.ips.push(f.ip);
  for (const m of text.matchAll(IPV4_RX)) out.ips.push(m[0]);
  out.ips = Array.from(new Set(out.ips));

  // Brand mentions (case-insensitive, longest-match-wins)
  if (f.brand_mentions) out.brand_mentions.push(...f.brand_mentions);
  const sortedBrands = [...brandLexicon].sort((a, b) => b.length - a.length);
  for (const brand of sortedBrands) {
    if (text.includes(brand.toLowerCase())) {
      out.brand_mentions.push(brand);
    }
  }
  out.brand_mentions = Array.from(new Set(out.brand_mentions));

  // Person names
  if (f.person_names) out.person_names.push(...f.person_names);
  for (const p of knownPeople) {
    if (text.includes(p.toLowerCase())) out.person_names.push(p);
  }
  out.person_names = Array.from(new Set(out.person_names));

  return out;
}

export function rootDomain(host: string): string {
  // very-light eTLD+1 — good enough for the Trust Graph match (we explicitly
  // store both grameenkoota.in AND grameenkoota.com so subdomain stripping
  // doesn't need to be perfect).
  const parts = host.toLowerCase().split(".");
  if (parts.length <= 2) return host.toLowerCase();
  return parts.slice(-2).join(".");
}

/** True iff candidate is the same as base or a subdomain of base. */
export function isSameOrSubdomain(candidate: string, base: string): boolean {
  candidate = candidate.toLowerCase();
  base = base.toLowerCase();
  return candidate === base || candidate.endsWith("." + base);
}
