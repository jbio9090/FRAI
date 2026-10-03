---
paths:
  - 'resources/js/**'
  - 'resources/js/**/*.tsx'
---

# Js

## Resolve VAPID key at runtime, share one SW registration
Resolve the VAPID key at runtime via usePage().props.firebaseConfig.vapidKey (see lib/firebasePush resolveVapidKey), never import.meta.env alone: Vite bakes env at build time and it is empty in the Docker image. Mint/check FCM tokens against one shared service-worker registration (getPushServiceWorkerRegistration), and guard mount-time getToken on Notification.permission === 'granted'.

## Never define a component inside another component's body
Never declare a React component inside another component's function body (e.g. a shared form-fields renderer defined in the middle of a page). Each parent render creates a new component type, so React unmounts/remounts the subtree and controlled inputs lose focus after one keystroke. Put shared renderers at module scope or in a separate file under pages/<page>/components/, and pass all parent state in as props instead of closing over it. This is what made the Add User modal in resources/js/pages/accounts/index.tsx type one letter at a time and lock the Position field.

## Hide per-facility decision controls on the requests listing card once resolved
RequestCard takes an opt-in `hideFacilityDecisionsWhenResolved` prop, passed only from pages/requests/index.tsx. When set, each BookingCard inside the card gets `showActions={false}` once the parent request is `Approved` or `Conditionally Approved`, which removes the per-facility "Facility Decision" footer (booking-card.tsx:404). The request detail page and pages/accounts/detail.tsx deliberately keep the footer visible, so don't flip BookingCard's `showActions` default or gate it globally by status. `Partially Approved` intentionally still shows decisions.

## Normalize 24:00 booking times before parsing
Booking times are stored as strings where midnight can be '24:00' or '24:00:00', which `new Date()` cannot parse (renders NaN). Always normalize to '23:59:00' before parsing. Likewise `date_requested` is a bare YYYY-MM-DD and must have `T00:00:00` appended, or it parses as UTC midnight and shifts a day backwards in negative-offset timezones. `formatBookingDate` / `formatBookingTimeRange` in lib/formatters.ts handle both; booking-card.tsx keeps local copies of the same logic.

## App shell is a persistent Inertia layout, never a per-page wrapper
The app shell (resources/js/layout.tsx/default.tsx) is attached as Inertia's persistent `Component.layout` via applyPageShell() in resources/js/layout.tsx/page-shell.tsx, called from both app.tsx (CSR) and ssr.tsx (SSR). Pages must NOT import/render <DefaultLayout> — wrapping a page in it nests a second per-visit shell and kills layout persistence (sidebar state/scroll, in-flight toasts, chatbot session). New pages get the padded shell automatically; add the page name to UNSHELLED_PAGES (auth/public/error pages that own their chrome) or EDGE_TO_EDGE_PAGES (tables/boards that need hasPadding={false}) instead of adding a wrapper. Shell state now survives navigation, so anything that used to reset implicitly on remount must be reset explicitly.

## A persistent chatbot must cancel an in-flight turn on navigation
useChatAPI runs one AbortController per turn: sendMessage() aborts the previous turn before starting, an aborted turn rethrows without calling setError and without entering the 2-minute transient-failure retry, and chatbot.tsx aborts on usePage().url change plus on unmount. This is required *because* the shell persists: before the persistent layout the chatbot unmounted on every navigation, so a pending retry (useChatAPI RETRY_DELAY_MS) fired into a dead component and was invisible. With a persistent shell that same retry types a stale answer into the live chat window on whatever page the user navigated to. Never reintroduce a bare setTimeout retry or an unabortable fetch in this hook.
