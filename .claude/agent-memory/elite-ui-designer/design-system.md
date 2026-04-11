---
name: TAI-AEGIS Design System
description: Enterprise dark theme tokens, component patterns, custom CSS classes for the Transilience AI threat intelligence platform
type: project
---

## Stack
- Next.js 14, React 18, TypeScript, Tailwind CSS
- Recharts, Lucide-react icons
- Global CSS: `frontend/app/globals.css`

## Color Tokens (CSS vars in :root)
- `--bg-primary: #07040B` — page background
- `--bg-card: #110d1a` — card / modal body
- `--border-color: rgba(139, 92, 246, 0.08)` — default borders
- `--border-glow: rgba(139, 92, 246, 0.15)` — hover borders
- `--accent-primary: #8b5cf6` (purple)
- `--accent-pink: #ec4899`

## Custom CSS Classes (do NOT replace with Tailwind)
- `.card-enterprise` — gradient card with purple border, backdrop-blur, hover glow
- `.stat-card` — stat card with top gradient accent bar
- `.btn-brand` — purple gradient button
- `.text-gradient-brand` — purple→pink gradient text
- `.status-live / .status-warning / .status-critical` — dot indicators
- `.skeleton` — shimmer loading
- `.glow-purple / .glow-brand` etc — box-shadow glow utilities

## Component Patterns

### Cards
```
className="card-enterprise p-4"
```

### Inputs & Selects
```jsx
className="rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)" }}
```

### Modals (overlay + body)
```jsx
// Overlay
className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
// Body
className="rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
style={{ background: "#110d1a", border: "1px solid rgba(139,92,246,0.12)" }}
```

### Table Headers
```jsx
<thead style={{ background: "rgba(139,92,246,0.04)" }}>
```

### Table Dividers (tbody)
```jsx
<tbody className="divide-y" style={{ borderColor: "rgba(139,92,246,0.06)" }}>
```
Row hover: `className="transition-colors hover:bg-white/[0.02]"`

### Tab Bar
```jsx
// Container
<div className="flex gap-1 p-1 rounded-lg w-fit"
  style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.1)" }}>
// Active tab
className="... bg-purple-500/10 text-purple-400 border border-purple-500/20"
// Inactive tab
className="... text-slate-400 hover:text-white"
```

### Inline code / tag chips
```jsx
style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(139,92,246,0.08)" }}
```

### Secondary Buttons (pagination, refresh, retry)
```jsx
className="... text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(139,92,246,0.1)" }}
```

### Timeline divider line (threats page)
```jsx
style={{ background: "rgba(139,92,246,0.12)" }}
```

### Empty-state icon containers
```jsx
style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)" }}
```

## Anti-patterns (never use)
- `bg-slate-900` — use `card-enterprise` or `#110d1a` inline
- `bg-slate-800` — use `rgba(255,255,255,0.02)` inline
- `border-slate-700` — use `rgba(139,92,246,0.1)` inline
- `divide-slate-700/50` — use `divide-y` + `borderColor: rgba(139,92,246,0.06)`
- `bg-purple-600` on tabs — use `bg-purple-500/10 text-purple-400 border border-purple-500/20`
- `hover:bg-slate-800/50` on rows — use `hover:bg-white/[0.02]`
