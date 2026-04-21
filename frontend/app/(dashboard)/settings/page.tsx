"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getOrgId } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  User, Shield, Bell, Sliders, Building2, Users, Puzzle, Key, Clock,
  Save, Loader2, ChevronRight, Copy, Check, RefreshCw, Trash2, Plus,
  Mail, Send, AlertTriangle, Globe, Eye, EyeOff, MoreHorizontal,
  Smartphone, X, LogOut, Monitor, Zap, CheckSquare, Square,
  Camera, Lock, QrCode, Activity
} from "lucide-react";

/* ─────────────────────────── API ─────────────────────────── */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://tai-aegis-api.onrender.com";

async function apiFetch(path: string, options: RequestInit = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", "X-Org-Id": getOrgId(), ...(options.headers as Record<string, string>) },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  } catch {
    return null;
  }
}

/* ─────────────────────────── TYPES ─────────────────────────── */
type TabKey =
  | "profile" | "security" | "notifications" | "preferences"
  | "organization" | "team" | "integrations" | "apikeys" | "scans";

interface OrgSettings { name: string; domain: string }
interface NotifSettings {
  email_enabled: boolean; email_recipients: string[];
  webhook_enabled: boolean; webhook_url: string;
  telegram_enabled: boolean; telegram_chat_id: string;
  min_severity: string;
}
interface Schedule { enabled: boolean; interval_hours: number }

/* ─────────────────────────── CONSTANTS ─────────────────────────── */
const SCAN_MODULES = [
  { key: "dark_web",     label: "Dark Web Monitoring",   icon: "🌑", defaultInterval: 6 },
  { key: "brand",        label: "Brand Protection",       icon: "🛡️", defaultInterval: 4 },
  { key: "data_leak",    label: "Data Leak Detection",    icon: "📄", defaultInterval: 12 },
  { key: "surface_web",  label: "Surface Web Scan",       icon: "🌐", defaultInterval: 24 },
  { key: "cert_monitor", label: "Certificate Monitor",    icon: "🔒", defaultInterval: 1 },
  { key: "credential",   label: "Credential Scan",        icon: "🔑", defaultInterval: 8 },
];

const SEVERITY_LEVELS = ["Info", "Low", "Medium", "High", "Critical"];

const SIDEBAR_GROUPS = [
  {
    label: "ACCOUNT",
    items: [
      { key: "profile" as TabKey,       label: "Profile",        icon: User },
      { key: "security" as TabKey,      label: "Security",       icon: Shield },
      { key: "notifications" as TabKey, label: "Notifications",  icon: Bell },
      { key: "preferences" as TabKey,   label: "Preferences",    icon: Sliders },
    ],
  },
  {
    label: "ORGANIZATION",
    items: [
      { key: "organization" as TabKey,  label: "Organization",   icon: Building2 },
      { key: "team" as TabKey,          label: "Team",           icon: Users },
      { key: "integrations" as TabKey,  label: "Integrations",   icon: Puzzle },
      { key: "apikeys" as TabKey,       label: "API Keys",       icon: Key },
      { key: "scans" as TabKey,         label: "Scan Schedules", icon: Clock },
    ],
  },
];

const MOCK_MEMBERS = [
  { id: "1", name: "Arjun Mehta",     email: "arjun@networkintelligence.ai",   role: "Admin",   lastActive: "2 min ago",  status: "online" },
  { id: "2", name: "Priya Nair",      email: "priya@networkintelligence.ai",   role: "Analyst", lastActive: "1 hr ago",   status: "online" },
  { id: "3", name: "Tariq Al-Rashid", email: "tariq@networkintelligence.ai",   role: "Analyst", lastActive: "3 hrs ago",  status: "away" },
  { id: "4", name: "Sofia Bianchi",   email: "sofia@networkintelligence.ai",   role: "Viewer",  lastActive: "Yesterday",  status: "offline" },
  { id: "5", name: "Marcus Webb",     email: "marcus@networkintelligence.ai",  role: "Analyst", lastActive: "2 days ago", status: "offline" },
  { id: "6", name: "Lin Feng",        email: "lin@networkintelligence.ai",     role: "Admin",   lastActive: "5 hrs ago",  status: "online" },
  { id: "7", name: "Elena Kovacs",    email: "elena@networkintelligence.ai",   role: "Viewer",  lastActive: "4 days ago", status: "offline" },
  { id: "8", name: "James Okafor",    email: "james@networkintelligence.ai",   role: "Analyst", lastActive: "Pending",    status: "pending" },
];

const MOCK_API_KEYS = [
  { id: "1", name: "Production CI",     prefix: "tai_live_****aB2c", scopes: ["read:threats","read:creds","write:alerts"],   created: "Mar 12, 2025", lastUsed: "2 min ago",   active: true },
  { id: "2", name: "SIEM Integration",  prefix: "tai_live_****xZ9k", scopes: ["read:threats","read:creds"],                   created: "Jan 5, 2025",  lastUsed: "1 hr ago",    active: true },
  { id: "3", name: "Dashboard Viewer",  prefix: "tai_live_****mP4r", scopes: ["read:threats"],                                created: "Feb 20, 2025", lastUsed: "3 days ago",  active: true },
  { id: "4", name: "Webhook Relay",     prefix: "tai_live_****qW7j", scopes: ["write:webhooks","read:threats"],               created: "Nov 1, 2024",  lastUsed: "8 days ago",  active: false },
  { id: "5", name: "Dev Testing",       prefix: "tai_test_****hK1n", scopes: ["read:threats","read:creds","write:alerts","write:webhooks"], created: "Oct 14, 2024", lastUsed: "Revoked", active: false },
];

