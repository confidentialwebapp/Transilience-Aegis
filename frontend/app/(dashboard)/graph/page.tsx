"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api, getOrgId, type Investigation } from "@/lib/api";
import {
  Search, X, Locate, GitBranch, Focus, LayoutGrid, HelpCircle,
  Maximize2, Globe, Server, Mail, Phone, MapPin, Bug, Wifi,
  Facebook, Instagram, MessageSquare, Calendar, ArrowDownUp,
  Download, ChevronDown, Network, Loader2, Shield, Fingerprint,
  AlertTriangle, CheckCircle2, Hash as HashIcon, FileLock2, Lock,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type NodeType =
  | "domain" | "ip" | "email" | "phone" | "location" | "malware"
  | "facebook" | "instagram" | "forum" | "hash" | "leak" | "asn";

type EdgeKind = "contact" | "social" | "infra" | "forum" | "malware" | "leak";

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  pivot?: boolean;
  malicious?: boolean;
  meta?: Record<string, string | number | undefined>;
}

interface GraphEdge {
  a: string;
  b: string;
  kind: EdgeKind;
}

interface PhysicsNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

type TargetType = "domain" | "ip" | "email" | "hash" | "phone" | "username";

type SourceStatus = "idle" | "pending" | "running" | "done" | "failed" | "skipped";

// ── Visual maps ────────────────────────────────────────────────────────────────

const TYPE_STYLE: Record<NodeType, { fill: string; glow: string }> = {
  domain:    { fill: "#10b981", glow: "rgba(16,185,129,0.45)" },
  ip:        { fill: "#22c55e", glow: "rgba(34,197,94,0.4)" },
  email:     { fill: "#facc15", glow: "rgba(250,204,21,0.4)" },
  phone:     { fill: "#facc15", glow: "rgba(250,204,21,0.4)" },
  location:  { fill: "#facc15", glow: "rgba(250,204,21,0.4)" },
  malware:   { fill: "#ea580c", glow: "rgba(234,88,12,0.5)" },
  facebook:  { fill: "#3b82f6", glow: "rgba(59,130,246,0.4)" },
  instagram: { fill: "#3b82f6", glow: "rgba(59,130,246,0.4)" },
  forum:     { fill: "#ec4899", glow: "rgba(236,72,153,0.45)" },
  hash:      { fill: "#a855f7", glow: "rgba(168,85,247,0.4)" },
  leak:      { fill: "#ef4444", glow: "rgba(239,68,68,0.45)" },
  asn:       { fill: "#8b5cf6", glow: "rgba(139,92,246,0.4)" },
};

const EDGE_STROKE: Record<EdgeKind, string> = {
  contact: "rgba(250,204,21,0.55)",
  social:  "rgba(59,130,246,0.55)",
  infra:   "rgba(16,185,129,0.55)",
  forum:   "rgba(236,72,153,0.6)",
  malware: "rgba(234,88,12,0.6)",
  leak:    "rgba(239,68,68,0.6)",
};

const NODE_ICON: Record<NodeType, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  domain:    Globe,
  ip:        Server,
  email:     Mail,
  phone:     Phone,
  location:  MapPin,
  malware:   Bug,
  facebook:  Facebook,
  instagram: Instagram,
  forum:     MessageSquare,
  hash:      HashIcon,
  leak:      FileLock2,
  asn:       Fingerprint,
};

const TARGET_TYPES: { value: TargetType; label: string; placeholder: string }[] = [
  { value: "domain", label: "Domain", placeholder: "example.com" },
  { value: "ip",     label: "IP",     placeholder: "8.8.8.8" },
  { value: "email",  label: "Email",  placeholder: "user@example.com" },
  { value: "hash",   label: "Hash",   placeholder: "md5 / sha1 / sha256" },
];

const TAB_DEFS: { key: string; label: string }[] = [
  { key: "domain",      label: "Domains" },
  { key: "ip",          label: "IP" },
  { key: "ssl",         label: "SSL" },
  { key: "ssh",         label: "SSH" },
  { key: "files",       label: "Files" },
  { key: "contacts",    label: "Contacts" },
  { key: "attribution", label: "Attribution" },
];

// ── Response → graph transformation ───────────────────────────────────────────

type AnyRec = Record<string, unknown>;

function asObj(v: unknown): AnyRec | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as AnyRec) : null;
}

