"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export interface DocSection {
  id: string;
  title: string;
  body?: React.ReactNode;
  children?: DocSection[];
}

export function ApiDocs({ sections, title }: { sections: DocSection[]; title: string }) {
  const [activeId, setActiveId] = useState(sections[0]?.id);

  const flatten = (s: DocSection[]): DocSection[] =>
    s.flatMap((sec) => [sec, ...flatten(sec.children || [])]);
  const all = flatten(sections);
  const active = all.find((s) => s.id === activeId) || all[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      {/* TOC sidebar */}
      <aside
        className="rounded-xl overflow-hidden h-fit lg:sticky lg:top-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}
      >
        <div className="px-3 py-2.5 border-b" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
          <span className="text-[10.5px] font-bold tracking-[0.13em] uppercase text-slate-400">{title}</span>
        </div>
        <div className="p-1.5 max-h-[calc(100vh-12rem)] overflow-y-auto sidebar-scroll">
          {sections.map((sec) => (
            <DocItem key={sec.id} section={sec} activeId={activeId!} setActiveId={setActiveId} depth={0} />
          ))}
        </div>
      </aside>

      {/* Active section */}
      <div className="min-w-0">
        <article
          className="rounded-xl p-6"
          style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(139,92,246,0.10)" }}
        >
          <h2 className="text-[20px] font-bold text-white tracking-tight mb-3">{active.title}</h2>
          <div className="text-[13px] text-slate-300 leading-relaxed space-y-3">
            {active.body || <p className="italic text-slate-500">No content available for this section.</p>}
          </div>
        </article>
      </div>
    </div>
  );
}

function DocItem({
  section,
  activeId,
  setActiveId,
  depth,
}: {
  section: DocSection;
  activeId: string;
  setActiveId: (id: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = !!section.children?.length;
  const isActive = section.id === activeId;
  return (
    <>
      <button
        onClick={() => {
          setActiveId(section.id);
          if (hasChildren) setOpen((o) => !o);
        }}
        className={cn(
          "w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-left transition-all",
          isActive ? "text-white bg-purple-500/10" : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
        )}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
      >
        {hasChildren ? (
          <ChevronRight className={cn("w-3 h-3 transition-transform shrink-0", open && "rotate-90")} />
        ) : (
          <span className="w-3 h-3 shrink-0" />
        )}
        <span className="text-[11.5px] font-medium truncate">{section.title}</span>
      </button>
      {hasChildren && open && section.children!.map((c) => (
        <DocItem key={c.id} section={c} activeId={activeId} setActiveId={setActiveId} depth={depth + 1} />
      ))}
    </>
  );
}

export function CodeBlock({ children, lang }: { children: string; lang?: string }) {
  return (
    <pre
      className="rounded-lg p-3 text-[11.5px] font-mono leading-relaxed overflow-x-auto"
      style={{ background: "#0a0610", border: "1px solid rgba(139,92,246,0.15)", color: "#cbd5e1" }}
    >
      {lang && <span className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">{lang}</span>}
      {children}
    </pre>
  );
}

export function EndpointTable({ rows }: { rows: { code: string; meaning: string }[] }) {
  return (
    <table className="w-full text-[12px] mt-2">
      <thead>
        <tr className="border-b" style={{ borderColor: "rgba(139,92,246,0.15)" }}>
          <th className="text-left py-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Code</th>
          <th className="text-left py-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Meaning</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.code} className="border-b" style={{ borderColor: "rgba(139,92,246,0.06)" }}>
            <td className="py-2 font-mono text-purple-300 pr-4">{r.code}</td>
            <td className="py-2 text-slate-300">{r.meaning}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
