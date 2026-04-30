"use client";

import { KnowledgeArticle } from "@/components/platform/KnowledgeArticle";

export default function WhitelistKnowledge() {
  return (
    <KnowledgeArticle
      title="Whitelist"
      description="How whitelisting works, when to use it, and how to manage exclusions in the Transilience platform."
      currentHref="/knowledge/whitelist"
      sections={[
        {
          heading: "What is a whitelist?",
          body: (
            <>
              <p>
                A whitelist is a curated list of brand-safe assets — domains, subdomains, mobile apps, and social
                profiles — that have been explicitly approved as belonging to your organisation. Whitelisted assets are
                excluded from automatic takedown workflows.
              </p>
              <p>
                Whitelists prevent false-positive takedowns of legitimate marketing campaigns, partner microsites,
                regional brand variants, or app-store listings owned by your organisation.
              </p>
            </>
          ),
        },
        {
          heading: "How to add a whitelist entry",
          body: (
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>Navigate to <strong>Attack Surface Management → Whitelist Management</strong>.</li>
              <li>Click <strong>Add Entry</strong> and select the asset type (Brand, Domain, Subdomain, Mobile App, Social Profile).</li>
              <li>Provide the canonical URL or identifier and link it to the parent client.</li>
              <li>Submit for review — entries are validated by Transilience SOC before activation.</li>
            </ol>
          ),
        },
        {
          heading: "Best practices",
          body: (
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>Re-review whitelists quarterly — divestitures and brand retirements are common drift points.</li>
              <li>Whitelist by exact match where possible; avoid wildcard whitelists on shared infrastructure (e.g., Cloudflare Pages).</li>
              <li>Document the business justification in the entry notes — useful when an analyst asks "why is this allowed?".</li>
            </ul>
          ),
        },
      ]}
    />
  );
}
