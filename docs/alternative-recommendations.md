# Alternative Date/Facility Recommendations for Overwritten Requests

## Overview

When a request is overridden by a higher-priority approved request and marked as **For Reschedule**, the system now provides alternative date and facility recommendations to help the request owner quickly reschedule.

## User Flow

1. **Request gets overridden** → Status changes to `For Reschedule`, user receives notification
2. **User clicks "Reschedule" button** on request detail page → Opens edit page
3. **Alternatives sidebar loads** → Shows available time slots and facilities
4. **User clicks an alternative** → Form pre-fills with facility, date, and time
5. **User submits** → New request goes through normal conflict check and recommendation flow

## Features

### Four Recommendation Strategies

| Strategy | Description |
|----------|-------------|
| **Same Facility - Different Times** | Available time slots on the same facility and date |
| **Same Facility - Nearby Dates** | Same time slot on nearby dates (±7 days) |
| **Other Facilities - Same Date/Time** | Different facilities with sufficient capacity at same date/time |
| **Other Facilities - Nearby Dates** | Different facilities on nearby dates |

### Smart Filtering

- **Capacity awareness**: Only shows facilities with `capacity >= expected_capacity`
- **Duration matching**: Time-slot alternatives always keep the same duration as the original booking (`time_end` − `time_start`), sliding forward by the booking-window step within the window bounds
- **Booking window compliance**: Respects global settings (allowed days, hours, step minutes)
- **Minimum advance days**: Excludes dates too soon based on `min_advance_days` setting
- **Higher-priority conflict exclusion**: Filters out slots that would conflict with higher-priority PENDING requests
- **Equipment availability (optional)**: Toggle to filter by equipment availability

### Presentation

- **Recommendation Panel** (Request Detail page): New "Suggested Alternatives" section
- **Edit Page Sidebar**: Interactive sidebar with clickable alternatives that pre-fill the form

## Technical Implementation

### Backend

#### New Service: `AlternativeRecommendationService`

```php
// app/Services/AlternativeRecommendationService.php

class AlternativeRecommendationService
{
    public function findAlternatives(FacilityRequest $request, array $options = []): array
    {
        // Returns alternatives grouped by facility_id
    }
}
```

**Key methods:**
- `findSameFacilityTimeAlternatives()` - Same facility, different time slots
- `findSameFacilityDateAlternatives()` - Same facility, nearby dates
- `findDifferentFacilityAlternatives()` - Other facilities, same date/time
- `findDifferentFacilityDateAlternatives()` - Other facilities, nearby dates
- `hasHigherPriorityConflict()` - Checks for higher-priority PENDING conflicts
- `isFacilityAvailable()` - Uses existing `RequestService::checkForConflicts()`
- `isEquipmentAvailable()` - Checks `Equipment::quantityAvailable()`

#### Controller Endpoint

```php
// app/Http/Controllers/RequestController.php
public function getAlternatives(Request $httpRequest, int $id): JsonResponse
```

**Route:** `GET /requests/{request}/alternatives` (named `requests.alternatives`)

**Authorization:** Request owner or user with `approve requests` permission

**Requirements:** Request must be in `For Reschedule` status

**Query Parameters:**
- `include_equipment` (boolean, default: false)
- `max_results` (integer, default: 5 per category, max: 20)

#### RequestService Addition

```php
// app/Services/RequestService.php
public function isSlotAvailable(int $facilityId, string $date, string $start, string $end): bool
```

### Frontend

#### Types (`resources/js/types/request.ts`)

```typescript
interface AlternativeSlot {
    facility_id: number;
    facility_name: string;
    facility_capacity: number;
    date: string;
    time_start: string;
    time_end: string;
    type: 'same_facility_time' | 'same_facility_date' | 'different_facility' | 'different_facility_date';
    equipment_available: boolean;
    capacity_fit: 'exact' | 'larger' | 'smaller';
}

interface AlternativesResponse {
    alternatives: Record<number, AlternativeSlot[]>;
    metadata: {
        include_equipment: boolean;
        max_results: number;
        date_range_days: number;
        per_facility: boolean;
    };
}
```

#### Hook (`resources/js/hooks/use-alternatives.ts`)

```typescript
export function useAlternatives({ requestId, includeEquipment = false, maxResults = 5, enabled = true }) {
    // Returns { alternatives, loading, error, refetch, setIncludeEquipment }
}
```

#### Components Updated

1. **RecommendationPanel** (`resources/js/components/request/recommendation-panel.tsx`)
   - Added "Suggested Alternatives" section for FOR_RESCHEDULE requests
   - Grouped by facility, then by strategy type
   - Equipment availability toggle

2. **Create/Edit Page** (`resources/js/pages/requests/create/index.tsx`)
   - Added alternatives sidebar for FOR_RESCHEDULE requests
   - Click alternative → pre-fills form (facility, date, time)
   - Uses `applyAlternative()` from `useCreateRequest` hook

#### Hook Updated

**`useCreateRequest`** (`resources/js/pages/requests/create/use-create-request.ts`)
- Added alternatives state and fetch effect
- Added `applyAlternative(slot)` function to pre-fill form

### Caching

- **Cache key**: `alternatives:{requestId}:eq{0|1}:max{maxResults}`
- **TTL**: 5 minutes (300 seconds)
- **Invalidation**: Automatic on cache expiry; manual via `Cache::forget()` if needed

## Configuration

### Global Settings (Request Options)

The system respects settings from `/request-settings`:

| Setting | Used For |
|---------|----------|
| `booking_window.start_time` / `end_time` | Time slot bounds |
| `booking_window.step_minutes` | Time slot granularity (15/30/60 min) |
| `booking_window.days_of_week` | Valid booking days |
| `min_advance_days` | Earliest selectable date |

### Constants (Service)

```php
// AlternativeRecommendationService
private const DATE_RANGE_DAYS = 7;        // Nearby date range
private const CACHE_TTL = 300;            // 5 minutes
private const MAX_RESULTS_PER_CATEGORY = 5;
```

## API Response Example

```json
{
  "alternatives": {
    "5": [
      {
        "facility_id": 5,
        "facility_name": "Room 201",
        "facility_capacity": 50,
        "date": "2026-08-25",
        "time_start": "14:00",
        "time_end": "16:00",
        "type": "same_facility_time",
        "equipment_available": true,
        "capacity_fit": "exact"
      }
    ]
  },
  "metadata": {
    "include_equipment": false,
    "max_results": 5,
    "date_range_days": 7,
    "per_facility": true
  }
}
```

## Testing

### Unit Tests (Recommended)

- `AlternativeRecommendationService` conflict filtering
- Capacity filtering
- Equipment availability integration
- Booking window compliance
- Higher-priority pending conflict exclusion

### Feature Tests

- Authorization (owner/admin only)
- FOR_RESCHEDULE status requirement
- Response structure validation

### Frontend Tests

- Alternatives display correctly
- Pre-fill on selection works
- Equipment toggle filters results

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| No alternatives found | Shows "No available alternatives found" message |
| Fully booked period | Empty results with informative message |
| Equipment unavailable | Shows "Eq ✗" badge; user can toggle filter |
| Request not FOR_RESCHEDULE | Alternatives section hidden |
| Cache miss | Computes fresh, caches for 5 min |
| Multiple facilities in request | Each facility gets own alternatives group |

## Future Enhancements

- [ ] Add alternatives to Reschedule notification (email/push)
- [ ] Admin override to suggest alternatives manually
- [ ] Learn from user selections to improve ranking
- [ ] Batch reschedule multiple overridden requests