function asArr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function buildGraph(
  inv: Investigation
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const addNode = (n: GraphNode) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    nodes.push(n);
  };

  const addEdge = (a: string, b: string, kind: EdgeKind) => {
    if (!seen.has(a) || !seen.has(b) || a === b) return;
    edges.push({ a, b, kind });
  };

  const results = (inv.results as AnyRec) || {};
  const target = inv.target_value;
  const tt = inv.target_type as TargetType;

  // Central pivot
  const pivotType: NodeType =
    tt === "ip" ? "ip" :
    tt === "email" ? "email" :
    tt === "hash" ? "hash" :
    tt === "phone" ? "phone" :
    "domain";

  const pivotMalicious =
    ((asObj(results.virustotal)?.malicious as number) || 0) > 0 ||
    asObj(results.urlhaus)?.status === "found" ||
    asObj(results.threatfox)?.status === "found" ||
    asObj(results.blocklist)?.status === "found" ||
    asObj(results.malwarebazaar)?.status === "found" ||
    (asObj(results.urlscan)?.verdict === "malicious");

  addNode({
    id: target,
    type: pivotType,
    label: `${pivotType[0].toUpperCase() + pivotType.slice(1)}: ${target}`,
    pivot: true,
    malicious: pivotMalicious,
  });

  // DNS → IP + related domain nodes
  const dns = asObj(results.dns);
  if (dns) {
    for (const ip of asArr<string>(dns.A).slice(0, 6)) {
      addNode({ id: ip, type: "ip", label: `IP: ${ip}` });
      addEdge(target, ip, "infra");
    }
    for (const ip of asArr<string>(dns.AAAA).slice(0, 3)) {
      addNode({ id: ip, type: "ip", label: `IP6: ${ip}` });
      addEdge(target, ip, "infra");
    }
    for (const mx of asArr<string>(dns.MX).slice(0, 3)) {
      const host = mx.replace(/^\d+\s+/, "").replace(/\.$/, "");
      if (host && host !== target) {
        addNode({ id: host, type: "domain", label: `MX: ${host}` });
        addEdge(target, host, "infra");
      }
    }
  }

  // WHOIS → email/registrar/ASN
  const whois = asObj(results.whois);
  if (whois) {
    const em = whois.admin_email as string | undefined;
    if (em && typeof em === "string" && em.includes("@")) {
      addNode({ id: em, type: "email", label: `Email: ${em}` });
      addEdge(target, em, "contact");
    }
    const org = whois.org as string | undefined;
    if (org && typeof org === "string" && org.length > 2) {
      const id = `ASN: ${org}`;
      addNode({ id, type: "asn", label: id });
      addEdge(target, id, "contact");
    }
  }

  // crt.sh → sibling/sub-domains
  const crtsh = asObj(results.crtsh);
  if (crtsh) {
    const subs = asArr<string>(crtsh.subdomains).slice(0, 8);
    for (const s of subs) {
      if (s && s !== target) {
        addNode({ id: s, type: "domain", label: `Domain: ${s}` });
        addEdge(target, s, "infra");
      }
    }
  }

  // ThreatFox → malware family node
  const tf = asObj(results.threatfox);
  if (tf && tf.status === "found") {
    const fam = (tf.malware_family as string) || (tf.threat_type as string) || "ThreatFox hit";
    const id = `Malware: ${fam}`;
    addNode({ id, type: "malware", label: id, malicious: true });
    addEdge(target, id, "malware");
  }

  // URLhaus → malware
  const uh = asObj(results.urlhaus);
  if (uh && uh.status === "found") {
    const fam = (uh.threat_type as string) || (uh.malware_family as string) || "URLhaus";
    const id = `Malware: ${fam}`;
    addNode({ id, type: "malware", label: id, malicious: true });
    addEdge(target, id, "malware");
  }

  // Shodan → hostnames, ASN/ISP, malicious IP services
  const shodan = asObj(results.shodan);
  if (shodan) {
    for (const h of asArr<string>(shodan.hostnames).slice(0, 4)) {
      if (h && h !== target) {
        addNode({ id: h, type: "domain", label: `Domain: ${h}` });
        addEdge(target, h, "infra");
      }
    }
    const org = (shodan.org as string) || (shodan.asn as string);
    if (org && typeof org === "string") {
      const id = `ASN: ${org}`;
      addNode({ id, type: "asn", label: id });
      addEdge(target, id, "contact");
    }
  }

  // Geolocation → location node
  const geo = asObj(results.geolocation);
  if (geo) {
    const loc =
      [geo.city, geo.country].filter(Boolean).join(", ") ||
      (geo.country as string) || "";
    if (loc) {
      const id = `Location: ${loc}`;
      addNode({ id, type: "location", label: id });
      addEdge(target, id, "contact");
    }
  }

  // HIBP → breach nodes (leak, red)
  const hibp = asObj(results.hibp);
  if (hibp && hibp.status === "breached") {
    for (const b of asArr<AnyRec>(hibp.breaches).slice(0, 5)) {
      const name = (b.name as string) || "Breach";
      const id = `Leak: ${name}`;
      addNode({ id, type: "leak", label: id, malicious: true });
      addEdge(target, id, "leak");
    }
  }

  // GitHub leaks → forum-style pink nodes
  const gh = asObj(results.github);
  if (gh && gh.status === "found") {
    for (const r of asArr<AnyRec>(gh.results).slice(0, 4)) {
      const repo = (r.repo as string) || "github";
      const id = `GitHub: ${repo}`;
      addNode({ id, type: "forum", label: id, malicious: true });
      addEdge(target, id, "forum");
    }
  }

  // MalwareBazaar (for hash targets) → malware family
  const mb = asObj(results.malwarebazaar);
  if (mb && mb.status === "found") {
    const sig = (mb.signature as string) || (mb.file_name as string) || "Sample";
    const id = `Malware: ${sig}`;
    addNode({ id, type: "malware", label: id, malicious: true });
    addEdge(target, id, "malware");
  }

  return { nodes, edges };
}

// ── Right panel: per-tab extractors ───────────────────────────────────────────

interface DomainRow {
  domain: string;
  regDate?: string;
  expDate?: string;
  registrar?: string;
  ips: string[];
  ipOverflow: number;
  email?: string;
  owner?: string;
  malicious?: boolean;
}

