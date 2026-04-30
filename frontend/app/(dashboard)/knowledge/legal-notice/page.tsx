"use client";

import { KnowledgeArticle } from "@/components/platform/KnowledgeArticle";

export default function LegalNoticeKnowledge() {
  return (
    <KnowledgeArticle
      title="Legal Notice"
      description="Terms of use, data handling, evidence retention, and rules of engagement for Transilience services."
      currentHref="/knowledge/legal-notice"
      sections={[
        {
          heading: "Service terms",
          body: (
            <p>
              Use of the Transilience platform is governed by the Master Services Agreement signed at onboarding. The
              terms displayed in this article are reference summaries and do not supersede the executed contract.
            </p>
          ),
        },
        {
          heading: "Data handling and residency",
          body: (
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>Customer data is encrypted at rest using AES-256.</li>
              <li>Recovered records are stored in the same residency as your contracted tenant region.</li>
              <li>Deleted incidents are purged within 30 days (90 days for billing-relevant audit logs).</li>
              <li>Transilience employees access tenant data only via just-in-time approvals; all access is logged.</li>
            </ul>
          ),
        },
        {
          heading: "Acceptable use",
          body: (
            <p>
              The platform is intended for defensive cybersecurity purposes. Customers must not use Transilience output
              to harass individuals, conduct unauthorised investigations, or bypass legal due process. Misuse will
              result in suspension and may be reported to law enforcement.
            </p>
          ),
        },
        {
          heading: "Evidence preservation",
          body: (
            <p>
              Screenshots, WHOIS records, and HTTP archives captured during a takedown case are preserved for 7 years
              to support law-enforcement requests and regulatory disclosure obligations.
            </p>
          ),
        },
      ]}
    />
  );
}
