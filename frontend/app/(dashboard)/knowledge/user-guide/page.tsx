"use client";

import { KnowledgeArticle } from "@/components/platform/KnowledgeArticle";

export default function UserGuideKnowledge() {
  return (
    <KnowledgeArticle
      title="User Guide"
      description="Quick orientation to the Transilience platform — chrome, navigation, keyboard shortcuts, and common tasks."
      currentHref="/knowledge/user-guide"
      sections={[
        {
          heading: "Layout primer",
          body: (
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li><strong>Top bar</strong> — Dashboard / Assets / Case Manager / Support primary nav, plus search, client selector, notifications, and your profile.</li>
              <li><strong>Left sidebar</strong> — module navigation grouped by Threat Management, Attack Surface, Cyber Threat Intelligence, DMARC, TPRM, Reports, Management, Knowledge Centre, and Tools.</li>
              <li><strong>Page header</strong> — title, description, contextual <em>Help</em> dropdown, and any module-specific actions.</li>
              <li><strong>Page body</strong> — collapsible filter card on top, primary data table or content grid below, paginated 50 / 100 per page.</li>
            </ul>
          ),
        },
        {
          heading: "Keyboard shortcuts",
          body: (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-slate-300">
              <div className="flex justify-between"><span>Open command palette</span><kbd className="font-mono text-purple-300">⌘K</kbd></div>
              <div className="flex justify-between"><span>Open command palette</span><kbd className="font-mono text-purple-300">/</kbd></div>
              <div className="flex justify-between"><span>Close any modal</span><kbd className="font-mono text-purple-300">Esc</kbd></div>
              <div className="flex justify-between"><span>Open AI Assistant dock</span><kbd className="font-mono text-purple-300">⌘J</kbd></div>
            </div>
          ),
        },
        {
          heading: "Common tasks",
          body: (
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>Submit a takedown request — Case Manager → Report New Case.</li>
              <li>Approve a discovered subdomain — Attack Surface → Asset Discovery → toggle monitoring.</li>
              <li>Subscribe to threat intelligence — Cyber Threat Intelligence → STIX/TAXII or Threat Intel API.</li>
              <li>Switch tenant scope — top-bar Client Selector.</li>
              <li>Enrol 2FA — profile menu → 2FA.</li>
            </ul>
          ),
        },
      ]}
    />
  );
}