function fmtDate(v: unknown): string | undefined {
  if (!v || typeof v !== "string") return undefined;
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function extractDomainRows(inv: Investigation): DomainRow[] {
  const results = (inv.results as AnyRec) || {};
  const target = inv.target_value;
  const rows: DomainRow[] = [];

  const dns = asObj(results.dns);
  const whois = asObj(results.whois);
  const crtsh = asObj(results.crtsh);
  const blocklist = asObj(results.blocklist);
  const vt = asObj(results.virustotal);
  const urlhaus = asObj(results.urlhaus);
  const threatfox = asObj(results.threatfox);

  const malicious =
    ((vt?.malicious as number) || 0) > 0 ||
    urlhaus?.status === "found" ||
    threatfox?.status === "found" ||
    blocklist?.status === "found";

  // Primary row — the target domain (if it's a domain investigation)
  if (inv.target_type === "domain") {
    const ips = asArr<string>(dns?.A);
    rows.push({
      domain: target,
      regDate: fmtDate(whois?.registration),
      expDate: fmtDate(whois?.expiration),
      registrar: whois?.registrar as string | undefined,
      ips: ips.slice(0, 2),
      ipOverflow: Math.max(0, ips.length - 2),
      email: whois?.admin_email as string | undefined,
      owner: (whois?.org as string | undefined) || (whois?.country as string | undefined),
      malicious,
    });
  }

  // Sibling / co-hosted domains from crt.sh
  const subs = asArr<string>(crtsh?.subdomains).slice(0, 8).filter((s) => s !== target);
  for (const s of subs) {
    rows.push({
      domain: s,
      regDate: undefined,
      expDate: undefined,
      registrar: whois?.registrar as string | undefined,
      ips: [],
      ipOverflow: 0,
      email: undefined,
      owner: undefined,
    });
  }

  return rows;
}

interface IpRow {
  ip: string;
  asn?: string;
  isp?: string;
  country?: string;
  ports: number[];
  vulns: number;
  malicious?: boolean;
}

function extractIpRows(inv: Investigation): IpRow[] {
  const results = (inv.results as AnyRec) || {};
  const rows: IpRow[] = [];

  const dns = asObj(results.dns);
  const shodan = asObj(results.shodan);
  const idb = asObj(results.shodan_internetdb);
  const geo = asObj(results.geolocation);
  const blocklist = asObj(results.blocklist);

  // Primary: target if IP, else the first DNS A record
  const primaryIp =
    inv.target_type === "ip" ? inv.target_value :
    (asArr<string>(dns?.A)[0] as string | undefined);

  if (primaryIp) {
    rows.push({
      ip: primaryIp,
      asn: (shodan?.asn as string) || (geo?.asn as string),
      isp: (shodan?.isp as string) || (geo?.isp as string),
      country: (shodan?.country as string) || (geo?.country as string),
      ports: asArr<number>(shodan?.ports).slice(0, 8).concat(
             asArr<number>(idb?.ports).slice(0, 8)),
      vulns: asArr(shodan?.vulns).length + asArr(idb?.vulns).length,
      malicious: blocklist?.status === "found",
    });
  }

  // Additional A records (if target was domain)
  const extraIps = asArr<string>(dns?.A).filter((ip) => ip !== primaryIp).slice(0, 5);
  for (const ip of extraIps) {
    rows.push({
      ip,
      asn: undefined,
      isp: undefined,
      country: undefined,
      ports: [],
      vulns: 0,
    });
  }
  return rows;
}

interface SslRow {
  commonName: string;
  issuer?: string;
  notBefore?: string;
  notAfter?: string;
}

function extractSslRows(inv: Investigation): SslRow[] {
  const results = (inv.results as AnyRec) || {};
  const crtsh = asObj(results.crtsh);
  const certs = asArr<AnyRec>(crtsh?.certificates) as AnyRec[];
  const issuers = asArr<AnyRec>(crtsh?.issuers);
  // Prefer explicit certificates list, else fall back to subdomain-style rows
  if (certs.length > 0) {
    return certs.slice(0, 20).map((c) => ({
      commonName: (c.common_name as string) || (c.name_value as string) || inv.target_value,
      issuer: (c.issuer_name as string) || (c.issuer as string),
      notBefore: fmtDate(c.not_before),
      notAfter: fmtDate(c.not_after),
    }));
  }
  if (issuers.length > 0) {
    return issuers.slice(0, 20).map((i) => ({
      commonName: inv.target_value,
      issuer: (i.issuer_name as string) || (i.name as string),
      notBefore: fmtDate(i.not_before),
      notAfter: fmtDate(i.not_after),
    }));
  }
  return [];
}

interface SshRow {
  ip: string;
  port: number;
  banner?: string;
}

function extractSshRows(inv: Investigation): SshRow[] {
  const results = (inv.results as AnyRec) || {};
  const shodan = asObj(results.shodan);
  const ip = inv.target_type === "ip" ? inv.target_value :
             (asArr<string>(asObj(results.dns)?.A)[0] as string | undefined);
  const services = asArr<AnyRec>(shodan?.services);
  return services
    .filter((s) => s.port === 22 || s.proto === "ssh")
    .map((s) => ({
      ip: ip || "",
      port: (s.port as number) ?? 22,
      banner: (s.banner as string) || undefined,
    }));
}

interface FileRow {
  name: string;
  source: string;
  meta?: string;
  sha?: string;
  url?: string;
  malicious?: boolean;
}

function extractFileRows(inv: Investigation): FileRow[] {
  const results = (inv.results as AnyRec) || {};
  const rows: FileRow[] = [];
  const mb = asObj(results.malwarebazaar);
  if (mb?.status === "found") {
    rows.push({
      name: (mb.file_name as string) || "sample",
      source: "MalwareBazaar",
      meta: `${(mb.file_type as string) || "file"} · ${(mb.signature as string) || "unknown"}`,
      sha: (mb.sha256_hash as string) || inv.target_value,
      malicious: true,
    });
  }
  const gh = asObj(results.github);
  if (gh?.status === "found") {
    for (const r of asArr<AnyRec>(gh.results).slice(0, 20)) {
      rows.push({
        name: (r.path as string) || "leaked-file",
        source: "GitHub",
        meta: r.repo as string,
        url: r.url as string,
        malicious: true,
      });
    }
  }
  return rows;
}

interface ContactRow {
  kind: "email" | "phone" | "address";
  value: string;
  source: string;
  breached?: boolean;
}

function extractContactRows(inv: Investigation): ContactRow[] {
  const results = (inv.results as AnyRec) || {};
  const rows: ContactRow[] = [];
  const whois = asObj(results.whois);
  if (whois?.admin_email) {
    rows.push({ kind: "email", value: whois.admin_email as string, source: "WHOIS" });
  }
  const hibp = asObj(results.hibp);
  if (hibp?.status === "breached" && inv.target_type === "email") {
    rows.push({ kind: "email", value: inv.target_value, source: "HIBP", breached: true });
  }
  if (inv.target_type === "email") {
    rows.push({ kind: "email", value: inv.target_value, source: "target" });
  }
  const phone = asObj(results.phone);
  if (phone && inv.target_type === "phone") {
    rows.push({ kind: "phone", value: inv.target_value, source: "phone_check" });
  }
  return rows;
}

interface AttributionRow {
  kind: string;
  label: string;
  source: string;
  malicious?: boolean;
}

function extractAttributionRows(inv: Investigation): AttributionRow[] {
  const results = (inv.results as AnyRec) || {};
  const rows: AttributionRow[] = [];
  const tf = asObj(results.threatfox);
  if (tf?.status === "found") {
    rows.push({
      kind: "Malware family",
      label: (tf.malware_family as string) || (tf.threat_type as string) || "Unknown family",
      source: "ThreatFox",
      malicious: true,
    });
  }
  const uh = asObj(results.urlhaus);
  if (uh?.status === "found") {
    rows.push({
      kind: "Threat type",
      label: (uh.threat_type as string) || "URLhaus hit",
      source: "URLhaus",
      malicious: true,
    });
  }
  const bl = asObj(results.blocklist);
  if (bl?.status === "found") {
    for (const s of asArr<string>(bl.sources).slice(0, 6)) {
      rows.push({ kind: "Blocklist", label: s, source: "Blocklist feed", malicious: true });
    }
  }
  const gn = asObj(results.greynoise);
  if (gn?.classification) {
    rows.push({
      kind: "GreyNoise",
      label: `${gn.classification}${gn.name ? ` (${gn.name})` : ""}`,
      source: "GreyNoise",
      malicious: gn.classification === "malicious",
    });
  }
  const shodan = asObj(results.shodan);
  if (shodan?.org) {
    rows.push({
      kind: "Owner",
      label: shodan.org as string,
      source: "Shodan",
    });
  }
  const geo = asObj(results.geolocation);
  if (geo?.asn) {
    rows.push({
      kind: "ASN",
      label: `${geo.asn}${geo.isp ? ` · ${geo.isp}` : ""}`,
      source: "Geolocation",
    });
  }
  return rows;
}

// ── Layout / physics helpers ──────────────────────────────────────────────────

function buildInitialPositions(nodes: GraphNode[], cx: number, cy: number): Map<string, PhysicsNode> {
  const map = new Map<string, PhysicsNode>();
  nodes.forEach((node, i) => {
    if (node.pivot) {
      map.set(node.id, { x: cx, y: cy, vx: 0, vy: 0, fx: cx, fy: cy });
    } else {
      const count = Math.max(1, nodes.length - 1);
      const angle = (i / count) * Math.PI * 2;
      const r = 150 + (i % 3) * 40;
      map.set(node.id, {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      });
    }
  });
  return map;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EdgeView({ edge, positions }: { edge: GraphEdge; positions: Map<string, PhysicsNode> }) {
  const a = positions.get(edge.a);
  const b = positions.get(edge.b);
  if (!a || !b) return null;
  return (
    <line
      x1={a.x} y1={a.y}
      x2={b.x} y2={b.y}
      stroke={EDGE_STROKE[edge.kind]}
      strokeWidth={1.2}
      strokeLinecap="round"
      opacity={0.7}
    />
  );
}

function NodeView({
  node, pos, selected, onPointerDown,
}: {
  node: GraphNode;
  pos: PhysicsNode;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent<SVGGElement>, id: string) => void;
}) {
  const style = TYPE_STYLE[node.type];
  const Icon = NODE_ICON[node.type];
  const displayLabel = node.id.length > 28 ? node.id.slice(0, 26) + "…" : node.id;
  const pillW = displayLabel.length * 5.5 + 16;

  return (
    <g
      transform={`translate(${pos.x},${pos.y})`}
      style={{ cursor: "grab" }}
      onPointerDown={(e) => onPointerDown(e, node.id)}
    >
      <circle r={32} fill="none" stroke={style.glow} strokeWidth={14} opacity={0.35} />
      {(selected || node.pivot) && (
        <circle
          r={28}
          fill="none"
          stroke={selected ? "rgba(255,255,255,0.75)" : "rgba(139,92,246,0.6)"}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          style={{ animation: "graphRingSpin 8s linear infinite" }}
        />
      )}
      {node.malicious && (
        <circle r={24} fill="none" stroke="#ef4444" strokeWidth={1.2} opacity={0.8} />
      )}
      <circle r={20} fill="#0B1120" stroke={style.fill} strokeWidth={2.5} />
      <foreignObject x={-9} y={-9} width={18} height={18} style={{ pointerEvents: "none" }}>
        <Icon
          // @ts-expect-error xmlns required on SVG foreignObject children
          xmlns="http://www.w3.org/1999/xhtml"
          className="w-[18px] h-[18px]"
          style={{ color: style.fill }}
        />
      </foreignObject>
      <rect
        x={-(pillW / 2)} y={26}
        width={pillW} height={16} rx={4}
        fill="#0B1120" stroke="rgba(139,92,246,0.18)" strokeWidth={1}
      />
      <text
        y={37} textAnchor="middle" fontSize={9}
        fill="rgba(255,255,255,0.85)"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {displayLabel}
      </text>
    </g>
  );
}

function CardShell({ children, malicious }: { children: React.ReactNode; malicious?: boolean }) {
  return (
    <div
      className="rounded-xl p-4 relative"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(139,92,246,0.07)",
      }}
    >
      {malicious && (
        <span className="absolute top-3 right-3 bg-[#F2634A]/15 text-[#F2634A] border border-[#F2634A]/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Malicious
        </span>
      )}
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
      <div className="text-[13px] text-slate-300 mt-0.5 break-words">{value || <span className="text-slate-600">—</span>}</div>
    </div>
  );
}

