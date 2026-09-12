---
paths:
  - app/Services/RequestService.php
---

# Services

## Conflict detection is synchronous, job is notify-only
Conflict detection (detectAndStoreConflicts) runs synchronously inside RequestService::create() and ::update() so request cards on the index page have fresh pending/approved_conflict_rf_ids immediately. ProcessRequestConflicts is notify-only (admin push) — do not move detection back into it. update() must purge deleted RF ids from other requests via purgeDeletedConflictRefs because RF rows are deleted and recreated with new ids.

## Conflict backfill merges only overlapping RF ids
detectAndStoreConflicts backfill must merge only the own RF ids that actually overlap each conflicting pending request (facility+date+time), never all savedRequestRfIds — otherwise multi-date requests leak other-date ids (e.g. 09-22 rows into a 09-21 conflict list). Frontend must filter stored conflicts per-RF by facility+date+time overlap (conflictsForBooking in lib/utils), not by facility_id alone.
