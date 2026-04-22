"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getOrgId } from "@/lib/api";
import { toast } from "sonner";
import {
  Skull, Search, Loader2, RefreshCw, X, ChevronDown,
  SlidersHorizontal, Shield, Target, Code2, Cpu, Layers,
  AlertOctagon, Clock, Globe, Zap, Users, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId() },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ThreatActor {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  country?: string;
  motivation?: string;
  sophistication?: string;
  first_seen?: string;
  last_seen?: string;
  target_sectors: string[];
  techniques: string[];
  malware_used: string[];
  source: string;
  category?: "apt" | "ransomware" | "hacktivism" | "cybercrime";
  active?: boolean;
  flag?: string;
}

interface RansomwareGroup {
  name: string;
  url?: string;
  last_seen?: string;
  victim_count?: number;
  status?: string;
  country?: string;
  flag?: string;
  description?: string;
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const DEMO_ACTORS: ThreatActor[] = [
  {
    id: "apt29", name: "APT29", aliases: ["Cozy Bear", "NOBELIUM", "The Dukes", "Midnight Blizzard"],
    description: "Russian SVR-linked espionage group targeting government, think tanks, and healthcare. Known for the SolarWinds supply chain compromise and persistent phishing campaigns against diplomatic entities.",
    country: "Russia", flag: "🇷🇺", motivation: "espionage", sophistication: "5",
    first_seen: "2008", last_seen: "2026-04-15",
    target_sectors: ["Government", "Defense", "Healthcare", "Think Tanks", "Energy"],
    techniques: ["T1566", "T1059", "T1078", "T1021", "T1027", "T1055", "T1105"],
    malware_used: ["SUNBURST", "WellMess", "BEATDROP", "EnvyScout", "GraphDoor"],
    source: "MITRE ATT&CK", category: "apt", active: true,
  },
  {
    id: "apt28", name: "APT28", aliases: ["Fancy Bear", "STRONTIUM", "Sofacy", "Pawn Storm"],
    description: "Russian GRU Unit 26165 conducting cyber espionage and influence operations against NATO nations, political parties, and military targets. Responsible for DNC hack and French election interference.",
    country: "Russia", flag: "🇷🇺", motivation: "espionage",sophistication: "5",
    first_seen: "2004", last_seen: "2026-04-19",
    target_sectors: ["Government", "Military", "Political", "Defense", "Aerospace"],
    techniques: ["T1566", "T1203", "T1190", "T1091", "T1059", "T1036", "T1098"],
    malware_used: ["X-Agent", "Sofacy", "JHUHUGIT", "Zebrocy", "Komplex"],
    source: "MITRE ATT&CK", category: "apt", active: true,
  },
  {
    id: "lazarus", name: "Lazarus Group", aliases: ["HIDDEN COBRA", "ZINC", "Guardians of Peace", "APT38"],
    description: "North Korean state-sponsored group conducting financial crime, espionage, and destructive attacks. Responsible for SWIFT banking heists totaling $1B+, WannaCry ransomware, and cryptocurrency theft.",
    country: "North Korea", flag: "🇰🇵", motivation: "financial",sophistication: "5",
    first_seen: "2009", last_seen: "2026-04-20",
    target_sectors: ["Finance", "Cryptocurrency", "Defense", "Healthcare", "Media"],
    techniques: ["T1566", "T1059", "T1486", "T1041", "T1071", "T1078", "T1027"],
    malware_used: ["HERMES", "AppleJeus", "FALLCHILL", "Volgmer", "BLINDINGCAN"],
    source: "MITRE ATT&CK", category: "apt", active: true,
  },
  {
    id: "apt41", name: "APT41", aliases: ["Double Dragon", "Winnti Group", "Barium", "Axiom"],
    description: "Chinese state-sponsored group conducting both nation-state espionage and financially motivated cybercrime. Unique dual mandate targets pharma IP, government secrets, and gaming companies.",
    country: "China", flag: "🇨🇳", motivation: "espionage", sophistication: "5",
    first_seen: "2012", last_seen: "2026-04-17",
    target_sectors: ["Pharmaceutical", "Telecom", "Gaming", "Healthcare", "Government"],
    techniques: ["T1190", "T1133", "T1059", "T1078", "T1055", "T1036", "T1070"],
    malware_used: ["POISONPLUG", "ShadowPad", "KeyBoy", "Gh0st", "DUSTPAN"],
    source: "MITRE ATT&CK", category: "apt", active: true,
  },
  {
    id: "fin7", name: "FIN7", aliases: ["Carbanak", "Cobalt Group", "ITG14", "Sangria Tempest"],
    description: "Financially-motivated e-crime group targeting retail, restaurant, and hospitality sectors through sophisticated spearphishing. Responsible for $1B+ in POS and banking fraud across 100+ countries.",
    country: "Russia", flag: "🇷🇺", motivation: "financial", sophistication: "4",
    first_seen: "2015", last_seen: "2026-03-22",
    target_sectors: ["Retail", "Hospitality", "Finance", "Healthcare", "Government"],
    techniques: ["T1566", "T1059", "T1055", "T1547", "T1071", "T1219", "T1105"],
    malware_used: ["Carbanak", "BIRDWATCH", "BELLHOP", "EASYLOOK", "Cobalt Strike"],
    source: "MITRE ATT&CK", category: "cybercrime", active: true,
  },
  {
    id: "apt1", name: "APT1", aliases: ["Comment Crew", "Comment Panda", "Shanghai Group", "PLA Unit 61398"],
    description: "Chinese PLA Unit 61398 conducting large-scale intellectual property theft from US and global companies. One of the most prolific cyber espionage operations ever publicly documented.",
    country: "China", flag: "🇨🇳", motivation: "espionage", sophistication: "4",
    first_seen: "2006", last_seen: "2015-05-01",
    target_sectors: ["Aerospace", "Energy", "Finance", "IT", "Telecom"],
    techniques: ["T1566", "T1078", "T1059", "T1041", "T1083", "T1005", "T1048"],
    malware_used: ["WEBC2", "BISCUIT", "COOKFACE", "GREENCAT", "MAPIGET"],
    source: "MITRE ATT&CK", category: "apt", active: false,
  },
  {
    id: "charming-kitten", name: "Charming Kitten", aliases: ["APT35", "Phosphorus", "MINT SANDSTORM", "NewsBeef"],
    description: "Iranian IRGC-linked group conducting espionage against dissidents, journalists, human rights activists, and government targets through credential harvesting and social engineering.",
    country: "Iran", flag: "🇮🇷", motivation: "espionage", sophistication: "3",
    first_seen: "2014", last_seen: "2026-04-10",
    target_sectors: ["Government", "Think Tanks", "Journalism", "Telecom", "Defense"],
    techniques: ["T1566", "T1598", "T1078", "T1534", "T1036", "T1071", "T1041"],
    malware_used: ["POWERSTAR", "CharmPower", "GhostEcho", "BASICSTAR", "NokNok"],
    source: "MITRE ATT&CK", category: "apt", active: true,
  },
  {
    id: "sandworm", name: "Sandworm Team", aliases: ["Voodoo Bear", "ELECTRUM", "Quedagh", "Iron Viking"],
    description: "Russian GRU Unit 74455 responsible for destructive cyberattacks including NotPetya, Ukrainian power grid attacks, and Olympic Destroyer. Among the most destructive nation-state actors.",
    country: "Russia", flag: "🇷🇺", motivation: "destruction", sophistication: "5",
    first_seen: "2009", last_seen: "2026-04-08",
    target_sectors: ["Energy", "Government", "Critical Infrastructure", "Defense", "Media"],
    techniques: ["T1486", "T1059", "T1190", "T1078", "T1071", "T1565", "T1498"],
    malware_used: ["NotPetya", "BlackEnergy", "Industroyer", "GreyEnergy", "Cyclops Blink"],
    source: "MITRE ATT&CK", category: "apt", active: true,
  },
  {
    id: "muddywater", name: "MuddyWater", aliases: ["Static Kitten", "MERCURY", "TEMP.Zagros", "Mango Sandstorm"],
    description: "Iranian Ministry of Intelligence group targeting Middle Eastern government and telecom entities. Uses custom malware and legitimate remote admin tools to establish persistent access.",
    country: "Iran", flag: "🇮🇷", motivation: "espionage", sophistication: "3",
    first_seen: "2017", last_seen: "2026-02-14",
    target_sectors: ["Government", "Telecom", "Healthcare", "Defense", "Energy"],
    techniques: ["T1566", "T1059", "T1105", "T1036", "T1078", "T1071", "T1219"],
    malware_used: ["POWERSTATS", "Mori", "STARWHALE", "CANOPY", "Small Sieve"],
    source: "MITRE ATT&CK", category: "apt", active: true,
  },
  {
    id: "scattered-spider", name: "Scattered Spider", aliases: ["UNC3944", "Roasted 0ktapus", "Storm-0875", "Muddled Libra"],
    description: "English-speaking cybercriminal group using social engineering and SIM swapping. Responsible for MGM Resorts and Caesars Entertainment breaches, causing $100M+ in damages.",
    country: "Unknown", flag: "🌐", motivation: "financial", sophistication: "3",
    first_seen: "2022", last_seen: "2026-04-01",
    target_sectors: ["Hospitality", "Retail", "Finance", "Technology", "Gaming"],
    techniques: ["T1598", "T1621", "T1556", "T1078", "T1486", "T1657", "T1059"],
    malware_used: ["ALPHV", "Cobalt Strike", "ScreenConnect", "AnyDesk"],
    source: "CrowdStrike", category: "cybercrime", active: true,
  },
  {
    id: "turla", name: "Turla", aliases: ["Snake", "Uroburos", "Waterbug", "Krypton"],
    description: "FSB-linked Russian espionage group known for extraordinary technical sophistication, including satellite-based C2 and compromising other nation-state actors' infrastructure.",
    country: "Russia", flag: "🇷🇺", motivation: "espionage", sophistication: "5",
    first_seen: "2004", last_seen: "2026-03-30",
    target_sectors: ["Government", "Military", "Defense", "Diplomatic", "Research"],
    techniques: ["T1190", "T1059", "T1055", "T1071", "T1027", "T1036", "T1078"],
    malware_used: ["Snake", "Kazuar", "HyperStack", "COMRat", "ANDROMEDA"],
    source: "MITRE ATT&CK", category: "apt", active: true,
  },
  {
    id: "anonymous-sudan", name: "Anonymous Sudan", aliases: ["Storm-1359"],
    description: "Hacktivism group conducting high-volume DDoS campaigns against Western infrastructure under the guise of geopolitical protest. Suspected ties to Killnet.",
    country: "Sudan", flag: "🇸🇩", motivation: "ideology", sophistication: "2",
    first_seen: "2023", last_seen: "2026-04-05",
    target_sectors: ["Government", "Finance", "Healthcare", "Media", "Education"],
    techniques: ["T1498", "T1499", "T1583"],
    malware_used: ["Godzilla Botnet", "SLOWLORIS"],
    source: "Mandiant", category: "hacktivism", active: true,
  },
  {
    id: "killnet", name: "KillNet", aliases: ["KillMilk"],
    description: "Russian-linked hacktivist collective conducting DDoS attacks against NATO nations in support of Russian geopolitical objectives since the Ukraine invasion.",
    country: "Russia", flag: "🇷🇺", motivation: "ideology", sophistication: "2",
    first_seen: "2022", last_seen: "2026-03-20",
    target_sectors: ["Government", "Healthcare", "Finance", "Defense", "Media"],
    techniques: ["T1498", "T1499"],
    malware_used: ["Custom DDoS tools"],
    source: "CISA", category: "hacktivism", active: false,
  },
  {
    id: "silence", name: "Silence Group", aliases: ["WHISPER SPIDER"],
    description: "Russian-speaking financially motivated group targeting banks and financial institutions through sophisticated ATM jackpotting and unauthorized wire transfers.",
    country: "Russia", flag: "🇷🇺", motivation: "financial", sophistication: "4",
    first_seen: "2016", last_seen: "2025-11-10",
    target_sectors: ["Finance", "Banking", "Retail"],
    techniques: ["T1566", "T1059", "T1547", "T1078", "T1041", "T1105", "T1486"],
    malware_used: ["Silence", "TrueBot", "FlawedGrace"],
    source: "Group-IB", category: "cybercrime", active: false,
  },
];

const DEMO_RANSOMWARE: RansomwareGroup[] = [
  { name: "LockBit 3.0", last_seen: "2026-04-21", victim_count: 2847, status: "active", country: "Russia", flag: "🇷🇺", url: "lockbit3753b.onion", description: "Most prolific ransomware-as-a-service. Sophisticated affiliate model." },
  { name: "ALPHV/BlackCat", last_seen: "2026-04-20", victim_count: 1092, status: "active", country: "Unknown", flag: "🌐", url: "alphvmmm4y6y5sc.onion", description: "Rust-based RaaS with triple extortion. High value targets." },
  { name: "Play", last_seen: "2026-04-20", victim_count: 456, status: "active", country: "Unknown", flag: "🌐", url: "playb1og3k2nq.onion", description: "Targets SMBs and government. No decryptor publicly available." },
  { name: "Akira", last_seen: "2026-04-19", victim_count: 389, status: "active", country: "Russia", flag: "🇷🇺", url: "akiraifon4kf.onion", description: "Retro-themed ransomware with rapid victim growth since 2023." },
  { name: "Medusa Blog", last_seen: "2026-04-18", victim_count: 311, status: "active", country: "Unknown", flag: "🌐", url: "medusaw6hjj.onion", description: "Data leak extortion with countdown timers on victim data." },
  { name: "8Base", last_seen: "2026-04-17", victim_count: 278, status: "active", country: "Unknown", flag: "🌐", url: "8base4m3k.onion", description: "Emerged 2023, targets SMBs. Possible Phobos variant." },
  { name: "BlackBasta", last_seen: "2026-04-15", victim_count: 512, status: "active", country: "Russia", flag: "🇷🇺", url: "blackbastaa.onion", description: "Ex-Conti members. High-value targets in critical infrastructure." },
  { name: "Royal", last_seen: "2026-04-10", victim_count: 202, status: "intermittent", country: "Unknown", flag: "🌐", url: "royalhq2p.onion", description: "Rebranding suspected. Advanced encryption, double extortion." },
  { name: "Cl0p", last_seen: "2026-04-08", victim_count: 389, status: "intermittent", country: "Russia", flag: "🇷🇺", url: "clop2cjvd.onion", description: "Known for mass exploitation of zero-days (MOVEit, GoAnywhere)." },
  { name: "RansomHub", last_seen: "2026-04-21", victim_count: 603, status: "active", country: "Unknown", flag: "🌐", url: "ransomhub7p.onion", description: "Fastest-growing RaaS platform. Suspected former ALPHV affiliates." },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "apt", label: "APT Groups", icon: Shield },
  { id: "ransomware", label: "Ransomware", icon: Skull },
  { id: "hacktivism", label: "Hacktivism", icon: Globe },
  { id: "cybercrime", label: "Cyber Crime", icon: AlertOctagon },
] as const;

