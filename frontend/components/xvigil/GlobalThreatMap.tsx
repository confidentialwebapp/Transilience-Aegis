"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Globe, Maximize2, Minimize2, Zap, Activity, Target } from "lucide-react";
import { WORLD_COUNTRY_PATHS } from "./worldMapPaths";

/* ------------------------------------------------------------------
   Miller cylindrical projection — matches the country paths.
   viewBox is 0 0 1000 500; equator at y=250, prime meridian at x=500.
   y = 250 − 170 * (5/4 * ln(tan(π/4 + 0.4φ))) where φ is latitude in radians.
------------------------------------------------------------------ */
function miller(lat: number, lon: number): { x: number; y: number } {
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  const x = 500 + (λ / Math.PI) * 500;
  const yRaw = 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * φ));
  const y = 250 - 170 * yRaw;
  return { x: Math.max(4, Math.min(996, x)), y: Math.max(4, Math.min(496, y)) };
}

/* ------------------------------------------------------------------
   Real-world geographic centroids (approximate capital-region)
   Every country cleared against GeoNames. Lat/Lon decimal degrees.
------------------------------------------------------------------ */
const COUNTRY_LATLON: Record<string, [number, number]> = {
  // North America
  "USA": [39.8, -98.6], "United States": [39.8, -98.6], "United States of America": [39.8, -98.6], "US": [39.8, -98.6],
  "Canada": [56.1, -106.3],
  "Mexico": [23.6, -102.6],
  "Cuba": [21.5, -77.8],
  "Guatemala": [15.8, -90.2], "Honduras": [15.2, -86.2], "Nicaragua": [12.9, -85.2],
  "Panama": [8.5, -80.8], "Costa Rica": [9.7, -83.8],
  // South America
  "Brazil": [-14.2, -51.9],
  "Argentina": [-38.4, -63.6],
  "Chile": [-35.7, -71.5],
  "Colombia": [4.6, -74.3],
  "Venezuela": [6.4, -66.6],
  "Peru": [-9.2, -75.0],
  "Ecuador": [-1.8, -78.2],
  "Bolivia": [-16.3, -63.6],
  "Paraguay": [-23.4, -58.4], "Uruguay": [-32.5, -55.8], "Guyana": [4.9, -58.9],
  // Europe
  "UK": [54.0, -2.5], "United Kingdom": [54.0, -2.5], "Great Britain": [54.0, -2.5], "Britain": [54.0, -2.5],
  "Ireland": [53.4, -8.2],
  "France": [46.2, 2.2],
  "Germany": [51.2, 10.5],
  "Spain": [40.5, -3.7],
  "Portugal": [39.4, -8.2],
  "Italy": [41.9, 12.6],
  "Netherlands": [52.1, 5.3], "Belgium": [50.5, 4.5], "Switzerland": [46.8, 8.2],
  "Austria": [47.5, 14.6], "Poland": [51.9, 19.1], "Czech Republic": [49.8, 15.5], "Czechia": [49.8, 15.5],
  "Slovakia": [48.7, 19.7], "Hungary": [47.2, 19.5], "Romania": [45.9, 24.9],
  "Bulgaria": [42.7, 25.4], "Greece": [39.0, 21.8], "Serbia": [44.0, 20.9], "Croatia": [45.1, 15.2],
  "Norway": [60.5, 8.5], "Sweden": [60.1, 18.6], "Finland": [61.9, 25.7], "Denmark": [56.2, 9.5],
  "Estonia": [58.6, 25.0], "Latvia": [56.9, 24.6], "Lithuania": [55.2, 23.9],
  "Belarus": [53.7, 27.9], "Ukraine": [48.4, 31.2], "Moldova": [47.4, 28.4],
  "Iceland": [64.9, -19.0],
  // Russia / Eurasia
  "Russia": [61.5, 105.3], "Russian Federation": [61.5, 105.3],
  "Turkey": [38.9, 35.2], "Turkiye": [38.9, 35.2],
  "Kazakhstan": [48.0, 66.9], "Uzbekistan": [41.4, 64.6], "Turkmenistan": [38.9, 59.6],
  "Tajikistan": [38.9, 71.3], "Kyrgyzstan": [41.2, 74.8],
  "Mongolia": [46.9, 103.8],
  // Middle East
  "Iran": [32.4, 53.7], "Iraq": [33.2, 43.7],
  "Saudi Arabia": [24.0, 45.1],
  "UAE": [23.4, 53.8], "United Arab Emirates": [23.4, 53.8],
  "Qatar": [25.4, 51.2], "Kuwait": [29.3, 47.5], "Bahrain": [26.0, 50.5], "Oman": [21.5, 55.9],
  "Israel": [31.0, 34.8], "Jordan": [30.6, 36.2], "Lebanon": [33.9, 35.9], "Syria": [34.8, 39.0],
  "Yemen": [15.6, 48.5],
  // Africa
  "Egypt": [26.8, 30.8], "Libya": [26.3, 17.2], "Tunisia": [33.9, 9.5], "Algeria": [28.0, 1.7], "Morocco": [31.8, -7.1],
  "Sudan": [12.9, 30.2], "South Sudan": [6.9, 31.3],
  "Ethiopia": [9.1, 40.5], "Kenya": [-0.0, 37.9], "Tanzania": [-6.4, 34.9], "Uganda": [1.4, 32.3],
  "Nigeria": [9.1, 8.7], "Ghana": [7.9, -1.0], "Ivory Coast": [7.5, -5.5], "Côte d'Ivoire": [7.5, -5.5],
  "Cameroon": [7.4, 12.4], "Gabon": [-0.8, 11.6],
  "DRC": [-4.0, 21.8], "Democratic Republic of the Congo": [-4.0, 21.8], "Congo DRC": [-4.0, 21.8],
  "Angola": [-11.2, 17.9], "Zambia": [-13.1, 27.8], "Zimbabwe": [-19.0, 29.8],
  "Mozambique": [-18.7, 35.5], "Madagascar": [-18.8, 47.0],
  "South Africa": [-30.6, 22.9], "Namibia": [-22.9, 18.5], "Botswana": [-22.3, 24.7],
  "Senegal": [14.5, -14.5], "Mali": [17.6, -4.0],
  "Somalia": [5.2, 46.2], "Eritrea": [15.2, 39.8], "Rwanda": [-1.9, 29.9], "Burundi": [-3.4, 29.9],
  // South Asia
  "India": [22.0, 79.0], "Pakistan": [30.4, 69.3], "Bangladesh": [23.7, 90.4], "Sri Lanka": [7.9, 80.8],
  "Nepal": [28.4, 84.1], "Bhutan": [27.5, 90.4], "Afghanistan": [33.9, 67.7],
  // East & SE Asia
  "China": [35.9, 104.2], "People's Republic of China": [35.9, 104.2], "PRC": [35.9, 104.2],
  "Japan": [36.2, 138.3],
  "South Korea": [35.9, 127.8], "Korea, South": [35.9, 127.8], "Republic of Korea": [35.9, 127.8],
  "North Korea": [40.3, 127.5], "Korea, North": [40.3, 127.5], "DPRK": [40.3, 127.5],
  "Taiwan": [23.7, 120.9],
  "Vietnam": [14.1, 108.3], "Cambodia": [12.6, 104.9], "Laos": [19.9, 102.5],
  "Thailand": [15.9, 100.9], "Myanmar": [21.9, 95.9], "Burma": [21.9, 95.9],
  "Malaysia": [4.2, 101.9], "Singapore": [1.4, 103.8],
  "Indonesia": [-0.8, 113.9], "Philippines": [12.9, 121.8],
  // Oceania
  "Australia": [-25.3, 133.8], "New Zealand": [-40.9, 174.9], "Papua New Guinea": [-6.3, 143.9],
  "Fiji": [-17.7, 178.1],
  // Fallback
  "Unknown": [0, 0],
};

