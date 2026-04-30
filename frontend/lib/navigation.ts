import {
  AlertTriangle, Bell, ShieldX, Globe, Eye, Brain, KeyRound, Activity,
  ListChecks, Radar, Search as SearchIcon, FileSearch, Network, ServerCog,
  Radio, FileText, Skull, Bug, Shield, Wifi, Plug, Zap, Mail, Briefcase,
  TrendingUp, Clock, MapPin, BarChart3, Users, CreditCard, BookOpen,
  Building2, Smartphone, UserCircle, FileCheck, Award, Database, Hash,
  HelpCircle, Phone, Wrench, Plus, Inbox, Box, LayoutDashboard, Scan,
  Target, MessageSquare, FileBadge, FileLock, Banknote, Server, Download,
  Code, Settings as SettingsIcon, Lock, RotateCcw, UserCog, Globe2, Package,
  ShieldAlert, History, Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string | null;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

// ── LEFT SIDEBAR (modules / verticals) ────────────────────────────────
export const SIDEBAR_SECTIONS: NavSection[] = [
  {
    title: "THREAT MANAGEMENT",
    items: [
      { href: "/threat-management/incidents", label: "Incidents", icon: ShieldX, badge: null },
      { href: "/threat-management/monitoring", label: "Monitoring", icon: Activity, badge: "LIVE" },
      { href: "/threat-management/data-loss-recovery", label: "Data Loss Recovery", icon: KeyRound, badge: null },
    ],
  },
  {
    title: "ATTACK SURFACE MANAGEMENT",
    items: [
      { href: "/asm/whitelist", label: "Whitelist Management", icon: ListChecks, badge: null },
      { href: "/asm/asset-monitoring", label: "Asset Monitoring", icon: Radar, badge: null },
      { href: "/asm/asset-discovery", label: "Asset Discovery", icon: SearchIcon, badge: null },
      { href: "/asm/wss", label: "Website Scanning Suite", icon: FileSearch, badge: null },
      { href: "/asm/dns-monitoring", label: "DNS Monitoring", icon: Network, badge: null },
    ],
  },
  {
    title: "CYBER THREAT INTELLIGENCE",
    items: [
      { href: "/cti/ioc-feed", label: "IOC Feed", icon: Radio, badge: null },
      { href: "/cti/advisory", label: "Cyber Intel Advisory", icon: FileText, badge: "NEW" },
      { href: "/cti/threat-actors", label: "Threat Actors", icon: Skull, badge: null },
      { href: "/cti/cves", label: "Vulnerability — CVEs", icon: Bug, badge: null },
      { href: "/cti/malware", label: "Malware", icon: Shield, badge: null },
      { href: "/cti/tor-nodes", label: "TOR Nodes", icon: Wifi, badge: null },
      { href: "/cti/stix-taxii", label: "STIX/TAXII", icon: Plug, badge: null },
      { href: "/cti/threat-intel-api", label: "Threat Intel API", icon: Zap, badge: null },
    ],
  },
  {
    title: "DMARC MSS",
    items: [{ href: "/dmarc", label: "DMARC Dashboard", icon: Mail, badge: null }],
  },
  {
    title: "THIRD PARTY RISK MANAGEMENT",
    items: [{ href: "/tpra/vendors", label: "Vendors", icon: Briefcase, badge: null }],
  },
  {
    title: "REPORTS",
    items: [
      { href: "/reports/brand-targeted", label: "Brands Targeted", icon: TrendingUp, badge: null },
      { href: "/reports/threat-over-time", label: "Threats Over Time", icon: BarChart3, badge: null },
      { href: "/reports/site-takedown-time", label: "Site Take Down Time", icon: Clock, badge: null },
      { href: "/reports/incident-by-country", label: "Incident By Host Country", icon: MapPin, badge: null },
      { href: "/reports/executive-summary", label: "Executive Summary Report", icon: FileBadge, badge: null },
      { href: "/reports/wss", label: "Website Scanning Suite Reports", icon: FileSearch, badge: null },
      { href: "/reports/incidents-reopened", label: "Incidents Reopened", icon: RotateCcw, badge: null },
      { href: "/reports/moved-cases", label: "Moved Cases", icon: Inbox, badge: null },
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      { href: "/management/client-users", label: "Client Users", icon: Users, badge: null },
      { href: "/management/services-license", label: "Services (Subscription & License)", icon: Package, badge: null },
      { href: "/management/subscription", label: "Plan & Billing", icon: CreditCard, badge: null },
    ],
  },
  {
    title: "KNOWLEDGE CENTRE",
    items: [
      { href: "/knowledge/whitelist", label: "Whitelist", icon: BookOpen, badge: null },
      { href: "/knowledge/incident-monitoring", label: "Incident & Monitoring", icon: BookOpen, badge: null },
      { href: "/knowledge/data-loss-recovery", label: "Data Loss Recovery", icon: BookOpen, badge: null },
      { href: "/knowledge/legal-notice", label: "Legal Notice", icon: FileLock, badge: null },
      { href: "/knowledge/incident-response", label: "Incident Response", icon: BookOpen, badge: null },
      { href: "/knowledge/tpra", label: "Third Party Risk Assessment", icon: BookOpen, badge: null },
      { href: "/knowledge/asm-wss", label: "ASM / WSS", icon: BookOpen, badge: null },
      { href: "/knowledge/user-guide", label: "User Guide", icon: BookOpen, badge: null },
    ],
  },
  {
    title: "TOOLS",
    items: [
      { href: "/investigate", label: "Investigate", icon: Scan, badge: null },
      { href: "/transilience-ai", label: "Transilience AI", icon: Brain, badge: "AI" },
      { href: "/graph", label: "Link Graph", icon: Network, badge: null },
      { href: "/recon", label: "OSINT Recon", icon: Target, badge: null },
      { href: "/scan", label: "Active Scanners", icon: Zap, badge: null },
      { href: "/researcher-feed", label: "Researcher Feed", icon: Radio, badge: null },
    ],
  },
  {
    title: "ADMIN",
    items: [
      { href: "/admin", label: "Admin Console", icon: ShieldAlert, badge: null },
      { href: "/admin/scan", label: "Run Scan", icon: Zap, badge: null },
      { href: "/admin/runs", label: "Scan Runs", icon: History, badge: null },
      { href: "/admin/tenants", label: "Tenants", icon: Building2, badge: null },
      { href: "/admin/audit", label: "Audit Log", icon: FileText, badge: null },
    ],
  },
];

// ── TOP NAV (primary categories with megamenu submenus) ───────────────
export interface MegaMenuGroup {
  label: string;
  href?: string;
  icon?: LucideIcon;
  items: { href: string; label: string; icon?: LucideIcon; description?: string }[];
}

export const TOPNAV: MegaMenuGroup[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    items: [
      { href: "/dashboard/incident", label: "Incident", icon: ShieldX, description: "Active incidents and case status" },
      { href: "/dashboard/asm", label: "Attack Surface Management", icon: Radar, description: "Surface footprint and risk" },
      { href: "/dashboard/threat", label: "Threat Management", icon: Activity, description: "Detections and severity mix" },
      { href: "/dashboard/dmarc", label: "DMARC", icon: Mail, description: "Email authentication overview" },
      { href: "/dashboard/dlr", label: "Data Loss Recovery", icon: KeyRound, description: "Dark-web exposure recovery" },
      { href: "/dashboard/cti", label: "Cyber Threat Intelligence", icon: Brain, description: "Feed health and trends" },
    ],
  },
  {
    label: "Assets",
    icon: Box,
    items: [
      { href: "/assets/domains", label: "Domains", icon: Globe2 },
      { href: "/assets/brands", label: "Brands", icon: Award },
      { href: "/assets/social-media", label: "Social Media Accounts", icon: UserCircle },
      { href: "/assets/mobile-apps", label: "Mobile Apps", icon: Smartphone },
      { href: "/assets/executives", label: "Executives", icon: Users },
      { href: "/assets/authorised-content", label: "Authorised Contents", icon: FileCheck },
      { href: "/assets/trademark", label: "Trademark Documents", icon: FileBadge },
      { href: "/assets/dns-data", label: "DNS Data", icon: Database },
      { href: "/assets/bin-numbers", label: "BIN Numbers", icon: Banknote },
    ],
  },
  {
    label: "Case Manager",
    icon: Briefcase,
    items: [
      { href: "/case-manager/report-new", label: "Report New Case", icon: Plus, description: "Submit a new takedown" },
      { href: "/case-manager/reported-by-clients", label: "Reported Incidents By Clients", icon: Inbox },
    ],
  },
  {
    label: "Support",
    icon: HelpCircle,
    items: [
      { href: "/support/downloads", label: "Downloads", icon: Download },
      { href: "/documentation/threatintel", label: "API V3 Documentation", icon: Code },
      { href: "/support/service-administration", label: "Service Administration", icon: Wrench },
      { href: "/knowledge/user-guide", label: "User Guide", icon: BookOpen },
      { href: "/support/contact", label: "Contact Us", icon: Phone },
    ],
  },
];

