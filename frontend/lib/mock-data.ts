// Deterministic-ish mock data generators used across new modules.
// Each function returns realistic shapes mirroring the documented platform.

// Single-tenant deployment: the entire platform is scoped to one brand.
// Adding more brands here would re-introduce multi-brand UI elsewhere.
export const BRANDS = ["CreditAccessGrameen"];

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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
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
  // single-tenant deployment: real data lives in /api/v1/findings
  return [];
}