const INTEGRATIONS = [
  { group: "SIEM",      items: [
    { id: "splunk",    name: "Splunk",              color: "#FF5733", status: "connected",   letter: "S" },
    { id: "sentinel",  name: "Microsoft Sentinel",  color: "#0078D4", status: "disconnected", letter: "M" },
    { id: "chronicle", name: "Google Chronicle",    color: "#4285F4", status: "disconnected", letter: "G" },
  ]},
  { group: "SOAR",      items: [
    { id: "xsoar",     name: "Cortex XSOAR",        color: "#FA582D", status: "setup",        letter: "C" },
  ]},
  { group: "Ticketing", items: [
    { id: "jira",      name: "Jira",                color: "#0052CC", status: "connected",   letter: "J" },
    { id: "snow",      name: "ServiceNow",          color: "#62D84E", status: "disconnected", letter: "N" },
  ]},
  { group: "Chat",      items: [
    { id: "slack",     name: "Slack",               color: "#4A154B", status: "connected",   letter: "S" },
    { id: "teams",     name: "Microsoft Teams",     color: "#6264A7", status: "disconnected", letter: "T" },
  ]},
  { group: "Identity",  items: [
    { id: "okta",      name: "Okta",                color: "#007DC1", status: "setup",        letter: "O" },
    { id: "aad",       name: "Azure AD",            color: "#0078D4", status: "disconnected", letter: "A" },
  ]},
  { group: "Cloud",     items: [
    { id: "aws",       name: "AWS",                 color: "#FF9900", status: "connected",   letter: "A" },
    { id: "gcp",       name: "GCP",                 color: "#4285F4", status: "disconnected", letter: "G" },
    { id: "azure",     name: "Azure",               color: "#0078D4", status: "disconnected", letter: "Z" },
  ]},
];

const EVENT_TYPES = [
  "Critical CVE", "Credential Leak", "Dark Web Mention", "Ransomware Activity",
  "Asset Discovery", "Vendor Risk", "Exposure Drop"
];

const MOCK_SESSIONS = [
  { id: "1", device: "MacBook Pro (Chrome 124)",  ip: "45.231.12.88",   location: "Mumbai, IN",    lastActive: "Active now",   current: true },
  { id: "2", device: "iPhone 15 (Safari)",        ip: "45.231.12.89",   location: "Mumbai, IN",    lastActive: "2 hrs ago",    current: false },
  { id: "3", device: "Windows 11 (Edge 121)",     ip: "104.28.91.5",    location: "London, UK",    lastActive: "3 days ago",   current: false },
];

const SECURITY_EVENTS = [
  { id: "1", event: "Password changed",          time: "Apr 19, 2026 14:23", risk: "info" },
  { id: "2", event: "New device login",          time: "Apr 17, 2026 08:41", risk: "warning" },
  { id: "3", event: "2FA enabled",              time: "Apr 14, 2026 11:10", risk: "info" },
  { id: "4", event: "API key created",           time: "Apr 12, 2026 16:55", risk: "info" },
  { id: "5", event: "Failed login attempt (3x)", time: "Apr 8,  2026 03:22", risk: "critical" },
];

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Kolkata",
  "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"
];

/* ─────────────────────────── SMALL COMPONENTS ─────────────────────────── */
function Toggle({ on, onToggle, disabled = false }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0",
        on ? "bg-purple-500" : "bg-slate-700",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      <div className={cn(
        "w-4.5 h-4.5 w-[18px] h-[18px] rounded-full bg-white absolute top-[3px] transition-all duration-200 shadow-sm",
        on ? "left-[22px]" : "left-[3px]"
      )} />
    </button>
  );
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">{children}</label>;
}

const INPUT_CLS = "w-full px-3 py-2.5 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500/40 transition-all";
const INPUT_STYLE = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)" };

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(INPUT_CLS, props.className)} style={{ ...INPUT_STYLE, ...props.style }} />;
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(INPUT_CLS, props.className)} style={{ ...INPUT_STYLE, ...props.style }}>
      {children}
    </select>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(INPUT_CLS, "resize-none", props.className)} style={{ ...INPUT_STYLE, ...props.style }} />;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded-md text-slate-500 hover:text-purple-400 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function SaveBar({ dirty, saving, onSave, onDiscard }: { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void }) {
  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300",
      dirty ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
    )}>
      <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-purple-500/20 glow-purple"
        style={{ background: "rgba(17,13,26,0.97)", backdropFilter: "blur(20px)" }}>
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs text-slate-300 font-medium">You have unsaved changes</span>
        <div className="flex items-center gap-2 ml-2">
          <button onClick={onDiscard} className="px-4 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition-colors border border-slate-700 hover:border-slate-500">
            Discard
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 btn-brand rounded-lg text-xs font-medium">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
      status === "online"  ? "bg-emerald-400 shadow-[0_0_6px_#10b981]" :
      status === "away"    ? "bg-amber-400 shadow-[0_0_6px_#eab308]" :
      status === "pending" ? "bg-blue-400 shadow-[0_0_6px_#3b82f6]" :
      "bg-slate-600"
    )} />
  );
}

function IntegrationStatusBadge({ status }: { status: string }) {
  if (status === "connected")    return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Connected</span>;
  if (status === "setup")        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Setup Required</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-500 border border-slate-700">Disconnected</span>;
}

function Initials({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const parts = name.trim().split(" ");
  const initials = parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2);
  const sz = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-14 h-14 text-xl", xl: "w-20 h-20 text-3xl" }[size];
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold text-white flex-shrink-0", sz)}
      style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}>
      {initials.toUpperCase()}
    </div>
  );
}

/* ─────────────────────────── TABS ─────────────────────────── */

