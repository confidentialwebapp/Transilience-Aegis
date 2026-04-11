"use client";

import { useState, useMemo } from "react";
import { Globe, Maximize2, Minimize2 } from "lucide-react";
import { WORLD_COUNTRY_PATHS } from "./worldMapPaths";

// Country centroids for threat pins (Miller projection, viewBox 0 0 1000 500)
const COUNTRY_COORDS: Record<string, { x: number; y: number }> = {
  "USA": { x: 170, y: 155 }, "Canada": { x: 190, y: 115 }, "Mexico": { x: 155, y: 190 },
  "Brazil": { x: 290, y: 300 }, "Argentina": { x: 265, y: 365 }, "Colombia": { x: 230, y: 240 },
  "UK": { x: 473, y: 120 }, "Germany": { x: 505, y: 125 }, "France": { x: 490, y: 140 },
  "Spain": { x: 477, y: 155 }, "Italy": { x: 510, y: 148 }, "Poland": { x: 520, y: 122 },
  "Ukraine": { x: 545, y: 125 }, "Norway": { x: 505, y: 95 }, "Sweden": { x: 515, y: 100 },
  "Finland": { x: 530, y: 95 }, "Russia": { x: 620, y: 95 }, "Turkey": { x: 545, y: 155 },
  "Iran": { x: 590, y: 165 }, "Saudi Arabia": { x: 570, y: 190 }, "Israel": { x: 548, y: 170 },
  "Egypt": { x: 540, y: 185 }, "Nigeria": { x: 505, y: 230 }, "South Africa": { x: 540, y: 330 },
  "Kenya": { x: 555, y: 255 }, "Ethiopia": { x: 560, y: 237 },
  "India": { x: 650, y: 195 }, "Pakistan": { x: 635, y: 172 }, "Afghanistan": { x: 640, y: 162 },
  "China": { x: 720, y: 155 }, "Japan": { x: 790, y: 150 }, "South Korea": { x: 775, y: 155 },
  "North Korea": { x: 775, y: 145 }, "Vietnam": { x: 730, y: 205 }, "Thailand": { x: 715, y: 210 },
  "Indonesia": { x: 740, y: 260 }, "Philippines": { x: 760, y: 210 }, "Malaysia": { x: 725, y: 240 },
  "Australia": { x: 795, y: 340 }, "Kazakhstan": { x: 625, y: 135 }, "Mongolia": { x: 710, y: 130 },
  "Singapore": { x: 730, y: 250 }, "UAE": { x: 590, y: 185 },
  "Unknown": { x: 500, y: 300 },
};

const PIN_COLORS: Record<string, string> = {
  ransomware: "#ef4444", darkweb: "#a855f7", hacktivism: "#f59e0b",
};

interface ThreatPin {
  x: number; y: number; country: string;
  type: "ransomware" | "darkweb" | "hacktivism";
  count: number; label: string;
}

interface Props {
  actors?: any[]; ransomwareGroups?: any[]; totalFeeds?: number;
}

