"use client";

import { useState, useEffect, useMemo } from "react";
import { Globe, Maximize2, Minimize2, AlertTriangle } from "lucide-react";

// Real world map country/continent SVG paths (Natural Earth simplified)
// Using Miller projection coordinates scaled to viewBox 0 0 1000 500
const WORLD_PATHS = {
  // North America
  na: "M 50,120 C 60,100 80,80 120,70 L 160,60 C 180,55 200,50 220,55 L 240,62 C 250,65 258,72 260,80 L 265,95 C 268,105 265,115 260,120 L 250,135 C 245,142 235,150 225,155 L 210,162 C 200,168 185,175 175,178 L 165,180 C 155,178 145,172 138,165 L 125,155 C 115,148 105,140 98,132 L 85,120 C 75,112 65,108 55,118 Z",
  // Central America
  ca: "M 165,180 C 170,185 175,192 172,198 L 168,205 C 166,210 162,215 158,218 L 155,220 C 152,222 148,222 146,218 L 148,210 C 150,205 155,195 160,188 Z",
  // South America
  sa: "M 195,225 C 205,218 215,215 225,220 L 240,230 C 248,238 255,250 258,265 L 260,285 C 260,300 256,318 250,335 L 242,350 C 235,360 226,368 218,372 L 210,375 C 200,376 192,372 188,365 L 180,350 C 175,338 172,322 172,308 L 174,290 C 176,275 180,260 185,248 L 190,235 Z",
  // Europe
  eu: "M 445,55 C 455,48 468,45 480,48 L 498,52 C 508,55 518,60 525,68 L 532,78 C 535,85 535,92 530,98 L 522,108 C 518,112 510,116 502,118 L 490,120 C 480,120 470,118 462,112 L 452,105 C 445,98 440,90 438,82 L 436,72 C 436,62 440,58 445,55 Z",
  // UK/Ireland
  uk: "M 432,62 C 436,58 440,56 444,58 L 448,62 C 450,66 448,72 445,75 L 440,78 C 436,78 432,75 432,70 Z",
  // Africa
  af: "M 455,128 C 468,122 485,120 498,125 L 515,132 C 525,138 532,148 535,160 L 538,178 C 540,195 538,215 532,235 L 525,252 C 518,265 508,275 495,282 L 480,288 C 468,290 455,288 445,280 L 435,270 C 428,258 424,242 422,228 L 420,210 C 420,192 422,175 428,160 L 435,145 C 440,135 448,130 455,128 Z",
  // Middle East
  me: "M 540,105 C 555,100 570,98 582,102 L 595,108 C 602,115 605,125 604,135 L 600,148 C 596,158 588,165 578,168 L 565,170 C 555,168 545,162 538,155 L 532,145 C 528,135 528,122 532,112 Z",
  // Russia/Central Asia
  ru: "M 530,30 C 555,22 585,18 620,20 L 660,25 C 690,30 715,38 735,48 L 755,60 C 768,70 775,82 778,95 L 775,108 C 770,118 760,125 748,128 L 730,130 C 710,130 688,126 668,120 L 648,112 C 630,105 615,95 605,85 L 590,72 C 578,62 565,52 555,45 L 540,38 C 534,35 530,32 530,30 Z",
  // India
  in_: "M 620,140 C 630,135 642,132 652,138 L 660,145 C 665,152 668,162 666,172 L 662,185 C 658,195 650,205 642,210 L 632,215 C 622,215 614,210 610,202 L 606,190 C 604,178 606,165 610,155 L 615,145 Z",
  // China
  cn: "M 690,65 C 710,58 732,55 752,60 L 768,68 C 778,75 785,85 788,98 L 790,112 C 788,125 782,135 772,142 L 758,148 C 745,152 730,152 718,148 L 705,142 C 695,135 688,125 684,112 L 680,98 C 680,82 684,72 690,65 Z",
  // Southeast Asia
  sea: "M 725,160 C 738,155 752,155 762,162 L 770,170 C 775,178 776,188 772,198 L 768,205 C 762,212 754,216 745,215 L 735,212 C 728,208 722,200 720,190 L 718,178 C 718,168 720,162 725,160 Z",
  // Japan/Korea
  jp: "M 808,80 C 815,75 822,75 828,80 L 832,88 C 834,95 832,105 828,112 L 822,118 C 816,120 810,118 806,112 L 804,102 C 804,92 806,84 808,80 Z",
  // Australia
  au: "M 760,310 C 778,302 798,298 818,302 L 838,310 C 850,318 858,330 860,345 L 858,360 C 854,372 845,382 832,388 L 815,392 C 798,392 782,386 770,376 L 760,365 C 754,352 752,338 754,325 L 758,315 Z",
  // Indonesia/Philippines
  id_: "M 735,225 C 745,222 758,222 768,226 L 780,232 C 788,238 792,248 790,258 L 786,265 C 780,272 770,275 760,272 L 748,268 C 740,262 734,252 732,242 L 733,232 Z",
};