const COUNTRY_COLORS: Record<string, string> = {
  Russia: "#ef4444", China: "#f97316", "North Korea": "#a855f7",
  Iran: "#eab308", Unknown: "#64748b", Sudan: "#10b981",
};

const MOTIVATION_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  espionage:       { label: "Espionage",       color: "text-purple-300", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  financial:       { label: "Financial",       color: "text-yellow-300", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  ideology:        { label: "Ideology",        color: "text-blue-300",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
  destruction:     { label: "Destruction",     color: "text-red-300",    bg: "bg-red-500/10",    border: "border-red-500/20" },
  "state-sponsored": { label: "State-Sponsored", color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/20" },
};

const SECTORS = ["Finance", "Healthcare", "Government", "Energy", "Defense", "Telecom", "Retail", "Critical Infrastructure"];

const TACTICS = [
  { id: "T15xx", label: "Initial Access", count: 14 },
  { id: "T10xx", label: "Execution", count: 12 },
  { id: "T10xx-2", label: "Persistence", count: 11 },
  { id: "T10xx-3", label: "Priv Escalation", count: 9 },
  { id: "T10xx-4", label: "Defense Evasion", count: 13 },
  { id: "T10xx-5", label: "Credential Access", count: 8 },
  { id: "T10xx-6", label: "Lateral Movement", count: 10 },
  { id: "T14xx", label: "Exfiltration", count: 11 },
  { id: "T14xx-2", label: "Impact", count: 7 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function sophDots(level: string | undefined) {
  const n = parseInt(level || "3", 10);
  return Array.from({ length: 5 }, (_, i) => (
    <div
      key={i}
      className="w-2 h-2 rounded-full transition-all"
      style={{
        background: i < n ? (n >= 5 ? "#ef4444" : n >= 4 ? "#f97316" : n >= 3 ? "#eab308" : "#3b82f6") : "rgba(255,255,255,0.06)",
        boxShadow: i < n ? `0 0 4px ${n >= 5 ? "#ef4444" : n >= 4 ? "#f97316" : "#eab308"}` : "none",
      }}
    />
  ));
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/20 text-yellow-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function ActorDrawer({ actor, onClose }: { actor: ThreatActor; onClose: () => void }) {
  const [drawerTab, setDrawerTab] = useState<"overview" | "ttps" | "malware" | "iocs">("overview");
  const motiv = MOTIVATION_CONFIG[actor.motivation || "espionage"] || MOTIVATION_CONFIG.espionage;
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-xl h-full overflow-y-auto animate-slide-in flex flex-col"
        style={{ background: "#0d0a14", borderLeft: "1px solid rgba(139,92,246,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 py-5 sticky top-0 z-10"
          style={{ background: "linear-gradient(180deg,#0d0a14 80%,transparent)", borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                {actor.flag || "🌐"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{actor.name}</h2>
                  <div className={cn("w-2 h-2 rounded-full", actor.active ? "bg-red-400" : "bg-slate-600")}
                    style={{ boxShadow: actor.active ? "0 0 8px #ef4444" : "none" }} />
                  <span className={cn("text-[10px] font-semibold", actor.active ? "text-red-400" : "text-slate-500")}>
                    {actor.active ? "ACTIVE" : "DORMANT"}
                  </span>
                </div>
                {actor.aliases?.length > 0 && (
                  <p className="text-[11px] text-slate-500 mt-0.5">AKA: {actor.aliases.slice(0, 3).join(" · ")}</p>
                )}
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold border", motiv.color, motiv.bg, motiv.border)}>
              {motiv.label}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/[0.04] text-slate-400 border border-white/[0.06]">
              {actor.country}
            </span>
            <div className="flex items-center gap-1 ml-auto">
              {sophDots(actor.sophistication)}
            </div>
          </div>
        </div>

        {/* Drawer Tabs */}
        <div className="flex gap-0.5 px-6 border-b" style={{ borderColor: "rgba(139,92,246,0.08)" }}>
          {(["overview", "ttps", "malware", "iocs"] as const).map((t) => (
            <button key={t} onClick={() => setDrawerTab(t)}
              className={cn(
                "relative px-3 h-9 text-xs font-medium transition-all capitalize",
                drawerTab === t ? "text-white" : "text-slate-500 hover:text-slate-300"
              )}>
              {t === "ttps" ? "TTPs" : t === "iocs" ? "IOCs" : t.charAt(0).toUpperCase() + t.slice(1)}
              {drawerTab === t && (
                <div className="absolute left-0 right-0 bottom-[-1px] h-[2px] rounded-full"
                  style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
              )}
            </button>
          ))}
        </div>

        {/* Drawer Content */}
        <div className="px-6 py-5 flex-1 space-y-5">
          {drawerTab === "overview" && (
            <>
              <p className="text-sm text-slate-400 leading-relaxed">{actor.description}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "First Seen", value: actor.first_seen || "Unknown", icon: Clock },
                  { label: "Last Active", value: actor.last_seen ? timeAgo(actor.last_seen) : "Unknown", icon: Zap },
                  { label: "Country", value: actor.country || "Unknown", icon: Globe },
                  { label: "Source", value: actor.source, icon: Shield },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="stat-card p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3 h-3 text-slate-500" />
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
                    </div>
                    <p className="text-sm text-slate-200 font-medium">{value}</p>
                  </div>
                ))}
              </div>
              {actor.target_sectors?.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Target Sectors</p>
                  <div className="flex flex-wrap gap-1.5">
                    {actor.target_sectors.map((s) => (
                      <span key={s} className="px-2 py-1 rounded-md text-[11px] text-slate-300 bg-white/[0.04] border border-white/[0.06]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {drawerTab === "ttps" && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">MITRE ATT&CK Techniques</p>
              <div className="grid grid-cols-2 gap-2">
                {(actor.techniques?.length > 0 ? actor.techniques : ["T1566", "T1059", "T1486"]).map((t) => (
                  <div key={t} className="flex items-center gap-2 p-2.5 rounded-lg"
                    style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.1)" }}>
                    <Code2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <span className="text-xs font-mono text-red-300 font-semibold">{t}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-600 mt-3">
                {actor.techniques?.length || 0} techniques documented · Source: MITRE ATT&CK
              </p>
            </div>
          )}
          {drawerTab === "malware" && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Associated Malware & Tools</p>
              <div className="space-y-2">
                {(actor.malware_used?.length > 0 ? actor.malware_used : ["Unknown"]).map((m) => (
                  <div key={m} className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.1)" }}>
                    <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-sm text-purple-300 font-semibold">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {drawerTab === "iocs" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Layers className="w-10 h-10 text-slate-700" />
              <p className="text-sm text-slate-400">IOC data requires threat intelligence integration.</p>
              <button className="text-xs text-purple-300 hover:underline">Connect TI Feed</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ThreatActorsPage() {
  const [apiActors, setApiActors] = useState<ThreatActor[]>([]);
  const [apiRansomware, setApiRansomware] = useState<RansomwareGroup[]>([]);
  const [recentVictims, setRecentVictims] = useState<any[]>([]);
  const [ransomStats, setRansomStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"apt" | "ransomware" | "hacktivism" | "cybercrime">("apt");
  const [selectedActor, setSelectedActor] = useState<ThreatActor | null>(null);
  const [countryFilter, setCountryFilter] = useState("all");
  const [motivationFilter, setMotivationFilter] = useState("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchActors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const data = await apiFetch(`/api/v1/threat-actors/?${params}`);
      setApiActors(data.data || []);
    } catch { setApiActors([]); } finally { setLoading(false); }
  }, [search]);

  const fetchRansomware = useCallback(async () => {
    try {
      const [groups, victims, stats] = await Promise.all([
        apiFetch("/api/v1/threat-actors/ransomware"),
        apiFetch("/api/v1/threat-actors/ransomware/victims/recent?limit=30"),
        apiFetch("/api/v1/threat-actors/ransomware/stats"),
      ]);
      setApiRansomware(groups?.data || []);
      setRecentVictims(victims?.data || []);
      setRansomStats(stats || null);
    } catch {
      setApiRansomware([]);
      setRecentVictims([]);
      setRansomStats(null);
    }
  }, []);

  const syncActors = async () => {
    setSyncing(true);
    try {
      await apiFetch("/api/v1/threat-actors/sync");
      toast.success("Syncing MITRE ATT&CK data…");
      setTimeout(fetchActors, 5000);
    } catch { toast.error("Sync failed"); } finally { setSyncing(false); }
  };

  useEffect(() => { fetchActors(); fetchRansomware(); }, [fetchActors, fetchRansomware]);

  // Use demo data when API empty
  const actors = apiActors.length > 0 ? apiActors : DEMO_ACTORS;
  const ransomware = apiRansomware.length > 0 ? apiRansomware : DEMO_RANSOMWARE;

  // Tab counts
  const tabCounts = useMemo(() => ({
    apt: actors.filter((a) => a.category === "apt" || !a.category).length,
    ransomware: ransomware.length,
    hacktivism: actors.filter((a) => a.category === "hacktivism").length,
    cybercrime: actors.filter((a) => a.category === "cybercrime").length,
  }), [actors, ransomware]);

  // Filtered actors for current tab
  const filteredActors = useMemo(() => {
    let list = actors.filter((a) => {
      if (activeTab === "apt") return a.category === "apt" || !a.category;
      return a.category === activeTab;
    });
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.aliases?.some((al) => al.toLowerCase().includes(q)) ||
        a.description?.toLowerCase().includes(q)
      );
    }
    if (countryFilter !== "all") list = list.filter((a) => a.country === countryFilter);
    if (motivationFilter !== "all") list = list.filter((a) => a.motivation === motivationFilter);
    if (activeOnly) list = list.filter((a) => a.active);
    return list;
  }, [actors, activeTab, search, countryFilter, motivationFilter, activeOnly]);

  // Country breakdown for chart
  const countryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    actors.forEach((a) => { const c = a.country || "Unknown"; map[c] = (map[c] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [actors]);

  const maxCountry = countryCounts[0]?.[1] || 1;

  // Sector heatmap
  const sectorCounts = useMemo(() => {
    const map: Record<string, number> = {};
    SECTORS.forEach((s) => { map[s] = 0; });
    actors.forEach((a) => a.target_sectors?.forEach((s) => { if (map[s] !== undefined) map[s]++; }));
    return map;
  }, [actors]);
  const maxSector = Math.max(...Object.values(sectorCounts), 1);

  // Sophistication distribution
  const sophDist = useMemo(() => {
    const map: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    actors.forEach((a) => { const s = a.sophistication || "3"; if (map[s] !== undefined) map[s]++; });
    return map;
  }, [actors]);
  const sophTotal = Object.values(sophDist).reduce((a, b) => a + b, 0) || 1;

  const uniqueCountries = [...new Set(actors.map((a) => a.country).filter(Boolean))] as string[];

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,rgba(239,68,68,0.15),rgba(168,85,247,0.12))", border: "1px solid rgba(239,68,68,0.25)" }}>
            <Skull className="w-5 h-5 text-red-300" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse"
              style={{ boxShadow: "0 0 10px #ef4444" }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Threat Actors</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/[0.08] border border-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[10px] text-red-300 font-semibold tracking-wider">LIVE</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              MITRE ATT&CK · Mandiant · CrowdStrike · {actors.length} actors tracked
            </p>
          </div>
        </div>
        <button
          onClick={syncActors}
          disabled={syncing}
          className="h-9 px-4 rounded-lg text-sm font-semibold text-white btn-brand flex items-center gap-2 disabled:opacity-60"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync MITRE ATT&CK
        </button>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "APT Groups", value: tabCounts.apt, accent: "#ef4444" },
          { label: "Ransomware Groups", value: tabCounts.ransomware, accent: "#f97316" },
          { label: "Active Threats", value: actors.filter((a) => a.active).length, accent: "#a855f7", spark: true },
          { label: "Countries Tracked", value: uniqueCountries.length, accent: "#3b82f6" },
        ].map((s, i) => (
          <div key={i} className="stat-card p-4 relative overflow-hidden">
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-semibold">{s.label}</p>
            <p className="text-[26px] font-bold font-mono text-white leading-none mt-2">{s.value}</p>
            {s.spark && (
              <svg className="absolute bottom-0 right-0 w-24 h-8 opacity-50" viewBox="0 0 100 32" preserveAspectRatio="none">
                <path d="M0 25 L12 20 L25 22 L35 15 L50 17 L60 10 L75 12 L85 7 L100 9 L100 32 L0 32 Z" fill={`${s.accent}33`} />
                <path d="M0 25 L12 20 L25 22 L35 15 L50 17 L60 10 L75 12 L85 7 L100 9" stroke={s.accent} strokeWidth="1.5" fill="none" />
              </svg>
            )}
            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: s.accent, boxShadow: `0 0 8px ${s.accent}` }} />
          </div>
        ))}
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="card-enterprise p-3 md:p-4">
        <div className="flex gap-2 items-stretch flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actors, aliases, TTPs…"
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/[0.02] border border-purple-500/[0.08] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/25 transition-all"
            />
          </div>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="h-10 px-3 rounded-lg bg-white/[0.02] border border-purple-500/[0.08] text-sm text-slate-300 focus:outline-none focus:border-purple-500/25 transition-all"
          >
            <option value="all">All Countries</option>
            {uniqueCountries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={motivationFilter}
            onChange={(e) => setMotivationFilter(e.target.value)}
            className="h-10 px-3 rounded-lg bg-white/[0.02] border border-purple-500/[0.08] text-sm text-slate-300 focus:outline-none focus:border-purple-500/25 transition-all"
          >
            <option value="all">All Motivations</option>
            <option value="espionage">Espionage</option>
            <option value="financial">Financial</option>
            <option value="ideology">Ideology</option>
            <option value="destruction">Destruction</option>
          </select>
          <button
            onClick={() => setActiveOnly(!activeOnly)}
            className={cn(
              "h-10 px-4 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              activeOnly
                ? "text-red-300 bg-red-500/10 border border-red-500/25"
                : "text-slate-400 bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/25 hover:text-white"
            )}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", activeOnly ? "bg-red-400 animate-pulse" : "bg-slate-600")} />
            Active Only
          </button>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="h-10 px-3 rounded-lg text-slate-400 bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/25 hover:text-white transition-all flex items-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 border-b" style={{ borderColor: "rgba(139,92,246,0.08)" }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const count = tabCounts[id];
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "relative px-4 h-10 flex items-center gap-2 text-sm font-medium transition-all",
                activeTab === id ? "text-white" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count > 0 && (
                <span className={cn(
                  "px-1.5 min-w-[20px] h-4 rounded text-[9px] font-bold flex items-center justify-center",
                  activeTab === id ? "bg-purple-500/20 text-purple-300" : "bg-white/[0.04] text-slate-500"
                )}>{count}</span>
              )}
              {activeTab === id && (
                <div className="absolute left-0 right-0 bottom-[-1px] h-[2px] rounded-full"
                  style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── 2-col layout ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* ── LEFT: Actor Grid ──────────────────────────────────────────────── */}
        <div className="xl:col-span-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-red-400" />
              <p className="text-xs text-slate-500">Loading threat intelligence…</p>
            </div>
          ) : activeTab === "ransomware" ? (
            <div className="space-y-4">
              {/* Ransomware.live realtime strip */}
              {(ransomStats?.stats || recentVictims.length > 0) && (
                <div className="card-enterprise p-4 relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg,rgba(239,68,68,0.06),rgba(236,72,153,0.04))" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      <span className="text-[10px] font-bold text-red-300 tracking-wider">LIVE · ransomware.live</span>
                    </div>
                    <span className="text-[10px] text-slate-500">refreshed every 15 min</span>
                  </div>
                  {ransomStats?.stats && (
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Tracked victims</p>
                        <p className="text-xl font-bold font-mono text-red-300 mt-0.5">
                          {(ransomStats.stats.victims || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Active groups</p>
                        <p className="text-xl font-bold font-mono text-orange-300 mt-0.5">
                          {(ransomStats.stats.groups || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Press releases</p>
                        <p className="text-xl font-bold font-mono text-pink-300 mt-0.5">
                          {(ransomStats.stats.press || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                  {recentVictims.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                          Latest victim posts
                        </p>
                        <span className="text-[10px] text-slate-600">{recentVictims.length} new</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                        {recentVictims.slice(0, 12).map((v, i) => (
                          <a
                            key={i}
                            href={v.post_url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-red-500/20 transition-all"
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-200 truncate">{v.victim}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-[9.5px] font-bold text-red-300 uppercase tracking-wider">{v.group}</span>
                                  {v.country && (
                                    <span className="text-[9.5px] text-slate-500 font-mono">{v.country}</span>
                                  )}
                                  {v.activity && (
                                    <span className="text-[9.5px] text-slate-500 truncate">{v.activity}</span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[9px] text-slate-600 whitespace-nowrap">{timeAgo(v.discovered)}</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ransomware.map((group, i) => (
                <div key={i} className="card-enterprise p-4 group cursor-pointer relative overflow-hidden transition-all"
                  style={{ "--hover-border": "rgba(239,68,68,0.25)" } as React.CSSProperties}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(239,68,68,0.25)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.08)")}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{group.flag || "🌐"}</span>
                      <div>
                        <p className="text-sm font-bold text-white leading-none">
                          {search ? highlightMatch(group.name, search) : group.name}
                        </p>
                        {group.country && <p className="text-[10px] text-slate-600 mt-0.5">{group.country}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold font-mono text-red-400 leading-none">{(group.victim_count || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-600">victims</p>
                    </div>
                  </div>
                  {group.description && (
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-2">{group.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full", group.status === "active" ? "bg-red-400 animate-pulse" : "bg-yellow-400")}
                        style={{ boxShadow: group.status === "active" ? "0 0 6px #ef4444" : "0 0 6px #eab308" }} />
                      <span className={cn("text-[10px] font-semibold capitalize", group.status === "active" ? "text-red-400" : "text-yellow-400")}>
                        {group.status || "unknown"}
                      </span>
                    </div>
                    {group.last_seen && (
                      <span className="text-[10px] text-slate-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{timeAgo(group.last_seen)}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "linear-gradient(90deg,transparent,#ef4444,transparent)" }} />
                </div>
              ))}
              </div>
            </div>
          ) : filteredActors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 card-enterprise">
              <Shield className="w-10 h-10 text-slate-700" />
              <p className="text-sm text-slate-400">No actors match your filters.</p>
              <button onClick={() => { setSearch(""); setCountryFilter("all"); setMotivationFilter("all"); setActiveOnly(false); }}
                className="text-xs text-purple-300 hover:underline">Clear filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredActors.map((actor) => {
                const motiv = MOTIVATION_CONFIG[actor.motivation || "espionage"] || MOTIVATION_CONFIG.espionage;
                return (
                  <div
                    key={actor.id}
                    onClick={() => setSelectedActor(actor)}
                    className="card-enterprise p-4 group cursor-pointer relative overflow-hidden transition-all"
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.25)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.08)")}
                  >
                    {/* Actor name + flag row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{actor.flag || "🌐"}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-white leading-none truncate">
                              {search ? highlightMatch(actor.name, search) : actor.name}
                            </p>
                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", actor.active ? "bg-red-400" : "bg-slate-600")}
                              style={{ boxShadow: actor.active ? "0 0 6px #ef4444" : "none" }} />
                          </div>
                          {actor.aliases?.length > 0 && (
                            <p className="text-[10px] text-slate-600 mt-0.5 truncate">
                              AKA {actor.aliases.slice(0, 2).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Sophistication dots */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {sophDots(actor.sophistication)}
                      </div>
                    </div>

                    {/* Motivation chip */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-semibold border", motiv.color, motiv.bg, motiv.border)}>
                        {motiv.label}
                      </span>
                      {actor.last_seen && (
                        <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{timeAgo(actor.last_seen)}
                        </span>
                      )}
                    </div>

                    {/* Target sectors */}
                    {actor.target_sectors?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {actor.target_sectors.slice(0, 3).map((s) => (
                          <span key={s} className="px-1.5 py-0.5 rounded text-[9px] text-slate-500 bg-white/[0.03] border border-white/[0.05]">
                            {s}
                          </span>
                        ))}
                        {actor.target_sectors.length > 3 && (
                          <span className="text-[9px] text-slate-600">+{actor.target_sectors.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* TTPs */}
                    {actor.techniques?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {actor.techniques.slice(0, 3).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-mono text-red-400 bg-red-500/[0.08] border border-red-500/10">
                            {t}
                          </span>
                        ))}
                        {actor.techniques.length > 3 && (
                          <span className="text-[9px] text-slate-600 font-mono">+{actor.techniques.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-3 pointer-events-none"
                      style={{ background: "linear-gradient(135deg,transparent 60%,rgba(139,92,246,0.08))" }}>
                      <span className="flex items-center gap-1 text-[10px] text-purple-300 font-semibold">
                        View profile <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>

                    {/* Bottom glow */}
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "linear-gradient(90deg,transparent,#8b5cf6,#ec4899,transparent)" }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: Analytics ──────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Country Breakdown */}
          <div className="card-enterprise p-4">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">Country Breakdown</p>
            </div>
            <div className="space-y-2.5">
              {countryCounts.map(([country, count]) => (
                <div key={country}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      {DEMO_ACTORS.find((a) => a.country === country)?.flag || "🌐"} {country}
                    </span>
                    <span className="text-[11px] font-bold font-mono text-slate-300">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(count / maxCountry) * 100}%`,
                        background: `linear-gradient(90deg, ${COUNTRY_COLORS[country] || "#a855f7"}, ${COUNTRY_COLORS[country] || "#a855f7"}88)`,
                        boxShadow: `0 0 6px ${COUNTRY_COLORS[country] || "#a855f7"}44`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sophistication Distribution */}
          <div className="card-enterprise p-4">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">Sophistication</p>
            </div>
            <div className="flex items-end justify-between gap-1 h-16">
              {Object.entries(sophDist).map(([level, count]) => {
                const colors = ["#3b82f6", "#10b981", "#eab308", "#f97316", "#ef4444"];
                const color = colors[parseInt(level) - 1];
                const pct = count / sophTotal;
                return (
                  <div key={level} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold font-mono" style={{ color }}>{count}</span>
                    <div className="w-full rounded-t-sm transition-all duration-700"
                      style={{ height: `${Math.max(pct * 52, 4)}px`, background: color, opacity: 0.7 + pct * 0.3 }} />
                    <span className="text-[9px] text-slate-600">L{level}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sector Heatmap */}
          <div className="card-enterprise p-4">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-3.5 h-3.5 text-orange-400" />
              <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">Sector Heatmap</p>
            </div>
            <div className="space-y-1.5">
              {SECTORS.map((sector) => {
                const count = sectorCounts[sector] || 0;
                const intensity = count / maxSector;
                return (
                  <div key={sector} className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 w-[130px] shrink-0 truncate">{sector}</span>
                    <div className="flex-1 h-5 rounded overflow-hidden flex items-center"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.03)" }}>
                      <div
                        className="h-full rounded transition-all duration-700"
                        style={{
                          width: `${Math.max(intensity * 100, count > 0 ? 8 : 0)}%`,
                          background: `linear-gradient(90deg, rgba(239,68,68,${0.2 + intensity * 0.7}), rgba(249,115,22,${0.15 + intensity * 0.6}))`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-bold font-mono text-slate-500 w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MITRE Tactic Coverage */}
          <div className="card-enterprise p-4">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">MITRE Tactic Coverage</p>
            </div>
            <div className="space-y-2">
              {TACTICS.map((tactic) => {
                const pct = (tactic.count / 15) * 100;
                return (
                  <div key={tactic.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-500">{tactic.label}</span>
                      <span className="text-[10px] font-bold font-mono text-slate-400">{tactic.count}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: "linear-gradient(90deg,#3b82f6,#8b5cf6)",
                          boxShadow: "0 0 4px rgba(59,130,246,0.3)",
                        }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card-enterprise p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">Intel Summary</p>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "State-sponsored", value: actors.filter((a) => a.motivation === "espionage").length, color: "#a855f7" },
                { label: "Financially motivated", value: actors.filter((a) => a.motivation === "financial").length, color: "#eab308" },
                { label: "Ideologically driven", value: actors.filter((a) => a.motivation === "ideology").length, color: "#3b82f6" },
                { label: "Destructive", value: actors.filter((a) => a.motivation === "destruction").length, color: "#ef4444" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: row.color, boxShadow: `0 0 6px ${row.color}` }} />
                    <span className="text-[11px] text-slate-500">{row.label}</span>
                  </div>
                  <span className="text-[11px] font-bold font-mono" style={{ color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Drawer ──────────────────────────────────────────────────────────── */}
      {selectedActor && (
        <ActorDrawer actor={selectedActor} onClose={() => setSelectedActor(null)} />
      )}
    </div>
  );
}
