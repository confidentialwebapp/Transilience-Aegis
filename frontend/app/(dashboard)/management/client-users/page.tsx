"use client";

import { useState } from "react";
import { Mail, Plus, Users } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill, Toggle, KPICard } from "@/components/platform";
import type { Column } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";

interface UserRow {
  name: string;
  email: string;
  role: string;
  client: string;
  status: "ACTIVE" | "INACTIVE" | "PENDING";
  twoFactor: boolean;
  lastLogin: string;
}

const USERS: UserRow[] = [
  { name: "Karthik Raja", email: "fde@transilienceai.com", role: "Admin", client: "Transilience Holdings", status: "ACTIVE", twoFactor: true, lastLogin: "2m ago" },
  { name: "Priya Iyer", email: "priya.iyer@acme.com", role: "Analyst", client: "Acme Bank", status: "ACTIVE", twoFactor: true, lastLogin: "12m ago" },
  { name: "Rohit Mehta", email: "rohit.mehta@globex.com", role: "Read-Only", client: "Globex Insurance", status: "ACTIVE", twoFactor: false, lastLogin: "3h ago" },
  { name: "Anita Nair", email: "anita.nair@stark.com", role: "Analyst", client: "Stark Retail", status: "PENDING", twoFactor: false, lastLogin: "—" },
  { name: "Vikram Shah", email: "vikram@umbrella.com", role: "Admin", client: "Umbrella Pharma", status: "ACTIVE", twoFactor: true, lastLogin: "1d ago" },
  { name: "Meera Krishnan", email: "meera@soylent.com", role: "Analyst", client: "Soylent Health", status: "INACTIVE", twoFactor: false, lastLogin: "32d ago" },
  { name: "Sanjay Kapoor", email: "sanjay@wayne.com", role: "Read-Only", client: "Wayne Manufacturing", status: "ACTIVE", twoFactor: true, lastLogin: "5h ago" },
];

export default function ClientUsersPage() {
  const [twoFactorMap, setTwoFactorMap] = useState<Record<string, boolean>>({});

  const cols: Column<UserRow>[] = [
    {
      key: "user",
      header: "User",
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
          >
            {r.name[0]}
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-slate-200">{r.name}</p>
            <p className="text-[10.5px] text-slate-500">{r.email}</p>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (r) => <span className="text-[11.5px] text-slate-300 font-medium">{r.role}</span> },
    { key: "client", header: "Client", render: (r) => <span className="text-[12px] text-slate-300">{r.client}</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "2fa",
      header: "2FA",
      render: (r) => {
        const on = twoFactorMap[r.email] ?? r.twoFactor;
        return (
          <Toggle on={on} onChange={(v) => setTwoFactorMap((m) => ({ ...m, [r.email]: v }))} />
        );
      },
    },
    { key: "last", header: "Last Login", render: (r) => <span className="text-[11px] text-slate-500">{r.lastLogin}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Client Users"
        description="Manage users that belong to your client tenants. Roles, 2FA enrolment, and session activity for the entire portfolio."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Plus className="w-3 h-3" /> Invite User
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KPICard label="Total Users" value={USERS.length} accent="purple" icon={Users} />
        <KPICard label="Active" value={USERS.filter((u) => u.status === "ACTIVE").length} accent="green" />
        <KPICard label="Pending" value={USERS.filter((u) => u.status === "PENDING").length} accent="amber" />
        <KPICard label="2FA enrolled" value={USERS.filter((u) => u.twoFactor).length} accent="blue" />
      </div>

      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterInput icon={Mail} placeholder="Email" />
          <FilterSelect label="Client" options={BRANDS} />
          <FilterSelect label="Role" options={["Admin", "Analyst", "Read-Only"]} />
        </div>
      </FilterCard>

      <DataTable<UserRow> columns={cols} rows={USERS} rowAction />
    </>
  );
}
