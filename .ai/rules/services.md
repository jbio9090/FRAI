---
paths:
  - app/Services/RequestService.php
  - app/Services/ChatSessionStore.php
  - app/Services/EquipmentAvailabilityService.php
---

# Services

## Conflict detection is synchronous, job is notify-only
Conflict detection (detectAndStoreConflicts) runs synchronously inside RequestService::create() and ::update() so request cards on the index page have fresh pending/approved_conflict_rf_ids immediately. ProcessRequestConflicts is notify-only (admin push) — do not move detection back into it. update() must purge deleted RF ids from other requests via purgeDeletedConflictRefs because RF rows are deleted and recreated with new ids.

## Conflict backfill merges only overlapping RF ids
detectAndStoreConflicts backfill must merge only the own RF ids that actually overlap each conflicting pending request (facility+date+time), never all savedRequestRfIds — otherwise multi-date requests leak other-date ids (e.g. 09-22 rows into a 09-21 conflict list). Frontend must filter stored conflicts per-RF by facility+date+time overlap (conflictsForBooking in lib/utils), not by facility_id alone.

## Chat transcript is scoped to the browser session, not the user
All chatbot cache keys live in ChatSessionStore. The transcript key uses session()->getId(), NOT Auth::id() — keying it by user made the history follow the account across every tab and device for the 15-minute TTL, and one tab clearing it wiped a conversation another tab was showing. Session-scoped keys also mean logout needs no chatbot-specific clearing: LoginController invalidates the session, so the old entry is unreachable and expires on its own. Page-context and FAQ-state keys stay user-scoped (server-derived facts, not conversation). chatbot.tsx sends a best-effort DELETE chat.session.clear on pagehide with keepalive, skipping when event.persisted is true (bfcache) and when the transcript is empty. When asserting the transcript in a feature test, read Cache::get(app(ChatSessionStore::class)->transcriptKey()) — a follow-up HTTP request gets a brand-new session and would see nothing.

## Over-allocated equipment is rejected twice: form request and in-transaction
Equipment quantity validation runs in two places on purpose. FacilityFormRequest::withValidator() gives immediate field-level 422 feedback; RequestService::create()/update() re-check inside the write transaction after lockForUpdate() on the facility_equipment rows, throwing ValidationException, which is the one that actually guarantees the limit (the form request runs before the transaction and can race another submission). Demand must be aggregated across the whole facility_bookings payload by facility+equipment+date and time-overlap — validating booking-by-booking lets two overlapping bookings each pass while jointly exceeding stock. Borrowed quantities are checked against the SOURCE facility's pool, not the booking facility. Exclude the request being updated, or every edit of an approved request fails on its own stock.
