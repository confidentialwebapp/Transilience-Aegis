---
name: Marketing Legal Pages
description: Security, Privacy, Terms, Changelog pages in (marketing) route group — patterns, data, contact emails
type: project
---

Public marketing pages live at `app/(marketing)/` — a Next.js route group (parens in dir name, no URL segment).

**Shared layout**: `app/(marketing)/layout.tsx` — extracts sticky header + footer from the landing page. Header nav links to /security, /changelog, /#pricing. Footer has cross-links: Security · Privacy · Terms · Changelog · Sign in · Sign up.

**Contact emails used**:
- security@transilienceai.com — security reports, CVD, review calls
- privacy@transilienceai.com — GDPR/CCPA rights requests, DPA
- legal@transilienceai.com — ToS disputes, billing, legal inquiries

**Security page** (`/security`): Most important. CISO-targeted. Sections: compliance grid (SOC2 in-progress Q3 2026, GDPR compliant, TLS1.3/AES-256, per-org RLS), infrastructure vs application architecture 2-col, CVD 5-step process with PGP key block, bug bounty coming Q4 2026 HackerOne, sub-processors table (6 rows: Render/Vercel/Supabase/Upstash/Modal/Resend), security review CTA.

**Privacy page** (`/privacy`): Sticky right-rail TOC (lg+ only) using IntersectionObserver hook. 10 sections. Key facts: 90-day logs, indefinite watchlist data, 7-day digest send logs. No ad cookies, no tracking pixels, no data sale.

**Terms page** (`/terms`): Same sticky TOC pattern. Governing law: India (Bengaluru arbitration). Can-you/can't-you summary grid. Cancel anytime, pro-rated refunds, 30-day notice for price changes. AUP violations = immediate suspension, no refund.

**Changelog** (`/changelog`): 6 entries v0.1–v0.6 with real shipped features from git history. Timeline spine with per-entry accent color. Version jump links. Subscribe form POSTs to `/api/v1/changelog/subscribe?email=` (endpoint not yet built — button looks real). Stats strip: 6 releases, 50+ features, <90 days to v0.6.

**Pattern: sticky TOC**: `useTOCActive(ids: string[])` hook uses IntersectionObserver with `rootMargin: "-20% 0px -70% 0px"`. TOC only renders on `lg:` breakpoint via `hidden lg:block`.

**TS gotcha**: Generic icon component types must include `style?: React.CSSProperties` if you pass inline color. `React.ComponentType<{ className?: string; style?: React.CSSProperties }>` — otherwise TS2322 on the style prop.

**Why**: Middleware already permits these paths without auth. They're designed to convert CISO procurement reviews into paying customers — trust signals over marketing copy.

**How to apply**: When adding new public pages, use (marketing) layout. When writing Section components that accept an icon prop and apply inline color via `style`, include `style?: React.CSSProperties` in the component prop type.
