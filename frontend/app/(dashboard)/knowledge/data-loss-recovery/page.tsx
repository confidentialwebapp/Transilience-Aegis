"use client";

import { KnowledgeArticle } from "@/components/platform/KnowledgeArticle";

export default function DLRKnowledge() {
  return (
    <KnowledgeArticle
      title="Data Loss Recovery"
      description="How Transilience identifies and recovers leaked data on the dark web, paste sites, criminal forums, and Telegram."
      currentHref="/knowledge/data-loss-recovery"
      sections={[
        {
          heading: "What gets recovered",
          body: (
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li><strong>Login Credentials</strong> — bank account, corporate mailbox, customer portal logins.</li>
              <li><strong>Personal Identifiable Information</strong> — PAN, SSN, addresses, phone numbers.</li>
              <li><strong>Technical Information</strong> — source code, API keys, configuration files.</li>
            </ul>
          ),
        },
        {
          heading: "How recovery works",
          body: (
            <p>
              Operatives collect the data from the source (combolist drop, paste, Telegram channel, marketplace), validate
              ownership, and stage the recovered records in your tenant. Recovery is non-destructive — we never pay or
              transact with criminals.
            </p>
          ),
        },
        {
          heading: "Status meanings",
          body: (
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li><strong>OPEN</strong> — match observed, recovery in progress.</li>
              <li><strong>WAITING (CRR)</strong> — Customer Recovery Required: action required from your side (e.g., notify affected user, rotate credential).</li>
              <li><strong>RECOVERED</strong> — record is in your tenant and accessible to authorised users only.</li>
              <li><strong>RECOVERY FAILED</strong> — source removed before our operatives could collect.</li>
              <li><strong>RECOVERY NOT AUTHORISED</strong> — collection blocked by your policy or legal counsel.</li>
            </ul>
          ),
        },
      ]}
    />
  );
}
