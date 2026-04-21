"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Brain, Send, Paperclip, ChevronRight, Sparkles, Copy,
  MessageSquare, Clock, Terminal, ExternalLink, Shield,
  AlertTriangle, FileText, BookOpen, Zap, User, Loader2,
  ChevronDown,
} from "lucide-react";

// ── Canned responses ──────────────────────────────────────────────────────────
const CANNED: Array<{ keywords: string[]; response: CannedResponse }> = [
  {
    keywords: ["critical", "alert", "today", "summary", "recent"],
    response: {
      title: "Today's Critical Alert Summary",
      sections: [
        {
          heading: "Critical Findings (3)",
          items: [
            "**Ransomware C2 beacon** detected from 185.220.101.47 — matches LockBit 3.0 infrastructure [1]",
            "**14 employee credentials** leaked in Stealer Log dump — impacted: sales@, support@ (7 active sessions) [2]",
            "**CVE-2024-3400** (PAN-OS RCE) — 2 internet-facing firewalls unpatched, CVSS 10.0 [3]",
          ],
        },
        {
          heading: "Recommended Actions",
          items: [
            "Block IP 185.220.101.47 at perimeter immediately",
            "Force password reset for affected accounts, revoke active sessions",
            "Apply PAN-OS hotfix HF-3400 within 24h — actively exploited in the wild",
          ],
        },
      ],
      citations: [
        { id: 1, label: "LockBit 3.0 IOC Feed", url: "#" },
        { id: 2, label: "Stealer Log Report #4412", url: "#" },
        { id: 3, label: "CISA KEV — CVE-2024-3400", url: "#" },
      ],
      codeBlock: null,
      table: null,
    },
  },
  {
    keywords: ["cve-2024", "exposed", "vulnerable", "patch", "cve"],
    response: {
      title: "CVE Exposure Analysis",
      sections: [
        {
          heading: "Exposure Status: CVE-2024-3400",
          items: [
            "**Severity:** Critical (CVSS 10.0) — OS Command Injection in PAN-OS GlobalProtect",
            "**Your exposure:** 2 assets match this CVE (fw-prod-01, fw-edge-02)",
            "**Exploitation:** Actively exploited in-the-wild since Apr 12, 2024 [1]",
            "**Patch available:** PAN-OS 10.2.9-h1, 11.0.4-h1, 11.1.2-h3 [2]",
          ],
        },
        {
          heading: "Mitigation Steps",
          items: [
            "Apply hotfix immediately (downtime: ~8 min per device)",
            "Temporarily disable GlobalProtect if patching is delayed",
            "Enable Threat Prevention Signature 95187 as temporary workaround",
          ],
        },
      ],
      citations: [
        { id: 1, label: "CISA KEV Catalog", url: "#" },
        { id: 2, label: "Palo Alto Security Advisory", url: "#" },
      ],
      codeBlock: {
        lang: "bash",
        code: `# Verify affected version\nssh admin@fw-prod-01 "show system info | match version"\n\n# Apply hotfix (run from Panorama)\nrequest system software install version 10.2.9-h1`,
      },
      table: null,
    },
  },
  {
    keywords: ["actor", "threat actor", "target", "industry", "who", "group"],
    response: {
      title: "Threat Actors Targeting Your Industry",
      sections: [
        {
          heading: "High-Priority Threat Groups",
          items: [
            "**APT29 (Cozy Bear)** — Nation-state, Russia. Active campaigns against FinTech/SaaS via spear-phishing + OAuth abuse [1]",
            "**Scattered Spider** — Financially motivated. Known for vishing + MFA fatigue attacks against cloud-heavy orgs [2]",
            "**ALPHV/BlackCat** — Ransomware-as-a-Service. Exfiltrates data before encryption; avg ransom $4.5M [3]",
          ],
        },
        {
          heading: "TTPs Most Relevant to You",
          items: [
            "Initial access: Phishing (T1566) — 64% of incidents in your sector",
            "Persistence: OAuth application abuse (T1550.001)",
            "Impact: Data exfiltration to Mega.nz + SFTP before encryption",
          ],
        },
      ],
      citations: [
        { id: 1, label: "MITRE ATT&CK — APT29", url: "#" },
        { id: 2, label: "CrowdStrike 2024 Threat Report", url: "#" },
        { id: 3, label: "ALPHV IOC Database", url: "#" },
      ],
      codeBlock: null,
      table: {
        headers: ["Group", "Motivation", "Sectors", "TTP Count"],
        rows: [
          ["APT29", "Espionage", "FinTech, Gov", "47"],
          ["Scattered Spider", "Financial", "Cloud SaaS", "23"],
          ["ALPHV/BlackCat", "Ransomware", "All sectors", "38"],
        ],
      },
    },
  },
  {
    keywords: ["playbook", "incident response", "ir", "ransomware", "respond"],
    response: {
      title: "Incident Response Playbook — Ransomware",
      sections: [
        {
          heading: "Phase 1: Contain (0–2h)",
          items: [
            "Isolate affected hosts: disconnect from network, preserve memory dump",
            "Revoke compromised credentials, disable affected AD accounts",
            "Block known C2 IPs at firewall/EDR: 185.220.101.47, 194.165.16.x/24",
          ],
        },
        {
          heading: "Phase 2: Investigate (2–8h)",
          items: [
            "Identify patient zero via EDR timeline and lateral movement logs",
            "Determine exfiltration scope — check DLP, egress firewall, cloud storage",
            "Preserve forensic artifacts: NTFS MFT, prefetch, registry hives",
          ],
        },
        {
          heading: "Phase 3: Recover (8h+)",
          items: [
            "Restore from last known-good snapshots (validate hash integrity)",
            "Patch initial access vector before reconnecting systems",
            "Issue external breach notification if PII/PHI was exfiltrated",
          ],
        },
      ],
      citations: [
        { id: 1, label: "NIST SP 800-61r2", url: "#" },
        { id: 2, label: "CISA Ransomware Guide", url: "#" },
      ],
      codeBlock: {
        lang: "bash",
        code: `# Isolate host (Windows)\nnetsh advfirewall set allprofiles state on\nnetsh advfirewall firewall add rule name="IR-Block-All" \\\n  protocol=ANY dir=out action=block\n\n# Capture memory (Linux)\navml-capture --output /mnt/forensics/mem_$(hostname)_$(date +%s).lime`,
      },
      table: null,
    },
  },
  {
    keywords: ["ioc", "explain", "indicator", "ip address", "hash", "domain", "185."],
    response: {
      title: "IOC Analysis — 185.220.101.47",
      sections: [
        {
          heading: "Threat Intelligence Summary",
          items: [
            "**Classification:** Malicious — Tor Exit Node + Malware C2 (LockBit 3.0 infrastructure)",
            "**First seen:** 2024-01-15 · **Last seen:** 2024-04-21 (active)",
            "**ASN:** AS205100 — F3 Netze e.V. (Germany) — known bulletproof hosting [1]",
            "**Reputation score:** 96/100 malicious across 12 threat intel sources [2]",
          ],
        },
        {
          heading: "Associated Campaigns",
          items: [
            "LockBit 3.0 ransomware distribution (Jan–Mar 2024)",
            "Credential stuffing botnet targeting Okta, Azure AD",
            "Cobalt Strike beacon C2 (stager hash: 3f4a2b...)",
          ],
        },
      ],
      citations: [
        { id: 1, label: "VirusTotal Report", url: "#" },
        { id: 2, label: "Shodan — 185.220.101.47", url: "#" },
      ],
      codeBlock: null,
      table: {
        headers: ["Source", "Classification", "Confidence", "Last Updated"],
        rows: [
          ["VirusTotal", "Malicious", "High", "2024-04-20"],
          ["AbuseIPDB", "C2 Server", "95%", "2024-04-21"],
          ["OTX AlienVault", "LockBit IOC", "High", "2024-04-18"],
          ["GreyNoise", "Mass Scanning", "Medium", "2024-04-21"],
        ],
      },
    },
  },
  {
    keywords: ["executive", "brief", "briefing", "report", "board", "management", "summary"],
    response: {
      title: "Executive Threat Briefing — April 2024",
      sections: [
        {
          heading: "Security Posture Overview",
          items: [
            "**Exposure Score:** 724/1000 (↑18 pts from last month) — Good standing vs peers (71st percentile)",
            "**Critical findings this month:** 3 — all have active remediation plans",
            "**Mean time to remediate:** 4.2 days (industry avg: 12.1 days)",
          ],
        },
        {
          heading: "Business Risk Summary",
          items: [
            "**Ransomware risk:** Elevated — industry targeting up 34% YoY. Recommend tabletop exercise Q2.",
            "**Supply chain risk:** 3 vendors flagged with open critical CVEs. Reviewed with vendor security team.",
            "**Compliance posture:** SOC2 Type II on track for June audit. 2 controls need evidence refresh.",
          ],
        },
        {
          heading: "Strategic Recommendations",
          items: [
            "Approve $85K budget for MFA rollout to remaining 12% of employees",
            "Initiate vendor security questionnaire automation (estimated 40h/quarter savings)",
            "Schedule phishing simulation for Q2 — 22% click rate in last exercise",
          ],
        },
      ],
      citations: [
        { id: 1, label: "Verizon DBIR 2024", url: "#" },
        { id: 2, label: "Gartner Security Benchmark", url: "#" },
      ],
      codeBlock: null,
      table: null,
    },
  },
];