// ── PAGE TITLE LOOKUP for breadcrumbs ─────────────────────────────────
export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Command Center",
  "/dashboard/incident": "Incident Dashboard",
  "/dashboard/asm": "ASM Dashboard",
  "/dashboard/threat": "Threat Dashboard",
  "/dashboard/dmarc": "DMARC Dashboard",
  "/dashboard/dlr": "Data Loss Recovery Dashboard",
  "/dashboard/cti": "Cyber Threat Intelligence Dashboard",
  "/threat-management/incidents": "Incidents",
  "/threat-management/monitoring": "Monitoring",
  "/threat-management/data-loss-recovery": "Data Loss Recovery",
  "/asm/whitelist": "Whitelist Management",
  "/asm/asset-monitoring": "Asset Monitoring",
  "/asm/asset-discovery": "Asset Discovery",
  "/asm/wss": "Website Scanning Suite",
  "/asm/dns-monitoring": "DNS Monitoring",
  "/cti/ioc-feed": "IOC Feed",
  "/cti/advisory": "Cyber Intel Advisory",
  "/cti/threat-actors": "Threat Actors",
  "/cti/cves": "Vulnerabilities — CVEs",
  "/cti/malware": "Malware",
  "/cti/tor-nodes": "TOR Nodes",
  "/cti/stix-taxii": "STIX/TAXII",
  "/cti/threat-intel-api": "Threat Intel API",
  "/dmarc": "DMARC MSS",
  "/tpra/vendors": "Third-Party Vendors",
  "/reports/brand-targeted": "Brand Targeted",
  "/reports/threat-over-time": "Threat Over Time",
  "/reports/site-takedown-time": "Site Take Down Time",
  "/reports/incident-by-country": "Incident By Host Country",
  "/reports/executive-summary": "Executive Summary",
  "/reports/wss": "Website Scanning Suite Report",
  "/reports/incidents-reopened": "Incidents Reopened",
  "/reports/moved-cases": "Moved Cases",
  "/management/client-users": "Client Users",
  "/management/services-license": "Services (Subscription & License)",
  "/management/subscription": "Plan & Billing",
  "/knowledge/whitelist": "Knowledge — Whitelist",
  "/knowledge/incident-monitoring": "Knowledge — Incident & Monitoring",
  "/knowledge/data-loss-recovery": "Knowledge — Data Loss Recovery",
  "/knowledge/legal-notice": "Knowledge — Legal Notice",
  "/knowledge/incident-response": "Knowledge — Incident Response",
  "/knowledge/tpra": "Knowledge — TPRA",
  "/knowledge/asm-wss": "Knowledge — ASM / WSS",
  "/knowledge/user-guide": "User Guide",
  "/assets/domains": "Domains",
  "/assets/brands": "Brands",
  "/assets/social-media": "Social Media Accounts",
  "/assets/mobile-apps": "Mobile Apps",
  "/assets/executives": "Executives",
  "/assets/authorised-content": "Authorised Contents",
  "/assets/trademark": "Trademark Documents",
  "/assets/dns-data": "DNS Data",
  "/assets/bin-numbers": "BIN Numbers",
  "/case-manager/report-new": "Report New Case",
  "/case-manager/reported-by-clients": "Reported Incidents By Clients",
  "/support/downloads": "Downloads",
  "/support/service-administration": "Service Administration",
  "/support/contact": "Contact Us",
  "/documentation/StixTaxii": "STIX/TAXII API",
  "/documentation/threatintel": "Threat Intel REST API",
  "/investigate": "Investigate",
  "/transilience-ai": "Transilience AI",
  "/graph": "Link Graph",
  "/recon": "OSINT Recon",
  "/scan": "Active Scanners",
  "/researcher-feed": "Researcher Feed",
  "/admin": "Admin Console",
  "/admin/scan": "Run Scan",
  "/admin/runs": "Scan Run History",
  "/admin/tenants": "Tenants",
  "/admin/audit": "Audit Log",
};

// ── CLIENT MODES ──────────────────────────────────────────────────────
export const CLIENT_MODES = [
  { value: "all", label: "All Clients" },
  { value: "production", label: "Production Clients Only" },
  { value: "demo", label: "Demo Clients Only" },
  { value: "specific", label: "Specific Client" },
] as const;

export type ClientMode = (typeof CLIENT_MODES)[number]["value"];