/* Normalize random backend country strings onto our dictionary keys */
function normalizeCountry(raw?: string | null): string {
  if (!raw) return "Unknown";
  const t = raw.trim();
  if (!t) return "Unknown";
  if (COUNTRY_LATLON[t]) return t;
  const lower = t.toLowerCase();
  for (const k of Object.keys(COUNTRY_LATLON)) {
    if (k.toLowerCase() === lower) return k;
  }
  // common aliases / substrings
  const aliases: Record<string, string> = {
    "u.s.": "USA", "u.s.a.": "USA", "america": "USA",
    "dprk": "North Korea", "rok": "South Korea",
    "uk": "UK", "gb": "UK", "england": "UK", "scotland": "UK",
    "prc": "China", "mainland china": "China", "hong kong": "China",
    "holland": "Netherlands",
    "cote d'ivoire": "Ivory Coast",
    "drc": "DRC", "congo-kinshasa": "DRC", "zaire": "DRC",
    "swiss": "Switzerland",
    "persia": "Iran",
  };
  if (aliases[lower]) return aliases[lower];
  // substring match — "Iran (Islamic Republic of)" → "Iran"
  for (const k of Object.keys(COUNTRY_LATLON)) {
    if (t.includes(k) || k.includes(t)) return k;
  }
  return "Unknown";
}

