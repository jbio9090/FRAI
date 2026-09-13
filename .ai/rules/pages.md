---
paths:
  - resources/js/pages/dashboard.tsx
---

# Pages

## Conflict filters are status-independent
Conflict ids are stored asymmetrically: only the recording (usually pending) request stores pending/approved_conflict_rf_ids — the conflicting approved side is never modified. So has_pending/approved_conflicts filters must NOT be combined with a status= deep-link scope (e.g. status=approved hides the pending requests that recorded approved conflicts). Dashboard conflict banners link with only the conflict flag, and requests/index checkboxes init from URL params so Apply/Sort/Search doesn't drop the active filter.