export function GlobalThreatMap({ actors = [], ransomwareGroups = [], totalFeeds = 0 }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [hoveredPin, setHoveredPin] = useState<ThreatPin | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const threatPins = useMemo(() => {
    const pins: ThreatPin[] = [];
    const countryCounts: Record<string, { darkweb: number; ransomware: number; hacktivism: number }> = {};

    actors.forEach(a => {
      const country = a.country || "Unknown";
      if (!countryCounts[country]) countryCounts[country] = { darkweb: 0, ransomware: 0, hacktivism: 0 };
      const m = (a.motivation || "").toLowerCase();
      if (m.includes("financial") || m.includes("ransom")) countryCounts[country].ransomware++;
      else if (m.includes("espionage") || m.includes("destruct")) countryCounts[country].darkweb++;
      else countryCounts[country].hacktivism++;
    });

    Object.entries(countryCounts).forEach(([country, counts]) => {
      const coords = COUNTRY_COORDS[country];
      if (!coords) return;
      if (counts.darkweb > 0)
        pins.push({ ...coords, country, type: "darkweb", count: counts.darkweb, label: `${country}: ${counts.darkweb} APT groups` });
      if (counts.ransomware > 0)
        pins.push({ x: coords.x + 10, y: coords.y - 6, country, type: "ransomware", count: counts.ransomware, label: `${country}: ${counts.ransomware} ransomware actors` });
      if (counts.hacktivism > 0)
        pins.push({ x: coords.x - 8, y: coords.y + 8, country, type: "hacktivism", count: counts.hacktivism, label: `${country}: ${counts.hacktivism} hacktivism groups` });
    });

    // Add top ransomware group pins
    const hotspots = [
      { x: 172, y: 160 }, { x: 490, y: 130 }, { x: 735, y: 155 },
    ];
    ransomwareGroups.slice(0, 3).forEach((g, i) => {
      pins.push({ ...hotspots[i], country: "Global", type: "ransomware", count: g.victim_count, label: `${g.name}: ${g.victim_count} victims` });
    });

    return pins;
  }, [actors, ransomwareGroups]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 flex flex-col p-6" : "card-enterprise p-5";

  return (
    <div className={containerClass} style={fullscreen ? { background: "#07040B" } : undefined}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-slate-300">Global Threat Map</h2>
          <span className="text-[10px] text-slate-600 ml-2">{totalFeeds} feeds &bull; real-time</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            {[
              { label: "APT / Dark Web", color: "#a855f7" },
              { label: "Ransomware", color: "#ef4444" },
              { label: "Hacktivism", color: "#f59e0b" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: l.color, boxShadow: `0 0 6px ${l.color}` }} />
                <span className="text-[10px] text-slate-500">{l.label}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 rounded-lg text-slate-500 hover:text-purple-400 transition-colors hover:bg-white/[0.02]">
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Map */}
      <div className={`relative ${fullscreen ? "flex-1" : ""}`} onMouseLeave={() => setHoveredPin(null)}>
        <svg
          viewBox="0 0 1000 500"
          className={`w-full rounded-xl ${fullscreen ? "h-full" : ""}`}
          style={{ background: "linear-gradient(180deg, #0c0818 0%, #07040B 50%, #050310 100%)" }}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
        >
          {/* Latitude/longitude grid */}
          {Array.from({ length: 18 }, (_, i) => (
            <line key={`lat${i}`} x1="0" y1={i * 28} x2="1000" y2={i * 28}
              stroke="rgba(139,92,246,0.018)" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 36 }, (_, i) => (
            <line key={`lon${i}`} x1={i * 28} y1="0" x2={i * 28} y2="500"
              stroke="rgba(139,92,246,0.018)" strokeWidth="0.5" />
          ))}
          {/* Equator */}
          <line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(139,92,246,0.04)" strokeWidth="0.6" strokeDasharray="6 4" />
          {/* Prime meridian */}
          <line x1="500" y1="0" x2="500" y2="500" stroke="rgba(139,92,246,0.03)" strokeWidth="0.4" strokeDasharray="4 6" />

          {/* Real country outlines */}
          {Object.entries(WORLD_COUNTRY_PATHS).map(([id, d]) => (
            <path
              key={id}
              d={d}
              fill="rgba(139,92,246,0.04)"
              stroke="rgba(139,92,246,0.12)"
              strokeWidth="0.5"
              strokeLinejoin="round"
              className="transition-all duration-200 hover:fill-[rgba(139,92,246,0.09)] hover:stroke-[rgba(168,85,247,0.3)]"
            />
          ))}

          {/* Threat corridor lines between pins */}
          {threatPins.length > 2 && threatPins.slice(0, 10).map((pin, i) => {
            const next = threatPins[(i + 4) % threatPins.length];
            return (
              <line key={`line${i}`}
                x1={pin.x} y1={pin.y} x2={next.x} y2={next.y}
                stroke={PIN_COLORS[pin.type]} strokeWidth="0.3" opacity="0.06" strokeDasharray="3 5" />
            );
          })}

          {/* Threat pins with animated pulses */}
          {threatPins.map((pin, i) => (
            <g key={i}
              onMouseEnter={() => setHoveredPin(pin)}
              onMouseLeave={() => setHoveredPin(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Outer expanding pulse */}
              <circle cx={pin.x} cy={pin.y} r="4" fill={PIN_COLORS[pin.type]} opacity="0">
                <animate attributeName="r" values="4;16;4" dur={`${2 + (i % 4) * 0.6}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.12;0;0.12" dur={`${2 + (i % 4) * 0.6}s`} repeatCount="indefinite" />
              </circle>
              {/* Glow */}
              <circle cx={pin.x} cy={pin.y} r="5" fill={PIN_COLORS[pin.type]} opacity="0.08" />
              {/* Core */}
              <circle cx={pin.x} cy={pin.y} r="3" fill={PIN_COLORS[pin.type]} opacity="0.85" />
              {/* Bright center */}
              <circle cx={pin.x} cy={pin.y} r="1.2" fill="white" opacity="0.5" />
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredPin && (
          <div className="absolute pointer-events-none px-3 py-1.5 rounded-lg text-[11px] font-medium z-10 whitespace-nowrap"
            style={{
              left: `${mousePos.x}px`, top: `${mousePos.y - 35}px`,
              transform: "translateX(-50%)",
              background: "rgba(17,13,26,0.95)", backdropFilter: "blur(8px)",
              border: `1px solid ${PIN_COLORS[hoveredPin.type]}30`,
              color: PIN_COLORS[hoveredPin.type],
              boxShadow: `0 4px 20px ${PIN_COLORS[hoveredPin.type]}10`,
            }}>
            {hoveredPin.label}
          </div>
        )}

        {/* Bottom stats */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-lg text-[10px]" style={{ background: "rgba(7,4,11,0.85)", border: "1px solid rgba(139,92,246,0.08)", backdropFilter: "blur(4px)" }}>
            <span className="text-slate-600">Regions: </span>
            <span className="text-purple-400 font-bold">{new Set(threatPins.map(p => p.country)).size}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg text-[10px]" style={{ background: "rgba(7,4,11,0.85)", border: "1px solid rgba(139,92,246,0.08)", backdropFilter: "blur(4px)" }}>
            <span className="text-slate-600">Threats: </span>
            <span className="text-red-400 font-bold">{threatPins.length}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg text-[10px]" style={{ background: "rgba(7,4,11,0.85)", border: "1px solid rgba(139,92,246,0.08)", backdropFilter: "blur(4px)" }}>
            <span className="text-slate-600">Actors: </span>
            <span className="text-amber-400 font-bold">{actors.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