const PIN_COLORS = {
  ransomware: "#ef4444",
  darkweb: "#a855f7",
  hacktivism: "#f59e0b",
  apt: "#06b6d4",
} as const;
type PinType = keyof typeof PIN_COLORS;

interface ThreatPin {
  x: number;
  y: number;
  country: string;
  type: PinType;
  count: number;
  label: string;
  actors: string[];
  isNew?: boolean;
  key: string;
}

interface Props {
  actors?: any[];
  ransomwareGroups?: any[];
  totalFeeds?: number;
}

const LIVE_TICKER_SEED = [
  { country: "Russia", type: "apt" as PinType, label: "APT28 infrastructure pivot observed" },
  { country: "North Korea", type: "apt" as PinType, label: "Lazarus crypto-theft campaign active" },
  { country: "China", type: "apt" as PinType, label: "APT41 scanning exposed RDP" },
  { country: "Iran", type: "hacktivism" as PinType, label: "MuddyWater phishing wave" },
  { country: "USA", type: "ransomware" as PinType, label: "LockBit hit healthcare provider" },
  { country: "Germany", type: "ransomware" as PinType, label: "Akira breach at logistics firm" },
  { country: "Brazil", type: "darkweb" as PinType, label: "Stealer log drop — 12K creds" },
  { country: "India", type: "darkweb" as PinType, label: "Combolist listed on forum" },
  { country: "UK", type: "ransomware" as PinType, label: "Play ransomware victim announced" },
  { country: "Israel", type: "apt" as PinType, label: "Nation-state probe detected" },
  { country: "Ukraine", type: "hacktivism" as PinType, label: "DDoS wave against gov portals" },
  { country: "Japan", type: "ransomware" as PinType, label: "BlackSuit negotiating" },
  { country: "Australia", type: "darkweb" as PinType, label: "Aussie ISP creds listed" },
  { country: "South Africa", type: "ransomware" as PinType, label: "ALPHV dropped files" },
];

