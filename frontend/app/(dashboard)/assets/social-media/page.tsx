"use client";

import { Plus } from "lucide-react";
import { PageHeader, FilterCard, FilterInput, FilterSelect, DataTable, StatusPill } from "@/components/platform";
import type { Column } from "@/components/platform";
import { BRANDS } from "@/lib/mock-data";

interface SocialRow {
  handle: string;
  platform: string;
  brand: string;
  followers: number;
  status: "VERIFIED" | "UNVERIFIED";
  added: string;
}

const PLATFORMS = ["Instagram", "Facebook", "Twitter / X", "LinkedIn", "YouTube", "Telegram", "TikTok", "Threads"];

const ROWS: SocialRow[] = [
  { handle: "@acmebank", platform: "Instagram", brand: "Acme Bank", followers: 218000, status: "VERIFIED", added: "01 Mar 2024" },
  { handle: "@acmebank", platform: "Twitter / X", brand: "Acme Bank", followers: 142000, status: "VERIFIED", added: "01 Mar 2024" },
  { handle: "@globex_insurance", platform: "Instagram", brand: "Globex Insurance", followers: 84000, status: "VERIFIED", added: "01 Mar 2024" },
  { handle: "@initech_official", platform: "Telegram", brand: "Initech Telecom", followers: 12000, status: "UNVERIFIED", added: "12 May 2024" },
  { handle: "@stark_retail", platform: "TikTok", brand: "Stark Retail", followers: 320000, status: "VERIFIED", added: "12 May 2024" },
];

export default function SocialMediaAssetsPage() {
  const cols: Column<SocialRow>[] = [
    { key: "handle", header: "Handle", render: (r) => <span className="text-[12.5px] text-slate-200 font-semibold">{r.handle}</span> },
    { key: "platform", header: "Platform", render: (r) => <span className="text-[12px] text-slate-300">{r.platform}</span> },
    { key: "brand", header: "Brand", render: (r) => <span className="text-[12px] text-slate-400">{r.brand}</span> },
    {
      key: "followers",
      header: "Followers",
      align: "right",
      render: (r) => <span className="text-[12px] text-slate-300 tabular-nums">{r.followers.toLocaleString()}</span>,
    },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "added", header: "Added", render: (r) => <span className="text-[11px] text-slate-500">{r.added}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Social Media Accounts"
        description="Owned social profiles. Used to disambiguate impersonators in incident triage."
        rightSlot={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)" }}>
            <Plus className="w-3 h-3" /> Add Account
          </button>
        }
      />
      <FilterCard onSearch={() => {}} onReset={() => {}}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterInput placeholder="Handle / username" />
          <FilterSelect label="Platform" options={PLATFORMS} />
          <FilterSelect label="Brand" options={BRANDS} />
        </div>
      </FilterCard>
      <DataTable<SocialRow> columns={cols} rows={ROWS} totalEntries={ROWS.length} />
    </>
  );
}
