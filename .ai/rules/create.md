---
paths:
  - 'resources/js/pages/requests/create/**'
  - resources/js/pages/requests/create/availability.ts
---

# Create

## One stale-response token per fetch, and unknown availability must stay unknown
Never share a useRef request-token across two sibling effects that fetch concurrently: both effects run in the same commit, so the second ++ always invalidates the first's response and its `if (ref.current !== requestId) return;` guard silently discards it. That is how the equipment availability number never rendered and the UI showed each facility's full allocation. useEquipmentAvailability() owns both availability fetches with one token each to make the collision structurally impossible. Second rule: never render availability with a fallback to the facility's allocated total (`availability ? … : equipment.pivot.quantity`) — "not loaded yet" must render as unknown, and a new row's default quantity comes from remaining-at-the-selected-slot (floored at 1, since quantity_needed is validated min:1), not the facility's whole stock.

## Keep the per-date dimension when collapsing slot availability
A batch add writes one booking per selected date carrying the SAME quantity, so availability must collapse to the tightest remaining across the selection — but mergeSlotAvailability must return { merged, tightestDate, byDate } and never discard the dateKey. An earlier version kept the min entry's numbers and threw away which date produced them, so a multi-date pick could show a count but never name the offending day; deriveShortfalls and the tooltip both depend on that attribution. Ties resolve on the earliest date so the label cannot flicker. POST /equipment/availability takes dates[] and returns { dates: { 'Y-m-d': { availability: [...] } } } — one request for the whole selection, never one per date, and every requested date is present even when empty so "no equipment" is distinguishable from "not fetched". The borrow panel must merge across ALL selected dates, not just the first: stock free on one day and gone on another is not borrowable for that submission.