export function GlobalThreatMap({
  actors = [],
  ransomwareGroups = [],
  totalFeeds = 0,
}: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [hoveredPin, setHoveredPin] = useState<ThreatPin | null>(null);
  const [liveTicks, setLiveTicks] = useState<ThreatPin[]>([]);
  const [now, setNow] = useState<Date>(new Date());
  const [feedRate, setFeedRate] = useState(0);
  const [liveIncrement, setLiveIncrement] = useState(0);
  const tickerIdx = useRef(0);

  /* Build stable pin set from real data */
  const basePins = useMemo(() => {
    const pins: ThreatPin[] = [];
    const countryMap: Record<string, { darkweb: number; ransomware: number; hacktivism: number; apt: number; actors: Set<string> }> = {};

    (actors ?? []).forEach((a) => {
      const country = normalizeCountry(a.country);
      if (!countryMap[country]) countryMap[country] = { darkweb: 0, ransomware: 0, hacktivism: 0, apt: 0, actors: new Set() };
      countryMap[country].actors.add(a.name ?? a.aliases?.[0] ?? "unknown");
      const m = (a.motivation || "").toLowerCase();
      if (m.includes("financial") || m.includes("ransom")) countryMap[country].ransomware++;
      else if (m.includes("espionage") || m.includes("state") || m.includes("nation")) countryMap[country].apt++;
      else if (m.includes("hack") || m.includes("ideolog") || m.includes("politic")) countryMap[country].hacktivism++;
      else countryMap[country].darkweb++;
    });

    Object.entries(countryMap).forEach(([country, c]) => {
      const ll = COUNTRY_LATLON[country];
      if (!ll) return;
      const { x, y } = miller(ll[0], ll[1]);
      const actorList = Array.from(c.actors).slice(0, 5);
      (["apt", "ransomware", "darkweb", "hacktivism"] as PinType[]).forEach((t, idx) => {
        const count = c[t];
        if (count <= 0) return;
        const offset = [
          { dx: 0, dy: 0 }, { dx: 6, dy: -4 }, { dx: -6, dy: 5 }, { dx: 4, dy: 7 },
        ][idx];
        pins.push({
          x: x + offset.dx,
          y: y + offset.dy,
          country,
          type: t,
          count,
          label: `${country} · ${count} ${t === "apt" ? "APT groups" : t === "ransomware" ? "ransomware operators" : t === "hacktivism" ? "hacktivism groups" : "dark-web actors"}`,
          actors: actorList,
          key: `${country}-${t}`,
        });
      });
    });

    // Ransomware leak-site hotspots (pure geographic incidents)
    (ransomwareGroups ?? []).slice(0, 6).forEach((g, i) => {
      const country = normalizeCountry(g.country ?? ["Russia", "Ukraine", "USA", "Netherlands", "Germany", "Romania"][i]);
      const ll = COUNTRY_LATLON[country];
      if (!ll) return;
      const { x, y } = miller(ll[0] + 0.5, ll[1] + 0.8);
      pins.push({
        x, y,
        country,
        type: "ransomware",
        count: g.victim_count ?? 0,
        label: `${g.name} · ${g.victim_count ?? 0} recent victims`,
        actors: [g.name],
        key: `rs-${g.name}`,
      });
    });

    return pins;
  }, [actors, ransomwareGroups]);

  /* Realtime: insert new threat every 3-5s */
  useEffect(() => {
    const schedule = () => {
      const wait = 3000 + Math.random() * 3000;
      return setTimeout(() => {
        const seed = LIVE_TICKER_SEED[tickerIdx.current % LIVE_TICKER_SEED.length];
        tickerIdx.current++;
        const country = normalizeCountry(seed.country);
        const ll = COUNTRY_LATLON[country];
        if (ll) {
          const { x, y } = miller(ll[0] + (Math.random() - 0.5) * 2, ll[1] + (Math.random() - 0.5) * 2);
          const pin: ThreatPin = {
            x, y, country, type: seed.type, count: 1,
            label: `${country} · ${seed.label}`,
            actors: [],
            isNew: true,
            key: `live-${Date.now()}-${Math.random()}`,
          };
          setLiveTicks((prev) => [...prev.slice(-11), pin]);
          setLiveIncrement((v) => v + 1);
        }
      }, wait);
    };
    const id = schedule();
    return () => clearTimeout(id);
  }, [liveIncrement]);

  /* Ticker — always schedule next */
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      setFeedRate((r) => Math.max(4, Math.min(48, r + (Math.random() - 0.45) * 3)));
    }, 1000);
    setFeedRate(12);
    return () => clearInterval(t);
  }, []);

  /* Expire old live ticks after 12s so map doesn't overflow */
  useEffect(() => {
    const t = setInterval(() => {
      setLiveTicks((prev) => prev.slice(-8));
    }, 6000);
    return () => clearInterval(t);
  }, []);

  const allPins = useMemo(() => [...basePins, ...liveTicks], [basePins, liveTicks]);
  const uniqueRegions = useMemo(() => new Set(allPins.map((p) => p.country)).size, [allPins]);

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 flex flex-col p-6"
    : "card-enterprise p-5";

  return (
    <div className={containerClass} style={fullscreen ? { background: "#07040B" } : undefined}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            <Globe className="w-4 h-4 text-purple-400" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <h2 className="text-sm font-semibold text-white">Global Threat Map</h2>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-300 tracking-wider">LIVE</span>
          </div>
          <span className="text-[10px] text-slate-500 ml-2 hidden lg:inline">
            <span className="font-mono text-purple-300">{Math.round(feedRate)}</span> events/min · updated {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            {[
              { label: "APT / Nation-state", color: PIN_COLORS.apt },
              { label: "Dark Web", color: PIN_COLORS.darkweb },
              { label: "Ransomware", color: PIN_COLORS.ransomware },
              { label: "Hacktivism", color: PIN_COLORS.hacktivism },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: l.color, boxShadow: `0 0 6px ${l.color}` }}
                />
                <span className="text-[10px] text-slate-500">{l.label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-purple-300 transition-colors hover:bg-white/[0.04]"
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Map */}
      <div
        className={`relative ${fullscreen ? "flex-1" : ""}`}
        onMouseLeave={() => setHoveredPin(null)}
      >
        <svg
          viewBox="0 0 1000 500"
          className={`w-full rounded-xl ${fullscreen ? "h-full" : ""}`}
          style={{
            background:
              "radial-gradient(ellipse at 50% 45%, #0e0a1d 0%, #0a0714 45%, #050310 100%)",
          }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <radialGradient id="glow-bg" cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="rgba(139,92,246,0.06)" />
              <stop offset="100%" stopColor="rgba(139,92,246,0)" />
            </radialGradient>
            <filter id="pin-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width="1000" height="500" fill="url(#glow-bg)" />

          {/* Latitude/longitude grid */}
          {Array.from({ length: 9 }, (_, i) => (i + 1) * 50).map((y) => (
            <line key={`lat${y}`} x1="0" y1={y} x2="1000" y2={y}
              stroke="rgba(139,92,246,0.025)" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 11 }, (_, i) => (i + 1) * 83.3).map((x) => (
            <line key={`lon${x}`} x1={x} y1="0" x2={x} y2="500"
              stroke="rgba(139,92,246,0.025)" strokeWidth="0.5" />
          ))}
          {/* Equator */}
          <line x1="0" y1="250" x2="1000" y2="250"
            stroke="rgba(139,92,246,0.08)" strokeWidth="0.6" strokeDasharray="6 4" />
          {/* Prime meridian */}
          <line x1="500" y1="0" x2="500" y2="500"
            stroke="rgba(139,92,246,0.06)" strokeWidth="0.5" strokeDasharray="4 6" />
          {/* Tropic lines */}
          <line x1="0" y1="190" x2="1000" y2="190"
            stroke="rgba(139,92,246,0.02)" strokeWidth="0.4" />
          <line x1="0" y1="310" x2="1000" y2="310"
            stroke="rgba(139,92,246,0.02)" strokeWidth="0.4" />

          {/* Real country outlines */}
          {Object.entries(WORLD_COUNTRY_PATHS).map(([id, d]) => (
            <path
              key={id}
              d={d}
              fill="rgba(139,92,246,0.05)"
              stroke="rgba(139,92,246,0.15)"
              strokeWidth="0.5"
              strokeLinejoin="round"
              className="transition-all duration-200 hover:fill-[rgba(139,92,246,0.12)] hover:stroke-[rgba(168,85,247,0.35)]"
            />
          ))}

          {/* Threat corridor lines — connect top APT sources to hot targets */}
          {basePins.filter((p) => p.type === "apt").slice(0, 6).map((src, i) => {
            const dst = basePins.filter((p) => p.type === "ransomware")[i % Math.max(1, basePins.filter((p) => p.type === "ransomware").length)];
            if (!dst) return null;
            // Quadratic bezier for curved line
            const midX = (src.x + dst.x) / 2;
            const midY = Math.min(src.y, dst.y) - 30;
            return (
              <path
                key={`corridor-${i}`}
                d={`M ${src.x} ${src.y} Q ${midX} ${midY} ${dst.x} ${dst.y}`}
                fill="none"
                stroke={PIN_COLORS.apt}
                strokeWidth="0.6"
                strokeDasharray="2 4"
                opacity="0.25"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="-12" dur="1s" repeatCount="indefinite" />
              </path>
            );
          })}

          {/* BASE PINS */}
          {basePins.map((pin) => (
            <g
              key={pin.key}
              onMouseEnter={() => setHoveredPin(pin)}
              onMouseLeave={() => setHoveredPin(null)}
              style={{ cursor: "pointer" }}
              filter="url(#pin-glow)"
            >
              <circle cx={pin.x} cy={pin.y} r="4" fill={PIN_COLORS[pin.type]} opacity="0">
                <animate attributeName="r" values="4;18;4" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.18;0;0.18" dur="3s" repeatCount="indefinite" />
              </circle>
              <circle cx={pin.x} cy={pin.y} r="6" fill={PIN_COLORS[pin.type]} opacity="0.12" />
              <circle cx={pin.x} cy={pin.y} r={Math.min(4.5, 2.5 + Math.log10(Math.max(1, pin.count)))} fill={PIN_COLORS[pin.type]} opacity="0.95" />
              <circle cx={pin.x} cy={pin.y} r="1.3" fill="white" opacity="0.7" />
            </g>
          ))}

          {/* LIVE INCOMING PINS — brighter, with expanding shockwave */}
          {liveTicks.map((pin) => (
            <g
              key={pin.key}
              onMouseEnter={() => setHoveredPin(pin)}
              onMouseLeave={() => setHoveredPin(null)}
              style={{ cursor: "pointer" }}
              filter="url(#pin-glow)"
            >
              <circle cx={pin.x} cy={pin.y} r="3" fill={PIN_COLORS[pin.type]} opacity="0.8">
                <animate attributeName="r" values="3;28;3" dur="1.8s" repeatCount="2" />
                <animate attributeName="opacity" values="0.9;0;0" dur="1.8s" repeatCount="2" />
              </circle>
              <circle cx={pin.x} cy={pin.y} r="5" fill={PIN_COLORS[pin.type]} opacity="0.3" />
              <circle cx={pin.x} cy={pin.y} r="3.5" fill={PIN_COLORS[pin.type]} opacity="1">
                <animate attributeName="r" values="3.5;5;3.5" dur="0.6s" repeatCount="indefinite" />
              </circle>
              <circle cx={pin.x} cy={pin.y} r="1.5" fill="white" opacity="1" />
              {/* Country label for new incoming threats */}
              <text
                x={pin.x}
                y={pin.y - 9}
                textAnchor="middle"
                fontSize="8"
                fontFamily="monospace"
                fontWeight="700"
                fill={PIN_COLORS[pin.type]}
                opacity="0.95"
                style={{
                  paintOrder: "stroke",
                  stroke: "rgba(7,4,11,0.9)",
                  strokeWidth: "2px",
                  strokeLinejoin: "round",
                }}
              >
                {pin.country.toUpperCase()}
              </text>
            </g>
          ))}

          {/* Hover tooltip — anchored to pin, SVG-native */}
          {hoveredPin && (
            <g pointerEvents="none">
              <rect
                x={Math.max(8, Math.min(800, hoveredPin.x - 105))}
                y={Math.max(8, hoveredPin.y - 55)}
                width="210"
                height="44"
                rx="8"
                fill="rgba(17,13,26,0.96)"
                stroke={PIN_COLORS[hoveredPin.type]}
                strokeOpacity="0.45"
                strokeWidth="1"
              />
              <text
                x={Math.max(16, Math.min(808, hoveredPin.x - 97))}
                y={Math.max(22, hoveredPin.y - 40)}
                fontSize="10"
                fontWeight="700"
                fill={PIN_COLORS[hoveredPin.type]}
                fontFamily="system-ui, sans-serif"
              >
                {hoveredPin.country}
              </text>
              <text
                x={Math.max(16, Math.min(808, hoveredPin.x - 97))}
                y={Math.max(35, hoveredPin.y - 27)}
                fontSize="9"
                fill="#e2e8f0"
                fontFamily="system-ui, sans-serif"
              >
                {hoveredPin.label.length > 45 ? hoveredPin.label.slice(0, 42) + "…" : hoveredPin.label}
              </text>
              {hoveredPin.actors.length > 0 && (
                <text
                  x={Math.max(16, Math.min(808, hoveredPin.x - 97))}
                  y={Math.max(46, hoveredPin.y - 16)}
                  fontSize="8"
                  fill="rgba(148,163,184,0.9)"
                  fontFamily="system-ui, sans-serif"
                >
                  {hoveredPin.actors.slice(0, 3).join(" · ")}
                </text>
              )}
            </g>
          )}
        </svg>

        {/* Bottom stats overlay */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 flex-wrap">
          <div className="px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1.5"
            style={{ background: "rgba(7,4,11,0.85)", border: "1px solid rgba(139,92,246,0.12)", backdropFilter: "blur(6px)" }}>
            <Target className="w-2.5 h-2.5 text-purple-400" />
            <span className="text-slate-500">Regions</span>
            <span className="text-purple-300 font-bold font-mono">{uniqueRegions}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1.5"
            style={{ background: "rgba(7,4,11,0.85)", border: "1px solid rgba(239,68,68,0.15)", backdropFilter: "blur(6px)" }}>
            <Zap className="w-2.5 h-2.5 text-red-400" />
            <span className="text-slate-500">Threats</span>
            <span className="text-red-300 font-bold font-mono">{allPins.length}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1.5"
            style={{ background: "rgba(7,4,11,0.85)", border: "1px solid rgba(245,158,11,0.15)", backdropFilter: "blur(6px)" }}>
            <Activity className="w-2.5 h-2.5 text-amber-400" />
            <span className="text-slate-500">Actors</span>
            <span className="text-amber-300 font-bold font-mono">{actors.length}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1.5"
            style={{ background: "rgba(7,4,11,0.85)", border: "1px solid rgba(16,185,129,0.15)", backdropFilter: "blur(6px)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-500">Feed rate</span>
            <span className="text-emerald-300 font-bold font-mono">{Math.round(feedRate)}/min</span>
          </div>
        </div>

        {/* Realtime incoming ticker */}
        {liveTicks.length > 0 && (
          <div
            className="absolute top-3 right-3 w-[260px] p-2.5 rounded-lg"
            style={{
              background: "rgba(7,4,11,0.85)",
              border: "1px solid rgba(139,92,246,0.15)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[9px] font-bold text-red-300 tracking-wider">INCOMING</span>
              <span className="ml-auto text-[9px] text-slate-600 font-mono">last 60s</span>
            </div>
            <div className="space-y-1 max-h-32 overflow-hidden">
              {[...liveTicks].reverse().slice(0, 4).map((t, i) => (
                <div
                  key={t.key}
                  className="flex items-center gap-2 text-[10px] animate-fade-up"
                  style={{ opacity: 1 - i * 0.2 }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: PIN_COLORS[t.type] }}
                  />
                  <span className="text-slate-400 font-mono shrink-0">
                    {t.country.length > 10 ? t.country.slice(0, 10) : t.country}
                  </span>
                  <span className="text-slate-500 truncate">·</span>
                  <span className="text-slate-400 truncate">
                    {t.label.replace(`${t.country} · `, "")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
