# Overlapping Facility Request Flow

## Core Overlap Algorithm

Everywhere in the system uses the same interval overlap test:

```
newStart < existingEnd AND newEnd > existingStart
```

Example: 7:00–10:00 **conflicts with** 9:00–12:00 (since 9:00 < 10:00 and 10:00 > 9:00).

## Status Types

| Status | Description |
|---|---|
| Pending | Awaiting decision |
| Approved | Fully approved |
| Denied | Rejected |
| Conditionally Approved | Approved with conditions |
| On Hold | Blocked by a higher-priority or overlapping request |
| For Reschedule | Overridden; must rebook |
| Partially Approved | Some facility line-items approved, others not |

## Flow by Status of the Conflicting Booking

### On Create / Update (`RequestService::detectAndStoreConflicts`)

Only **Pending** and **Approved** bookings are checked as conflict sources.

| Existing Status | Behavior |
|---|---|
| **Pending** | The new request stores the conflicting RF IDs in `pending_conflict_rf_ids` (JSON). The *existing* pending request gets `recommended_action = FOR_RESCHEDULE` and the new request's RF IDs are appended to its own `pending_conflict_rf_ids`. |
| **Approved** | Conflict is recorded in `approved_conflict_rf_ids`. The *existing* approved request is **not** modified. The new request is flagged as having an approved conflict, which influences the AI recommendation. |
| **Conditionally Approved** | Not checked during create. |
| **Denied / On Hold / For Reschedule / Partially Approved** | Not checked. |

---

### On Approval of a Request (`RequestService::approve`)

This is the most aggressive conflict handler — it actively overrides existing bookings.

| Conflicting Request Status | Behavior |
|---|---|
| **Approved** (time overlap) | Existing request → **`FOR_RESCHEDULE`**, `on_hold = true`, `held_by_request_id` set. Auto-comment added. |
| **Conditionally Approved** (time overlap) | Same as Approved — treated as active, put into `FOR_RESCHEDULE` + on hold. |
| **Pending** (time overlap) | Not directly overridden, but may be displaced via equipment conflict (see below). |
| **Pending / Conditionally Approved** (equipment now taken) | Any request using the same equipment in overlapping times → `FOR_RESCHEDULE` + on hold. |
| **On Hold / For Reschedule** | Not affected. |

---

### On Individual Facility Line-Item Approval (`RequestService::approveFacility`)

Same logic as full approval but scoped to a single facility. After resolving conflicts, the parent request status is rolled up:

| Child Statuses | Resulting Parent Status |
|---|---|
| All Approved | Approved |
| All Denied | Denied |
| Mix of Approved and others | Partially Approved |
| None Approved | Pending |

---

### On Create (Legacy Single-Facility Path — `Request::handlePriorityConflict`)

Only used for the old model where the request has `facility_id`, `date`, `start_time`, `end_time` directly on the `requests` table.

| Priority Comparison | Behavior |
|---|---|
| New > Existing | Existing → **On Hold** with `overridden_by_request_id` set. New request is created. |
| New < Existing | New → **On Hold**, creation aborted. |
| New == Existing | New → **Pending Review**, creation aborted. |

---

## Key Source Files

| File | Key Lines | Purpose |
|---|---|---|
| `app/Services/RequestService.php` | 376 | `checkForConflicts()` — generic overlap detection |
| `app/Services/RequestService.php` | 434 | `detectAndStoreConflicts()` — conflict recording on create/update |
| `app/Services/RequestService.php` | 538 | `approve()` — full request approval + override logic |
| `app/Services/RequestService.php` | 659 | `getConflictingApprovedRequests()` — find approved overlaps |
| `app/Services/RequestService.php` | 619 | `getEquipmentDisplacedRequests()` — find equipment-displaced requests |
| `app/Services/RequestService.php` | 890 | `checkForEquipmentConflicts()` — equipment-level overlap |
| `app/Services/RequestService.php` | 1016 | `approveFacility()` — single line-item approval |
| `app/Models/Request.php` | 125 | `scopeConflicting()` — legacy scope |
| `app/Models/Request.php` | 157 | `handlePriorityConflict()` — legacy priority override |
| `app/Enums/RequestStatus.php` | — | All status enum values |

## Visual Summary

```
                         New request created/updated
                                   |
                     checkForConflicts(Pending, Approved)
                                   |
            ┌──────────────────────┼──────────────────────┐
            v                      v                      v
   Conflicts w/ Pending    Conflicts w/ Approved    No conflicts
            │                      │                      │
   Existing pending gets     New request flagged     Normal flow
   recommended_action =      with approved_conflict  (AI recommends)
   FOR_RESCHEDULE            rf_ids
            │                      │
            └──────────────────────┘
                                   │
                         Request Approved (admin)
                                   |
            ┌──────────────────────┼──────────────────────┐
            v                      v                      v
   Conflicting Approved/     Equipment-displaced     Nothing to
   Conditionally Approved    Pending/Conditionally   override
   requests → FOR_RESCHEDULE Approved requests →
   + on hold                 FOR_RESCHEDULE + on hold
```
