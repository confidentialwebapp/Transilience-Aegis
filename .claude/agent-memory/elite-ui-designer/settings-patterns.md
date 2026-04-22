---
name: Settings Page Patterns
description: Enterprise settings page architecture for Transilience Aegis — sidebar layout, tab structure, API wiring, reusable primitives
type: project
---

Settings page rebuilt at `frontend/app/(dashboard)/settings/page.tsx` — single file, ~800 lines.

**Architecture:** Two-column layout: 240px sticky sidebar (hidden on mobile, collapsible toggle instead) + flex-1 main content. Hero strip at top with Supabase user profile data.

**Tab structure — 9 tabs in 2 groups:**
- ACCOUNT: Profile, Security, Notifications, Preferences
- ORGANIZATION: Organization, Team, Integrations, API Keys, Scan Schedules

**Reusable primitives defined inline (no extra component files created):**
- `Toggle` — 11px track, smooth CSS transition
- `SectionHeader` — title + desc, consistent across all tabs
- `FieldLabel` — uppercase tracking-wider 11px
- `Input`, `Select`, `Textarea` — shared INPUT_CLS + INPUT_STYLE (rgba bg + purple border)
- `Skeleton` — uses `.skeleton` CSS class from globals
- `CopyButton` — clipboard with 2s check state
- `SaveBar` — fixed bottom floating bar, slides up when dirty, Discard/Save
- `StatusDot` — emerald/amber/blue/slate for online/away/pending/offline
- `Initials` — gradient avatar with size variants (sm/md/lg/xl)
- `IntegrationStatusBadge` — Connected/Setup Required/Disconnected

**API wiring:** `apiFetch` wraps all calls with graceful null fallback (no throw — returns null on error). Real API used for org, notifications, scan-schedule, trigger. All others are client state.

**Why:** Per-tab dirty state + floating SaveBar pattern avoids full-page save confusion. Graceful fallback lets page work when API is unavailable.

**How to apply:** Follow same Input/Select/Textarea primitives and SaveBar pattern for any new settings-style pages. Keep API calls null-safe (return null on error, not throw).