/* PROFILE TAB */
function ProfileTab() {
  const [form, setForm] = useState({
    fullName: "Krisha Thakkar", displayName: "krisha", email: "krisha.thakkar@networkintelligence.ai",
    phone: "+91 98765 43210", timezone: "Asia/Kolkata", language: "English", bio: ""
  });
  const [orig, setOrig] = useState(form);
  const dirty = JSON.stringify(form) !== JSON.stringify(orig);

  const save = () => { setOrig(form); toast.success("Profile saved"); };
  const discard = () => setForm(orig);

  return (
    <>
      <SectionHeader title="Profile" desc="Your personal information and preferences" />
      <div className="space-y-6">
        <div className="card-enterprise p-6">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Avatar</h3>
          <div className="flex items-center gap-5">
            <Initials name={form.fullName} size="xl" />
            <div>
              <p className="text-sm font-medium text-slate-200">{form.fullName}</p>
              <p className="text-xs text-slate-500 mt-0.5">{form.email}</p>
              <button className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-300 border border-slate-700 hover:border-purple-500/30 hover:text-purple-400 transition-all">
                <Camera className="w-3.5 h-3.5" /> Change avatar
              </button>
            </div>
          </div>
        </div>

        <div className="card-enterprise p-6 space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Personal Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Full name</FieldLabel>
              <Input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Display name</FieldLabel>
              <Input value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Email address</FieldLabel>
              <Input value={form.email} readOnly className="opacity-50 cursor-not-allowed" />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
            </div>
            <div>
              <FieldLabel>Timezone</FieldLabel>
              <Select value={form.timezone} onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Language</FieldLabel>
              <Select value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}>
                {["English", "German", "French", "Japanese", "Spanish"].map(l => <option key={l}>{l}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <FieldLabel>Bio</FieldLabel>
            <Textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
              rows={3} placeholder="Tell your team a little about yourself..." />
          </div>
        </div>
      </div>
      <SaveBar dirty={dirty} saving={false} onSave={save} onDiscard={discard} />
    </>
  );
}

/* SECURITY TAB */
function SecurityTab() {
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [twoFa, setTwoFa] = useState(false);
  const [sessions] = useState(MOCK_SESSIONS);
  const [revokedSessions, setRevokedSessions] = useState<Set<string>>(new Set());

  const strength = (() => {
    const p = pwForm.next;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500"];
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];

  const savePassword = () => {
    if (!pwForm.current || !pwForm.next) return toast.error("Fill all fields");
    if (pwForm.next !== pwForm.confirm) return toast.error("Passwords do not match");
    setPwForm({ current: "", next: "", confirm: "" });
    toast.success("Password updated");
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Security" desc="Manage your password, 2FA, and active sessions" />

      <div className="card-enterprise p-6 space-y-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Change Password</h3>
        <div className="space-y-3">
          <div>
            <FieldLabel>Current password</FieldLabel>
            <div className="relative">
              <Input type={showPw ? "text" : "password"} value={pwForm.current}
                onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} placeholder="••••••••" />
              <button onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <FieldLabel>New password</FieldLabel>
            <Input type={showPw ? "text" : "password"} value={pwForm.next}
              onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} placeholder="Min. 8 characters" />
            {pwForm.next && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={cn("h-1 flex-1 rounded-full transition-all", i < strength ? strengthColors[strength - 1] : "bg-slate-800")} />
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{strength > 0 ? strengthLabels[strength - 1] : ""}</p>
              </div>
            )}
          </div>
          <div>
            <FieldLabel>Confirm new password</FieldLabel>
            <Input type={showPw ? "text" : "password"} value={pwForm.confirm}
              onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="Repeat new password" />
          </div>
          <button onClick={savePassword} className="btn-brand px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 mt-2">
            <Lock className="w-4 h-4" /> Update Password
          </button>
        </div>
      </div>

      <div className="card-enterprise p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Two-Factor Authentication</h3>
            <p className="text-xs text-slate-500 mt-0.5">Add an extra layer of security to your account</p>
          </div>
          <Toggle on={twoFa} onToggle={() => setTwoFa(v => !v)} />
        </div>
        {twoFa && (
          <div className="mt-4 space-y-4 animate-fade-up">
            <div className="flex items-start gap-4">
              <div className="w-32 h-32 rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-700"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <QrCode className="w-20 h-20 text-slate-600" />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Scan with your authenticator app (Google Authenticator, Authy)</p>
                <div className="p-2 rounded-lg font-mono text-xs text-slate-300 border border-slate-700"
                  style={{ background: "rgba(255,255,255,0.02)" }}>
                  JBSWY3DPEHPK3PXP
                </div>
                <Input placeholder="Enter 6-digit code to verify" className="text-center font-mono tracking-widest" />
                <button className="btn-brand px-4 py-1.5 rounded-lg text-xs font-medium">Verify & Enable</button>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-700 space-y-2" style={{ background: "rgba(255,255,255,0.01)" }}>
              <p className="text-xs font-semibold text-slate-300">Recovery Codes</p>
              <p className="text-[11px] text-slate-500">Save these in a secure location. Each can only be used once.</p>
              <div className="grid grid-cols-2 gap-1 mt-2">
                {["A1B2-C3D4", "E5F6-G7H8", "I9J0-K1L2", "M3N4-O5P6", "Q7R8-S9T0", "U1V2-W3X4"].map(c => (
                  <span key={c} className="font-mono text-xs text-slate-400 py-0.5">{c}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card-enterprise p-6 space-y-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Sessions</h3>
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className={cn("flex items-center justify-between p-3 rounded-xl border transition-all",
              revokedSessions.has(s.id) ? "opacity-40 border-slate-800" : "border-slate-800 hover:border-slate-700"
            )}>
              <div className="flex items-center gap-3">
                <Monitor className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-300">{s.device}</p>
                  <p className="text-[10px] text-slate-600">{s.ip} · {s.location} · {s.lastActive}</p>
                </div>
              </div>
              {s.current
                ? <span className="text-[10px] text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">Current</span>
                : !revokedSessions.has(s.id) && (
                  <button onClick={() => setRevokedSessions(p => new Set([...p, s.id]))}
                    className="text-[10px] text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
                    <LogOut className="w-3 h-3" /> Revoke
                  </button>
                )
              }
            </div>
          ))}
        </div>
      </div>

      <div className="card-enterprise p-6">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Recent Security Events</h3>
        <div className="space-y-2">
          {SECURITY_EVENTS.map(ev => (
            <div key={ev.id} className="flex items-center gap-3 py-2 border-b border-slate-800/50 last:border-0">
              <Activity className={cn("w-3.5 h-3.5 flex-shrink-0",
                ev.risk === "critical" ? "text-red-400" : ev.risk === "warning" ? "text-amber-400" : "text-slate-500"
              )} />
              <span className="text-xs text-slate-300 flex-1">{ev.event}</span>
              <span className="text-[10px] text-slate-600 tabular-nums">{ev.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* NOTIFICATIONS TAB */
function NotificationsTab({
  notif, setNotif, saving, saveNotif
}: {
  notif: NotifSettings;
  setNotif: React.Dispatch<React.SetStateAction<NotifSettings>>;
  saving: boolean;
  saveNotif: () => void;
}) {
  const [orig] = useState(notif);
  const dirty = JSON.stringify(notif) !== JSON.stringify(orig);

  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>(() =>
    Object.fromEntries(EVENT_TYPES.map(e => [e, { Email: true, Slack: false, Webhook: false }]))
  );

  const toggleMatrix = (event: string, col: string) =>
    setMatrix(p => ({ ...p, [event]: { ...p[event], [col]: !p[event][col] } }));

  const CHANNELS = [
    { key: "email" as const,    label: "Email",            icon: Mail,  color: "text-blue-400",   enabled: notif.email_enabled,    toggle: () => setNotif(p => ({ ...p, email_enabled: !p.email_enabled })) },
    { key: "slack",             label: "Slack",            icon: Zap,   color: "text-purple-400", enabled: notif.webhook_enabled,  toggle: () => setNotif(p => ({ ...p, webhook_enabled: !p.webhook_enabled })) },
    { key: "teams",             label: "Microsoft Teams",  icon: Globe, color: "text-blue-500",   enabled: false,                  toggle: () => toast.info("Configure via Integrations tab") },
    { key: "telegram",          label: "Telegram",         icon: Send,  color: "text-sky-400",    enabled: notif.telegram_enabled, toggle: () => setNotif(p => ({ ...p, telegram_enabled: !p.telegram_enabled })) },
    { key: "sms",               label: "SMS",              icon: Smartphone, color: "text-emerald-400", enabled: false, toggle: () => {}, pro: true },
    { key: "push",              label: "Mobile Push",      icon: Bell,  color: "text-amber-400",  enabled: false,                  toggle: () => {}, soon: true },
  ];

  return (
    <>
      <SectionHeader title="Notifications" desc="Configure where and how you receive threat alerts" />
      <div className="space-y-6">
        <div className="card-enterprise p-6">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Minimum Severity Threshold</h3>
          <div className="flex gap-1 flex-wrap">
            {SEVERITY_LEVELS.map(s => {
              const active = notif.min_severity.toLowerCase() === s.toLowerCase();
              const colors: Record<string, string> = {
                Info: "border-slate-600 text-slate-400 data-[active=true]:bg-slate-700 data-[active=true]:text-white data-[active=true]:border-slate-500",
                Low: "border-emerald-900 text-emerald-500 data-[active=true]:bg-emerald-500/10 data-[active=true]:text-emerald-400 data-[active=true]:border-emerald-500/40",
                Medium: "border-amber-900 text-amber-500 data-[active=true]:bg-amber-500/10 data-[active=true]:text-amber-400 data-[active=true]:border-amber-500/40",
                High: "border-orange-900 text-orange-500 data-[active=true]:bg-orange-500/10 data-[active=true]:text-orange-400 data-[active=true]:border-orange-500/40",
                Critical: "border-red-900 text-red-500 data-[active=true]:bg-red-500/10 data-[active=true]:text-red-400 data-[active=true]:border-red-500/40",
              };
              return (
                <button key={s} data-active={active}
                  onClick={() => setNotif(p => ({ ...p, min_severity: s.toLowerCase() }))}
                  className={cn("px-4 py-1.5 rounded-lg text-xs font-medium border transition-all", colors[s])}>
                  {s}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Alerts below this threshold will be suppressed</p>
        </div>

        <div className="card-enterprise p-6 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Channels</h3>
          {CHANNELS.map(ch => (
            <div key={ch.key} className="rounded-xl border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <ch.icon className={cn("w-4 h-4", ch.color)} />
                  <span className="text-sm font-medium text-slate-300">{ch.label}</span>
                  {ch.pro  && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/20 uppercase">Pro</span>}
                  {ch.soon && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-700 text-slate-500 uppercase">Soon</span>}
                </div>
                <Toggle on={!!ch.enabled} onToggle={ch.toggle} disabled={!!(ch.pro || ch.soon)} />
              </div>
              {ch.key === "email" && notif.email_enabled && (
                <div className="px-4 pb-4 animate-fade-up">
                  <FieldLabel>Recipients (comma separated)</FieldLabel>
                  <Textarea value={notif.email_recipients.join(", ")}
                    onChange={e => setNotif(p => ({ ...p, email_recipients: e.target.value.split(",").map(x => x.trim()) }))}
                    rows={2} placeholder="security@company.com, soc@company.com" />
                </div>
              )}
              {ch.key === "slack" && notif.webhook_enabled && (
                <div className="px-4 pb-4 animate-fade-up">
                  <FieldLabel>Slack webhook URL</FieldLabel>
                  <Input value={notif.webhook_url} onChange={e => setNotif(p => ({ ...p, webhook_url: e.target.value }))}
                    placeholder="https://hooks.slack.com/services/..." />
                </div>
              )}
              {ch.key === "telegram" && notif.telegram_enabled && (
                <div className="px-4 pb-4 animate-fade-up">
                  <FieldLabel>Telegram chat ID</FieldLabel>
                  <Input value={notif.telegram_chat_id} onChange={e => setNotif(p => ({ ...p, telegram_chat_id: e.target.value }))}
                    placeholder="-1001234567890" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card-enterprise p-6">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Event Notification Matrix</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left text-[10px] text-slate-500 font-medium pb-3 pr-4">Event Type</th>
                  {["Email", "Slack", "Webhook"].map(c => (
                    <th key={c} className="text-center text-[10px] text-slate-500 font-medium pb-3 w-16">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {EVENT_TYPES.map(event => (
                  <tr key={event}>
                    <td className="py-2.5 pr-4 text-slate-300 font-medium">{event}</td>
                    {["Email", "Slack", "Webhook"].map(col => (
                      <td key={col} className="py-2.5 text-center">
                        <button onClick={() => toggleMatrix(event, col)} className="mx-auto flex items-center justify-center">
                          {matrix[event]?.[col]
                            ? <CheckSquare className="w-4 h-4 text-purple-400" />
                            : <Square className="w-4 h-4 text-slate-700" />
                          }
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-enterprise p-6">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Quiet Hours</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>From</FieldLabel>
              <Input type="time" defaultValue="22:00" />
            </div>
            <div>
              <FieldLabel>Until</FieldLabel>
              <Input type="time" defaultValue="08:00" />
            </div>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">No alerts will be sent during quiet hours except Critical severity</p>
        </div>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={saveNotif} onDiscard={() => {}} />
    </>
  );
}

/* PREFERENCES TAB */
function PreferencesTab() {
  const [theme, setTheme] = useState("dark");
  const [density, setDensity] = useState("comfortable");
  const [landing, setLanding] = useState("dashboard");
  const [dateFormat, setDateFormat] = useState("MMM DD, YYYY");
  const [timeFormat, setTimeFormat] = useState("12h");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [orig] = useState({ theme, density, landing, dateFormat, timeFormat, reduceMotion });
  const dirty = theme !== orig.theme || density !== orig.density;

  const THEMES = [
    { key: "dark",      label: "Dark",      desc: "Default dark theme", gradient: "from-slate-900 to-slate-800" },
    { key: "midnight",  label: "Midnight",  desc: "Deep blue-black",    gradient: "from-blue-950 to-slate-900" },
    { key: "cyberpunk", label: "Cyberpunk", desc: "Neon purple",        gradient: "from-purple-950 to-black" },
  ];

  return (
    <>
      <SectionHeader title="Preferences" desc="Customize your interface experience" />
      <div className="space-y-6">
        <div className="card-enterprise p-6">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Theme</h3>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map(t => (
              <button key={t.key} onClick={() => setTheme(t.key)}
                className={cn("p-3 rounded-xl border transition-all text-left",
                  theme === t.key ? "border-purple-500/40 ring-1 ring-purple-500/20" : "border-slate-800 hover:border-slate-700"
                )}>
                <div className={cn("w-full h-14 rounded-lg mb-3 bg-gradient-to-br", t.gradient)} />
                <p className="text-xs font-medium text-slate-300">{t.label}</p>
                <p className="text-[10px] text-slate-600">{t.desc}</p>
                {theme === t.key && <div className="mt-2 flex items-center gap-1 text-purple-400"><Check className="w-3 h-3" /><span className="text-[10px]">Active</span></div>}
              </button>
            ))}
          </div>
        </div>

        <div className="card-enterprise p-6">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Interface Density</h3>
          <div className="flex gap-2">
            {["Compact", "Comfortable", "Spacious"].map(d => (
              <button key={d} onClick={() => setDensity(d.toLowerCase())}
                className={cn("flex-1 py-2 rounded-lg text-xs font-medium border transition-all",
                  density === d.toLowerCase()
                    ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                    : "border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700"
                )}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="card-enterprise p-6 space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Display</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Default landing page</FieldLabel>
              <Select value={landing} onChange={e => setLanding(e.target.value)}>
                {[["dashboard","Dashboard"],["alerts","Alerts"],["credentials","Credentials"],["investigate","Investigate"]].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel>Date format</FieldLabel>
              <Select value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
                {["MMM DD, YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map(f => <option key={f}>{f}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Time format</FieldLabel>
              <Select value={timeFormat} onChange={e => setTimeFormat(e.target.value)}>
                <option value="12h">12-hour (AM/PM)</option>
                <option value="24h">24-hour</option>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div>
              <p className="text-sm text-slate-300">Reduce animations</p>
              <p className="text-[11px] text-slate-600">Minimize motion for accessibility</p>
            </div>
            <Toggle on={reduceMotion} onToggle={() => setReduceMotion(v => !v)} />
          </div>
        </div>
      </div>
      <SaveBar dirty={dirty} saving={false} onSave={() => { toast.success("Preferences saved"); }} onDiscard={() => {}} />
    </>
  );
}

/* ORGANIZATION TAB */
function OrganizationTab({
  org, setOrg, saving, saveOrg
}: {
  org: OrgSettings;
  setOrg: React.Dispatch<React.SetStateAction<OrgSettings>>;
  saving: boolean;
  saveOrg: () => void;
}) {
  const [orig] = useState(org);
  const [dangerModal, setDangerModal] = useState<"transfer" | "delete" | null>(null);
  const dirty = JSON.stringify(org) !== JSON.stringify(orig);
  const orgId = "org_0x3f8a91c2d744e";

  return (
    <>
      <SectionHeader title="Organization" desc="Manage your organization profile and settings" />
      <div className="space-y-6">
        <div className="card-enterprise p-6 space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Organization Details</h3>
          <div className="flex items-center gap-5 mb-5">
            <div className="w-16 h-16 rounded-xl border border-slate-700 flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.02)" }}>
              <Building2 className="w-8 h-8 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">{org.name || "Your Organization"}</p>
              <p className="text-xs text-slate-500 mt-0.5">{org.domain}</p>
              <button className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs text-slate-400 border border-slate-700 hover:border-slate-600 transition-all">
                <Camera className="w-3 h-3" /> Upload logo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Organization name</FieldLabel>
              <Input value={org.name} onChange={e => setOrg(p => ({ ...p, name: e.target.value }))} placeholder="Acme Security Inc." />
            </div>
            <div>
              <FieldLabel>Primary domain</FieldLabel>
              <Input value={org.domain} onChange={e => setOrg(p => ({ ...p, domain: e.target.value }))} placeholder="example.com" />
            </div>
            <div>
              <FieldLabel>Industry</FieldLabel>
              <Select>
                {["Financial Services", "Healthcare", "Technology", "Government", "Retail", "Energy", "Manufacturing"].map(i => (
                  <option key={i}>{i}</option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel>Company size</FieldLabel>
              <Select>
                {["1-50", "51-200", "201-1000", "1001-5000", "5000+"].map(s => <option key={s}>{s} employees</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Headquarters country</FieldLabel>
              <Select>
                {["United States", "United Kingdom", "India", "Germany", "Singapore", "Australia"].map(c => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel>Organization ID</FieldLabel>
              <div className="flex items-center gap-2">
                <Input value={orgId} readOnly className="font-mono text-xs opacity-60 cursor-not-allowed flex-1" />
                <CopyButton text={orgId} />
              </div>
            </div>
          </div>
        </div>

        <div className="card-enterprise p-6 border-red-500/10">
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Danger Zone</h3>
          <p className="text-[11px] text-slate-500 mb-4">These actions are irreversible. Please proceed with extreme caution.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-300">Transfer ownership</p>
                <p className="text-[11px] text-slate-600">Transfer this organization to another admin</p>
              </div>
              <button onClick={() => setDangerModal("transfer")}
                className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-700 text-slate-400 hover:border-amber-500/30 hover:text-amber-400 transition-all">
                Transfer
              </button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border border-red-500/10">
              <div>
                <p className="text-sm font-medium text-red-400">Delete organization</p>
                <p className="text-[11px] text-slate-600">Permanently delete all data and cancel subscription</p>
              </div>
              <button onClick={() => setDangerModal("delete")}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all">
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {dangerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
          <div className="card-enterprise p-6 max-w-sm w-full space-y-4 animate-fade-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{dangerModal === "delete" ? "Delete organization?" : "Transfer ownership?"}</p>
                <p className="text-[11px] text-slate-500">This cannot be undone</p>
              </div>
            </div>
            <Input placeholder={dangerModal === "delete" ? `Type "${org.name}" to confirm` : "Enter new owner email"} />
            <div className="flex gap-2">
              <button onClick={() => setDangerModal(null)} className="flex-1 py-2 rounded-lg text-sm border border-slate-700 text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={() => { toast.error("Action blocked in demo"); setDangerModal(null); }}
                className="flex-1 py-2 rounded-lg text-sm bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors">
                {dangerModal === "delete" ? "Delete" : "Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <SaveBar dirty={dirty} saving={saving} onSave={saveOrg} onDiscard={() => {}} />
    </>
  );
}

/* TEAM TAB */
function TeamTab() {
  const [members, setMembers] = useState(MOCK_MEMBERS);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Analyst");

  const stats = {
    total: members.length,
    admins: members.filter(m => m.role === "Admin").length,
    analysts: members.filter(m => m.role === "Analyst").length,
    pending: members.filter(m => m.status === "pending").length,
  };

  const sendInvite = () => {
    if (!inviteEmail) return toast.error("Enter an email address");
    setInviteEmail("");
    toast.success(`Invite sent to ${inviteEmail}`);
  };

  return (
    <>
      <SectionHeader title="Team" desc="Manage team members and permissions" />
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total members", value: stats.total },
            { label: "Admins", value: stats.admins },
            { label: "Analysts", value: stats.analysts },
            { label: "Pending invites", value: stats.pending },
          ].map(s => (
            <div key={s.label} className="stat-card p-4">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="card-enterprise p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Invite Member</h3>
          <div className="flex gap-2">
            <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com" className="flex-1" />
            <Select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="w-32">
              {["Admin", "Analyst", "Viewer"].map(r => <option key={r}>{r}</option>)}
            </Select>
            <button onClick={sendInvite} className="btn-brand px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 whitespace-nowrap">
              <Plus className="w-4 h-4" /> Invite
            </button>
          </div>
        </div>

        <div className="card-enterprise overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-[10px] text-slate-500 font-medium px-5 py-3">Member</th>
                <th className="text-left text-[10px] text-slate-500 font-medium px-4 py-3 hidden sm:table-cell">Role</th>
                <th className="text-left text-[10px] text-slate-500 font-medium px-4 py-3 hidden md:table-cell">Last Active</th>
                <th className="text-left text-[10px] text-slate-500 font-medium px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Initials name={m.name} size="sm" />
                      <div>
                        <p className="font-medium text-slate-200">{m.name}</p>
                        <p className="text-[10px] text-slate-600">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <select value={m.role} onChange={e => setMembers(ms => ms.map(x => x.id === m.id ? { ...x, role: e.target.value } : x))}
                      className="text-xs text-slate-400 bg-transparent border border-slate-800 rounded-lg px-2 py-1 hover:border-slate-700 focus:outline-none">
                      {["Admin", "Analyst", "Viewer"].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 hidden md:table-cell">{m.lastActive}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={m.status} />
                      <span className="text-[10px] text-slate-500 capitalize">{m.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <button className="p-1.5 rounded-lg text-slate-600 hover:text-slate-400 transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* INTEGRATIONS TAB */
function IntegrationsTab() {
  return (
    <>
      <SectionHeader title="Integrations" desc="Connect Transilience Aegis to your security stack" />
      <div className="space-y-6">
        {INTEGRATIONS.map(group => (
          <div key={group.group}>
            <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">{group.group}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.items.map(item => (
                <div key={item.id} className="card-enterprise p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: item.color + "22", border: `1px solid ${item.color}33` }}>
                      <span style={{ color: item.color }}>{item.letter}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-300">{item.name}</p>
                      <IntegrationStatusBadge status={item.status} />
                    </div>
                  </div>
                  <button onClick={() => toast.info(`${item.name} integration coming soon`)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      item.status === "connected"
                        ? "border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-500/20"
                        : "border-purple-500/20 text-purple-400 hover:bg-purple-500/10"
                    )}>
                    {item.status === "connected" ? "Disconnect" : "Connect"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* API KEYS TAB */
function ApiKeysTab() {
  const [keys, setKeys] = useState(MOCK_API_KEYS);
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState({ name: "", scopes: [] as string[], expiry: "never" });
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const ALL_SCOPES = ["read:threats", "read:creds", "write:alerts", "write:webhooks", "admin:org"];

  const stats = {
    total: keys.length,
    active: keys.filter(k => k.active).length,
    revoked: keys.filter(k => !k.active).length,
  };

  const createKey = () => {
    if (!newKey.name) return toast.error("Name required");
    const created = { id: Date.now().toString(), name: newKey.name, prefix: `tai_live_****${Math.random().toString(36).slice(2, 6)}`, scopes: newKey.scopes, created: "Apr 21, 2025", lastUsed: "Just now", active: true };
    setKeys(ks => [created, ...ks]);
    setNewKey({ name: "", scopes: [], expiry: "never" });
    setShowModal(false);
    toast.success("API key created — copy it now, it won't be shown again");
  };

  return (
    <>
      <SectionHeader title="API Keys" desc="Manage programmatic access to Transilience Aegis" />
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Keys", value: stats.total },
            { label: "Active", value: stats.active },
            { label: "Revoked", value: stats.revoked },
          ].map(s => (
            <div key={s.label} className="stat-card p-4">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button onClick={() => setShowModal(true)} className="btn-brand px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create API Key
          </button>
        </div>

        <div className="card-enterprise overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                {["Name", "Key", "Scopes", "Created", "Last Used", ""].map(h => (
                  <th key={h} className="text-left text-[10px] text-slate-500 font-medium px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {keys.map(k => (
                <tr key={k.id} className={cn("hover:bg-white/[0.01] transition-colors", !k.active && "opacity-50")}>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full", k.active ? "bg-emerald-400" : "bg-slate-600")} />
                      <span className="font-medium text-slate-300">{k.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-slate-500">{k.prefix}</span>
                      <CopyButton text={k.prefix} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.slice(0, 2).map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/15">{s}</span>
                      ))}
                      {k.scopes.length > 2 && <span className="text-[9px] text-slate-600">+{k.scopes.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{k.created}</td>
                  <td className="px-4 py-3.5 text-slate-600">{k.lastUsed}</td>
                  <td className="px-4 py-3.5">
                    {k.active && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => toast.info("Key rotated")} className="p-1.5 text-slate-600 hover:text-amber-400 transition-colors" title="Rotate">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setKeys(ks => ks.map(x => x.id === k.id ? { ...x, active: false } : x))}
                          className="p-1.5 text-slate-600 hover:text-red-400 transition-colors" title="Revoke">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
          <div className="card-enterprise p-6 max-w-md w-full space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Create API Key</p>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <FieldLabel>Key name</FieldLabel>
              <Input value={newKey.name} onChange={e => setNewKey(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Production SIEM" />
            </div>
            <div>
              <FieldLabel>Scopes</FieldLabel>
              <div className="space-y-2 mt-1">
                {ALL_SCOPES.map(s => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newKey.scopes.includes(s)}
                      onChange={() => setNewKey(p => ({
                        ...p, scopes: p.scopes.includes(s) ? p.scopes.filter(x => x !== s) : [...p.scopes, s]
                      }))}
                      className="accent-purple-500" />
                    <span className="text-xs text-slate-300">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Expiration</FieldLabel>
              <Select value={newKey.expiry} onChange={e => setNewKey(p => ({ ...p, expiry: e.target.value }))}>
                <option value="never">Never</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
                <option value="1y">1 year</option>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg text-sm border border-slate-700 text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={createKey} className="flex-1 btn-brand py-2 rounded-lg text-sm font-medium">Create Key</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* SCAN SCHEDULES TAB */
function ScanSchedulesTab({
  schedules, setSchedules, saving, saveSchedules, triggerScan
}: {
  schedules: Record<string, Schedule>;
  setSchedules: React.Dispatch<React.SetStateAction<Record<string, Schedule>>>;
  saving: boolean;
  saveSchedules: () => void;
  triggerScan: (mod: string) => void;
}) {
  const [orig] = useState(schedules);
  const dirty = JSON.stringify(schedules) !== JSON.stringify(orig);
  const [triggering, setTriggering] = useState<Record<string, boolean>>({});

  const handleTrigger = async (key: string) => {
    setTriggering(p => ({ ...p, [key]: true }));
    await triggerScan(key);
    setTimeout(() => setTriggering(p => ({ ...p, [key]: false })), 2000);
  };

  return (
    <>
      <SectionHeader title="Scan Schedules" desc="Configure automated scanning intervals for each module" />
      <div className="space-y-3">
        {SCAN_MODULES.map(mod => {
          const sched = schedules[mod.key] || { enabled: true, interval_hours: mod.defaultInterval };
          return (
            <div key={mod.key} className="card-enterprise p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.12)" }}>
                  {mod.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-300">{mod.label}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {sched.enabled ? `Runs every ${sched.interval_hours}h` : "Paused"}
                    <span className="mx-1.5 text-slate-800">·</span>
                    Next run: {sched.enabled ? `in ~${Math.round(sched.interval_hours * 0.6)}h` : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={sched.interval_hours}
                    onChange={e => setSchedules(p => ({ ...p, [mod.key]: { ...sched, interval_hours: parseInt(e.target.value) } }))}
                    className="w-28 py-1.5 text-xs">
                    {[1,2,4,6,8,12,24,48].map(h => <option key={h} value={h}>Every {h}h</option>)}
                  </Select>
                  <Toggle on={sched.enabled}
                    onToggle={() => setSchedules(p => ({ ...p, [mod.key]: { ...sched, enabled: !sched.enabled } }))} />
                  <button onClick={() => handleTrigger(mod.key)} disabled={triggering[mod.key]}
                    className="p-2 rounded-lg border border-slate-800 text-slate-500 hover:text-purple-400 hover:border-purple-500/20 transition-all"
                    title="Run now">
                    <RefreshCw className={cn("w-4 h-4", triggering[mod.key] && "animate-spin text-purple-400")} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={saveSchedules} onDiscard={() => {}} />
    </>
  );
}

/* ─────────────────────────── MAIN PAGE ─────────────────────────── */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // API-backed state
  const [org, setOrg] = useState<OrgSettings>({ name: "", domain: "" });
  const [notif, setNotif] = useState<NotifSettings>({
    email_enabled: true, email_recipients: [],
    webhook_enabled: false, webhook_url: "",
    telegram_enabled: false, telegram_chat_id: "",
    min_severity: "medium",
  });
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});

  // User profile from Supabase
  const [userProfile, setUserProfile] = useState({ name: "Krisha Thakkar", email: "krisha.thakkar@networkintelligence.ai", role: "Admin", lastLogin: "" });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserProfile({
            name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User",
            email: session.user.email || "",
            role: session.user.user_metadata?.role || "Admin",
            lastLogin: session.user.last_sign_in_at ? new Date(session.user.last_sign_in_at).toLocaleString() : "",
          });
        }
      } catch {}

      const [orgData, notifData, scanData] = await Promise.all([
        apiFetch("/api/v1/settings/org"),
        apiFetch("/api/v1/settings/notifications"),
        apiFetch("/api/v1/settings/scan-schedule"),
      ]);

      if (orgData)   setOrg({ name: orgData.name || "", domain: orgData.domain || "" });
      if (notifData) setNotif({
        email_enabled:    notifData.email_enabled    ?? true,
        email_recipients: notifData.email_recipients || [],
        webhook_enabled:  notifData.webhook_enabled  ?? false,
        webhook_url:      notifData.webhook_url      || "",
        telegram_enabled: notifData.telegram_enabled ?? false,
        telegram_chat_id: notifData.telegram_chat_id || "",
        min_severity:     notifData.min_severity     || "medium",
      });
      if (scanData)  setSchedules(scanData.schedules || {});

      setLoading(false);
    })();
  }, []);

  const saveOrg = useCallback(async () => {
    setSaving(true);
    const res = await apiFetch("/api/v1/settings/org", { method: "PATCH", body: JSON.stringify({ name: org.name, domain: org.domain }) });
    setSaving(false);
    res ? toast.success("Organization saved") : toast.error("Failed to save — changes kept locally");
  }, [org]);

  const saveNotif = useCallback(async () => {
    setSaving(true);
    const res = await apiFetch("/api/v1/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({
        email_enabled: notif.email_enabled,
        email_recipients: notif.email_recipients.filter(Boolean),
        webhook_enabled: notif.webhook_enabled,
        webhook_url: notif.webhook_url,
        telegram_enabled: notif.telegram_enabled,
        telegram_chat_id: notif.telegram_chat_id,
        min_severity: notif.min_severity,
      }),
    });
    setSaving(false);
    res ? toast.success("Notifications saved") : toast.error("Failed to save — changes kept locally");
  }, [notif]);

  const saveSchedules = useCallback(async () => {
    setSaving(true);
    const res = await apiFetch("/api/v1/settings/scan-schedule", { method: "PATCH", body: JSON.stringify({ schedules }) });
    setSaving(false);
    res ? toast.success("Schedules saved") : toast.error("Failed to save — changes kept locally");
  }, [schedules]);

  const triggerScan = useCallback(async (module: string) => {
    const res = await apiFetch("/api/v1/scans/trigger", { method: "POST", body: JSON.stringify({ module }) });
    res ? toast.success(`${module.replace(/_/g, " ")} scan triggered`) : toast.error("Could not trigger scan");
  }, []);

  const renderTab = () => {
    if (loading) return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="card-enterprise p-6 space-y-4 mt-6">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </div>
    );

    switch (activeTab) {
      case "profile":        return <ProfileTab />;
      case "security":       return <SecurityTab />;
      case "notifications":  return <NotificationsTab notif={notif} setNotif={setNotif} saving={saving} saveNotif={saveNotif} />;
      case "preferences":    return <PreferencesTab />;
      case "organization":   return <OrganizationTab org={org} setOrg={setOrg} saving={saving} saveOrg={saveOrg} />;
      case "team":           return <TeamTab />;
      case "integrations":   return <IntegrationsTab />;
      case "apikeys":        return <ApiKeysTab />;
      case "scans":          return <ScanSchedulesTab schedules={schedules} setSchedules={setSchedules} saving={saving} saveSchedules={saveSchedules} triggerScan={triggerScan} />;
      default:               return null;
    }
  };

  return (
    <div className="animate-fade-up">
      {/* Hero strip */}
      <div className="card-enterprise p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <Initials name={userProfile.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-white">{userProfile.name}</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/25 uppercase tracking-wider">
              {userProfile.role}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{userProfile.email}</p>
          <p className="text-[10px] text-slate-600 mt-1">
            {org.name && <><span className="text-slate-500">{org.name}</span><span className="mx-1.5">·</span></>}
            {userProfile.lastLogin && <>Last login: {userProfile.lastLogin}</>}
          </p>
        </div>
      </div>

      {/* Mobile sidebar toggle */}
      <div className="sm:hidden mb-4">
        <button onClick={() => setSidebarOpen(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-400 border border-slate-800 hover:border-slate-700 transition-colors w-full">
          {SIDEBAR_GROUPS.flatMap(g => g.items).find(i => i.key === activeTab)?.label || "Settings"}
          <ChevronRight className={cn("w-4 h-4 ml-auto transition-transform", sidebarOpen && "rotate-90")} />
        </button>
        {sidebarOpen && (
          <div className="mt-2 card-enterprise p-2 animate-fade-up">
            {SIDEBAR_GROUPS.map(group => (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider px-2 py-1">{group.label}</p>
                {group.items.map(item => (
                  <button key={item.key} onClick={() => { setActiveTab(item.key); setSidebarOpen(false); }}
                    className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                      activeTab === item.key ? "bg-purple-500/10 text-purple-400" : "text-slate-500 hover:text-slate-300"
                    )}>
                    <item.icon className="w-3.5 h-3.5 flex-shrink-0" />{item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <aside className="hidden sm:block w-56 flex-shrink-0 sticky top-6">
          <div className="card-enterprise p-3 space-y-4">
            {SIDEBAR_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider px-2 py-1 mb-1">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <button key={item.key} onClick={() => setActiveTab(item.key)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group",
                        activeTab === item.key
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/15"
                          : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
                      )}>
                      <item.icon className={cn("w-3.5 h-3.5 flex-shrink-0 transition-colors",
                        activeTab === item.key ? "text-purple-400" : "text-slate-600 group-hover:text-slate-400"
                      )} />
                      {item.label}
                      {activeTab === item.key && <div className="ml-auto w-1 h-1 rounded-full bg-purple-400" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {renderTab()}
        </main>
      </div>
    </div>
  );
}