interface CannedResponse {
  title: string;
  sections: Array<{ heading: string; items: string[] }>;
  citations: Array<{ id: number; label: string; url: string }>;
  codeBlock: { lang: string; code: string } | null;
  table: { headers: string[]; rows: string[][] } | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: CannedResponse;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  { icon: AlertTriangle, label: "Summarize today's critical alerts", color: "#ef4444" },
  { icon: Shield, label: "Are we exposed to CVE-2024-3400?", color: "#8b5cf6" },
  { icon: Zap, label: "What actors target our industry?", color: "#f97316" },
  { icon: FileText, label: "Generate incident response playbook", color: "#3b82f6" },
  { icon: BookOpen, label: "Explain this IOC: 185.220.101.47", color: "#10b981" },
  { icon: Terminal, label: "Draft executive briefing", color: "#ec4899" },
];

const HISTORY = [
  { id: "h1", title: "LockBit C2 beacon analysis", time: "2h ago" },
  { id: "h2", title: "CVE-2024-3400 exposure check", time: "Yesterday" },
  { id: "h3", title: "Vendor risk summary — April", time: "2 days ago" },
  { id: "h4", title: "Phishing campaign attribution", time: "Apr 18" },
  { id: "h5", title: "Executive briefing Q1 2024", time: "Apr 14" },
];

