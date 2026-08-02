# FRAI Design System — "Blueprint"

**Status: Proposed.** This spec is implemented as a **scoped mock-up** so it can be reviewed
without touching the live app. Live routes:

| Route | What it is |
|---|---|
| `/design/preview` | Sample dashboard in the new system |
| `/design/preview/create` | Sample create-request form in the new system |

All preview styling lives in `resources/css/app.css` under the `.design-preview` scope, and in
`resources/js/components/design/`. The live app is unaffected until this direction is approved
and the tokens are promoted to the global theme.

---

## 1. Design principles

1. **The chamfer is the one bold thing.** A chamfered corner cut (from the logo's 120° facets)
   is FRAI's signature. Everything else stays flat, ruled, and quiet.
2. **No decorative gradients.** No purple-blue meshes, no radial glows, no color-to-color
   fades. Surfaces are flat solid fills separated by hairlines. The only permitted gradients
   are *functional* scroll-edge fades (fade-to-background on carousels).
3. **Structure is information.** Section eyebrows are uppercase Manrope semibold and carry
   real counts or meaning (`REQUEST QUEUE · 7`), never decorative `01 / 02 / 03` numbering.
4. **Mono is the data voice, used sparingly.** Only numbers, identifiers and statuses read as
   instrumentation: stat numerals, request IDs, timestamps/dates, chart ticks and status
   badges render in JetBrains Mono. Everything else — labels, eyebrows, copy — is Manrope
   with weight doing the hierarchy work.
5. **Approval is the brand.** Approved = FRAI blue. Green never appears anywhere in the app.
6. **Dark mode is full parity.** Same tokens, flipped lightness. The sidebar shares the app's
   surface in both modes — the brand blue is the only constant identity.

---

## 2. Brand foundations

| Asset | Value |
|---|---|
| Logomark | `resources/js/svg/FRAI.svg` — faceted blue prism |
| Brand blues | `#2152ff` (royal), `#1a41cc` (navy), `#6079ff` (sky) |
| Display / wordmark | **ClashDisplay** (variable) — FRAI wordmark + hero headings |
| UI / body | **Manrope** (200–800) — all interface copy |
| Data / mono | **JetBrains Mono** (variable, `public/fonts/JetBrainsMono-Variable.ttf`) |
| GSO · PLV | Institution context: city university general services office |

---

## 3. Color tokens

Light is "paper + ink" (cool blue-white surfaces, navy ink). Dark is "deep blue-slate".
Values shown are the scoped mock values; when promoted, they become the global Oklch tokens.

### 3.1 Core (light)
| Token | Value | Use |
|---|---|---|
| `--background` | `#eef1f8` | app canvas (paper) |
| `--foreground` | `#16213d` | primary text (ink) |
| `--card` | `#ffffff` | surfaces |
| `--primary` | `#2152ff` | brand / primary actions / approved |
| `--muted-foreground` | `#5b6783` | secondary text |
| `--border` | `#d7ddeb` | hairlines |

### 3.2 Core (dark)
`--background #0c1322` · `--card #121b30` · `--foreground #dbe2f2` · `--primary #5a7bff`
· `--border #25304f`.

### 3.3 Semantic (both modes)
| Meaning | Light | Dark |
|---|---|---|
| OK / approved | `#2152ff` bg `rgba(33,82,255,.10)` | `#5a7bff` bg `rgba(90,123,255,.16)` |
| Warning | `#a15c07` bg `rgba(196,116,16,.12)` | `#e5a24e` bg `rgba(229,162,78,.16)` |
| Danger | `#bf3b37` bg `rgba(191,59,55,.10)` | `#e06a64` bg `rgba(224,106,100,.16)` |
| Neutral | `#5b6783` bg `rgba(91,103,131,.12)` | `#8b96b5` bg `rgba(139,150,181,.16)` |

Implemented as `--bp-ok`, `--bp-amber`, `--bp-danger`, `--bp-neutral` (+ `-bg` variants).

### 3.4 Status → tone mapping (the whole app uses this)
| Status | Tone |
|---|---|
| Approved, Conditionally Approved | **ok** (blue) |
| For Reschedule, Partially Approved | **amber** |
| Denied, On Hold | **danger** |
| Pending | **neutral** |

**No green exists in the palette.**

### 3.5 Sidebar (matches the app surface)
`--sidebar` matches `--background` (`#eef1f8` light / `#0c1322` dark), active item = `--accent`
fill with a 2px inset blue left rule. The sidebar is intentionally *not* a separate color —
it is the same paper as content, with the brand blue as the only colored identity.
Collapse keeps the old icon-rail behavior: labels hide, icons center and stay visible
(70px rail, native tooltips), and the nested Requests submenu collapses to its parent icon.
**Responsive (matches the old layout):** below 768px the sidebar does not render in the
layout at all — content is full-width and the header toggle opens a 256px offcanvas drawer
(always expanded, no icon rail) with a backdrop.

---

## 4. Radius & chamfer

- **Global radius is `0px`.** Surfaces are sharp.
- **Signature:** a chamfered corner cut (default 16px cut, 24px on hero surfaces) applied to
  major surfaces: stat tiles, queue cards, panels, the summary card. Implemented with
  `clip-path: polygon(0 var(--bp-chamfer), var(--bp-chamfer) 0, 100% 0, 100% 100%, 0 100%)`.
- Chamfered cards get a 1px hairline that follows the cut edge (`--bp-card` / `--bp-card-inner`).
- Pills (badges, status chips) stay `rounded-full` for scannability.

---

## 5. Typography

| Role | Face | Notes |
|---|---|---|
| Display | ClashDisplay | hero headings, FRAI wordmark; use sparingly |
| UI / body | Manrope | 400 / 500 / 600 / 700; body 14px |
| Data / mono | JetBrains Mono | IDs, timestamps, dates, stat numerals, ticks, status badges |

**Eyebrow spec:** Manrope semibold, 11px, `letter-spacing: .13em`, uppercase,
`--muted-foreground`. Carries real info, e.g. `REQUEST QUEUE · 7`.

**Numerals:** stat values render in mono (`text-4xl font-bold`). Numbers are tabular by nature
of the mono face — aligns columns in tables automatically. Mono is reserved for data and
signals; interface copy uses Manrope weights instead of mono.

---

## 6. Layout & shell

- **Sidebar** keeps the current shadcn icon-rail behavior but becomes a flush full-height board
  that matches the app surface, with Manrope semibold section labels
  (`OVERVIEW / REQUESTS / DIRECTORY`), sharp items, the old nested **Requests** collapsible
  (chevron-rotating parent + status sub-items), blue Create Request / Chatbot CTAs, and the
  user dropdown pinned bottom.
- **Content** sits on the paper background with **no decorative texture** — the blueprint grid
  was dropped after review; separation comes from hairlines and spacing alone.
- **Top bar** holds the collapse toggle, mono breadcrumb (`GSO / design / …`), and global actions.
- Content is capped at the existing `max-w-7xl` rhythm; 8-column rhythm via `grid`.

---

## 7. Components

- **StatusBadge** — the one badge component (`components/design/StatusBadge.tsx`). Token-driven
  via `--bp-*`, mono uppercase, optional dot. Replaces every hand-rolled pill.
- **ChamferCard** — chamfered surface (`components/design/ChamferCard.tsx`), hairline edge.
- **QueueCard** (mock dashboard) — mirrors the live `SmallRequestCard` info: title + detail,
  status badge + priority (only when > 0) + on-hold + conflicts pills, requester + submitted
  time, facilities/comments/files counts, and Approve/Deny/More actions for Pending /
  For Reschedule. Shown in a live-style 400px carousel with prev/next arrows.
- **Button** — shadcn structure; radius 0; `default` = primary blue; destructive = `--bp-danger`.
- **Input / Select / Textarea** — radius 0, `--card` fill, `--border` rule; data-ish placeholders
  may use mono.
- **Table** — hairline rows (`border-b`), mono IDs/dates, no zebra, badges in a status column.
- **Charts** — solid line + flat low-alpha fill (`fillOpacity ≈ 0.07`), mono ticks, hairline
  grid. **No gradient fills.**
- **Tabs** — bottom hairline rule, active tab = 2px blue underline (already the pattern in
  request-card).
- **Dialogs / Sheets / Popovers** — radius 0, hairline border, no shadow-heavy treatment.

### 7.1 Status buttons (bulk actions)
Approve stays primary blue; Deny is outline that turns `--bp-danger` on hover; For Reschedule is
outline with amber hover. Matches the status tones.

---

## 8. Motion

- Keep the existing motion library usage but **restrain it**: entrance only (fade/slide-in),
  hover micro-interactions on clickable surfaces, carousel edge fades (functional, allowed).
- **Respect `prefers-reduced-motion`** — motion components already should collapse to nothing.
- No ambient/loop animations, no scroll-triggered parallax in the admin surfaces.

---

## 9. Accessibility / quality floor

- Visible keyboard focus everywhere (`focus-visible` ring in `--ring`).
- Contrast: `--muted-foreground` on `--card` ≥ 4.5:1 in both modes.
- Buttons/inputs/labels fully navigable; icon buttons carry `aria-label`.
- Responsive: sidebar collapses to icon rail; grids stack; tables scroll horizontally.

---

## 10. Rollout plan (once approved)

1. **Promote tokens:** move the `.design-preview` values into the global `:root` / `.dark`
   theme in `app.css`; set `--radius` to `0px` and add `--bp-*` semantic vars globally.
2. **Promote components:** move `StatusBadge` / `ChamferCard` into `components/ui/`.
3. **Migrate the shell:** restyle `layout.tsx/default..tsx` + `app-sidebar.tsx` to the
   surface-matching board + chamfered content; keep the icon rail.
4. **Migrate pages:** replace hardcoded colors with tokens — `bg-blue-600` (login), `bg-gray-100/20`
   & `bg-slate-500/20` (status-tag), `bg-yellow-100`/`bg-red-100` (conflict pills, on-hold,
   error banners), `hover:text-green-500` (bulk bar) → semantic status system.
5. **Delete dead code:** remove `resources/js/pages/welcome.tsx` (unrouted Laravel starter).
6. **Delete sandbox:** remove the `/design/preview` routes, `components/design/`,
   `pages/design/`, and the `.design-preview` CSS block.

## 11. Known pre-existing issue (not caused by this work)

`npm run types` reports `Cannot find name 'route'` across the whole codebase because
`resources/js/ziggy.d.ts` is stale (it declares an old route list and no global `route`). This
predates the design work and fails in existing files (app-sidebar, chatbot, etc.) equally.
Runtime works via the `@routes` blade directive. Regenerating Ziggy types will clear it.
