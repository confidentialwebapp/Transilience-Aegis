"use client";

import { Globe, Save } from "lucide-react";
import { PageHeader, FilterSelect, Toggle } from "@/components/platform";
import { useEffect, useState } from "react";

const TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function TimezonePage() {
  const [tz, setTz] = useState("Asia/Kolkata");
  const [show12h, setShow12h] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatted = now.toLocaleString("en-GB", {
    timeZone: tz,
    hour12: show12h,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <>
      <PageHeader
        title="Timezone Setting"
        description="Display all timestamps across the platform in your preferred timezone and clock format."
      />
      <div className="rounded-xl p-5 max-w-2xl"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.10)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.20)" }}>
            <Globe className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Current local time</p>
            <p className="text-[14px] font-mono text-slate-200">{formatted}</p>
          </div>
        </div>
        <FilterSelect icon={Globe} label="Timezone" value={tz} onChange={setTz} options={TIMEZONES} />
        <div className="mt-4 px-3 py-2 rounded-lg flex items-center gap-3"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.12)" }}>
          <div className="flex-1">
            <p className="text-[12px] text-slate-200 font-semibold">12-hour clock</p>
            <p className="text-[10.5px] text-slate-500">Display 1:30 PM instead of 13:30.</p>
          </div>
          <Toggle on={show12h} onChange={setShow12h} />
        </div>
        <button className="mt-5 flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
          <Save className="w-3.5 h-3.5" /> Save
        </button>
      </div>
    </>
  );
}
