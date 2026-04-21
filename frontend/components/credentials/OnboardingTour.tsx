"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X, Sparkles } from "lucide-react";

export interface TourStep {
  target: string; // CSS selector or anchor id
  title: string;
  body: string;
  placement?: "left" | "right" | "top" | "bottom";
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: "tour-tabs",
    title: "Tenant Feed & Global Search",
    body: "Tenant Feed shows credentials tied to your monitored identifiers. Global Search queries the full breach database (Core/Enterprise plan).",
    placement: "bottom",
  },
  {
    target: "tour-search",
    title: "Search",
    body: "Type a domain, email, or username. Switch the dropdown on the left to change search type.",
    placement: "bottom",
  },
  {
    target: "tour-filters",
    title: "Refine Results",
    body: "Filters open on the right. They apply to both Tenant Feed and Global Search.",
    placement: "left",
  },
  {
    target: "tour-results-count",
    title: "Live Result Counter",
    body: "The counter updates in real time as you search and filter — great for spotting breach spikes quickly.",
    placement: "bottom",
  },
  {
    target: "tour-credential-row",
    title: "Credential Detail Card",
    body: "Each result has a card. URLs linked to the leaked credential are shown inside the detail drawer.",
    placement: "left",
  },
  {
    target: "tour-global-search",
    title: "Global Search",
    body: "Search beyond your tenant's identifiers across the entire Flare database.",
    placement: "bottom",
  },
  {
    target: "tour-filters",
    title: "Filters Button",
    body: "Filters work for both Tenant Feed and Global Search tabs.",
    placement: "left",
  },
  {
    target: "tour-filter-date",
    title: "Date Imported",
    body: "Use the date filter to surface the most recent leaked credentials first.",
    placement: "left",
  },
  {
    target: "tour-filter-source",
    title: "Password Policy & Source",
    body: "Reduce noise — filter weak-password credentials or focus on specific breach sources.",
    placement: "left",
  },
  {
    target: "tour-filter-status",
    title: "Status Tags",
    body: "Sort credentials by remediation status: New, Ignored, or Remediated.",
    placement: "left",
  },
];

interface Props {
  open: boolean;
  step: number;
  setStep: (n: number) => void;
  onClose: () => void;
}

export default function OnboardingTour({ open, step, setStep, onClose }: Props) {
  const [box, setBox] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${TOUR_STEPS[step].target}"]`);
      if (el) setBox(el.getBoundingClientRect());
      else setBox(null);
    };
    update();
    const id = setTimeout(update, 60); // after any layout shift
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step]);

  if (!open) return null;

  const total = TOUR_STEPS.length;
  const current = TOUR_STEPS[step];

  const tooltipStyle: React.CSSProperties = {};
  if (box) {
    const pad = 14;
    const w = 320;
    switch (current.placement) {
      case "left":
        tooltipStyle.top = Math.max(16, box.top + box.height / 2 - 80);
        tooltipStyle.left = Math.max(16, box.left - w - pad);
        break;
      case "right":
        tooltipStyle.top = Math.max(16, box.top + box.height / 2 - 80);
        tooltipStyle.left = box.right + pad;
        break;
      case "top":
        tooltipStyle.top = Math.max(16, box.top - 170);
        tooltipStyle.left = Math.max(16, box.left + box.width / 2 - w / 2);
        break;
      default:
        tooltipStyle.top = box.bottom + pad;
        tooltipStyle.left = Math.max(16, Math.min(window.innerWidth - w - 16, box.left));
    }
  } else {
    tooltipStyle.top = 80;
    tooltipStyle.right = 24;
  }

  return (
    <>
      {/* Dim background with cutout */}
      <div className="fixed inset-0 z-[100] pointer-events-none">
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {box && (
                <rect
                  x={box.left - 6}
                  y={box.top - 6}
                  width={box.width + 12}
                  height={box.height + 12}
                  rx="12"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(5,3,10,0.68)" mask="url(#tour-mask)" />
        </svg>
        {box && (
          <div
            className="absolute rounded-xl pointer-events-none animate-pulse"
            style={{
              top: box.top - 6,
              left: box.left - 6,
              width: box.width + 12,
              height: box.height + 12,
              border: "2px solid rgba(236,72,153,0.55)",
              boxShadow: "0 0 30px rgba(139,92,246,0.4), 0 0 80px rgba(236,72,153,0.25)",
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        className="fixed z-[101] w-[320px] rounded-xl p-4 animate-fade-up"
        style={{
          ...tooltipStyle,
          background: "linear-gradient(180deg,#16112a 0%,#0c0817 100%)",
          border: "1px solid rgba(139,92,246,0.3)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1)",
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-purple-300" />
            </div>
            <span className="text-[10px] font-semibold tracking-[0.15em] text-purple-300/80 uppercase">
              Tour · {step + 1}/{total}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <h4 className="text-[14px] font-semibold text-white mb-1.5">{current.title}</h4>
        <p className="text-[12px] text-slate-400 leading-relaxed mb-4">{current.body}</p>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className="h-[3px] rounded-full transition-all"
                style={{
                  width: i === step ? 18 : 6,
                  background:
                    i === step
                      ? "linear-gradient(90deg,#8b5cf6,#ec4899)"
                      : i < step
                      ? "rgba(139,92,246,0.4)"
                      : "rgba(139,92,246,0.12)",
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
              className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            {step === total - 1 ? (
              <button
                onClick={onClose}
                className="h-8 px-3 rounded-md text-[11px] font-semibold text-white btn-brand"
              >
                Finish
              </button>
            ) : (
              <button
                onClick={() => setStep(step + 1)}
                className="h-8 px-3 rounded-md text-[11px] font-semibold text-white btn-brand flex items-center gap-1.5"
              >
                Next <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
