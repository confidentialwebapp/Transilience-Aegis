// Curated list of well-documented public APT groups — sourced from MITRE
// ATT&CK Groups, Mandiant, Microsoft Threat Intelligence, and CrowdStrike
// adversary universe. All attribution information is publicly disclosed.
//
// Data shape matches what GlobalThreatMap consumes:
//   { name, country, motivation, aliases? }
// motivation keywords are matched by GlobalThreatMap to pick pin colour:
//   "financial"/"ransom" → ransomware (red)
//   "espionage"/"state"/"nation" → APT (cyan)
//   "hack"/"ideolog"/"politic" → hacktivism (amber)
//   anything else → darkweb (purple)

export type AptActor = {
  name: string;
  country: string;
  motivation: string;
  aliases?: string[];
  first_seen?: string;
  targets?: string[];
};

export const APT_ACTORS: AptActor[] = [
  // ── Russia ──
  { name: "APT28",       country: "Russia",        motivation: "espionage state",     aliases: ["Fancy Bear", "Sofacy", "Sednit", "STRONTIUM"], first_seen: "2007", targets: ["government", "defence", "media"] },
  { name: "APT29",       country: "Russia",        motivation: "espionage state",     aliases: ["Cozy Bear", "Nobelium", "MIDNIGHT BLIZZARD"], first_seen: "2008", targets: ["government", "think-tanks", "supply chain"] },
  { name: "Sandworm",    country: "Russia",        motivation: "espionage state hacktivism", aliases: ["VOODOO BEAR", "TeleBots", "Iron Viking"], first_seen: "2009", targets: ["energy", "ICS", "Ukraine"] },
  { name: "Turla",       country: "Russia",        motivation: "espionage state",     aliases: ["Snake", "Venomous Bear", "Uroburos"], first_seen: "2004", targets: ["diplomatic", "research"] },
  { name: "Gamaredon",   country: "Russia",        motivation: "espionage state",     aliases: ["Primitive Bear", "ACTINIUM"], first_seen: "2013", targets: ["Ukraine government"] },

  // ── China ──
  { name: "APT1",        country: "China",         motivation: "espionage state",     aliases: ["Comment Crew", "PLA Unit 61398"], first_seen: "2006", targets: ["IP theft", "industrial"] },
  { name: "APT10",       country: "China",         motivation: "espionage state",     aliases: ["Stone Panda", "MenuPass", "POTASSIUM"], first_seen: "2009", targets: ["MSP", "cloud"] },
  { name: "APT41",       country: "China",         motivation: "espionage financial",  aliases: ["Wicked Panda", "BARIUM", "Winnti"], first_seen: "2012", targets: ["healthcare", "telecom", "gaming"] },
  { name: "Mustang Panda", country: "China",      motivation: "espionage state",     aliases: ["RedDelta", "BRONZE PRESIDENT", "Earth Preta"], first_seen: "2017", targets: ["NGOs", "South-East Asia"] },
  { name: "APT40",       country: "China",         motivation: "espionage state",     aliases: ["Leviathan", "TEMP.Periscope"], first_seen: "2013", targets: ["maritime", "academia"] },
  { name: "Volt Typhoon", country: "China",       motivation: "espionage state",     aliases: ["VANGUARD PANDA", "BRONZE SILHOUETTE"], first_seen: "2021", targets: ["critical infrastructure", "telecom"] },

  // ── North Korea ──
  { name: "Lazarus",     country: "North Korea",   motivation: "financial state",     aliases: ["Hidden Cobra", "ZINC", "DIAMOND SLEET"], first_seen: "2009", targets: ["banks", "crypto exchanges"] },
  { name: "APT38",       country: "North Korea",   motivation: "financial state",     aliases: ["BlueNoroff", "Stardust Chollima"], first_seen: "2014", targets: ["SWIFT", "banks"] },
  { name: "Kimsuky",     country: "North Korea",   motivation: "espionage state",     aliases: ["Velvet Chollima", "Black Banshee", "EMERALD SLEET"], first_seen: "2012", targets: ["South Korea", "policy researchers"] },
  { name: "Andariel",    country: "North Korea",   motivation: "espionage financial",  aliases: ["Silent Chollima", "Stonefly"], first_seen: "2015", targets: ["defence", "nuclear"] },

  // ── Iran ──
  { name: "APT33",       country: "Iran",          motivation: "espionage state",     aliases: ["Elfin", "MAGNESIUM", "Refined Kitten"], first_seen: "2013", targets: ["aerospace", "energy"] },
  { name: "APT34",       country: "Iran",          motivation: "espionage state",     aliases: ["OilRig", "HelixKitten", "EUROPIUM"], first_seen: "2014", targets: ["telecom", "government"] },
  { name: "MuddyWater",  country: "Iran",          motivation: "espionage state",     aliases: ["MERCURY", "Static Kitten", "Boggy Serpens"], first_seen: "2017", targets: ["telecom", "government"] },
  { name: "APT35",       country: "Iran",          motivation: "espionage state",     aliases: ["Charming Kitten", "Phosphorus", "MINT SANDSTORM"], first_seen: "2014", targets: ["journalists", "dissidents"] },

  // ── Vietnam / Korea / India / Pakistan ──
  { name: "OceanLotus",  country: "Vietnam",       motivation: "espionage state",     aliases: ["APT32", "BISMUTH"], first_seen: "2014", targets: ["dissidents", "media"] },
  { name: "DarkHotel",   country: "South Korea",   motivation: "espionage state",     aliases: ["DUBNIUM", "Tapaoux"], first_seen: "2007", targets: ["executives via hotel WiFi"] },
  { name: "APT36",       country: "Pakistan",      motivation: "espionage state",     aliases: ["Mythic Leopard", "Transparent Tribe"], first_seen: "2013", targets: ["India military"] },
  { name: "SideWinder",  country: "India",         motivation: "espionage state",     aliases: ["Razor Tiger", "Rattlesnake"], first_seen: "2012", targets: ["Pakistan", "Afghanistan", "Nepal"] },

  // ── Hacktivists / Information ops ──
  { name: "Anonymous Sudan", country: "Russia",   motivation: "hacktivism politic",   aliases: ["Storm-1359"], first_seen: "2023", targets: ["western infrastructure"] },
  { name: "KillNet",     country: "Russia",        motivation: "hacktivism politic",   aliases: [], first_seen: "2022", targets: ["NATO", "Ukraine allies"] },
  { name: "Predatory Sparrow", country: "Israel", motivation: "hacktivism politic",   aliases: ["Gonjeshke Darande"], first_seen: "2021", targets: ["Iranian infrastructure"] },
  { name: "GhostSec",    country: "USA",           motivation: "hacktivism politic",   aliases: [], first_seen: "2015", targets: ["ISIS", "industrial"] },

  // ── eCrime / financially-motivated ──
  { name: "FIN7",        country: "Russia",        motivation: "financial",            aliases: ["Carbanak", "Carbon Spider", "ITG14"], first_seen: "2013", targets: ["retail", "POS systems"] },
  { name: "FIN8",        country: "Russia",        motivation: "financial",            aliases: ["Syssphinx"], first_seen: "2016", targets: ["hospitality", "retail"] },
  { name: "TA505",       country: "Russia",        motivation: "financial ransom",     aliases: ["Hive0065", "Indrik Spider"], first_seen: "2014", targets: ["banks", "retail"] },
  { name: "Cobalt Group", country: "Russia",      motivation: "financial",            aliases: ["GOLD KINGSWOOD"], first_seen: "2016", targets: ["banks SWIFT"] },

  // ── South America ──
  { name: "Blind Eagle",  country: "Colombia",     motivation: "financial espionage",  aliases: ["APT-C-36"], first_seen: "2018", targets: ["LatAm finance", "government"] },
];

export const RANSOMWARE_GROUPS = [
  { name: "LockBit",          country: "Russia",      victim_count: 1857 },
  { name: "ALPHV / BlackCat",  country: "Russia",      victim_count: 643 },
  { name: "Cl0p",              country: "Russia",      victim_count: 506 },
  { name: "Play",              country: "Romania",     victim_count: 489 },
  { name: "Akira",             country: "Russia",      victim_count: 412 },
  { name: "Black Basta",       country: "Russia",      victim_count: 381 },
  { name: "8Base",             country: "Ukraine",     victim_count: 312 },
  { name: "BianLian",          country: "Russia",      victim_count: 287 },
  { name: "Royal",             country: "Russia",      victim_count: 244 },
  { name: "Medusa",            country: "Romania",     victim_count: 213 },
  { name: "RansomHub",         country: "Russia",      victim_count: 198 },
  { name: "Hunters International", country: "Russia",  victim_count: 162 },
];
