"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search, X, Locate, GitBranch, Focus, LayoutGrid, HelpCircle,
  Maximize2, Globe, Server, Mail, Phone, MapPin, Bug,
  Facebook, Instagram, MessageSquare, Calendar, ArrowDownUp,
  Download, ChevronDown, Network,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type NodeType = "domain" | "ip" | "email" | "phone" | "location" | "malware" | "facebook" | "instagram" | "forum";
type EdgeKind = "contact" | "social" | "infra" | "forum" | "malware";

interface DemoNode {
  id: string;
  type: NodeType;
  label: string;
  pivot?: boolean;
  malicious?: boolean;
}

interface DemoEdge {
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

// ── Demo dataset ───────────────────────────────────────────────────────────────

const DEMO_NODES: DemoNode[] = [
  { id: "berbank.com",        type: "domain",    label: "Domain: berbank.com",         pivot: true },
  { id: "cin.kp",             type: "domain",    label: "Domain: cin.kp" },
  { id: "neerco.net",         type: "domain",    label: "Domain: neerco.net",           malicious: true },
  { id: "admin@neerco.net",   type: "email",     label: "Email: admin@neerco.net" },
  { id: "pyongyang",          type: "location",  label: "Location: Pyongyang" },
  { id: "+86 199-9145-1884",  type: "phone",     label: "Phone: +86 199-9145-1884" },
  { id: "spyeye",             type: "malware",   label: "Malware: SpyEye",              malicious: true },
  { id: "292.168.3.4",        type: "ip",        label: "IP: 292.168.3.4" },
  { id: "234.221.98.0",       type: "ip",        label: "IP: 234.221.98.0" },
  { id: "234.221.98.01",      type: "ip",        label: "IP: 234.221.98.01" },
  { id: "234.221.98.05",      type: "ip",        label: "IP: 234.221.98.05" },
  { id: "@zld_y_92oo",        type: "facebook",  label: "Facebook: @zld_y_92oo" },
  { id: "@zld9200",           type: "instagram", label: "Instagram: @zld9200" },
  { id: "r-cin.com",          type: "forum",     label: "Forum: r-cin.com" },
];

const DEMO_EDGES: DemoEdge[] = [
  { a: "berbank.com", b: "admin@neerco.net",  kind: "contact" },
  { a: "berbank.com", b: "pyongyang",          kind: "contact" },
  { a: "berbank.com", b: "+86 199-9145-1884",  kind: "contact" },
  { a: "berbank.com", b: "cin.kp",             kind: "infra" },
  { a: "berbank.com", b: "neerco.net",         kind: "infra" },
  { a: "cin.kp",      b: "292.168.3.4",        kind: "infra" },
  { a: "neerco.net",  b: "234.221.98.0",       kind: "infra" },
  { a: "neerco.net",  b: "234.221.98.01",      kind: "infra" },
  { a: "neerco.net",  b: "234.221.98.05",      kind: "infra" },
  { a: "234.221.98.01", b: "spyeye",           kind: "malware" },
  { a: "berbank.com", b: "@zld_y_92oo",        kind: "social" },
  { a: "berbank.com", b: "@zld9200",           kind: "social" },
  { a: "berbank.com", b: "r-cin.com",          kind: "forum" },
];

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
};

const EDGE_STROKE: Record<EdgeKind, string> = {
  contact: "rgba(250,204,21,0.55)",
  social:  "rgba(59,130,246,0.55)",
  infra:   "rgba(16,185,129,0.55)",
  forum:   "rgba(236,72,153,0.6)",
  malware: "rgba(234,88,12,0.6)",
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
};

// ── Tab meta ───────────────────────────────────────────────────────────────────

const TABS = [
  { key: "domain",    label: "Domains",     count: 12 },
  { key: "ip",        label: "IP",          count: 145 },
  { key: "ssl",       label: "SSL",         count: 12 },
  { key: "ssh",       label: "SSH",         count: 8 },
  { key: "files",     label: "Files",       count: 7 },
  { key: "contacts",  label: "Contacts",    count: 16 },
  { key: "attribution", label: "Attribution", count: 4 },
];

// ── Domain result cards (hardcoded) ───────────────────────────────────────────

interface DomainRecord {
  domain: string;
  regDate: string;
  expDate: string;
  registrar: string;
  ips: string[];
  ipOverflow: number;
  email: string;
  owner: string;
  malicious?: boolean;
}

