---
name: Status and Docs Page Patterns
description: Patterns for the /status public status page and /docs API reference page — probing, OpenAPI rendering, try-it-out panel
type: project
---

## /status page (`app/(marketing)/status/page.tsx`, 784 lines)

Lives in the `(marketing)` route group — inherits shared sticky header + footer from `(marketing)/layout.tsx`. No auth required.

**Probe architecture:**
- Each service defined as a `ServiceDef` with an async `probe()` function
- All probes run in parallel via `Promise.all` in `runProbes()`
- Each probe wrapped in `withTimeout(promise, 10000)` via `Promise.race`
- State shape: `{ status: 'checking'|'up'|'down'|'degraded', responseMs, lastChecked, note }`
- `setInterval(runProbes, 30000)` auto-refreshes every 30s

**Modal probe trick:** Hits `https://status.modal.com/api/v2/status.json` (public REST endpoint) instead of invoking any Modal function — zero compute cost. Falls back to hardcoded "up" if the status page is unreachable.

**Telegram probe:** Hits `https://api.telegram.org/bot<TOKEN>/getMe` — fully harmless public Telegram Bot API call, returns `{ok: true}`.

**Database probe:** Hits `/api/v1/dashboard/summary` with `X-Org-Id` header — treats 401/403 as "up" (proves the layer is reachable), only marks down on network failure or 5xx.

**Visual patterns:**
- 90-day uptime bar: array of 90 colored `<div>` slivers (green/orange/red)
- Sparkline: decorative SVG `<polyline>` showing up/down wave shape
- `formatRelTime(date)` utility for "just now / Xs ago / Xm ago" display
- Stats strip: 3-column `stat-card` grid with services-up count, avg response time, 30d uptime

## /docs page (`app/(dashboard)/docs/page.tsx`, 1189 lines)

Lives in the `(dashboard)` route group — inherits sidebar + header chrome from `(dashboard)/layout.tsx`. Auth required.

**OpenAPI loading:**
- Fetches `https://tai-aegis-api.onrender.com/openapi.json` on mount
- Loading state with animated progress bar + Render cold-start note
- Error state with retry button

**FlatEndpoint type:** `{ method, path, tag, operation, id }` — flattened from `spec.paths` across all HTTP methods.

**Tag ordering:** `TAG_ORDER` constant (18 canonical tags) controls sidebar and section order. Unknown tags appended after.

**Try-it panel (`TryItPanel`):**
- Fixed right side panel with `animate-slide-in` class
- Backdrop overlay div closes panel on click
- Reads params from OpenAPI `parameters[]`, builds query/path params from user input
- Uses `getOrgId()` from `@/lib/api` for `X-Org-Id` header
- Shows response status color-coded (green 2xx, red 4xx), response time in ms, copyable JSON

**Endpoint cards:**
- Collapsed by default — click to expand (toggle via `expandedEndpoints: Set<string>`)
- Expanded view shows: summary, description, parameters table (4-col grid), response codes, "Try it" + copy curl buttons
- "Try" button also available inline in collapsed header on sm+ screens

**Sidebar:**
- Desktop: `position: fixed` 240px left panel (actually `static` within flex layout)
- Mobile: off-screen slide-in drawer toggled by hamburger, with backdrop overlay
- Search input filters both sidebar tags and main content simultaneously

**Why:** Building trust with developers — docs page is a sales tool. Every endpoint is explorable without leaving the page.
