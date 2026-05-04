"use client";

import { PageHeader } from "@/components/platform";
import { FindingsTable } from "@/components/shared/FindingsTable";

export default function SocialMediaPage() {
  return (
    <>
      <PageHeader
        title="Social Media Account"
        description="Social-platform handles surfaced by the BrandMonitoring social_deep_scrape + social_impersonation modules — Instagram, Facebook, X, Telegram, YouTube, TikTok, LinkedIn, Reddit, Threads, Bluesky."
      />
      <FindingsTable
        category="social_impersonation"
        pageSize={50}
      />
    </>
  );
}
