---
paths:
  - app/Services/RequestService.php
---

# Services

## Conflict detection is synchronous, job is notify-only
Conflict detection (detectAndStoreConflicts) runs synchronously inside RequestService::create() and ::update() so request cards on the index page have fresh pending/approved_conflict_rf_ids immediately. ProcessRequestConflicts is notify-only (admin push) — do not move detection back into it. update() must purge deleted RF ids from other requests via purgeDeletedConflictRefs because RF rows are deleted and recreated with new ids.