const DEMO_CONVERSATION: Message[] = [
  {
    id: "d1", role: "user",
    content: "We're seeing suspicious network activity from 185.220.101.47 — what can you tell me?",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: "d2", role: "assistant",
    content: "",
    response: CANNED.find(c => c.keywords.includes("185."))!.response,
    timestamp: new Date(Date.now() - 1000 * 60 * 4),
  },
];

function getCannedResponse(query: string): CannedResponse | null {
  const q = query.toLowerCase();
  for (const c of CANNED) {
    if (c.keywords.some(k => q.includes(k))) return c.response;
  }
  return {
    title: "Threat Intelligence Query",
    sections: [
      {
        heading: "Analysis",
        items: [
          "I've analyzed your query against our threat intelligence corpus.",
          "No exact match found in canned databases — in production this would query live OSINT, MITRE ATT&CK, and your organization's telemetry.",
          "Recommend scoping this query with specific IOCs, CVE IDs, or threat actor names for more targeted results.",
        ],
      },
      {
        heading: "General Recommendations",
        items: [
          "Check active alerts for related indicators",
          "Review recent Dark Web exposure feed for context",
          "Correlate with vendor risk data if supply chain relevant",
        ],
      },
    ],
    citations: [],
    codeBlock: null,
    table: null,
  };
}

function renderBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i} className="text-slate-100 font-semibold">{p}</strong> : p
  );
}

