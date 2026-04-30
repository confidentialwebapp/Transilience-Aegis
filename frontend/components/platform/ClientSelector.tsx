"use client";

import { useState, useEffect, useRef } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLIENT_MODES, type ClientMode } from "@/lib/navigation";

const MOCK_CLIENTS = [
  "Acme Bank",
  "Globex Insurance",
  "Initech Telecom",
  "Soylent Health",
  "Wayne Manufacturing",
  "Stark Retail",
  "Umbrella Pharma",
  "Pied Piper Gaming",
];

const STORE_KEY = "tai_client_mode";
const STORE_DEFAULT_KEY = "tai_client_mode_default";
const STORE_SPECIFIC_KEY = "tai_specific_client";

export function ClientSelector() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ClientMode>("all");
  const [specific, setSpecific] = useState<string>("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [savedDefault, setSavedDefault] = useState<string>("none");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY) as ClientMode | null;
      const def = localStorage.getItem(STORE_DEFAULT_KEY);
      const sp = localStorage.getItem(STORE_SPECIFIC_KEY);
      if (def) {
        setSavedDefault(def);
        setMode(def as ClientMode);
        setMakeDefault(true);
      } else if (stored) {
        setMode(stored);
      }
      if (sp) setSpecific(sp);
    } catch {}
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const apply = (m: ClientMode) => {
    setMode(m);
    try {
      localStorage.setItem(STORE_KEY, m);
      if (makeDefault) {
        localStorage.setItem(STORE_DEFAULT_KEY, m);
        setSavedDefault(m);
      }
    } catch {}
  };

  const toggleDefault = () => {
    const next = !makeDefault;
    setMakeDefault(next);
    try {
      if (next) {
        localStorage.setItem(STORE_DEFAULT_KEY, mode);
        setSavedDefault(mode);
      } else {
        localStorage.removeItem(STORE_DEFAULT_KEY);
        setSavedDefault("none");
      }
    } catch {}
  };

  const updateSpecific = (c: string) => {
    setSpecific(c);
    try {
      localStorage.setItem(STORE_SPECIFIC_KEY, c);
    } catch {}
  };

  const currentLabel =
    mode === "specific"
      ? specific || "Specific Client"
      : CLIENT_MODES.find((c) => c.value === mode)?.label ?? "All Clients";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-200 hover:text-white transition-all"
        style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.20)" }}
        title="Client selection"
      >
        <Building2 className="w-3.5 h-3.5 text-purple-300" />
        <div className="flex flex-col items-start leading-none">
          <span className="text-[8.5px] uppercase tracking-wider text-slate-500">Client Mode</span>
          <span className="text-[11px]">{currentLabel}</span>
        </div>
        <ChevronDown className={cn("w-3 h-3 text-slate-500 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[340px] rounded-xl overflow-hidden shadow-2xl z-50 animate-fade-up"
          style={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.25)" }}
        >
          <div className="p-3 border-b" style={{ borderColor: "rgba(139,92,246,0.10)" }}>
            <p className="text-[11px] font-bold text-white">Client Selection</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Switching modes will reload the entire portal scope.
            </p>
          </div>
          <div className="p-2 space-y-1">
            {CLIENT_MODES.map((c) => (
              <button
                key={c.value}
                onClick={() => apply(c.value)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-medium transition-all text-left",
                  mode === c.value
                    ? "text-white bg-purple-500/10 border border-purple-500/25"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.03] border border-transparent"
                )}
              >
                <span>{c.label}</span>
                {mode === c.value && <Check className="w-3.5 h-3.5 text-purple-300" />}
              </button>
            ))}
            {mode === "specific" && (
              <div className="px-1 pt-2">
                <label className="text-[9.5px] uppercase tracking-wider text-slate-500 font-semibold">
                  Select Client
                </label>
                <select
                  value={specific}
                  onChange={(e) => updateSpecific(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-[12px] text-slate-200 outline-none cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.20)" }}
                >
                  <option value="" className="bg-[#0d0a14]">— Pick a client —</option>
                  {MOCK_CLIENTS.map((c) => (
                    <option key={c} value={c} className="bg-[#0d0a14]">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div
            className="px-3 py-2.5 flex items-start gap-2 cursor-pointer"
            style={{ borderTop: "1px solid rgba(139,92,246,0.10)", background: "rgba(255,255,255,0.015)" }}
            onClick={toggleDefault}
          >
            <input
              type="checkbox"
              checked={makeDefault}
              onChange={toggleDefault}
              className="mt-0.5 w-3.5 h-3.5 rounded accent-purple-500"
            />
            <div className="flex-1">
              <p className="text-[11px] font-medium text-slate-200">Make above selected option as default for me</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Previous default: <span className="text-slate-400">{savedDefault === "none" ? "none" : CLIENT_MODES.find((c) => c.value === savedDefault)?.label || savedDefault}</span>
              </p>
            </div>
          </div>
          <div
            className="px-3 py-2 text-[9.5px] text-slate-500 leading-relaxed"
            style={{ borderTop: "1px solid rgba(139,92,246,0.10)" }}
          >
            <p>
              <span className="text-slate-400 font-semibold">Note:</span> once a mode is selected, the entire portal
              scope updates accordingly. Marking a mode as default will re-apply it on next sign-in.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
