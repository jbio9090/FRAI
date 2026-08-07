# FRAI Design System — "Atlassian"

**Status: Proposed (current direction).** Not yet applied to the live app — the tokens and
component specs in this document are the target; promote them via §10 once approved.

---

## 1. Design principles

1. **Neutral-dominant, restrained saturation.** Surfaces are calm greys and whites; colour carries
   meaning and is never decorative. Depth is earned through the elevation model (surface → raised →
   overlay), not gradients or glows.
2. **Blue is the brand.** Brand blue `#0C66E4` is the primary action colour, the active nav
   identity, and — following the app's existing convention — the "approved / ok" tone. Green never
   stands in for approval.
3. **An 8px grid and a t-shirt radius scale.** `radius.small` 4px (lozenges), `radius.medium` 6px
   (buttons, inputs), `radius.large` 8px (cards), `radius.xlarge` 12px (modals). The shadcn radius
   math already produces exactly this from a single `--radius: 0.5rem` base.
4. **Cards are borders, not shadows.** Flat cards use a 1px hairline on a white surface. Shadows
   are reserved for raised/overlay surfaces (menus, dialogs, tooltips).
5. **Expanded accent register, same semantics.** Event types and categories use the full ADS accent
   palette (grey, blue, purple, orange, teal, magenta, green, lime) — semantic statuses stay
   restrained: blue = ok, orange = reschedule, red = denied, neutral = pending.
6. **Dark mode is full parity.** Same tokens, flipped lightness on deep neutral (`#1D2125`), not
   black.

---

## 2. Brand foundations

| Asset      | Value                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| Logomark   | `resources/js/svg/FRAI.svg` — faceted blue prism                                 |
| Brand blue | `#0C66E4` (light, = `primary`) · `#579DFF` (dark) · focus `#388BFF`              |
| UI / body  | **Manrope** (kept — Atlassian Sans/Charlie are auth-gated and cannot be bundled) |
| Data       | none — no mono voice                                                             |
| GSO · PLV  | Institution context: city university general services office                     |

_If licensed Atlassian Sans later becomes available, swap `--font-sans` in the token block and
everything reflows — no component changes needed._

---

## 3. Color tokens

Light is "sunken canvas + white surfaces" (ADS `elevation.surface.sunken` / `surface`). Dark is
"deep neutral". Values shown are the proposed token values; when promoted, they become the global
tokens.

### 3.1 Core (light)

| Token                  | Value       | Use                                      |
| ---------------------- | ----------- | ---------------------------------------- |
| `--background`         | `#F7F8F9`   | app canvas (`surface.sunken`)            |
| `--foreground`         | `#292A2E`   | primary text (`text`)                    |
| `--card` / `--popover` | `#FFFFFF`   | surfaces (`surface` / `surface.overlay`) |
| `--primary`            | `#0C66E4`   | brand / primary actions / approved       |
| `--muted-foreground`   | `#505258`   | secondary text (`text.subtle`)           |
| `--border`             | `#091E4224` | hairline borders (`border`, alpha)       |
| `--input`              | `#8590A2`   | field outlines (`border.input`)          |
| `--ring`               | `#388BFF`   | focus ring (`border.focused`)            |

### 3.2 Core (dark)

`--background #1D2125` · `--card #1D2125` · `--popover #282E33` · `--foreground #B6C2CF`
· `--primary #579DFF` · `--muted-foreground #9FADBC` · `--border #A6C5E229`.

### 3.3 Semantic status → tone mapping (the whole app uses this)

| Status                             | Tone                         |
| ---------------------------------- | ---------------------------- |
| Approved, Conditionally Approved   | **ok** (blue `#0C66E4`)      |
| For Reschedule, Partially Approved | **amber** (orange `#E56910`) |
| Denied, On Hold                    | **danger** (`#C9372C`)       |
| Pending                            | **neutral** (`#44546F`)      |

Implemented as `--ads-ok`, `--ads-amber`, `--ads-danger`, `--ads-neutral` (+ `-bg` variants) that
flip in dark mode. **No green exists in the palette.**

### 3.4 Event-type accent register (the expanded palette)

| Event type  | Light fill / ink        |
| ----------- | ----------------------- |
| Routine     | `#091E420F` / `#44546F` |
| Department  | `#E9F2FE` / `#0C66E4`   |
| Academic    | `#F3F0FF` / `#5E4DB2`   |
| University  | `#FEDEC8` / `#E56910`   |
| Sports      | `#E3F5F4` / `#1D7F8C`   |
| Cultural    | `#FFEDF3` / `#AE3E86`   |
| Community   | `#E4F5EE` / `#216E4E`   |
| Fundraising | `#F4F7DB` / `#4C6B1F`   |

Defined as `--ads-ac-*` vars so they also adapt to dark mode.

### 3.5 Sidebar

`--sidebar` is white in light / `#161A1D` in dark. Active item = subtle blue fill (`--ads-ok-bg`)
with a 2px inset brand-blue rule, rounded corners, no pills. Collapse keeps the old icon-rail
behaviour (76px rail, native tooltips). **Responsive (matches the old layout):** below 768px the
sidebar renders as a 256px offcanvas drawer with a backdrop.

---

## 4. Radius

- Base `--radius: 0.5rem` — shadcn math yields the ADS scale: `rounded-sm` 4px, `rounded-md` 6px
  (buttons/inputs), `rounded-lg` 8px (cards via `.ads-card`), `rounded-xl` 12px (dialogs/menus).
