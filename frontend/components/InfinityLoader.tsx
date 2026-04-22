"use client";

/**
 * Brand loading indicator — renders /infinity_loader.svg.
 *
 * The SVG is self-animating (CSS keyframes baked in) so this is a tiny
 * wrapper that just controls size + optional label. Replaces the
 * lucide spinner across the app.
 *
 * Sizes:
 *   - inline (in buttons, message bubbles): size=16
 *   - section/card-level loading: size=48
 *   - full-page splash: size=96 + label
 */

import { cn } from "@/lib/utils";

interface InfinityLoaderProps {
  /** Height in px. Width auto-scales (SVG aspect 680:280 ≈ 2.43:1). */
  size?: number;
  /** Optional caption rendered under the loader. */
  label?: string;
  className?: string;
}

export function InfinityLoader({ size = 24, label, className }: InfinityLoaderProps) {
  const width = Math.round(size * (680 / 280));
  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)} role="status" aria-label={label || "Loading"}>
      <img
        src="/infinity_loader.svg"
        alt=""
        width={width}
        height={size}
        style={{ width, height: size }}
        draggable={false}
      />
      {label && (
        <span className="text-[11px] font-medium text-slate-400 tracking-wide">{label}</span>
      )}
    </div>
  );
}

/**
 * Centered full-screen loading splash. Use as the entire body of a route
 * while data is loading.
 */
export function InfinityLoaderSplash({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <InfinityLoader size={72} />
      <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">{label}</span>
    </div>
  );
}