// Country centroids for threat pins (x,y in viewBox coordinates)
const COUNTRY_COORDS: Record<string, { x: number; y: number }> = {
  "USA": { x: 170, y: 105 },
  "Canada": { x: 180, y: 75 },
  "Brazil": { x: 230, y: 300 },
  "Mexico": { x: 145, y: 170 },
  "Argentina": { x: 215, y: 360 },
  "UK": { x: 440, y: 68 },
  "Germany": { x: 478, y: 72 },
  "France": { x: 462, y: 88 },
  "Russia": { x: 650, y: 55 },
  "China": { x: 735, y: 105 },
  "India": { x: 640, y: 175 },
  "Iran": { x: 570, y: 130 },
  "Israel": { x: 548, y: 135 },
  "Turkey": { x: 535, y: 100 },
  "Pakistan": { x: 615, y: 148 },
  "North Korea": { x: 790, y: 95 },
  "Vietnam": { x: 740, y: 175 },
  "Singapore": { x: 748, y: 215 },
  "Japan": { x: 818, y: 98 },
  "South Korea": { x: 798, y: 105 },
  "Australia": { x: 805, y: 345 },
  "Nigeria": { x: 465, y: 195 },
  "South Africa": { x: 490, y: 285 },
  "Saudi Arabia": { x: 560, y: 150 },
  "UAE": { x: 580, y: 155 },
  "Ukraine": { x: 520, y: 72 },
  "Poland": { x: 495, y: 65 },
  "Indonesia": { x: 755, y: 245 },
  "Unknown": { x: 500, y: 260 },
};

interface ThreatPin {
  x: number;
  y: number;
  country: string;
  type: "ransomware" | "darkweb" | "hacktivism";
  count: number;
  label?: string;
}

const PIN_COLORS: Record<string, string> = {
  ransomware: "#ef4444",
  darkweb: "#a855f7",
  hacktivism: "#f59e0b",
};

interface Props {
  actors?: any[];
  ransomwareGroups?: any[];
  totalFeeds?: number;
}

