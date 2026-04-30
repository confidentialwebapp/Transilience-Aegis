"use client";

import { KnowledgeArticle } from "@/components/platform/KnowledgeArticle";

export default function IncidentResponseKnowledge() {
  return (
    <KnowledgeArticle
      title="Incident Response"
      description="The IR runbook for high-severity incidents — phishing-at-scale, executive impersonation, dark-web data leaks."
      currentHref="/knowledge/incident-response"
      sections={[
        {
          heading: "Severity definitions",
          body: (
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li><strong>Critical</strong> — active phishing or credential capture against your customers; SLA 30 minutes.</li>
              <li><strong>Substantial</strong> — high-fidelity impersonation, public CXO impersonation, dark-web victim post; SLA 2 hours.</li>
              <li><strong>Moderate</strong> — staged content (no live capture), brand abuse, low-traffic typosquats; SLA 8 hours.</li>
              <li><strong>Low</strong> — passive monitoring matches; SLA 24 hours.</li>
            </ul>
          ),
        },
        {
          heading: "First-response checklist",
          body: (
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>Confirm impact: live capture? cred-stealer? customer-facing?</li>
              <li>Capture evidence: full-page screenshot, HAR archive, source dump.</li>
              <li>Send abuse complaints (registrar, host, CDN, payment processor as relevant).</li>
              <li>Notify your in-house IR team if customer credentials are at risk.</li>
              <li>Open a Case Manager record and link any related cases.</li>
            </ol>
          ),
        },
        {
          heading: "Coordination with SOC",
          body: (
            <p>
              Your dedicated Customer Success Manager and the Transilience SOC are reachable via the Assistant tab on
              every page, or by escalating the case in Case Manager. For after-hours critical incidents, call the
              published 24×7 line listed in <em>Support → Contact Us</em>.
            </p>
          ),
        },
      ]}
    />
  );
}
