---
name: Landing Page Patterns
description: Public marketing landing page patterns for TAI-AEGIS — sections, primitives, mock dashboard, comparison table, pricing cards
type: project
---

Public landing page lives at `/frontend/app/page.tsx` (1011 lines, "use client").

## Section order
1. Sticky header (backdrop-blur, h-14, mobile hamburger drawer)
2. Hero (eyebrow pill, gradient headline, CTA pair, trust pills, DashboardPreview mock)
3. Problem / The Gap (4 stat-cards with big mono numbers, color-coded icons)
4. How it works (3-step cards with connector chevrons, id="how-it-works")
5. Features grid (8 cards, 3-col, id="features")
6. Comparison table (4-col: AEGIS | Flare | Recorded Future, card-enterprise wrapper)
7. Pricing (3 cards: Free Beta / Pro highlighted / Enterprise, id="pricing")
8. Final CTA (gradient card, email input → /register?email=)
9. Footer (4-col grid, GitHub link, status-live dot)

## Key primitives defined inline
- `<Eyebrow>` — 11px purple uppercase tracking-[0.18em]
- `<SectionHeading>` — 3xl/4xl bold text-gradient-brand
- `<DashboardPreview>` — fake window-chrome card with 3 ransomware alert rows + IOC strip

## Routing
- All primary CTAs → `/register` or `/register?email=<value>`
- "Sign in" / "See live demo" → `/login`
- Anchor scroll: `#features`, `#pricing`, `#how-it-works`

## No-dependency rule
Only lucide-react, next/image, next/link — no external images, no new deps.

**Why:** Landing page must work for logged-out visitors with no backend connection.
**How to apply:** Never import from @/lib/api or @/lib/supabase in this file.