export function GlobalThreatMap({ actors = [], ransomwareGroups = [], totalFeeds = 0 }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [hoveredPin, setHoveredPin] = useState<ThreatPin | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Generate threat pins from real actor data
  const threatPins = useMemo(() => {
    const pins: ThreatPin[] = [];
    const countryCounts: Record<string, { darkweb: number; ransomware: number; hacktivism: number }> = {};

    // From MITRE ATT&CK actors
    actors.forEach(a => {
      const country = a.country || "Unknown";
      if (!countryCounts[country]) countryCounts[country] = { darkweb: 0, ransomware: 0, hacktivism: 0 };
      const motivation = (a.motivation || "").toLowerCase();
      if (motivation.includes("financial") || motivation.includes("ransom")) {
        countryCounts[country].ransomware++;
      } else if (motivation.includes("espionage") || motivation.includes("destruct")) {
        countryCounts[country].darkweb++;
      } else {
        countryCounts[country].hacktivism++;
      }
    });

    // Generate pins from counts
    Object.entries(countryCounts).forEach(([country, counts]) => {
      const coords = COUNTRY_COORDS[country];
      if (!coords) return;
      if (counts.darkweb > 0) {
        pins.push({ ...coords, country, type: "darkweb", count: counts.darkweb, label: `${country}: ${counts.darkweb} APT groups` });
      }
      if (counts.ransomware > 0) {
        pins.push({ x: coords.x + 12, y: coords.y - 8, country, type: "ransomware", count: counts.ransomware, label: `${country}: ${counts.ransomware} ransomware actors` });
      }
      if (counts.hacktivism > 0) {
        pins.push({ x: coords.x - 10, y: coords.y + 10, country, type: "hacktivism", count: counts.hacktivism, label: `${country}: ${counts.hacktivism} hacktivism groups` });
      }
    });

    // Add ransomware hotspots
    const topRansomware = ransomwareGroups.slice(0, 5);
    if (topRansomware.length > 0) {
      // Add global ransomware indicators
      [{ x: 172, y: 115 }, { x: 485, y: 82 }, { x: 742, y: 110 }].forEach((pos, i) => {
        if (topRansomware[i]) {
          pins.push({ ...pos, country: "Global", type: "ransomware", count: topRansomware[i].victim_count, label: `${topRansomware[i].name}: ${topRansomware[i].victim_count} victims` });
        }
      });
    }

    return pins;
  }, [actors, ransomwareGroups]);

  const handlePinHover = (pin: ThreatPin, e: React.MouseEvent) => {
    setHoveredPin(pin);
    const rect = (e.target as SVGElement).closest("svg")?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top - 30 });
    }
  };

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 bg-[#07040B] p-6 flex flex-col"
    : "card-enterprise p-5";

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-slate-300">Global Threat Map</h2>
          <span className="text-[10px] text-slate-600 ml-2">{totalFeeds} feeds &bull; real-time</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {[
              { label: "Hacktivism", color: "#f59e0b" },
              { label: "Dark Web / APT", color: "#a855f7" },
              { label: "Ransomware", color: "#ef4444" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: l.color, boxShadow: `0 0 6px ${l.color}` }} />
                <span className="text-[10px] text-slate-500">{l.label}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1 rounded text-slate-500 hover:text-purple-400 transition-colors">
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className={`relative ${fullscreen ? "flex-1" : ""}`}>
        <svg
          viewBox="0 0 1000 500"
          className={`w-full rounded-xl ${fullscreen ? "h-full" : ""}`}
          style={{ background: "linear-gradient(180deg, rgba(139,92,246,0.02) 0%, rgba(7,4,11,0.98) 100%)" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Ocean grid */}
          {Array.from({ length: 13 }, (_, i) => (
            <line key={`lat${i}`} x1="0" y1={i * 40} x2="1000" y2={i * 40} stroke="rgba(139,92,246,0.025)" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 26 }, (_, i) => (
            <line key={`lon${i}`} x1={i * 40} y1="0" x2={i * 40} y2="500" stroke="rgba(139,92,246,0.025)" strokeWidth="0.5" />
          ))}

          {/* Equator */}
          <line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(139,92,246,0.04)" strokeWidth="0.8" strokeDasharray="8 4" />

          {/* Country/continent paths */}
          {Object.entries(WORLD_PATHS).map(([id, d]) => (
            <path
              key={id}
              d={d}
              fill="rgba(139,92,246,0.05)"
              stroke="rgba(139,92,246,0.12)"
              strokeWidth="0.8"
              className="transition-all duration-300 hover:fill-[rgba(139,92,246,0.1)] hover:stroke-[rgba(139,92,246,0.25)]"
            />
          ))}

          {/* Connection lines between active threat regions */}
          {threatPins.length > 1 && threatPins.slice(0, 8).map((pin, i) => {
            const next = threatPins[(i + 3) % threatPins.length];
            return (
              <line
                key={`conn${i}`}
                x1={pin.x} y1={pin.y}
                x2={next.x} y2={next.y}
                stroke={PIN_COLORS[pin.type]}
                strokeWidth="0.3"
                opacity="0.08"
                strokeDasharray="4 6"
              />
            );
          })}

          {/* Threat pins */}
          {threatPins.map((pin, i) => (
            <g
              key={i}
              onMouseEnter={(e) => handlePinHover(pin, e)}
              onMouseLeave={() => setHoveredPin(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Outer pulse ring */}
              <circle cx={pin.x} cy={pin.y} r="12" fill={PIN_COLORS[pin.type]} opacity="0">
                <animate attributeName="r" values="6;18;6" dur={`${2.5 + (i % 3) * 0.5}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.15;0;0.15" dur={`${2.5 + (i % 3) * 0.5}s`} repeatCount="indefinite" />
              </circle>
              {/* Middle glow */}
              <circle cx={pin.x} cy={pin.y} r="6" fill={PIN_COLORS[pin.type]} opacity="0.12" />
              {/* Core dot */}
              <circle cx={pin.x} cy={pin.y} r="3.5" fill={PIN_COLORS[pin.type]} opacity="0.9" />
              {/* Bright center */}
              <circle cx={pin.x} cy={pin.y} r="1.5" fill="white" opacity="0.6" />
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredPin && (
          <div
            className="absolute pointer-events-none px-3 py-2 rounded-lg text-[11px] font-medium z-10 whitespace-nowrap"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              transform: "translateX(-50%)",
              background: "#110d1a",
              border: `1px solid ${PIN_COLORS[hoveredPin.type]}40`,
              color: PIN_COLORS[hoveredPin.type],
              boxShadow: `0 0 20px ${PIN_COLORS[hoveredPin.type]}15`,
            }}
          >
            {hoveredPin.label || `${hoveredPin.country}: ${hoveredPin.count} threats`}
          </div>
        )}

        {/* Stats overlay */}
        <div className="absolute bottom-3 left-3 flex items-center gap-3">
          <div className="px-2.5 py-1.5 rounded-lg text-[10px]" style={{ background: "rgba(17,13,26,0.9)", border: "1px solid rgba(139,92,246,0.1)" }}>
            <span className="text-slate-500">Active regions: </span>
            <span className="text-purple-400 font-bold">{new Set(threatPins.map(p => p.country)).size}</span>
          </div>
          <div className="px-2.5 py-1.5 rounded-lg text-[10px]" style={{ background: "rgba(17,13,26,0.9)", border: "1px solid rgba(139,92,246,0.1)" }}>
            <span className="text-slate-500">Threat pins: </span>
            <span className="text-red-400 font-bold">{threatPins.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
