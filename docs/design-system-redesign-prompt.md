# FRAI Design System — Page Redesign Prompt

> Copy everything below this line, paste it into your AI, then append the target page/route at
> the end (e.g. `## Target: facilities index`). The full source of truth lives in
> `docs/design-system.md`.

---

You are redesigning a page of **FRAI**, a Laravel + Inertia + React (TypeScript) app for the GSO
(city university general services office), to match the FRAI "Atlassian" design system.
shadcn/ui on Tailwind CSS v4 is installed, and the global design tokens are already applied in
`resources/css/app.css`. **Your job is UI-only: never change global styles, backend, routes,
controllers, or data.**

## Target

## Hard rules (do not skip)

1. **Keep every existing feature.** Preserve all state, logic, handlers, API calls, permissions,
   routes, and data shown. Change ONLY presentation (`className`, JSX structure, colors, spacing,
   icons). Nothing may be removed or relabelled unless it's pure dead code.
2. **Scope strictly to the target page and its own components.** Do not touch other pages, the
   layout/sidebar, shared UI primitives, or global CSS. Read-only reference to migrated pages is
   fine.
3. **Tokenize, never hardcode.** Replace all raw color literals (`bg-yellow-*`, `text-green-*`,
   `bg-red-100`, `text-blue-600`, `border-gray-*`, `text-foreground/70`, etc.) with the semantic
   tokens below or existing shadcn utilities.
4. **No green.** Blue is the brand and the "approved / ok" tone. Green never stands in for
   approval.
5. **Dark mode is full parity.** Use tokens/CSS vars so light and dark both look correct — never
   single-mode hardcoded colors.
6. **Cards are flat:** 1px hairline (`--border`), 8px radius (`.ads-card`), **no shadow**. Shadows
   are reserved for overlay surfaces (popovers, dialogs, sheets, tooltips, dropdowns).
7. **Lozenges, not pills:** badges / status chips / counts use 4px radius (`rounded-[4px]`).
8. **Typography:** Manrope; headings use tight tracking (`tracking-tight`); section context uses
   `.ads-eyebrow` (11px, semibold, uppercase, muted). No decorative emojis.
9. **Motion:** entrance-only (fade/slide-in), hover micro-interactions; respect
   `prefers-reduced-motion`; no looping/ambient animation.
10. **Accessibility:** visible 2px offset focus ring (already global), `aria-label` on icon
    buttons, contrast ≥ 4.5:1, responsive stacking, keyboard navigable.
11. **Clean code:** remove dead code / unused imports / unused state in the files you touch so the
    file passes a scoped eslint pass.

## Design essentials (inline)

- **Status → tone map** (use `<StatusTag requestStatus={...} />` where the status badge exists):
  - Approved, Conditionally Approved → **ok** (blue `--ads-ok` / `--ads-ok-bg`)
  - For Reschedule, Partially Approved → **amber** (`--ads-amber` / `--ads-amber-bg`)
  - Denied, On Hold → **danger** (`--ads-danger` / `--ads-danger-bg`)
  - Pending → **neutral** (`--ads-neutral` / `--ads-neutral-bg`)
- **Event-type / priority accents** (fill + ink pairs): `--ads-ac-routine`, `-department`,
  `-academic`, `-university`, `-sports`, `-cultural`, `-community`, `-fundraising` with matching
  `--ads-ac-ink-*`. For requests, priority chips use `PRIORITY_ACCENT` from
  `resources/js/types/request.ts` (rendered as 4px lozenges).
- **Radius scale:** small 4px (lozenges/badges) · medium 6px (buttons, inputs) · large 8px (cards →
  `.ads-card`) · xlarge 12px (dialogs, menus, popovers).
- **Buttons:** `default` = primary brand-blue CTA · `outline` / `ghost` for secondary · `destructive`
  for danger. Approve = blue, never green.
- **Tabs:** use `TabsList variant="line"` for page/section tabs.
- **Avatars:** `AvatarWithInitials` already applies the people-palette tints — no styling needed.

## Reference patterns (already migrated — mirror these, do NOT modify)

- `resources/js/pages/dashboard.tsx` — hero (`.ads-eyebrow` + `font-display` H1), StatTile KPIs,
  RequestRow queue, conflict banners, line tabs, empty states, bulk/filter popovers.
- `resources/js/pages/requests/index.tsx` + `resources/js/components/request-card.tsx` — the
  migrated requests index (flat cards, lozenges, tokens, bulk bar).
- `resources/js/pages/requests/create/index.tsx` — `.ads-card` form sections with `.ads-eyebrow`
  headers, accent lozenges, sticky right rail.
- `resources/js/components/status-tag.tsx`, `request-row.tsx`, `avatar-with-initials.tsx` —
  shared components already on-system.

## Definition of done

- [ ] All features work exactly as before; no props/handlers/behavior removed.
- [ ] No hardcoded color literals remain in the page; all ADS tokens applied; dark mode verified.
- [ ] `npm run build` succeeds.
- [ ] Scoped `npx eslint <changed files>` → 0 errors (dead code removed).
- [ ] `php artisan route:list` unchanged (no route/controller changes).
- [ ] Spot-checked responsive (mobile stacking), keyboard focus, `prefers-reduced-motion`.

## Deliverable

Summarize the changes per file and call out any dead code removed. Do not modify anything outside
the target page.
