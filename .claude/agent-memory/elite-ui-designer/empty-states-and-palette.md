---
name: Empty States and Command Palette Patterns
description: Icon-ring empty states with How-it-works steps; CommandPalette component architecture and layout wiring
type: project
---

## Empty state visual pattern (all 4 pages use this)

Each empty state shares a consistent structure:
1. **Relative-positioned 112px container** with an outer `animate-ping` radial-gradient ring
2. **Orbit icons**: 5–7 Lucide icons positioned via `left`/`top` percentage using trigonometry (cos/sin), -translate-x/y-1/2, absolute positioned
3. **Center core**: 48px rounded-xl with gradient background matching page accent color, contains the page's primary icon
4. **Headline**: `text-xl font-bold text-white tracking-tight`
5. **Subhead**: `text-[13px] text-slate-400 max-w-xs leading-relaxed` with one `<span>` in the page accent color for a highlight
6. **Primary CTA**: `h-9 px-5 btn-brand` with a Lucide icon
7. **Optional secondary CTA**: muted `bg-white/[0.02] border border-white/[0.06]` style
8. **How it works divider**: two `flex-1 h-px` dividers with `text-[10px] uppercase tracking-wider text-slate-600` center label
9. **Numbered steps**: `<ol>` with `w-5 h-5 rounded-full` number badges in page accent color (bg opacity 0.1, border opacity 0.2)

### Page accent colors:
- `/intel`: blue `rgba(59,130,246,…)` — 6-icon orbit for IOC types
- `/profile`: rose/red `rgba(244,63,94,…)` — 5-icon orbit: Building2, Globe, Tag, MapPin, Skull
- `/researcher-feed`: purple `rgba(168,85,247,…)` — 7-orbit with text labels (channel abbreviations)
- `/scan`: blue `rgba(59,130,246,…)` — 4-icon orbit (one per tool)

## CommandPalette component

**File**: `/frontend/components/CommandPalette.tsx` (489 lines)

**Architecture**:
- Named export `CommandPalette` with props `{ open: boolean; onClose: () => void }`
- Self-manages `query`, `selectedIdx`, `showShortcuts` state
- `useRouter` from next/navigation for navigation
- ALL_ITEMS constant defined outside component (stable reference)
- SECTION_ORDER array controls display order: Navigate → Actions → Quick queries → Help
- SECTION_COLORS map gives each section a distinct accent (purple/blue/orange/green)

**Key UX details**:
- Each section gets a colored 1px dot + colored section label (not generic grey)
- Selected item row: `linear-gradient(90deg, ${color}18, ${color}08)` background + `${color}25` border
- Selected icon container: `${color}20` bg + `${color}35` border — icon gets `style={{ color: sectionColor }}`
- Unselected: `rgba(255,255,255,0.03)` bg, `rgba(255,255,255,0.05)` border, slate-300 text
- Arrows only appear when selected (replaces shortcut chip)
- Mobile: full-screen overlay (no `pt-[12vh]` at sm:), flex flex-col with flex-1 results area
- Keyboard shortcuts panel toggled by selecting "Keyboard shortcuts" item
- `selectedRef.current?.scrollIntoView({ block: "nearest" })` for keyboard scroll-into-view

**Interface widening needed**: `PaletteItem.icon` must be typed as `React.ComponentType<{ className?: string; style?: React.CSSProperties }>` to allow `style={{ color }}` on icons.

## Layout wiring

The layout (`app/(dashboard)/layout.tsx`) retains its own `cmdOpen`/`setCmdOpen` state and keyboard handler.
The new `CommandPalette` component is imported as a named export from `@/components/CommandPalette`.
Usage: `<CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />`
The palette is rendered after `{children}` but inside the main content div, just before `<main>`.

**Why:** The previous inline `CommandPalette` function (169 lines) was removed from layout.tsx in favor of the richer standalone component. The `cmdQuery`, `cmdInputRef` state/ref that fed the old inline component are also removed.
