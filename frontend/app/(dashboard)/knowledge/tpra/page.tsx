"use client";

import { KnowledgeArticle } from "@/components/platform/KnowledgeArticle";

export default function TpraKnowledge() {
  return (
    <KnowledgeArticle
      title="Third Party Risk Assessment"
      description="Methodology, scoring inputs, and remediation workflows for assessing third-party vendor risk."
      currentHref="/knowledge/tpra"
      sections={[
        {
          heading: "What goes into the risk score",
          body: (
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li><strong>External posture</strong> — open ports, expired certificates, missing email auth.</li>
              <li><strong>Compliance signals</strong> — ISO 27001, SOC 2, PCI DSS attestations.</li>
              <li><strong>Dark-web exposure</strong> — leaked credentials, mention in initial-access listings.</li>
              <li><strong>Operational hygiene</strong> — public CVE patching velocity, CDN/cloud misconfig.</li>
              <li><strong>Questionnaire responses</strong> — vendor-supplied attestation answers.</li>
            </ul>
          ),
        },
        {
          heading: "Onboarding a new vendor",
          body: (
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>Add the vendor under TPRM → Vendors → Add Vendor.</li>
              <li>Provide their primary domain and security contact.</li>
              <li>Optionally trigger an initial questionnaire (we send via email and ingest responses automatically).</li>
              <li>Wait 24–48h for the first risk score; the score recalculates daily.</li>
            </ol>
          ),
        },
        {
          heading: "Reviewing risk",
          body: (
            <p>
              Open the vendor detail page to see compliance status, discovered assets, vulnerability counts, dark-web
              hits, and the questionnaire trail. Use the <em>Compliance</em> tab to confirm certifications; use the
              <em> Vulnerabilities</em> tab to action specific CVEs.
            </p>
          ),
        },
      ]}
    />
  );
}
