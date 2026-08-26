# Request Options — Admin Settings Page

The **Request Options** page (`/request-settings`) is the single admin-controlled source of truth for the request-creation experience. Any change made here is picked up immediately by both the **create request page** (`/requests/create`) and the **AI chatbot** (guided booking flow).

## Access

- Route: `GET /request-settings` (view) and `POST /request-settings` (save)
- Route names: `request-settings`, `request-settings.update`
- Guarded by the `manage request options` permission (Spatie). Only roles granted this permission (seeded to **admin** / **Super Admin**) can view or save.
- Nav entry: **Request Settings** in the sidebar (visible only when the user holds the permission).

## What Can Be Configured

| Setting | Shape | Default | Used Where |
|---|---|---|---|
| Approvers list | array of strings | 7 defaults (Faculty, College Dean, Registrar, ...) | Create page approver checkboxes |
| Booking window start | `HH:mm` | `07:00` | Time-slot bounds on create page + chatbot quick replies |
| Booking window end | `HH:mm` | `20:00` | Time-slot bounds on create page + chatbot quick replies |
| Booking days | array of ints `0–6` (Sun–Sat) | all 7 days | Create page calendar day blocking |
| Booking step | one of `15` / `30` / `60` minutes | `30` | Create page time-slot step |
| Minimum advance days | int `0–365` | `5` | Earliest selectable booking date on create page + chatbot |

## Where the Settings Live

- **Storage:** `settings` table (`key` string PK, `value` JSON), created by `database/migrations/2026_08_01_000001_create_settings_table.php`.
- **Model:** `App\Models\Setting` (`key` as primary key, `value` cast to `array`).
- **Service:** `App\Services\RequestSettingsService` — single accessor used everywhere. Reads through the `request_options.settings` cache key and exposes:
  - `all()` — full settings array
  - `approvers()`
  - `bookingWindow()` — `['start_time', 'end_time', 'days_of_week', 'step_minutes']`
  - `minAdvanceDays()`
  - `update(array $data)` — persists + clears cache
- **Seeding:** `database/seeders/SettingSeeder.php` inserts the defaults (idempotent `updateOrCreate`). Registered in `DatabaseSeeder` after `RolePermissionSeeder`.

## How the Frontend Consumes It

- `HandleInertiaRequests` shares `requestOptions` (= `RequestSettingsService::all()`) to every Inertia page.
- **Create page** (`resources/js/pages/requests/create/index.tsx`): reads `requestOptions` via `usePage()`. Replaces the old hardcoded constants — booking-time bounds, step, min/warning advance days, and the approver list all derive from settings. Calendar days not in `days_of_week` are disabled.
- **Chatbot guided flow** (`resources/js/components/chatbot/chatbot.tsx` + `hooks/useBookingFlow.ts`): derives hourly quick-reply time options from the booking window, and uses `minAdvanceDays` for the earliest bookable date. Warning advance days are derived as `minAdvanceDays + 2` in the guided flow (preserving prior behavior).
- **Types:** `BookingWindow` / `RequestOptions` in `resources/js/types/request.ts`.

## Saving (Controller)

`App\Http\Controllers\RequestSettingsController@update` validates:

- `approvers` — non-empty array of strings
- `booking_window.start_time` / `end_time` — `HH:mm`; `end_time` must be after `start_time`
- `booking_window.days_of_week` — distinct ints in `0–6`
- `booking_window.step_minutes` — one of `15`, `30`, `60`
- `min_advance_days` — int `0–365`

Persists via `RequestSettingsService::update()`, records a `SettingsUpdated` audit event, and redirects back with a success flash.

## Deployment Notes

- The migration must be applied and the seeder run. On existing databases (where `db:seed --force` may skip), run explicitly:
  `php artisan db:seed --class=SettingSeeder --force`
- Production `entrypoint.sh` runs `php artisan migrate --force` and `db:seed --force`, which includes the new settings.
- Regenerate frontend routes after adding/renaming routes:
  `php artisan wayfinder:generate` and `php artisan ziggy:generate`.

## Tests

`tests/Feature/RequestSettingsTest.php` covers: permission enforcement, page render, successful update persistence, and validation rejections (invalid step / empty approvers / end-before-start).
