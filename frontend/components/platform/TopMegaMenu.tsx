"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOPNAV } from "@/lib/navigation";

export function TopMegaMenu() {
  const pathname = usePathname();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpenIdx(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapRef} className="hidden lg:flex items-center gap-1">
      {TOPNAV.map((group, i) => {
        const Icon = group.icon;
        const isActive =
          (group.href && pathname === group.href) ||
          group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));
        const isOpen = openIdx === i;
        return (
          <div key={group.label} className="relative">
            <button
              onClick={() => setOpenIdx(isOpen ? null : i)}
              onMouseEnter={() => setOpenIdx(i)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all",
                isActive ? "text-white" : "text-slate-400 hover:text-white"
              )}
              style={isActive ? { background: "rgba(139,92,246,0.10)" } : undefined}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{group.label}</span>
              <ChevronDown
                className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")}
              />
            </button>

            {isOpen && (
              <div
                onMouseLeave={() => setOpenIdx(null)}
                className="absolute left-0 top-full mt-1.5 w-[340px] rounded-xl overflow-hidden shadow-2xl z-50 animate-fade-up"
                style={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.25)" }}
              >
                <div className="px-3 pt-3 pb-2">
                  <span className="text-[9.5px] uppercase tracking-[0.15em] font-semibold text-slate-500">
                    {group.label}
                  </span>
                </div>
                <div className="px-1.5 pb-2">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const itemActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenIdx(null)}
                        className={cn(
                          "flex items-start gap-3 px-3 py-2 rounded-lg transition-all group",
                          itemActive ? "bg-purple-500/10" : "hover:bg-white/[0.04]"
                        )}
                      >
                        {ItemIcon && (
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{
                              background: itemActive ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)",
                              border: itemActive
                                ? "1px solid rgba(139,92,246,0.35)"
                                : "1px solid rgba(139,92,246,0.10)",
                            }}
                          >
                            <ItemIcon
                              className={cn(
                                "w-4 h-4",
                                itemActive ? "text-purple-300" : "text-slate-400 group-hover:text-purple-300"
                              )}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-[12px] font-semibold leading-tight",
                              itemActive ? "text-white" : "text-slate-200 group-hover:text-white"
                            )}
                          >
                            {item.label}
                          </p>
                          {item.description && (
                            <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