const DOMAIN_RECORDS: DomainRecord[] = [
  {
    domain: "berbank.com",
    regDate: "13 Dec 2018",
    expDate: "3 Feb 2023",
    registrar: "reg-ripn",
    ips: ["195.208.0.4", "195.208.0.5"],
    ipOverflow: 3,
    email: "card@tours-cin.org",
    owner: "AS56724",
  },
  {
    domain: "cin.kp",
    regDate: "25 Oct 2019",
    expDate: "22 Feb 2022",
    registrar: "r01-reg-ripn",
    ips: ["195.208.0.4", "292.168.3.4"],
    ipOverflow: 9,
    email: "admin@pneer.net",
    owner: "AS43783",
  },
  {
    domain: "neerco.net",
    regDate: "12 Dec 2019",
    expDate: "2 Feb 2022",
    registrar: "reg-ripn",
    ips: ["234.221.98.01", "234.221.98.03"],
    ipOverflow: 3,
    email: "ad@ci-nema.net",
    owner: "AS4482",
    malicious: true,
  },
  {
    domain: "r-cin.com",
    regDate: "5 May 2020",
    expDate: "5 May 2023",
    registrar: "reg-ripn",
    ips: ["234.221.98.05"],
    ipOverflow: 1,
    email: "webmaster@r-cin.com",
    owner: "AS4482",
    malicious: true,
  },
];

// ── Physics helpers ────────────────────────────────────────────────────────────

