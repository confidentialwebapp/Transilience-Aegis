"use client";

import { KnowledgeArticle } from "@/components/platform/KnowledgeArticle";

export default function IncidentMonitoringKnowledge() {
  return (
    <KnowledgeArticle
      title="Incident & Monitoring"
      description="The lifecycle of an incident — from detection through monitoring, escalation, takedown, and closure."
      currentHref="/knowledge/incident-monitoring"
      sections={[
        {
          heading: "Detection sources",
          body: (
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>Continuous OSINT (passive DNS, certificate transparency, search engines).</li>
              <li>Brand-keyword sweeps across Telegram, Discord, dark-web markets, and clearnet forums.</li>
              <li>Phishing kit detonation in the Transilience sandbox.</li>
              <li>Customer-submitted reports via Case Manager.</li>
              <li>Partner sharing (industry ISACs, takedown coalitions).</li>
            </ul>
          ),
        },
        {
          heading: "From low-threat watchlist to incident",
          body: (
            <p>
              Newly registered look-alike domains begin life on the <strong>Monitoring</strong> watchlist. They graduate
              to a full <strong>Incident</strong> when content goes live, when DNS resolves to a known phishing host, or
              when a customer escalates the case. Monitoring entries auto-promote on detection.
            </p>
          ),
        },
        {
          heading: "Status workflow",
          body: (
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li><strong>OPEN</strong> — analyst is actively engaged.</li>
              <li><strong>WAITING</strong> — abuse complaint sent, awaiting registrar/host response.</li>
              <li><strong>ON HOLD</strong> — paused pending customer input or counsel review.</li>
              <li><strong>CLOSED</strong> — content removed, DNS revoked, or successfully taken down.</li>
            </ul>
          ),
        },
      ]}
    />
  );
}
