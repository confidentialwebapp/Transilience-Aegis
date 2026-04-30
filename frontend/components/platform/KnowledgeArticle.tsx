"use client";

import Link from "next/link";
import { ChevronRight, BookOpen } from "lucide-react";
import { PageHeader } from "./PageHeader";

const ARTICLES = [
  { href: "/knowledge/whitelist", title: "Whitelist", section: "Operate" },
  { href: "/knowledge/incident-monitoring", title: "Incident & Monitoring", section: "Operate" },
  { href: "/knowledge/data-loss-recovery", title: "Data Loss Recovery", section: "Operate" },
  { href: "/knowledge/legal-notice", title: "Legal Notice", section: "Compliance" },
  { href: "/knowledge/incident-response", title: "Incident Response", section: "Operate" },
  { href: "/knowledge/tpra", title: "Third Party Risk Assessment", section: "Compliance" },
  { href: "/knowledge/asm-wss", title: "ASM / WSS", section: "Operate" },
  { href: "/knowledge/user-guide", title: "User Guide", section: "Reference" },
];

interface Section {
  heading: string;
  body: React.ReactNode;
}

interface Props {
  title: string;
  description: string;
  currentHref: string;
  sections: Section[];
}

export function KnowledgeArticle({ title, description, currentHref, sections }: Props) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <aside
          className="rounded-xl overflow-hidden h-fit lg:sticky lg:top-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
        >
          <div className="px-3 py-2.5 border-b" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
            <span className="text-[10.5px] font-bold tracking-[0.13em] uppercase text-slate-400">Knowledge Centre</span>
          </div>
          <div className="p-1.5">
            {ARTICLES.map((a) => {
              const active = a.href === currentHref;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className={`flex items-start gap-2 px-2.5 py-2 rounded-lg transition-all ${
                    active ? "text-white bg-purple-500/10" : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-semibold truncate">{a.title}</p>
                    <p className="text-[9.5px] uppercase tracking-wider text-slate-500">{a.section}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </aside>

        <article
          className="rounded-xl p-6"
          style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.10)" }}
        >
          {sections.map((s, i) => (
            <section key={i} className="mb-6 last:mb-0">
              <h2 className="text-[16px] font-bold text-white tracking-tight mb-2 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full" style={{ background: "linear-gradient(180deg, #8b5cf6, #ec4899)" }} />
                {s.heading}
              </h2>
              <div className="text-[13px] text-slate-300 leading-relaxed space-y-3">{s.body}</div>
            </section>
          ))}
          <div className="pt-4 mt-6 border-t flex items-center justify-between" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
            <span className="text-[11px] text-slate-500">Was this article helpful?</span>
            <Link
              href="/support/contact"
              className="text-[11.5px] font-semibold text-purple-300 hover:text-purple-200 flex items-center gap-1"
            >
              Contact support <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
