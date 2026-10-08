---
paths:
  - app/Http/Controllers/ChatController.php
  - 'app/Http/Controllers/**'
  - app/Http/Controllers/EquipmentController.php
---

# Controllers

## Chat turns run on an ai.chat wall-clock budget, never a hardcoded timeout
A chat turn is one synchronous request (tool loop + fallback call), and nginx has no fastcgi_read_timeout — locally (Herd) or in nginx.conf — so it cuts off at 60s and the user sees a 504 while PHP keeps going to set_time_limit(120). Every AI call must go through chatCallTimeout() and be gated by chatBudgetSpent(); never reintroduce a hardcoded 120. When the budget runs out, return the 200 + meta.budget_exceeded fallback (chatBudgetExceededResponse) instead of a gateway error, and keep ai.chat.budget under 60.

## Set response headers via toResponse(), and never assert a literal Cache-Control string
Inertia\Response (v2) has no header()/withHeaders() macro — convert first with `Inertia::render(...)->toResponse($request)->withHeaders([...])` (same pattern as routes/web.php dev.error). Symfony's ResponseHeaderBag::set() re-serializes Cache-Control via computeCacheControlValue(): directives come back alphabetically sorted plus an appended `private`, so `no-store, no-cache, must-revalidate` goes out as `must-revalidate, no-cache, no-store, private` (semantically equal/stronger). Assert with `$response->headers->hasCacheControlDirective('no-store')`, never assertHeader with the literal string. Also: a controller that both redirects and renders needs a union return type (Response|RedirectResponse).

## Composer equipment conflicts report pending only; admin buckets stay broad
There are TWO systems both called "equipment conflicts". checkConflicts() (POST /equipment/check-conflicts) is used ONLY by the request composer and must return PENDING only — Approved/Conditionally Approved bookings are already subtracted from the availability figure rendered on the same row, so reporting them made the row contradict itself ("Available: 3" beside "also requested by an Approved request"). Belt-and-braces: pendingConflictsOnly() in pages/requests/create/utils.ts filters at render so a stale in-flight payload cannot repaint an amber box. Do NOT "fix" RequestService::checkForEquipmentConflicts() — that one feeds the stored pending/approved_equipment_conflict_request_ids buckets used by the requests-list filters, dashboard KPIs and ReportService, and is intentionally broader.