function buildInitialPositions(cx: number, cy: number): Map<string, PhysicsNode> {
  const map = new Map<string, PhysicsNode>();
  DEMO_NODES.forEach((node, i) => {
    if (node.pivot) {
      map.set(node.id, { x: cx, y: cy, vx: 0, vy: 0, fx: cx, fy: cy });
    } else {
      // Spread nodes in a circle so initial layout doesn't explode
      const angle = (i / (DEMO_NODES.length - 1)) * Math.PI * 2;
      const r = 160 + (i % 3) * 40;
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

function EdgeView({ edge, positions }: { edge: DemoEdge; positions: Map<string, PhysicsNode> }) {
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
  node,
  pos,
  selected,
  onPointerDown,
}: {
  node: DemoNode;
  pos: PhysicsNode;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent<SVGGElement>, id: string) => void;
}) {
  const style = TYPE_STYLE[node.type];
  const Icon = NODE_ICON[node.type];
  // Pre-compute label pill width (monospace approximation)
  const pillW = node.label.length * 5.5 + 16;

  return (
    <g
      transform={`translate(${pos.x},${pos.y})`}
      style={{ cursor: "grab" }}
      onPointerDown={(e) => onPointerDown(e, node.id)}
    >
      {/* Soft halo */}
      <circle r={32} fill="none" stroke={style.glow} strokeWidth={14} opacity={0.35} />

      {/* Selected/pivot dashed ring */}
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

      {/* Inner filled ring */}
      <circle r={20} fill="#0B1120" stroke={style.fill} strokeWidth={2.5} />

      {/* Icon via foreignObject */}
      <foreignObject x={-9} y={-9} width={18} height={18} style={{ pointerEvents: "none" }}>
        <Icon
          // @ts-expect-error xmlns required on SVG foreignObject children
          xmlns="http://www.w3.org/1999/xhtml"
          className="w-[18px] h-[18px]"
          style={{ color: style.fill }}
        />
      </foreignObject>

      {/* Label pill */}
      <rect
        x={-(pillW / 2)}
        y={26}
        width={pillW}
        height={16}
        rx={4}
        fill="#0B1120"
        stroke="rgba(139,92,246,0.18)"
        strokeWidth={1}
      />
      <text
        y={37}
        textAnchor="middle"
        fontSize={9}
        fill="rgba(255,255,255,0.85)"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {node.id}
      </text>
    </g>
  );
}

function ResultCard({ record }: { record: DomainRecord }) {
  return (
    <div
      className="rounded-xl p-4 relative"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(139,92,246,0.07)",
      }}
    >
      {record.malicious && (
        <span className="absolute top-3 right-3 bg-[#F2634A]/15 text-[#F2634A] border border-[#F2634A]/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Malicious
        </span>
      )}
      <p className="text-sm font-semibold text-white mb-3 font-mono pr-16">{record.domain}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {[
          ["Registrar date", record.regDate, false],
          ["Exp date",       record.expDate,  false],
          ["Domain name",    record.domain,   false],
          ["Registrar",      record.registrar, false],
        ].map(([k, v]) => (
          <div key={k as string}>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider">{k}</p>
            <p className="text-[13px] text-slate-300 mt-0.5">{v}</p>
          </div>
        ))}
        {/* IP address row — spans both columns */}
        <div className="col-span-2">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">IP-address</p>
          <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
            {record.ips.map((ip) => (
              <span key={ip} className="text-[13px] font-mono text-slate-300">{ip}</span>
            ))}
            {record.ipOverflow > 0 && (
              <span className="text-[11px] text-purple-300 bg-purple-500/10 border border-purple-500/15 px-1.5 py-0.5 rounded-full">
                +{record.ipOverflow}
              </span>
            )}
          </div>
        </div>
        <div>
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">E-mail</p>
          <p className="text-[13px] text-slate-300 mt-0.5 break-all">{record.email}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">Owner</p>
          <p className="text-[13px] text-slate-300 mt-0.5">{record.owner}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function GraphPage() {
  const [chip, setChip] = useState<string>("berbank.com");
  const [chipInput, setChipInput] = useState("");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("domain");
  const [fullscreen, setFullscreen] = useState(false);

  // SVG canvas size
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 600, h: 560 });

  // Physics state stored in a ref to avoid re-renders per tick
  const physicsRef = useRef<Map<string, PhysicsNode>>(new Map());
  const [renderPositions, setRenderPositions] = useState<Map<string, PhysicsNode>>(new Map());
  const rafRef = useRef<number | null>(null);
  const cooldownRef = useRef(0);
  const dragIdRef = useRef<string | null>(null);

  // Observe SVG container resize
  useEffect(() => {
    if (!svgRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) {
        setSvgSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    obs.observe(svgRef.current);
    return () => obs.disconnect();
  }, []);

  const cx = svgSize.w / 2;
  const cy = svgSize.h / 2;

  // Initialise / re-initialise physics positions
  const initPhysics = useCallback(() => {
    const map = buildInitialPositions(cx, cy);
    physicsRef.current = map;
    cooldownRef.current = 0;
    setRenderPositions(new Map(map));
  }, [cx, cy]);

  useEffect(() => {
    initPhysics();
  }, [initPhysics]);

  // Physics loop
  useEffect(() => {
    if (!chip) return;

    const tick = () => {
      const map = physicsRef.current;
      if (!map.size) return;

      const ids = Array.from(map.keys());
      const maxVel = { v: 0 };

      // Repulsion
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = map.get(ids[i])!;
          const b = map.get(ids[j])!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          // Cap minimum distance so nodes don't launch to infinity
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 30);
          const f = 4000 / (dist * dist);
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;
          if (!a.fx) { a.vx -= fx; a.vy -= fy; }
          if (!b.fx) { b.vx += fx; b.vy += fy; }
        }
      }

      // Spring along edges
      for (const edge of DEMO_EDGES) {
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
        if (!a.fx) { a.vx += fx; a.vy += fy; }
        if (!b.fx) { b.vx -= fx; b.vy -= fy; }
      }

      // Centering + damping + integrate
      const pad = 40;
      for (const id of ids) {
        const n = map.get(id)!;
        if (n.fx !== undefined && n.fy !== undefined) {
          n.x = n.fx;
          n.y = n.fy;
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        // Gentle pull toward canvas center
        n.vx += 0.001 * (cx - n.x);
        n.vy += 0.001 * (cy - n.y);
        // Damping — 0.85 bleeds energy out so simulation converges
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        // Clamp to canvas
        n.x = Math.max(pad, Math.min(svgSize.w - pad, n.x));
        n.y = Math.max(pad, Math.min(svgSize.h - pad, n.y));
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > maxVel.v) maxVel.v = speed;
      }

      setRenderPositions(new Map(map));
      cooldownRef.current += 1;

      // Stop when settled (max velocity < 0.1 or hard cap ~360 frames at 60fps = 6s)
      if (maxVel.v > 0.1 && cooldownRef.current < 360) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [chip, cx, cy, svgSize.w, svgSize.h]);

  // Drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGGElement>, id: string) => {
    e.stopPropagation();
    dragIdRef.current = id;
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
    // Fix node position to cursor
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

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const id = dragIdRef.current;
    if (!id) return;
    dragIdRef.current = null;
    const n = physicsRef.current.get(id);
    // Don't unfix the pivot
    const node = DEMO_NODES.find((nd) => nd.id === id);
    if (n && !node?.pivot) {
      delete n.fx;
      delete n.fy;
    }
    // Re-start simulation so neighbors settle around dragged node
    cooldownRef.current = 0;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  const handleNodeClick = useCallback((id: string) => {
    setSelectedNode(id);
    const node = DEMO_NODES.find((n) => n.id === id);
    if (node) {
      const tabKey = TABS.find((t) => t.key === node.type)?.key ?? "domain";
      setActiveTab(tabKey);
    }
  }, []);

  // Toolbar actions
  const handleReCenter = useCallback(() => {
    const pivot = physicsRef.current.get("berbank.com");
    if (!pivot) return;
    pivot.fx = cx;
    pivot.fy = cy;
    pivot.x = cx;
    pivot.y = cy;
    setRenderPositions(new Map(physicsRef.current));
  }, [cx, cy]);

  const handleFitView = useCallback(() => {
    // Just re-center; real viewBox zoom not implemented in v1
    handleReCenter();
  }, [handleReCenter]);

  const handleRelayout = useCallback(() => {
    initPhysics();
    // Restart the RAF loop
    cooldownRef.current = 0;
  }, [initPhysics]);

  const handleComingSoon = useCallback((label: string) => {
    toast.info(`${label} — coming soon`);
  }, []);

  const toolbarButtons = [
    { icon: Locate,     title: "Re-center",   action: handleReCenter },
    { icon: GitBranch,  title: "Graph mode",  action: () => handleComingSoon("Graph mode") },
    { icon: Focus,      title: "Fit view",    action: handleFitView },
    { icon: LayoutGrid, title: "Re-layout",   action: handleRelayout },
    { icon: HelpCircle, title: "Help",        action: () => handleComingSoon("Help") },
    { icon: Maximize2,  title: "Fullscreen",  action: () => setFullscreen((f) => !f) },
  ];

  const hasChip = Boolean(chip);

  return (
    <>
      {/* Spin animation for pivot ring — injected once */}
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
              Force-directed entity relationship map · Pivot on any IOC
            </p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-4 items-start">
          {/* ── Graph panel ─────────────────────────────────────────────────── */}
          <div
            className={cn(
              "flex-1 min-w-0 card-enterprise flex flex-col",
              fullscreen && "fixed inset-4 z-50"
            )}
          >
            {/* Graph header row */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: "1px solid rgba(139,92,246,0.07)" }}
            >
              <h2 className="text-lg font-bold text-white tracking-tight">Graph</h2>
              <div className="flex items-center gap-1">
                {toolbarButtons.map(({ icon: Icon, title, action }) => (
                  <button
                    key={title}
                    title={title}
                    onClick={action}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 transition-all"
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(139,92,246,0.1)",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Filter bar */}
            <div className="px-5 py-3 space-y-2" style={{ borderBottom: "1px solid rgba(139,92,246,0.05)" }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                <input
                  placeholder="Add entity…"
                  value={chipInput}
                  onChange={(e) => setChipInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && chipInput.trim()) {
                      setChip(chipInput.trim());
                      setChipInput("");
                      initPhysics();
                    }
                  }}
                  className="w-full h-9 pl-9 pr-4 rounded-full text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-purple-500/30 transition-all"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(139,92,246,0.12)",
                  }}
                />
              </div>

              {/* Active chip */}
              {hasChip && (
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: "rgba(139,92,246,0.12)",
                      border: "1px solid rgba(139,92,246,0.25)",
                      color: "#c4b5fd",
                    }}
                  >
                    {chip}
                    <button
                      onClick={() => setChip("")}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-purple-500/20 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                </div>
              )}

              {!hasChip && (
                <p className="text-[11px] text-slate-600 pl-1">
                  Add an entity to pivot · Domain, IP, Email, Hash…
                </p>
              )}

              {hasChip && (
                <p className="text-[11px] text-slate-600 pl-1">
                  Add an entity to pivot · Domain, IP, Email, Hash…
                </p>
              )}
            </div>

            {/* SVG canvas */}
            <div className="flex-1 relative" style={{ minHeight: "560px" }}>
              {hasChip ? (
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

                  {/* Radial grid — two dashed circles + 6 spokes */}
                  <g style={{ pointerEvents: "none" }}>
                    {[0.35, 0.65].map((ratio) => (
                      <circle
                        key={ratio}
                        cx={cx}
                        cy={cy}
                        r={Math.min(cx, cy) * ratio * 1.4}
                        fill="none"
                        stroke="rgba(139,92,246,0.05)"
                        strokeWidth={1}
                        strokeDasharray="4 6"
                      />
                    ))}
                    {Array.from({ length: 6 }, (_, i) => {
                      const angle = (i / 6) * Math.PI * 2;
                      const rOuter = Math.min(cx, cy) * 0.65 * 1.4;
                      return (
                        <line
                          key={i}
                          x1={cx}
                          y1={cy}
                          x2={cx + Math.cos(angle) * rOuter}
                          y2={cy + Math.sin(angle) * rOuter}
                          stroke="rgba(139,92,246,0.04)"
                          strokeWidth={1}
                        />
                      );
                    })}
                  </g>

                  {/* Edges rendered below nodes */}
                  <g>
                    {DEMO_EDGES.map((edge) => (
                      <EdgeView key={`${edge.a}→${edge.b}`} edge={edge} positions={renderPositions} />
                    ))}
                  </g>

                  {/* Nodes */}
                  <g>
                    {DEMO_NODES.map((node) => {
                      const pos = renderPositions.get(node.id);
                      if (!pos) return null;
                      return (
                        <NodeView
                          key={node.id}
                          node={node}
                          pos={pos}
                          selected={selectedNode === node.id}
                          onPointerDown={handlePointerDown}
                        />
                      );
                    })}
                  </g>
                </svg>
              ) : (
                /* Empty state */
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{
                      background: "rgba(168,85,247,0.06)",
                      border: "1px solid rgba(168,85,247,0.12)",
                    }}
                  >
                    <Network className="w-8 h-8 text-purple-400 opacity-50" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-400 font-medium">Add an entity to pivot</p>
                    <p className="text-xs text-slate-600 mt-1">Domain, IP, Email, Hash, or Phone number</p>
                  </div>
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                    <input
                      placeholder="e.g. berbank.com"
                      value={chipInput}
                      onChange={(e) => setChipInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && chipInput.trim()) {
                          setChip(chipInput.trim());
                          setChipInput("");
                          initPhysics();
                        }
                      }}
                      className="w-full h-10 pl-9 pr-4 rounded-xl text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-purple-500/30 transition-all"
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        border: "1px solid rgba(139,92,246,0.12)",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right panel: Node details ────────────────────────────────────── */}
          <div className="w-[380px] shrink-0 hidden xl:flex flex-col card-enterprise" style={{ maxHeight: "calc(100vh - 8rem)" }}>
            {/* Panel title */}
            <div className="px-5 pt-5 pb-3" style={{ borderBottom: "1px solid rgba(139,92,246,0.07)" }}>
              <h2 className="text-lg font-bold text-white">Nodes details</h2>
            </div>

            {/* Tabs */}
            <div
              className="flex overflow-x-auto px-3 pt-2 gap-0 shrink-0"
              style={{ borderBottom: "1px solid rgba(139,92,246,0.07)" }}
            >
              {TABS.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 h-10 text-[12px] font-semibold whitespace-nowrap transition-all shrink-0",
                      active ? "text-white" : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {tab.label}
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                      style={{
                        background: active ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)",
                        color: active ? "#c4b5fd" : "#475569",
                        border: active ? "1px solid rgba(139,92,246,0.2)" : "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      {tab.count}
                    </span>
                    {active && (
                      <div
                        className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full"
                        style={{ background: "linear-gradient(90deg,#8b5cf6,#ec4899)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Controls row */}
            <div className="px-4 py-3 space-y-2 shrink-0" style={{ borderBottom: "1px solid rgba(139,92,246,0.05)" }}>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                <input
                  placeholder="Search nodes…"
                  className="w-full h-8 pl-9 pr-4 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(139,92,246,0.1)",
                  }}
                />
              </div>

              {/* Filter chips row */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {["Expiry", "Domain"].map((label) => (
                  <button
                    key={label}
                    className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-200 whitespace-nowrap shrink-0 transition-all"
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(139,92,246,0.1)",
                    }}
                  >
                    {label}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                ))}

                {/* Date range */}
                <button
                  className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-200 whitespace-nowrap shrink-0 transition-all"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(139,92,246,0.1)",
                  }}
                >
                  <Calendar className="w-3 h-3 opacity-60" />
                  <span>Start — End</span>
                </button>

                {/* Sort direction */}
                <button
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 shrink-0 transition-all"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(139,92,246,0.1)",
                  }}
                >
                  <ArrowDownUp className="w-3.5 h-3.5" />
                </button>

                {/* Secondary sort */}
                <button
                  className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-200 whitespace-nowrap shrink-0 transition-all"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(139,92,246,0.1)",
                  }}
                >
                  Domain
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>

                {/* Download */}
                <button
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 shrink-0 ml-auto transition-all"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(139,92,246,0.1)",
                  }}
                  title="Export"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Result cards — scrollable */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {activeTab === "domain"
                ? DOMAIN_RECORDS.map((r) => <ResultCard key={r.domain} record={r} />)
                : (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: "rgba(168,85,247,0.06)",
                        border: "1px solid rgba(168,85,247,0.1)",
                      }}
                    >
                      <Network className="w-6 h-6 text-purple-400 opacity-40" />
                    </div>
                    <p className="text-xs text-slate-500">No records for this tab in demo mode</p>
                  </div>
                )
              }
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
