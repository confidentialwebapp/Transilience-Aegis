"use client";

import { PageHeader } from "@/components/platform";
import { ApiDocs, CodeBlock, EndpointTable, type DocSection } from "@/components/platform/ApiDocs";

const sections: DocSection[] = [
  {
    id: "summary",
    title: "Summary",
    body: (
      <>
        <p>
          The Transilience STIX/TAXII server delivers indicator and vulnerability intelligence using the open
          STIX 2.1 / TAXII 2.1 standards. Compatible with all major SIEM, SOAR, and TIP tooling.
        </p>
        <p>
          <strong className="text-white">Supported versions:</strong> TAXII 2.1 (recommended), TAXII 2.0, TAXII 1.0.
          Each version uses its own host address — see the <em>Server Discovery</em> section.
        </p>
      </>
    ),
  },
  {
    id: "auth",
    title: "Authentication",
    body: (
      <>
        <p>HTTP Basic authentication using base64-encoded credentials.</p>
        <CodeBlock lang="HTTP Header">{`Authorization: Basic dXNlcjpwYXNz`}</CodeBlock>
        <p>API keys can be generated under <strong className="text-white">Management → Subscription → API Keys</strong>.</p>
      </>
    ),
  },
  {
    id: "discovery",
    title: "Server Discovery",
    body: (
      <>
        <p>Discover the available API roots and STIX versions:</p>
        <CodeBlock lang="GET">{`GET {host_address}`}</CodeBlock>
        <CodeBlock lang="Response">{`{
  "title": "Transilience TAXII Server",
  "description": "STIX/TAXII feeds for indicators and vulnerabilities",
  "default": "https://taxii.transilience.ai/api/v21",
  "api_roots": [
    "https://taxii.transilience.ai/api/v21",
    "https://taxii.transilience.ai/api/v20"
  ]
}`}</CodeBlock>
      </>
    ),
  },
  {
    id: "rootinfo",
    title: "Server Root Info",
    body: (
      <>
        <p>Lists the supported objects under a server root.</p>
        <CodeBlock lang="GET">{`GET {host_address}/{Object}`}</CodeBlock>
        <p>Where <code className="text-purple-300">Object</code> ∈ <code>Indicator</code>, <code>Vulnerability</code>.</p>
      </>
    ),
  },
  {
    id: "collections",
    title: "Fetch Collections",
    body: (
      <>
        <p>Lists collections within an object class.</p>
        <CodeBlock lang="GET">{`GET {host_address}/{Object}/collections`}</CodeBlock>
        <p>Available collections include:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-300">
          <li>Abuse-related resources / IPs</li>
          <li>Compromised machines / IPs</li>
          <li>Malicious or Phishing URLs</li>
          <li>Vulnerabilities</li>
        </ul>
      </>
    ),
  },
  {
    id: "indicators",
    title: "Fetch Indicator Objects",
    body: (
      <>
        <p>Returns STIX indicator objects from a specific collection.</p>
        <CodeBlock lang="GET">{`GET {host_address}/Indicator/collections/{collection-id}/Objects
?limit=500
&added_after=2026-04-01T00:00:00Z
&match[id]=indicator--abc123
&next=eyJjdXJzb3I...`}</CodeBlock>
        <p><strong className="text-white">Query params:</strong> <code>limit</code> (1–5000), <code>added_after</code>, <code>match[id]</code>, <code>next</code>.</p>
      </>
    ),
  },
  {
    id: "vulns",
    title: "Fetch Vulnerability Objects",
    body: (
      <>
        <p>Returns STIX vulnerability (CVE) objects from a specific collection.</p>
        <CodeBlock lang="GET">{`GET {host_address}/vulnerability/collections/{collection-id}/Objects`}</CodeBlock>
      </>
    ),
  },
  {
    id: "errors",
    title: "Error Codes",
    body: (
      <EndpointTable rows={[
        { code: "400", meaning: "Bad Request — invalid query parameters" },
        { code: "401", meaning: "Unauthorized — missing or invalid credentials" },
        { code: "404", meaning: "Not Found — unknown root or collection" },
        { code: "406", meaning: "Not Acceptable — unsupported Accept header" },
        { code: "500", meaning: "Internal Server Error" },
        { code: "501", meaning: "Not Implemented" },
      ]} />
    ),
  },
];

export default function StixTaxiiPage() {
  return (
    <>
      <PageHeader
        title="STIX/TAXII API"
        description="Subscribe to threat intelligence feeds using the open STIX 2.1 / TAXII 2.1 standards. Compatible with SIEM, SOAR, and TIP tooling."
      />
      <ApiDocs sections={sections} title="Reference" />
    </>
  );
}
