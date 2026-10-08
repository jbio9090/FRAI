---
paths:
  - app/Models/Equipment.php
---

# Models

## Equipment availability is derived from request_facilities, never the parent request
quantityReservedInFacility() must join request_equipment to request_facilities on re.request_facility_id = rf.id and filter on rf.status IN (Approved, Conditionally Approved) — never r.status. approveFacility() sets the SLOT status first and reconciles the parent after, so a facility-level approval leaves a Partially Approved parent over an Approved slot; filtering on the parent hid that stock entirely. Correlating only on request_id (the old whereExists) double-counted one request holding the same equipment across two non-overlapping bookings at one facility. Denied/For Reschedule slots under a Partially Approved parent must NOT reserve. Related: any test helper building a reservation by hand must set both rf.status and re.request_facility_id — leaving them to defaults creates a state the app never produces and reserves nothing.
