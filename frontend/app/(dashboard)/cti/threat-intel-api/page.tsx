"use client";

import { PageHeader } from "@/components/platform";
import { ApiDocs, CodeBlock, EndpointTable, type DocSection } from "@/components/platform/ApiDocs";

const endpoints = [
  { name: "POST /api/Data/GetMalwareFeed", purpose: "Bulk malware feed for a time range (≤ 3 days). Returns Sha256/Sha1/Sha3_384/Md5 hash, Signature, First/Last seen, Imphash, Ssdeep, Tlsh, Tags, File_information." },
  { name: "POST /api/Data/GetMalwareFeedSearch", purpose: "Lookup a single Sha256 hash → adds Origin_country, File_name, File_size, File_type, File_type_mime, Anonymous, Telfhash, Gimphash, Magika, Dhash_icon, Trid, Comment, Archive_pw." },
  { name: "POST /api/Data/GetCVERecord", purpose: "Bulk CVE list for a time range (≤ 3 days)." },
  { name: "POST /api/Data/GetCVERecordSearch", purpose: "Lookup a specific CVE name." },
  { name: "POST /api/Data/GetIndicators", purpose: "List indicators by IndicatorType (cve, yara, email, filehash, url, ip, other)." },
  { name: "POST /api/Data/GetIndicatorSearch", purpose: "Search a specific indicator value." },
  { name: "POST /api/Data/GetCyberIntelAdvisory", purpose: "Last 24h cyber intel advisories." },
  { name: "POST /api/Data/SearchBlacklistedIndicator", purpose: "Reputation lookup (daily limit 500). Returns Indicator, IndicatorType, Verdict, Confidence, FirstSeen, LastSeen." },
];

const sections: DocSection[] = [
  {
    id: "summary",
    title: "Summary",
    body: (
      <>
        <p>The Threat Intel REST API delivers malware, CVE, indicator, and advisory feeds in JSON.</p>
        <p>Base URL: <code className="text-purple-300">https://api.transilience.ai/v3</code></p>
      </>
    ),
  },
  {
    id: "auth",
    title: "Authentication",
    body: (
      <>
        <p>Token-based authentication. Exchange your API key + secret for an auth token.</p>
        <CodeBlock lang="POST /api/token/authenticate">{`{
  "APIKey": "ak_live_...",
  "SecretKey": "sk_live_..."
}`}</CodeBlock>
        <CodeBlock lang="Response">{`{
  "AuthToken": "eyJhbGciOi...",
  "ExpiresAt": "2026-05-01T00:00:00Z"
}`}</CodeBlock>
        <p>Pass the <code className="text-purple-300">AuthToken</code> as the <code>Authorization: Bearer</code> header on subsequent calls.</p>
      </>
    ),
  },
  ...endpoints.map((ep, i) => ({
    id: `ep-${i}`,
    title: ep.name,
    body: (
      <>
        <p>{ep.purpose}</p>
        <CodeBlock lang="Request">{`POST ${ep.name.replace("POST ", "")}
Authorization: Bearer {AuthToken}
Content-Type: application/json

{
  "DateFrom": "2026-04-25",
  "DateTo": "2026-04-28"
}`}</CodeBlock>
      </>
    ),
  })),
  {
    id: "errors",
    title: "Error Codes",
    body: (
      <EndpointTable rows={[
        { code: "*401", meaning: "Invalid credentials / missing API key" },
        { code: "*404", meaning: "Resource not found" },
        { code: "*500", meaning: "Internal server error" },
        { code: "*2001", meaning: "Validation error — required field missing" },
        { code: "*2002", meaning: "Date range exceeds 3-day limit" },
        { code: "*2010", meaning: "Daily quota exceeded" },
        { code: "*2015", meaning: "Invalid indicator format" },
        { code: "*2018", meaning: "Token expired" },
        { code: "*2020", meaning: "File not found / unsupported type" },
      ]} />
    ),
  },
];

export default function ThreatIntelApiPage() {
  return (
    <>
      <PageHeader
        title="Threat Intel API"
        description="Subscribe to indicator, malware, CVE, and dark-web advisory feeds programmatically. Token-based authentication, 3-day window queries, and JSON responses."
      />
      <ApiDocs sections={sections} title="Reference" />
    </>
  );
}