function DomainCard({ row }: { row: DomainRow }) {
  return (
    <CardShell malicious={row.malicious}>
      <p className="text-sm font-semibold text-white mb-3 font-mono pr-16 break-all">{row.domain}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <KV label="Registrar date" value={row.regDate} />
        <KV label="Exp date" value={row.expDate} />
        <KV label="Domain name" value={<span className="font-mono">{row.domain}</span>} />
        <KV label="Registrar" value={row.registrar} />
        <div className="col-span-2">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">IP-address</p>
          <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
            {row.ips.length === 0 && <span className="text-slate-600 text-[13px]">—</span>}
            {row.ips.map((ip) => (
              <span key={ip} className="text-[13px] font-mono text-slate-300">{ip}</span>
            ))}
            {row.ipOverflow > 0 && (
              <span className="text-[11px] text-purple-300 bg-purple-500/10 border border-purple-500/15 px-1.5 py-0.5 rounded-full">
                +{row.ipOverflow}
              </span>
            )}
          </div>
        </div>
        <KV label="E-mail" value={row.email} />
        <KV label="Owner" value={row.owner} />
      </div>
    </CardShell>
  );
}

function IpCard({ row }: { row: IpRow }) {
  return (
    <CardShell malicious={row.malicious}>
      <p className="text-sm font-semibold text-white mb-3 font-mono pr-16">{row.ip}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <KV label="ASN" value={row.asn} />
        <KV label="ISP" value={row.isp} />
        <KV label="Country" value={row.country} />
        <KV label="Vulns" value={row.vulns > 0 ? String(row.vulns) : undefined} />
        <div className="col-span-2">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">Open ports</p>
          <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
            {row.ports.length === 0 && <span className="text-slate-600 text-[13px]">—</span>}
            {Array.from(new Set(row.ports)).slice(0, 10).map((p) => (
              <span key={p} className="text-[11px] font-mono text-blue-300 bg-blue-500/10 border border-blue-500/15 px-1.5 py-0.5 rounded-md">{p}</span>
            ))}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function SslCard({ row }: { row: SslRow }) {
  return (
    <CardShell>
      <div className="flex items-start gap-2 mb-2">
        <Lock className="w-3.5 h-3.5 text-purple-300 mt-0.5 shrink-0" />
        <p className="text-sm font-semibold text-white font-mono break-all">{row.commonName}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <KV label="Issuer" value={row.issuer} />
        <KV label="Not before" value={row.notBefore} />
        <KV label="Not after" value={row.notAfter} />
      </div>
    </CardShell>
  );
}

function SshCard({ row }: { row: SshRow }) {
  return (
    <CardShell>
      <p className="text-sm font-semibold text-white mb-2 font-mono">{row.ip}<span className="text-slate-500">:{row.port}</span></p>
      <KV label="Banner" value={row.banner ? <code className="text-[11px] text-slate-400">{row.banner}</code> : undefined} />
    </CardShell>
  );
}

function FileCard({ row }: { row: FileRow }) {
  return (
    <CardShell malicious={row.malicious}>
      <p className="text-sm font-semibold text-white mb-2 font-mono break-all pr-16">{row.name}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <KV label="Source" value={row.source} />
        <KV label="Meta" value={row.meta} />
        {row.sha && <div className="col-span-2"><KV label="SHA-256" value={<span className="font-mono text-[11px] break-all">{row.sha}</span>} /></div>}
        {row.url && <div className="col-span-2">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">URL</p>
          <a href={row.url} target="_blank" rel="noreferrer" className="text-[12px] text-purple-300 hover:text-purple-200 break-all">{row.url}</a>
        </div>}
      </div>
    </CardShell>
  );
}

function ContactCard({ row }: { row: ContactRow }) {
  const Icon = row.kind === "email" ? Mail : row.kind === "phone" ? Phone : MapPin;
  return (
    <CardShell malicious={row.breached}>
      <div className="flex items-start gap-2">
        <Icon className="w-3.5 h-3.5 text-yellow-300 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white font-mono break-all pr-16">{row.value}</p>
          <p className="text-[11px] text-slate-500 mt-1">{row.source}</p>
        </div>
      </div>
    </CardShell>
  );
}

function AttributionCard({ row }: { row: AttributionRow }) {
  return (
    <CardShell malicious={row.malicious}>
      <p className="text-[10px] text-slate-600 uppercase tracking-wider">{row.kind}</p>
      <p className="text-sm font-semibold text-white mt-1 pr-16 break-all">{row.label}</p>
      <p className="text-[11px] text-slate-500 mt-1">{row.source}</p>
    </CardShell>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const DEFAULT_SOURCES: Record<TargetType, string[]> = {
  domain:   ["dns","whois","crtsh","threatfox","urlhaus","blocklist","github","intelx","virustotal","urlscan"],
  ip:       ["geolocation","threatfox","urlhaus","blocklist","shodan_internetdb","virustotal","shodan","greynoise"],
  email:    ["haveibeenpwned","github","dns","whois","virustotal","threatfox","intelx"],
  hash:     ["malwarebazaar","threatfox","blocklist","virustotal"],
  phone:    ["phone_check"],
  username: ["username_platforms","github"],
};

export default function GraphPage() {
  const [orgId, setOrgId] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("domain");
  const [targetInput, setTargetInput] = useState("");
  const [chip, setChip] = useState("");
  const [running, setRunning] = useState(false);
  const [inv, setInv] = useState<Investigation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceStatuses, setSourceStatuses] = useState<Record<string, SourceStatus>>({});
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("domain");
  const [fullscreen, setFullscreen] = useState(false);
  const [tabSearch, setTabSearch] = useState("");

  // Derived graph data
  const graph = useMemo(() => inv ? buildGraph(inv) : { nodes: [], edges: [] }, [inv]);
  const { nodes, edges } = graph;

  // SVG canvas size
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 600, h: 560 });

  // Physics state
  const physicsRef = useRef<Map<string, PhysicsNode>>(new Map());
  const [renderPositions, setRenderPositions] = useState<Map<string, PhysicsNode>>(new Map());
  const rafRef = useRef<number | null>(null);
  const cooldownRef = useRef(0);
  const dragIdRef = useRef<string | null>(null);

  useEffect(() => { setOrgId(getOrgId()); }, []);

  // Resize observer
  useEffect(() => {
    if (!svgRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setSvgSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(svgRef.current);
    return () => obs.disconnect();
  }, [chip]);

  const cx = svgSize.w / 2;
  const cy = svgSize.h / 2;

  // Re-init physics whenever the graph or canvas changes
  const initPhysics = useCallback(() => {
    const map = buildInitialPositions(nodes, cx, cy);
    physicsRef.current = map;
    cooldownRef.current = 0;
    setRenderPositions(new Map(map));
  }, [nodes, cx, cy]);

  useEffect(() => { initPhysics(); }, [initPhysics]);

  // Physics loop — runs until settled
  useEffect(() => {
    if (nodes.length === 0) return;

    const tick = () => {
      const map = physicsRef.current;
      if (!map.size) return;

      const ids = Array.from(map.keys());
      let maxVel = 0;

      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = map.get(ids[i])!;
          const b = map.get(ids[j])!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 30);
          const f = 4000 / (dist * dist);
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;
          if (a.fx === undefined) { a.vx -= fx; a.vy -= fy; }
          if (b.fx === undefined) { b.vx += fx; b.vy += fy; }
        }
      }

      for (const edge of edges) {
        const a = map.get(edge.a);
        const b = map.get(edge.b);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const rest = 130;
        const stretch = dist - rest;
        const f = stretch * 0.02;
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        if (a.fx === undefined) { a.vx += fx; a.vy += fy; }
        if (b.fx === undefined) { b.vx -= fx; b.vy -= fy; }
      }

      const pad = 40;
      for (const id of ids) {
        const n = map.get(id)!;
        if (n.fx !== undefined && n.fy !== undefined) {
          n.x = n.fx; n.y = n.fy; n.vx = 0; n.vy = 0;
          continue;
        }
        n.vx += 0.001 * (cx - n.x);
        n.vy += 0.001 * (cy - n.y);
        n.vx *= 0.85; n.vy *= 0.85;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(pad, Math.min(svgSize.w - pad, n.x));
        n.y = Math.max(pad, Math.min(svgSize.h - pad, n.y));
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > maxVel) maxVel = speed;
      }

      setRenderPositions(new Map(map));
      cooldownRef.current += 1;
      if (maxVel > 0.1 && cooldownRef.current < 360) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [nodes, edges, cx, cy, svgSize.w, svgSize.h]);

  // Drag
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGGElement>, id: string) => {
    e.stopPropagation();
    dragIdRef.current = id;
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const n = physicsRef.current.get(id);
    if (n) { n.fx = x; n.fy = y; }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const id = dragIdRef.current;
    if (!id) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = Math.max(40, Math.min(svgSize.w - 40, e.clientX - rect.left));
    const y = Math.max(40, Math.min(svgSize.h - 40, e.clientY - rect.top));
    const n = physicsRef.current.get(id);
    if (n) { n.fx = x; n.fy = y; }
  }, [svgSize]);

  const handlePointerUp = useCallback(() => {
    const id = dragIdRef.current;
    if (!id) return;
    dragIdRef.current = null;
    const n = physicsRef.current.get(id);
    const node = nodes.find((nd) => nd.id === id);
    if (n && !node?.pivot) { delete n.fx; delete n.fy; }
    cooldownRef.current = 0;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, [nodes]);

  const handleNodeClick = useCallback((id: string) => {
    setSelectedNode(id);
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const tabFor: Record<NodeType, string> = {
      domain: "domain", ip: "ip", email: "contacts", phone: "contacts",
      location: "contacts", malware: "attribution", facebook: "attribution",
      instagram: "attribution", forum: "files", hash: "files",
      leak: "attribution", asn: "attribution",
    };
    setActiveTab(tabFor[node.type] ?? "domain");
  }, [nodes]);

  // Run investigation
  const runInvestigation = useCallback(async (type: TargetType, value: string) => {
    if (!value.trim() || running) return;
    setRunning(true);
    setError(null);
    setInv(null);
    setSelectedNode(null);

    const sources = DEFAULT_SOURCES[type] || [];
    const initial: Record<string, SourceStatus> = {};
    sources.forEach((s) => { initial[s] = "pending"; });
    if (sources[0]) initial[sources[0]] = "running";
    setSourceStatuses(initial);

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const animateProgress = async () => {
      for (let i = 0; i < sources.length; i++) {
        await delay(200 + Math.random() * 200);
        setSourceStatuses((prev) => ({
          ...prev,
          [sources[i]]: "done",
          ...(i + 1 < sources.length ? { [sources[i + 1]]: "running" } : {}),
        }));
      }
    };

    try {
      const [data] = await Promise.all([
        api.investigate(orgId, type, value.trim()),
        animateProgress(),
      ]);
      setInv(data);
      setChip(value.trim());
      setTargetInput("");
      // Default tab based on what's populated
      const r = (data.results as AnyRec) || {};
      if (type === "ip") setActiveTab("ip");
      else if (type === "hash") setActiveTab("files");
      else if (type === "email") setActiveTab("contacts");
      else if (asObj(r.crtsh)) setActiveTab("domain");
      else setActiveTab("domain");
      toast.success(`Investigation complete · ${data.sources_checked?.length ?? 0} sources`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Investigation failed";
      setError(msg);
      setSourceStatuses((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) if (next[k] !== "done") next[k] = "failed";
        return next;
      });
      toast.error(`Investigation failed: ${msg}`);
    } finally {
      setRunning(false);
    }
  }, [orgId, running]);

  // Toolbar actions
  const handleReCenter = useCallback(() => {
    const pivotId = nodes.find((n) => n.pivot)?.id;
    if (!pivotId) return;
    const p = physicsRef.current.get(pivotId);
    if (!p) return;
    p.fx = cx; p.fy = cy; p.x = cx; p.y = cy;
    setRenderPositions(new Map(physicsRef.current));
  }, [cx, cy, nodes]);

  const handleRelayout = useCallback(() => {
    initPhysics();
    cooldownRef.current = 0;
  }, [initPhysics]);

  const handleComingSoon = useCallback((label: string) => {
    toast.info(`${label} — coming soon`);
  }, []);

  const handleExport = useCallback(() => {
    if (!inv) { toast.info("Nothing to export yet"); return; }
    const blob = new Blob([JSON.stringify(inv, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `graph-${inv.target_value.replace(/[^a-z0-9.-]/gi, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [inv]);

  const toolbarButtons = [
    { icon: Locate,     title: "Re-center",  action: handleReCenter },
    { icon: GitBranch,  title: "Graph mode", action: () => handleComingSoon("Graph mode") },
    { icon: Focus,      title: "Fit view",   action: handleReCenter },
    { icon: LayoutGrid, title: "Re-layout",  action: handleRelayout },
    { icon: HelpCircle, title: "Help",       action: () => handleComingSoon("Help") },
    { icon: Maximize2,  title: "Fullscreen", action: () => setFullscreen((f) => !f) },
  ];

  // Tab data (re-computed per render — cheap for these volumes)
  const tabRows = useMemo(() => {
    if (!inv) {
      return {
        domain: [], ip: [], ssl: [], ssh: [], files: [], contacts: [], attribution: [],
      };
    }
    return {
      domain:      extractDomainRows(inv),
      ip:          extractIpRows(inv),
      ssl:         extractSslRows(inv),
      ssh:         extractSshRows(inv),
      files:       extractFileRows(inv),
      contacts:    extractContactRows(inv),
      attribution: extractAttributionRows(inv),
    };
  }, [inv]);

  const tabCounts: Record<string, number> = {
    domain:      tabRows.domain.length,
    ip:          tabRows.ip.length,
    ssl:         tabRows.ssl.length,
    ssh:         tabRows.ssh.length,
    files:       tabRows.files.length,
    contacts:    tabRows.contacts.length,
    attribution: tabRows.attribution.length,
  };

  const hasChip = Boolean(chip);
  const currentType = TARGET_TYPES.find((t) => t.value === targetType) ?? TARGET_TYPES[0];
  const doneCount = Object.values(sourceStatuses).filter((s) => s === "done").length;
  const totalSources = Object.keys(sourceStatuses).length;

  // Tab filtering (shared free-text search across whichever tab is active)
  const matchesSearch = useCallback((fields: (string | number | undefined | null)[]) => {
    if (!tabSearch.trim()) return true;
    const q = tabSearch.toLowerCase();
    return fields.some((f) => f != null && String(f).toLowerCase().includes(q));
  }, [tabSearch]);

  return (
    <>
      <style>{`
        @keyframes graphRingSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <div className="animate-fade-up space-y-5">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <div
            className="relative w-11 h-11 rounded-xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg,rgba(168,85,247,0.15),rgba(59,130,246,0.1))",
              border: "1px solid rgba(168,85,247,0.2)",
            }}
          >
            <Network className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Link Graph</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live OSINT pivot · WHOIS + DNS + crt.sh + Shodan + VirusTotal + ThreatFox + HIBP + more
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          {/* Graph panel */}
          <div className={cn(
            "flex-1 min-w-0 card-enterprise flex flex-col",
            fullscreen && "fixed inset-4 z-50"
          )}>
            {/* Header row */}
            <div className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: "1px solid rgba(139,92,246,0.07)" }}>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white tracking-tight">Graph</h2>
                {inv && (
                  <span className="text-[11px] text-slate-500">
                    {nodes.length} nodes · {edges.length} edges · risk {inv.risk_score ?? "—"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {toolbarButtons.map(({ icon: Icon, title, action }) => (
                  <button
                    key={title} title={title} onClick={action}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 transition-all"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)" }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Target form */}
            <div className="px-5 py-3 space-y-2.5" style={{ borderBottom: "1px solid rgba(139,92,246,0.05)" }}>
              <div className="flex items-center gap-1.5 flex-wrap">
                {TARGET_TYPES.map((t) => {
                  const active = targetType === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setTargetType(t.value)}
                      className={cn(
                        "h-7 px-3 rounded-lg text-[11px] font-semibold border transition-all",
                        active ? "text-purple-200 border-purple-500/30 bg-purple-500/10"
                               : "text-slate-500 border-white/[0.05] bg-white/[0.02] hover:text-slate-300"
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); runInvestigation(targetType, targetInput); }}
                className="flex gap-2"
              >
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                  <input
                    placeholder={currentType.placeholder}
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    disabled={running}
                    className="w-full h-10 pl-9 pr-4 rounded-full text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-purple-500/30 transition-all disabled:opacity-50"
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(139,92,246,0.12)",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={running || !targetInput.trim()}
                  className="h-10 px-5 rounded-full text-sm font-semibold text-white btn-brand disabled:opacity-40 flex items-center gap-2 min-w-[130px] justify-center"
                >
                  {running
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {doneCount}/{totalSources}</>
                    : <>Pivot</>}
                </button>
              </form>

              {/* Active chip */}
              {hasChip && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#c4b5fd" }}>
                    {chip}
                    <button onClick={() => { setChip(""); setInv(null); setSourceStatuses({}); }}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-purple-500/20 transition-colors">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                  {inv?.severity && (
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      inv.severity === "critical" ? "bg-red-500/10 text-red-300 border-red-500/25" :
                      inv.severity === "high" ? "bg-orange-500/10 text-orange-300 border-orange-500/25" :
                      inv.severity === "medium" ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/25" :
                      "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                    )}>{inv.severity}</span>
                  )}
                </div>
              )}

              {/* Source progress (while running) */}
              {running && totalSources > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Querying {totalSources} sources…</span>
                    <span>{doneCount}/{totalSources}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${totalSources > 0 ? (doneCount / totalSources) * 100 : 0}%`,
                        background: "linear-gradient(90deg,#8b5cf6,#ec4899)",
                      }} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                    {Object.entries(sourceStatuses).map(([k, st]) => (
                      <div key={k} className="flex items-center gap-1 text-[10px]">
                        {st === "done" && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />}
                        {st === "running" && <Loader2 className="w-2.5 h-2.5 animate-spin text-purple-300" />}
                        {st === "pending" && <div className="w-2.5 h-2.5 rounded-full border border-slate-600" />}
                        {st === "failed" && <AlertTriangle className="w-2.5 h-2.5 text-red-400" />}
                        <span className={cn(
                          st === "done" ? "text-slate-400" :
                          st === "running" ? "text-purple-300" :
                          st === "failed" ? "text-red-300" :
                          "text-slate-600"
                        )}>{k}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-red-300"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1">{error}</span>
                  <span className="text-[10px] text-red-400/70">Render backend may be cold — retrying auto-extends timeout.</span>
                </div>
              )}
            </div>

            {/* SVG canvas */}
            <div className="flex-1 relative" style={{ minHeight: "560px" }}>
              {hasChip && nodes.length > 0 ? (
                <svg
                  ref={svgRef}
                  className="w-full h-full"
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  style={{ touchAction: "none" }}
                >
                  <defs>
                    <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Radial grid */}
                  <g style={{ pointerEvents: "none" }}>
                    {[0.35, 0.65].map((ratio) => (
                      <circle key={ratio} cx={cx} cy={cy}
                        r={Math.min(cx, cy) * ratio * 1.4}
                        fill="none" stroke="rgba(139,92,246,0.05)" strokeWidth={1} strokeDasharray="4 6" />
                    ))}
                    {Array.from({ length: 6 }, (_, i) => {
                      const angle = (i / 6) * Math.PI * 2;
                      const rOuter = Math.min(cx, cy) * 0.65 * 1.4;
                      return (
                        <line key={i} x1={cx} y1={cy}
                          x2={cx + Math.cos(angle) * rOuter}
                          y2={cy + Math.sin(angle) * rOuter}
                          stroke="rgba(139,92,246,0.04)" strokeWidth={1} />
                      );
                    })}
                  </g>

                  <g>
                    {edges.map((edge, i) => (
                      <EdgeView key={`${edge.a}→${edge.b}-${i}`} edge={edge} positions={renderPositions} />
                    ))}
                  </g>

                  <g>
                    {nodes.map((node) => {
                      const pos = renderPositions.get(node.id);
                      if (!pos) return null;
                      return (
                        <g key={node.id} onClick={() => handleNodeClick(node.id)}>
                          <NodeView node={node} pos={pos} selected={selectedNode === node.id}
                            onPointerDown={handlePointerDown} />
                        </g>
                      );
                    })}
                  </g>
                </svg>
              ) : running ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
                  <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
                  <p className="text-sm text-slate-400">Querying OSINT sources…</p>
                  <p className="text-[11px] text-slate-600 max-w-xs text-center">
                    First call may take 30–90s if the Render backend is cold-starting.
                  </p>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.12)" }}>
                    <Network className="w-8 h-8 text-purple-400 opacity-50" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-400 font-medium">Pivot on any IOC to build the graph</p>
                    <p className="text-xs text-slate-600 mt-1">Domain, IP, Email, or File hash</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-center max-w-md">
                    {["google.com", "8.8.8.8", "example@gmail.com", "44d88612fea8a8f36de82e1278abb02f"].map((v, i) => {
                      const t: TargetType = i === 0 ? "domain" : i === 1 ? "ip" : i === 2 ? "email" : "hash";
                      return (
                        <button key={v} onClick={() => { setTargetType(t); setTargetInput(v); runInvestigation(t, v); }}
                          className="px-3 h-7 rounded-full text-[11px] font-mono text-slate-300 border border-white/[0.06] bg-white/[0.02] hover:border-purple-500/30 hover:text-purple-200 transition-all">
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="w-[380px] shrink-0 hidden xl:flex flex-col card-enterprise" style={{ maxHeight: "calc(100vh - 8rem)" }}>
            <div className="px-5 pt-5 pb-3" style={{ borderBottom: "1px solid rgba(139,92,246,0.07)" }}>
              <h2 className="text-lg font-bold text-white">Nodes details</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {inv ? `Evidence for ${inv.target_value}` : "Run an investigation to populate"}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto px-3 pt-2 gap-0 shrink-0"
              style={{ borderBottom: "1px solid rgba(139,92,246,0.07)" }}>
              {TAB_DEFS.map((tab) => {
                const active = activeTab === tab.key;
                const count = tabCounts[tab.key] ?? 0;
                return (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 h-10 text-[12px] font-semibold whitespace-nowrap transition-all shrink-0",
                      active ? "text-white" : "text-slate-500 hover:text-slate-300"
                    )}>
                    {tab.label}
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                      style={{
                        background: active ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)",
                        color: active ? "#c4b5fd" : "#475569",
                        border: active ? "1px solid rgba(139,92,246,0.2)" : "1px solid rgba(255,255,255,0.04)",
                      }}>
                      {count}
                    </span>
                    {active && (
                      <div className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full"
                        style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Controls row */}
            <div className="px-4 py-3 space-y-2 shrink-0" style={{ borderBottom: "1px solid rgba(139,92,246,0.05)" }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                <input
                  value={tabSearch}
                  onChange={(e) => setTabSearch(e.target.value)}
                  placeholder="Search nodes…"
                  className="w-full h-8 pl-9 pr-4 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)" }}
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {["Expiry", "Type"].map((label) => (
                  <button key={label}
                    className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-200 whitespace-nowrap shrink-0 transition-all"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)" }}>
                    {label}<ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                ))}
                <button
                  className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-200 whitespace-nowrap shrink-0 transition-all"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)" }}>
                  <Calendar className="w-3 h-3 opacity-60" /><span>Start — End</span>
                </button>
                <button
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 shrink-0 transition-all"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)" }}>
                  <ArrowDownUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleExport}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 shrink-0 ml-auto transition-all"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(139,92,246,0.1)" }}
                  title="Export JSON">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Result cards */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {!inv && (
                <EmptyTab message="Pivot on an IOC to populate this tab." />
              )}
              {inv && activeTab === "domain" && (
                tabRows.domain.length === 0
                  ? <EmptyTab message="No domain records — DNS/WHOIS/crt.sh returned nothing." />
                  : tabRows.domain
                      .filter((r) => matchesSearch([r.domain, r.registrar, r.email, r.owner]))
                      .map((r) => <DomainCard key={r.domain} row={r} />)
              )}
              {inv && activeTab === "ip" && (
                tabRows.ip.length === 0
                  ? <EmptyTab message="No IP records. Try Shodan/DNS." />
                  : tabRows.ip
                      .filter((r) => matchesSearch([r.ip, r.asn, r.isp, r.country]))
                      .map((r) => <IpCard key={r.ip} row={r} />)
              )}
              {inv && activeTab === "ssl" && (
                tabRows.ssl.length === 0
                  ? <EmptyTab message="No certificates from crt.sh." />
                  : tabRows.ssl
                      .filter((r) => matchesSearch([r.commonName, r.issuer]))
                      .map((r, i) => <SslCard key={`${r.commonName}-${i}`} row={r} />)
              )}
              {inv && activeTab === "ssh" && (
                tabRows.ssh.length === 0
                  ? <EmptyTab message="No SSH banners. Requires Shodan key + exposed SSH." />
                  : tabRows.ssh
                      .filter((r) => matchesSearch([r.ip, r.banner]))
                      .map((r, i) => <SshCard key={`${r.ip}-${i}`} row={r} />)
              )}
              {inv && activeTab === "files" && (
                tabRows.files.length === 0
                  ? <EmptyTab message="No file artifacts. Try a hash or domain with GitHub leaks." />
                  : tabRows.files
                      .filter((r) => matchesSearch([r.name, r.source, r.meta]))
                      .map((r, i) => <FileCard key={`${r.name}-${i}`} row={r} />)
              )}
              {inv && activeTab === "contacts" && (
                tabRows.contacts.length === 0
                  ? <EmptyTab message="No contacts. WHOIS + HIBP populate this tab." />
                  : tabRows.contacts
                      .filter((r) => matchesSearch([r.value, r.source]))
                      .map((r, i) => <ContactCard key={`${r.value}-${i}`} row={r} />)
              )}
              {inv && activeTab === "attribution" && (
                tabRows.attribution.length === 0
                  ? <EmptyTab message="No attribution signals. ThreatFox/URLhaus/blocklists drive this tab." />
                  : tabRows.attribution
                      .filter((r) => matchesSearch([r.kind, r.label, r.source]))
                      .map((r, i) => <AttributionCard key={`${r.label}-${i}`} row={r} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.1)" }}>
        <Shield className="w-6 h-6 text-purple-400 opacity-40" />
      </div>
      <p className="text-xs text-slate-500 text-center max-w-[240px]">{message}</p>
    </div>
  );
}