function AIMessage({ msg }: { msg: Message }) {
  const r = msg.response;
  if (!r) return <p className="text-sm text-slate-300 leading-relaxed">{msg.content}</p>;
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-white">{r.title}</h3>
      {r.sections.map((sec, i) => (
        <div key={i}>
          <p className="text-[10px] uppercase tracking-widest text-purple-400 font-bold mb-2">{sec.heading}</p>
          <ul className="space-y-1.5">
            {sec.items.map((item, j) => (
              <li key={j} className="flex items-start gap-2 text-[12px] text-slate-300 leading-relaxed">
                <span className="w-1 h-1 rounded-full bg-purple-400 flex-shrink-0 mt-2" />
                <span>{renderBold(item)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {r.table && (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(139,92,246,0.12)" }}>
          <table className="w-full text-xs">
            <thead style={{ background: "rgba(139,92,246,0.06)" }}>
              <tr>{r.table.headers.map(h => (
                <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "rgba(139,92,246,0.06)" }}>
              {r.table.rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-white/[0.02] transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-300">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {r.codeBlock && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.12)" }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ background: "rgba(139,92,246,0.06)" }}>
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-mono text-purple-300">{r.codeBlock.lang}</span>
            </div>
            <button onClick={() => { navigator.clipboard?.writeText(r.codeBlock!.code); toast.success("Copied"); }}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-white transition-colors">
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <pre className="p-4 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed"
            style={{ background: "rgba(7,4,11,0.8)" }}>
            {r.codeBlock.code}
          </pre>
        </div>
      )}
      {r.citations.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {r.citations.map(c => (
            <a key={c.id} href={c.url}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-blue-300 hover:text-blue-200 transition-colors"
              style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <ExternalLink className="w-2.5 h-2.5" />
              [{c.id}] {c.label}
            </a>
          ))}
        </div>
      )}
      <button className="flex items-center gap-1.5 text-[11px] text-purple-400 hover:text-purple-300 font-medium transition-colors">
        View full analysis <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}

export default function TransilienceAIPage() {
  const [messages, setMessages] = useState<Message[]>(DEMO_CONVERSATION);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [activeHistory, setActiveHistory] = useState("d-demo");
  const [showHistory, setShowHistory] = useState(false);
  const [attachChip, setAttachChip] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const autoResize = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + "px";
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setTyping(true);
    await new Promise(r => setTimeout(r, 1800 + Math.random() * 800));
    const aiResponse = getCannedResponse(text);
    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      response: aiResponse || undefined,
      timestamp: new Date(),
    };
    setTyping(false);
    setMessages(prev => [...prev, aiMsg]);
  }, [typing]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)] animate-fade-up">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-56 flex-shrink-0 card-enterprise p-3 gap-2">
        <div className="flex items-center gap-2 px-1 pb-2" style={{ borderBottom: "1px solid rgba(139,92,246,0.08)" }}>
          <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">History</span>
        </div>
        {/* Current conversation */}
        <button className={cn("flex items-start gap-2 p-2 rounded-lg text-left transition-all",
          "bg-purple-500/[0.08] border border-purple-500/20")}>
          <Brain className="w-3 h-3 text-purple-300 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[11px] text-purple-200 font-medium leading-tight">C2 beacon — 185.220.101.47</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Just now</p>
          </div>
        </button>
        {HISTORY.map(h => (
          <button key={h.id} onClick={() => setActiveHistory(h.id)}
            className={cn("flex items-start gap-2 p-2 rounded-lg text-left hover:bg-white/[0.03] transition-all")}>
            <Clock className="w-3 h-3 text-slate-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[11px] text-slate-400 leading-tight">{h.title}</p>
              <p className="text-[9px] text-slate-600 mt-0.5">{h.time}</p>
            </div>
          </button>
        ))}
        <div className="mt-auto pt-2" style={{ borderTop: "1px solid rgba(139,92,246,0.06)" }}>
          <button onClick={() => { setMessages([]); toast.info("New conversation started"); }}
            className="w-full py-2 rounded-lg text-[11px] font-semibold text-purple-300 bg-purple-500/[0.08] border border-purple-500/20 hover:bg-purple-500/15 transition-all flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3" /> New Chat
          </button>
        </div>
      </div>

      {/* ── Main Chat Area ───────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.2),rgba(236,72,153,0.15))", border: "1px solid rgba(139,92,246,0.3)" }}>
              <Brain className="w-5 h-5 text-purple-300" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: "0 0 10px #10b981" }} />
            </div>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-gradient-brand">Transilience AI</h1>
              <p className="text-[11px] text-slate-500">Your threat intelligence analyst — ask me anything</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-300 font-semibold">AI ONLINE</span>
          </div>
        </div>

        {/* Suggested prompts — only when no user messages beyond demo */}
        {messages.length <= 2 && (
          <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-3 gap-2">
            {SUGGESTED_PROMPTS.map((p) => (
              <button key={p.label} onClick={() => sendMessage(p.label)}
                className="group flex items-start gap-2.5 p-3 rounded-xl text-left transition-all card-enterprise hover:border-purple-500/20"
                style={{ background: "rgba(17,13,26,0.6)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${p.color}15`, border: `1px solid ${p.color}25` }}>
                  <p.icon className="w-3.5 h-3.5" style={{ color: p.color }} />
                </div>
                <p className="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors leading-snug">{p.label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
          {messages.map(msg => (
            <div key={msg.id} className={cn("flex gap-3 animate-fade-up", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
              {/* Avatar */}
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                msg.role === "user"
                  ? "bg-purple-600/80"
                  : "bg-gradient-to-br from-purple-500/20 to-pink-500/15"
              )} style={msg.role === "assistant" ? { border: "1px solid rgba(139,92,246,0.25)" } : {}}>
                {msg.role === "user"
                  ? <User className="w-4 h-4 text-white" />
                  : <Brain className="w-4 h-4 text-purple-300" />}
              </div>
              {/* Bubble */}
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3",
                msg.role === "user"
                  ? "rounded-tr-sm text-sm text-white"
                  : "rounded-tl-sm"
              )} style={msg.role === "user"
                ? { background: "linear-gradient(135deg,#7c3aed,#9333ea)", }
                : { background: "linear-gradient(135deg,rgba(17,13,26,0.95),rgba(13,10,20,0.98))", border: "1px solid rgba(139,92,246,0.1)" }
              }>
                {msg.role === "user"
                  ? <p className="text-sm">{msg.content}</p>
                  : <AIMessage msg={msg} />
                }
                <p className={cn("text-[9px] mt-2", msg.role === "user" ? "text-purple-200 text-right" : "text-slate-600")}>
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex gap-3 animate-fade-up">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)" }}>
                <Brain className="w-4 h-4 text-purple-300" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm"
                style={{ background: "rgba(17,13,26,0.95)", border: "1px solid rgba(139,92,246,0.1)" }}>
                <TypingIndicator />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0">
          {attachChip && (
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-purple-300 font-medium"
                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                <Paperclip className="w-3 h-3" /> {attachChip}
                <button onClick={() => setAttachChip(null)} className="ml-1 text-slate-500 hover:text-white">&times;</button>
              </span>
            </div>
          )}
          <div className="flex items-end gap-2 p-3 rounded-2xl"
            style={{ background: "rgba(17,13,26,0.9)", border: "1px solid rgba(139,92,246,0.12)" }}>
            <button onClick={() => setAttachChip("Alert #4417 — LockBit")}
              className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-all flex-shrink-0 mb-0.5">
              <Paperclip className="w-4 h-4" />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKey}
              placeholder="Ask about threats, CVEs, IOCs, playbooks…"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-slate-200 placeholder-slate-600 focus:outline-none leading-relaxed"
              style={{ minHeight: "36px", maxHeight: "140px" }}
            />
            <div className="flex items-center gap-1.5 flex-shrink-0 mb-0.5">
              <span className="text-[10px] text-slate-600 hidden sm:block">⏎ Send</span>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || typing}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                  input.trim() && !typing
                    ? "btn-brand text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                    : "bg-white/[0.03] text-slate-600 cursor-not-allowed"
                )}>
                {typing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-700 mt-2">
            Transilience AI may produce inaccurate information — always verify critical findings with primary sources.
          </p>
        </div>
      </div>
    </div>
  );
}