- Cards are flat: 1px hairline (`--border`), **no shadow** by default.
- Badges render as ADS lozenges (4px) via a scoped `[data-slot="badge"]` override.
- Focus uses a 2px offset ring (scoped `:focus-visible { outline-offset: 2px }`).

---

## 5. Typography

| Role               | Face                 | Notes                                             |
| ------------------ | -------------------- | ------------------------------------------------- |
| Display / headings | Manrope Bold         | greeting, wordmark, stat numerals; tight tracking |
| UI / body          | Manrope              | 400 / 500 / 600 / 700; body 14px                  |
| Data               | none — no mono voice |                                                   |

**Eyebrow spec:** `.ads-eyebrow` — Manrope semibold, 11px, uppercase, `--muted-foreground`.
Section eyebrows carry real meaning (e.g. `GSO desk · Aug 12`), never decorative numbering.

---

## 6. Layout & shell

- **Sidebar** — white board, hairline border, rounded items, blue-tinted active fill with a 2px
  inset rule, filled blue Create Request / Chatbot CTAs, user dropdown pinned bottom. The nested
  **Requests** collapsible (chevron-rotating parent + status sub-items) is kept.
- **Top bar** — card surface, collapse toggle, breadcrumb (`GSO / design / …`), a hairline search
  field (6px radius), "Mockup · not final" chip, notification bell with a blue dot, theme toggle.
- **Content** — flat white cards on the sunken grey canvas, separated by hairlines; capped at the
  existing `max-w-7xl` rhythm.

---

## 7. Components

- **StatusLozenge** — the status badge. Same
  `STATUS_TONES` semantics as before, tokenized off `--ads-*`, 4px lozenge + dot. Approved stays
  brand blue.
- **Avatar / AvatarStack** — soft people-palette tints
  (`--ads-av-*`), white 2px ring, overlapping `-ml-2.5` stacks.
- **RequestRow** — a request as a flat queue strip (hairline
  dividers, hover fill): accent event-type chip, title + requester · facility, meta chips, status
  lozenge, avatar, and Approve/Deny on Pending / For Reschedule rows.
- **StatTile** — tinted icon chip + numeral; the accent tile is
  a filled brand-blue surface.
- **ActivityFeed** — live rail of avatar + actor + tinted
  verb + target, mirroring the app's real audit/notification events.
- **Button** — shadcn structure; `rounded-md` (6px) CTAs; `default` = primary blue; outline/ghost
  for secondary actions; destructive = `--destructive`.
- **Input / Select / Textarea** — shadcn defaults land at 6px via the radius base; `--input` /
  `--border` hairlines, `--background` fills.
- **Table / Queue** — hairline rows (`border-b`), no zebra, hover fill, badges in a status column.
- **Charts** — solid blue line + gradient fading to 0 (the one permitted gradient), rounded tooltip
  card, ADS chart palette (`chart-1..5`).
- **Tabs** — segmented control with a card-colour active pill (queue filters).
- **Dialogs / Menus / Popovers** — ADS overlay elevation (12px radius + diffused neutral shadow).

---

## 8. Motion

- Entrance only (fade/slide-in), hover micro-interactions, avatar hover lift, the feed's "live"
  ping dot. **Respect `prefers-reduced-motion`.**
- No ambient/loop animation, no scroll-triggered parallax in the admin surfaces.

---

## 9. Accessibility / quality floor

- Visible keyboard focus: 2px offset ring in `--ring`.
- Contrast: `--muted-foreground` on `--card` ≥ 4.5:1 in both modes.
- Buttons/inputs/labels fully navigable; icon buttons carry `aria-label`.
- Responsive: sidebar collapses to an icon rail; grids stack; tables scroll horizontally.

---

## 10. Rollout plan (once approved)

1. **Promote tokens:** apply the token tables in §3 to the global `:root` / `.dark` theme in
   `app.css`; set `--radius` to `0.5rem` and add `--ads-*` semantic vars globally; keep Manrope
   as `--font-sans` (or swap to Atlassian Sans if licensed).
2. **Promote components:** implement `StatusLozenge` / `Avatar` / `RequestRow` / `ActivityFeed` /
   `StatTile` per §7 into `components/`, adopt `.ads-card` as the global card surface, the
   `[data-slot="badge"]` lozenge override, and the 2px focus offset.
3. **Migrate the shell:** restyle `layout.tsx/default..tsx` + `app-sidebar.tsx` to the white board
    - hairline top bar; keep the icon rail.
4. **Migrate pages:** replace hardcoded colors with tokens — `bg-blue-600` (login), `bg-gray-100/20`
   & `bg-slate-500/20` (status-tag), `bg-yellow-100`/`bg-red-100` (conflict pills, on-hold, error
   banners), `hover:text-green-500` (bulk bar) → semantic status system.
5. **Delete dead code:** remove `resources/js/pages/welcome.tsx` (unrouted Laravel starter).

## 11. Known pre-existing issue (not caused by this work)

`npm run types` reports `Cannot find name 'route'` across the whole codebase because
`resources/js/ziggy.d.ts` is stale (it declares an old route list and no global `route`). This
predates the design work and fails in existing files (app-sidebar, chatbot, etc.) equally.
Runtime works via the `@routes` blade directive. Regenerating Ziggy types will clear it.
