// Deterministic-ish mock data generators used across new modules.
// Each function returns realistic shapes mirroring the documented platform.

export const BRANDS = [
  "Acme Bank",
  "Globex Insurance",
  "Initech Telecom",
  "Soylent Health",
  "Wayne Manufacturing",
  "Stark Retail",
  "Umbrella Pharma",
  "Pied Piper Gaming",
];

export const COUNTRIES = [
  "United States", "United Kingdom", "Germany", "France", "India", "Singapore",
  "Australia", "Brazil", "Japan", "Canada", "Netherlands", "UAE", "Russia", "China",
];

const INCIDENT_TYPES = [
  "Email", "Social Media – Instagram", "Social Media – Facebook", "Social Media – Vimeo",
  "Social Media – YouTube", "Social Media – Telegram", "Social Media – Twitter",
  "Brand Abuse – Chatroom", "Brand Abuse – Claim of Association", "Brand Abuse – Fake Website",
  "Brand Abuse – Other", "Brand Abuse – Download Site", "Phishing – Phishing site",
  "Phishing – Other", "Executive – Whatsapp", "Executive – Twitter", "Executive – Other",
];

const STATUSES = ["OPEN", "CLOSED", "WAITING", "ON HOLD"] as const;
const SEVERITIES = ["Critical", "Substantial", "Moderate", "Low"] as const;

function rand<T>(arr: readonly T[], seed: number) {
  return arr[seed % arr.length];
}

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function shortHash(seed: number) {
  return seed.toString(16).padStart(8, "0").slice(0, 12);
}

