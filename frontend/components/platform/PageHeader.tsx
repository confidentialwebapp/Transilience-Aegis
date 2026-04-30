"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, HelpCircle, FileText, BookOpen, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  helpLinks?: { label: string; href: string; icon?: React.ComponentType<{ className?: string }> }[];
  rightSlot?: React.ReactNode;
}

export function PageHeader({ title, description, helpLinks, rightSlot }: PageHeaderProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const links =
    helpLinks ?? [
      { label: "User Guide", href: "/knowledge/user-guide", icon: BookOpen },
      { label: "API Reference", href: "/documentation/threatintel", icon: FileText },
      { label: "Contact Support", href: "/support/contact", icon: MessageSquare },
    ];

  return (
    <div className="flex items-start justify-between mb-5">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold text-white tracking-tight">{title}</h1>
        {description && (
          <p className="text-[12.5px] text-slate-400 mt-1 max-w-3xl">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {rightSlot}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-slate-300 hover:text-white transition-all"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.15)" }}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Help
            <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div
              className="absolute right-0 top-full mt-2 w-64 rounded-xl overflow-hidden shadow-2xl z-40 animate-fade-up"
              style={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.2)" }}
            >
              <div className="p-1.5">
                {links.map((l) => {
                  const Icon = l.icon || FileText;
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="flex-1">{l.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
