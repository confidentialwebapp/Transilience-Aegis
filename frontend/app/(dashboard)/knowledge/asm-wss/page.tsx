"use client";

import { KnowledgeArticle } from "@/components/platform/KnowledgeArticle";

export default function AsmWssKnowledge() {
  return (
    <KnowledgeArticle
      title="ASM / WSS"
      description="Attack Surface Management and Website Scanning Suite — what they cover, how they differ, and how to use them together."
      currentHref="/knowledge/asm-wss"
      sections={[
        {
          heading: "Attack Surface Management (ASM)",
          body: (
            <p>
              ASM continuously discovers and inventories everything reachable from the public internet that ties back to
              your organisation: domains, subdomains, IPs, cloud assets, SaaS tenants, expired certificates, and shadow
              IT. The goal is reducing surprise — you cannot defend assets you do not know exist.
            </p>
          ),
        },
        {
          heading: "Website Scanning Suite (WSS)",
          body: (
            <p>
              WSS goes deeper than ASM on the web tier specifically. For each monitored URL, WSS performs OWASP-style
              checks (SQLi, XSS, CSP, mixed content), TLS health, and supply-chain script auditing (third-party JS
              integrity). Verdicts are <strong>CLEAN</strong> or <strong>POTENTIALLY SUSPICIOUS</strong>.
            </p>
          ),
        },
        {
          heading: "Workflow",
          body: (
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>ASM discovers a new subdomain via certificate transparency.</li>
              <li>You confirm ownership and enable monitoring on it.</li>
              <li>WSS schedules a deep scan. Findings appear in Asset Discovery and the WSS report.</li>
              <li>Critical findings auto-create incidents in Threat Management.</li>
            </ol>
          ),
        },
      ]}
    />
  );
}