function date(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d: Date) {
  return d.toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── INCIDENTS ─────────────────────────────────────────────────────────
export interface IncidentRow {
  id: string;
  caseHash: string;
  status: typeof STATUSES[number];
  type: string;
  url: string;
  brand: string;
  severity: typeof SEVERITIES[number];
  uptimeMin: number;
  addedAt: string;
  openedAt: string;
  closedAt?: string;
}

export function genIncidents(n: number, offset = 0): IncidentRow[] {
  const out: IncidentRow[] = [];
  for (let i = 0; i < n; i++) {
    const seed = i + offset + 7;
    const status = STATUSES[seed % STATUSES.length];
    const severity = SEVERITIES[seed % SEVERITIES.length];
    const type = INCIDENT_TYPES[seed % INCIDENT_TYPES.length];
    const brand = BRANDS[seed % BRANDS.length];
    const addedAt = date(seed % 60);
    const openedAt = date((seed % 60) - 1);
    const closedAt = status === "CLOSED" ? date(Math.max(0, (seed % 60) - 5)) : undefined;
    const urls = [
      `secure-${brand.toLowerCase().replace(/\s+/g, "-")}-login.com`,
      `${brand.toLowerCase().replace(/\s+/g, "")}-support.net`,
      `bit.ly/scam${shortHash(seed).slice(0, 6)}`,
      `t.me/${brand.toLowerCase().replace(/\s+/g, "")}_official`,
      `instagram.com/${brand.toLowerCase().replace(/\s+/g, "")}.help`,
    ];
    out.push({
      id: `INC${shortHash(seed)}`,
      caseHash: shortHash(seed),
      status,
      type,
      url: urls[seed % urls.length],
      brand,
      severity,
      uptimeMin: (seed * 13) % (24 * 60 * 30),
      addedAt: fmtDateTime(addedAt),
      openedAt: fmtDateTime(openedAt),
      closedAt: closedAt ? fmtDateTime(closedAt) : undefined,
    });
  }
  return out;
}

// ── DOMAIN MONITORING ─────────────────────────────────────────────────
export interface DomainRow {
  caseHash: string;
  domain: string;
  flag: "New Domain Registration" | "Domain Whois Record Updated";
  brand: string;
  monitoring: boolean;
  added: string;
  modified: string;
}

export function genDomains(n: number, offset = 0): DomainRow[] {
  const out: DomainRow[] = [];
  const tlds = [".com", ".net", ".io", ".co", ".online", ".info", ".biz", ".store"];
  for (let i = 0; i < n; i++) {
    const seed = i + offset + 11;
    const brand = BRANDS[seed % BRANDS.length];
    const slug = brand.toLowerCase().replace(/\s+/g, "-");
    const subs = ["secure", "login", "support", "verify", "billing", "account", "official"];
    const sub = subs[seed % subs.length];
    out.push({
      caseHash: shortHash(seed * 17),
      domain: `${sub}-${slug}${tlds[seed % tlds.length]}`,
      flag: seed % 2 === 0 ? "New Domain Registration" : "Domain Whois Record Updated",
      brand,
      monitoring: seed % 4 !== 0,
      added: fmtDateTime(date(seed % 30)),
      modified: fmtDateTime(date(seed % 5)),
    });
  }
  return out;
}

// ── DNS MONITORING ────────────────────────────────────────────────────
export interface DnsRow {
  domain: string;
  brand: string;
  ips: string[];
  nameservers: string[];
  status: "Matched" | "Mismatched";
  offendingIp?: string;
}

export function genDns(n: number): DnsRow[] {
  const out: DnsRow[] = [];
  for (let i = 0; i < n; i++) {
    const seed = i + 23;
    const brand = BRANDS[seed % BRANDS.length];
    const slug = brand.toLowerCase().replace(/\s+/g, "");
    const isMismatch = seed % 5 === 0;
    out.push({
      domain: `${slug}.com`,
      brand,
      ips: [`104.21.${(seed * 7) % 250}.${(seed * 11) % 250}`, `172.67.${(seed * 13) % 250}.${(seed * 17) % 250}`],
      nameservers: [`ns1.${slug}.com`, `ns2.${slug}.com`],
      status: isMismatch ? "Mismatched" : "Matched",
      offendingIp: isMismatch ? `45.${(seed * 19) % 250}.${(seed * 23) % 250}.${(seed * 29) % 250}` : undefined,
    });
  }
  return out;
}

// ── DLR ───────────────────────────────────────────────────────────────
const DLR_TYPES = [
  { type: "Login Credentials", subtype: "Bank Account", file: "JOIN NEW TELEGRAM @TXT_ALIENS – 1518" },
  { type: "Personal Identifiable Information (PII)", subtype: "Customer Data", file: "Udemy_shinyhunters" },
  { type: "Technical Info / Data", subtype: "Source Code", file: "Github" },
  { type: "Login Credentials", subtype: "Corporate Mailbox", file: "RaidForums Combo 2026-01-12" },
  { type: "Personal Identifiable Information (PII)", subtype: "PAN / SSN", file: "BreachForums dump 2026-02-04" },
];

export interface DlrRow {
  id: string;
  status: "RECOVERED" | "WAITING" | "OPEN" | "RECOVERY FAILED";
  actionTaken: boolean;
  type: string;
  subtype: string;
  file: string;
  brand: string;
  threatLevel: "High" | "Moderate" | "Low";
  added: string;
}

export function genDlr(n: number, offset = 0): DlrRow[] {
  const out: DlrRow[] = [];
  const statuses: DlrRow["status"][] = ["RECOVERED", "RECOVERED", "RECOVERED", "RECOVERED", "WAITING", "RECOVERY FAILED"];
  for (let i = 0; i < n; i++) {
    const seed = i + offset + 41;
    const t = DLR_TYPES[seed % DLR_TYPES.length];
    const status = statuses[seed % statuses.length];
    const levels: DlrRow["threatLevel"][] = ["High", "Moderate", "Low"];
    out.push({
      id: `DLR#${shortHash(seed * 23)}`,
      status,
      actionTaken: status === "RECOVERED" && seed % 3 === 0,
      type: t.type,
      subtype: t.subtype,
      file: t.file,
      brand: BRANDS[seed % BRANDS.length],
      threatLevel: levels[seed % 3],
      added: fmtDateTime(date(seed % 90)),
    });
  }
  return out;
}

// ── ASSET MONITORING (ASM) ────────────────────────────────────────────
export interface AsmRow {
  id: string;
  rootDomain: string;
  domainExpiry: string;
  sslExpiry: string;
  status: "ENABLED" | "DISABLED";
  brand: string;
  coverage: number;
  totalAssets: number;
  discovered: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export function genAsm(n: number): AsmRow[] {
  const out: AsmRow[] = [];
  for (let i = 0; i < n; i++) {
    const seed = i + 67;
    const brand = BRANDS[seed % BRANDS.length];
    const slug = brand.toLowerCase().replace(/\s+/g, "");
    out.push({
      id: `ASM#${shortHash(seed * 31)}`,
      rootDomain: `${slug}.com`,
      domainExpiry: fmtDate(date(-(180 + (seed % 365)))),
      sslExpiry: fmtDate(date(-(20 + (seed % 200)))),
      status: seed % 7 === 0 ? "DISABLED" : "ENABLED",
      brand,
      coverage: 20 + (seed * 7) % 70,
      totalAssets: 80 + (seed * 13) % 400,
      discovered: 10 + (seed * 11) % 60,
      critical: (seed * 3) % 5,
      high: (seed * 5) % 12,
      medium: (seed * 7) % 25,
      low: (seed * 11) % 50,
    });
  }
  return out;
}

// ── ASSET DISCOVERY (subdomains) ──────────────────────────────────────
export interface DiscoveryRow {
  subdomain: string;
  parent: string;
  monitoring: boolean;
  http: 200 | 404 | 0;
  status: "ACTIVE" | "INACTIVE" | "RESOLVED" | "UNKNOWN";
  sslExpiry: string;
  invalidSsl: boolean;
  critical: number;
  high: number;
  medium: number;
  low: number;
  discovered: string;
}

export function genDiscovery(n: number): DiscoveryRow[] {
  const out: DiscoveryRow[] = [];
  const subs = ["mail", "www", "api", "qrcode", "blog", "support", "shop", "dev", "vpn", "stage", "portal", "auth", "cdn", "mx", "files"];
  const codes: DiscoveryRow["http"][] = [200, 200, 200, 404, 0];
  const statuses: DiscoveryRow["status"][] = ["ACTIVE", "ACTIVE", "INACTIVE", "RESOLVED", "UNKNOWN"];
  for (let i = 0; i < n; i++) {
    const seed = i + 89;
    const brand = BRANDS[seed % BRANDS.length];
    const slug = brand.toLowerCase().replace(/\s+/g, "");
    const sub = subs[seed % subs.length];
    out.push({
      subdomain: `${sub}.${slug}.com`,
      parent: `${slug}.com`,
      monitoring: seed % 3 !== 0,
      http: codes[seed % codes.length],
      status: statuses[seed % statuses.length],
      sslExpiry: fmtDate(date(-(30 + (seed % 200)))),
      invalidSsl: seed % 6 === 0,
      critical: (seed * 2) % 3,
      high: (seed * 3) % 7,
      medium: (seed * 5) % 14,
      low: (seed * 7) % 25,
      discovered: fmtDateTime(date(seed % 60)),
    });
  }
  return out;
}

// ── WSS ───────────────────────────────────────────────────────────────
export interface WssRow {
  id: string;
  url: string;
  enabled: boolean;
  verdict: "CLEAN" | "POTENTIALLY SUSPICIOUS";
  critical: number;
  high: number;
  medium: number;
  low: number;
  lastScan: string;
}

export function genWss(n: number): WssRow[] {
  const out: WssRow[] = [];
  for (let i = 0; i < n; i++) {
    const seed = i + 103;
    const brand = BRANDS[seed % BRANDS.length];
    const slug = brand.toLowerCase().replace(/\s+/g, "");
    out.push({
      id: `WSS#${shortHash(seed * 37)}`,
      url: `https://${slug}.com/portal`,
      enabled: seed % 5 !== 0,
      verdict: seed % 4 === 0 ? "POTENTIALLY SUSPICIOUS" : "CLEAN",
      critical: (seed * 2) % 4,
      high: (seed * 3) % 9,
      medium: (seed * 5) % 16,
      low: (seed * 7) % 30,
      lastScan: fmtDateTime(date(seed % 14)),
    });
  }
  return out;
}

// ── IOC FEED ──────────────────────────────────────────────────────────
export interface IocRow {
  indicator: string;
  type: "filehash-md5" | "filehash-sha1" | "filehash-sha256" | "domain";
  firstSeen: string;
  expiry: string;
  confidence: number;
}

export function genIoc(n: number, offset = 0): IocRow[] {
  const out: IocRow[] = [];
  const types: IocRow["type"][] = ["filehash-md5", "filehash-sha1", "filehash-sha256", "domain"];
  const baseChars = "abcdef0123456789";
  for (let i = 0; i < n; i++) {
    const seed = i + offset + 109;
    const t = types[seed % types.length];
    let indicator = "";
    if (t === "filehash-md5") indicator = Array.from({ length: 32 }, (_, j) => baseChars[(seed * (j + 1)) % 16]).join("");
    else if (t === "filehash-sha1") indicator = Array.from({ length: 40 }, (_, j) => baseChars[(seed * (j + 2)) % 16]).join("");
    else if (t === "filehash-sha256") indicator = Array.from({ length: 64 }, (_, j) => baseChars[(seed * (j + 3)) % 16]).join("");
    else indicator = `${["evil", "scam", "fake", "malware", "phish"][seed % 5]}-${shortHash(seed)}.${["xyz", "top", "icu", "click"][seed % 4]}`;
    out.push({
      indicator,
      type: t,
      firstSeen: fmtDate(date(seed % 365)),
      expiry: fmtDate(date(-(30 + (seed % 90)))),
      confidence: 50 + ((seed * 13) % 50),
    });
  }
  return out;
}

// ── CVEs ──────────────────────────────────────────────────────────────
export interface CveRow {
  id: string;
  description: string;
  technology: string;
  vendor: string;
  product: string;
  cvss: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  disclosed: string;
}

export function genCves(n: number, offset = 0): CveRow[] {
  const out: CveRow[] = [];
  const vendors = ["1024-lab", "SourceCodester", "VetCoders", "AWS", "Tenda", "Cisco", "Microsoft", "Adobe", "Apache"];
  const products = ["Hospital Management", "User Auth Module", "Router AC1200", "S3 Bucket Policy", "Tomcat", "Office 365"];
  const techs = ["PHP", "Java", "C", "Python", "Node.js", "Go"];
  const desc = ["SQL Injection", "Buffer Overflow", "Remote Code Execution", "Path Traversal", "XSS", "CSRF", "Privilege Escalation"];
  for (let i = 0; i < n; i++) {
    const seed = i + offset + 149;
    const cvss = 3 + (((seed * 7) % 70) / 10);
    const sev: CveRow["severity"] = cvss >= 9 ? "CRITICAL" : cvss >= 7 ? "HIGH" : cvss >= 4 ? "MEDIUM" : "LOW";
    out.push({
      id: `CVE-2026-${(7000 + (seed % 999)).toString().padStart(4, "0")}`,
      description: `${desc[seed % desc.length]} in ${products[seed % products.length]}`,
      technology: techs[seed % techs.length],
      vendor: vendors[seed % vendors.length],
      product: products[seed % products.length],
      cvss: Number(cvss.toFixed(1)),
      severity: sev,
      disclosed: fmtDate(date(seed % 60)),
    });
  }
  return out;
}

// ── Malware ───────────────────────────────────────────────────────────
const MALWARE_FAMILIES = ["DCRAT", "NJRAT", "NANOCORE", "MASSLOGGER", "MIRAI", "CONNECTWISE"];
const MALWARE_TAGS = ["EXE", "RAT", "PS1", "JS", "SH", "ELF", "GAFGYT", "MIRAI", "UPX", "EXE-IN-ARCHIVE", "SPAMTRAP", "SIGNED"];

export interface MalwareRow {
  hash: string;
  filename: string;
  family: string;
  fileType: "exe" | "elf" | "js" | "sh" | "ps1";
  tags: string[];
  added: string;
}

export function genMalware(n: number, offset = 0): MalwareRow[] {
  const out: MalwareRow[] = [];
  const types: MalwareRow["fileType"][] = ["exe", "elf", "js", "sh", "ps1"];
  for (let i = 0; i < n; i++) {
    const seed = i + offset + 167;
    const tagCount = 2 + (seed % 4);
    const tags = Array.from({ length: tagCount }, (_, j) => MALWARE_TAGS[(seed + j) % MALWARE_TAGS.length]);
    out.push({
      hash: Array.from({ length: 64 }, (_, j) => "abcdef0123456789"[(seed * (j + 7)) % 16]).join(""),
      filename: `sample_${shortHash(seed).slice(0, 6)}.${types[seed % types.length]}`,
      family: MALWARE_FAMILIES[seed % MALWARE_FAMILIES.length],
      fileType: types[seed % types.length],
      tags,
      added: fmtDateTime(date(seed % 30)),
    });
  }
  return out;
}

// ── TOR Nodes ─────────────────────────────────────────────────────────
const TOR_FLAGS = ["RUNNING", "V2DIR", "VALID", "EXIT", "FAST", "HSDIR", "STABLE", "GUARD", "BADEXIT"];

export interface TorRow {
  relay: string;
  exit?: string;
  name: string;
  flags: string[];
  country: string;
  firstSeen: string;
}

export function genTor(n: number): TorRow[] {
  const out: TorRow[] = [];
  for (let i = 0; i < n; i++) {
    const seed = i + 191;
    const isExit = seed % 4 === 0;
    const flagCount = 3 + (seed % 5);
    const flags = Array.from({ length: flagCount }, (_, j) => TOR_FLAGS[(seed + j) % TOR_FLAGS.length]);
    if (isExit && !flags.includes("EXIT")) flags.push("EXIT");
    const ip = `${(seed * 11) % 250}.${(seed * 13) % 250}.${(seed * 17) % 250}.${(seed * 19) % 250}`;
    out.push({
      relay: `${ip}:9001`,
      exit: isExit ? ip : undefined,
      name: seed % 3 === 0 ? "Unnamed" : `Relay${shortHash(seed).slice(0, 6)}`,
      flags,
      country: COUNTRIES[seed % COUNTRIES.length],
      firstSeen: fmtDateTime(date(seed % 365)),
    });
  }
  return out;
}

// ── Threat Actors ─────────────────────────────────────────────────────
const ACTOR_NAMES = [
  "Dark Caracal", "DarkHydrus", "APT28", "APT29", "APT30", "APT33", "APT42", "TA459", "Whitefly",
  "RTM", "Thrip", "APT3", "DarkHotel", "Lazarus Group", "Group5", "TeamTNT", "APT1", "Cleaver",
  "DragonOK", "GCMAN", "Molerats", "APT18", "APT19", "Poseidon Group", "Volatile Cedar", "Mofang",
  "CopyKittens", "Orangeworm", "APT12", "APT16", "APT17", "Turla", "Kimsuky", "APT37", "Evilnum",
  "Fox Kitten", "RedEcho", "BackdoorDiplomacy", "Earth Lusca", "WIZARD SPIDER", "BlackOasis",
  "MoustachedBouncer", "Scattered Spider", "Malteiro", "TA577", "Winter Vivern", "WIRTE",
];

const ACTOR_TYPES = ["APT GROUPS", "CYBER CRIMINALS", "STATE SPONSORED HACKER"];
const CAPABILITIES = [
  "CYBER ESPIONAGE", "DATA BREACHES", "MALWARE AND RANSOMWARE", "STOLEN CREDENTIALS",
  "CYBER ATTACKS", "TROJAN/VIRUS/MALWARE/SPYWARE", "EXPLOIT & VULNERABILITY", "0-DAY",
  "REMOTE ACCESS TROJAN", "STEALER MALWARE", "EXTORTION AND THREATS",
  "BUSINESS EMAIL COMPROMISE", "OTHERS", "NETWORK ACCESS",
];

export interface ActorRow {
  name: string;
  description: string;
  country: string;
  type: string;
  capabilities: string[];
}

export function genActors(n: number, offset = 0): ActorRow[] {
  const out: ActorRow[] = [];
  for (let i = 0; i < n; i++) {
    const seed = i + offset + 211;
    const capCount = 2 + (seed % 4);
    const caps = Array.from({ length: capCount }, (_, j) => CAPABILITIES[(seed + j) % CAPABILITIES.length]);
    out.push({
      name: ACTOR_NAMES[(i + offset) % ACTOR_NAMES.length] + (i + offset >= ACTOR_NAMES.length ? `-${Math.floor((i + offset) / ACTOR_NAMES.length)}` : ""),
      description: "Active group observed across multiple campaigns. Targets financial, healthcare and government sectors with credential-theft malware and supply-chain operations.",
      country: COUNTRIES[seed % COUNTRIES.length],
      type: ACTOR_TYPES[seed % ACTOR_TYPES.length],
      capabilities: Array.from(new Set(caps)),
    });
  }
  return out;
}

// ── DARK WEB ADVISORY ────────────────────────────────────────────────
const ADVISORY_CATS = [
  "Extortion and Threats", "Cyber Espionage", "Defacement", "Hacking",
  "Cyber Attack Announcement", "Exploit & Vulnerability", "Trojan/Virus/Malware/Spyware",
  "DDOS", "SQL Injection", "0-Day", "Remote Access Trojan", "Stealer Malware",
  "XSS", "Webshell", "Network Access", "Others",
];
const INDUSTRIES = ["Banking and Finance", "Insurance", "Telecommunication", "Health", "Real Estate", "Airline", "Manufacturing", "Gaming", "Retail", "Information Technology", "Others"];
const REGIONS = ["UK", "US", "Europe", "North America", "South America", "Africa", "Middle East", "Central Asia", "China", "South Asia", "Australia", "Asia", "Others"];

export interface AdvisoryRow {
  id: string;
  title: string;
  date: string;
  time: string;
  summary: string;
  category: string;
  industry: string;
  region: string;
}

export function genAdvisories(n: number, offset = 0): AdvisoryRow[] {
  const out: AdvisoryRow[] = [];
  const titles = [
    "Threat actor offering RDP access to Fortune-500 retailer",
    "Combolist of 1.4M Indian banking customers posted on RaidForums",
    "Pro-state group claims breach of regional health authority",
    "0-day exploit in popular VPN gateway listed for $250k",
    "Defacement campaign targeting national infrastructure portals",
    "New stealer-as-a-service dropping in Telegram channels",
    "DDoS booster boosted to 1.2 Tbps against airline check-in",
    "Webshell kits being traded with embedded backdoors",
    "Network access offered for European telecom operator",
  ];
  for (let i = 0; i < n; i++) {
    const seed = i + offset + 233;
    const d = date(seed % 90);
    out.push({
      id: shortHash(seed * 41),
      title: titles[seed % titles.length],
      date: fmtDate(d),
      time: `${(seed % 23).toString().padStart(2, "0")}:${(seed % 60).toString().padStart(2, "0")} UTC`,
      summary: "Threat post observed on a private forum. Includes claims of access, sample data, and contact channels via Tox / Telegram. Recommend monitoring affected brand mentions and rotating credentials. Read more in the full advisory…",
      category: ADVISORY_CATS[seed % ADVISORY_CATS.length],
      industry: INDUSTRIES[seed % INDUSTRIES.length],
      region: REGIONS[seed % REGIONS.length],
    });
  }
  return out;
}

// ── VENDORS (TPRM) ────────────────────────────────────────────────────
export interface VendorRow {
  id: string;
  name: string;
  client: string;
  email: string;
  riskScore: number;
  status: boolean;
  added: string;
}

export function genVendors(n: number): VendorRow[] {
  const names = ["Cloudflare", "AWS", "Okta", "Slack", "GitHub", "DataDog", "Atlassian", "Salesforce", "Stripe", "Twilio"];
  const out: VendorRow[] = [];
  for (let i = 0; i < n; i++) {
    const seed = i + 257;
    const name = names[seed % names.length];
    out.push({
      id: shortHash(seed * 43),
      name,
      client: BRANDS[seed % BRANDS.length],
      email: `security@${name.toLowerCase()}.com`,
      riskScore: 5 + ((seed * 7) % 80),
      status: seed % 4 !== 0,
      added: fmtDate(date(seed % 365)),
    });
  }
  return out;
}

// ── BRANDS / WHITELIST ────────────────────────────────────────────────
export interface BrandRow {
  name: string;
  client: string;
  country: string;
  monitoring: boolean;
  added: string;
}

export function genBrands(): BrandRow[] {
  return BRANDS.map((b, i) => ({
    name: b,
    client: i % 2 === 0 ? "Transilience Holdings" : "Transilience SubCo",
    country: COUNTRIES[i % COUNTRIES.length],
    monitoring: i !== 5,
    added: fmtDate(date(60 + i * 7)),
  }));
}
