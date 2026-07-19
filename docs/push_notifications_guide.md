# FRAI — Push Notifications Guide

## How It Works

Push notifications in FRAI deliver real-time notifications to users across **web, Android, and iOS** via **Firebase Cloud Messaging (FCM)**. The system supports multi-device delivery with a unified token-based architecture.

### Flow

1. **Registration** — The user taps "Enable Push Notifications" on the Settings page. The frontend component (`pushNotification.tsx`) detects the platform:
   - **Native (Capacitor):** Uses `@capacitor/push-notifications` for permissions and `@capacitor-community/fcm` to obtain the FCM token
   - **Web (PWA):** Uses Firebase JS SDK (`firebase/messaging`) to obtain the FCM token with a VAPID key

   The FCM token + platform is sent to `POST /push/subscribe` and stored in the `device_tokens` table via the `HasFcmTokens` trait on the User model.

2. **Sending** — When a request event occurs (submitted, approved, rejected, rescheduled, etc.), `NotificationService` dispatches a Laravel Notification class (e.g. `NewPendingRequest`, `RequestResult`) to the target user. The notification class declares `FcmChannel::class` in its `via()` method, which sends via `kreait/firebase-php` to the FCM HTTP v1 API.

3. **Delivery** — FCM routes the message to the correct platform (Android via FCM directly, iOS via APNs bridge, web via browser push service). The device receives and displays the notification natively.

4. **Action Handling** — For admin approve/deny actions, `NewPendingRequest` includes **temporary signed URLs** (valid 24 hours) in the data payload. When the user taps an action, the Capacitor app or web app navigates to the signed URL at `GET /requests/{id}/push-action/{action}`, which authenticates the admin and processes the decision directly.

5. **Token Lifecycle** — `DeviceToken` records track active/inactive state. Invalid tokens are cleaned up when FCM reports delivery failures.

### Notification Types (Push)

| Notification Class | Channels | Trigger | Recipients |
|---|---|---|---|
| `NewPendingRequest` | database + FCM | New request submitted | All admins |
| `RequestResult` | database + FCM | Request approved/denied/held/etc. | Requesting user |
| `Reschedule` | database + FCM | Request needs rescheduling | Requesting user |
| `RequestFacilityDecision` | database + FCM | Per-facility booking decision | Requesting user |
| `TestPushNotification` | FCM only | Manual test from settings | Current user |

> `AdminAiRecommendationReady` is **email-only** and excluded from this guide.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Push service | Firebase Cloud Messaging (FCM) |
| Backend SDK | `kreait/firebase-php` ^8.0 |
| Laravel integration | `kreait/laravel-firebase` ^7.2 |
| Notification channel | `laravel-notification-channels/fcm` ^6.1 |
| Native push (Capacitor) | `@capacitor/push-notifications` |
| FCM token (iOS) | `@capacitor-community/fcm` |
| Web push (PWA) | Firebase JS SDK (`firebase/messaging`) |
| Queue | Laravel database queue (all notifications implement `ShouldQueue`) |
| Database | `device_tokens` table (polymorphic, via `HasFcmTokens` trait) |

---

## Relevant Files & Folders

### Backend (PHP)

| File | Purpose |
|---|---|
| `app/Models/User.php` | Uses `HasFcmTokens` trait — gives User `registerFcmToken()`, `removeFcmToken()`, `routeNotificationForFcm()` |
| `app/Models/DeviceToken.php` | Eloquent model for `device_tokens` table |
| `app/Models/Traits/HasFcmTokens.php` | Trait with FCM token CRUD and notification routing |
| `app/Http/Controllers/NotificationController.php` | `subscribe()`, `unsubscribe()`, `send()` — handles FCM token registration and test sends |
| `app/Http/Controllers/RequestController.php` | `handleSignedPushAction()` (line 478) — processes approve/reject from notification action URLs |
| `app/Services/NotificationService.php` | Orchestrates all push notification dispatch (`notifyAdmin`, `notifyUser`, `notifyUserForRequestReschedule`, `notifyUserFacilityDecision`, `notifyOnHold`) |
| `app/Notifications/NewPendingRequest.php` | FCM+DB notification with approve/reject action URLs (signed) |
| `app/Notifications/RequestResult.php` | FCM+DB notification for request status changes |
| `app/Notifications/Reschedule.php` | FCM+DB notification for reschedule requests |
| `app/Notifications/RequestFacilityDecision.php` | FCM+DB notification for per-facility decisions |
| `app/Notifications/TestPushNotification.php` | FCM-only test notification |
| `app/Http/Middleware/HandleInertiaRequests.php` | Shares Firebase config to frontend via Inertia props |
| `config/services.php` | Third-party service credentials |

### Frontend (React/TypeScript)

| File | Purpose |
|---|---|
| `resources/js/components/notification/pushNotification.tsx` | Platform-aware registration UI — Capacitor native + Firebase web |
| `resources/js/pages/settings/index.tsx` | Settings page where `PushNotifications` component is rendered |

### Database

| File | Purpose |
|---|---|
| `database/migrations/2026_07_18_000001_create_device_tokens_table.php` | Creates `device_tokens` table (token, platform, is_active, user_id) |
| `database/migrations/2026_05_07_000002_create_notifications_table.php` | Creates `notifications` table for database inbox |

### Routes (`routes/web.php`)

| Route | Method | Handler | Auth |
|---|---|---|---|
| `/push/subscribe` | POST | `NotificationController@subscribe` | `auth` |
| `/push/unsubscribe` | POST | `NotificationController@unsubscribe` | `auth` |
| `/push/send` | POST | `NotificationController@send` | `auth` |
| `/push/register-token` | POST | `NotificationController@subscribe` (alias) | `auth` |
| `/requests/{id}/push-action/{action}` | GET | `RequestController@handleSignedPushAction` | `signed` |

### Config & Environment

| File | Purpose |
|---|---|
| `.env.example` | Firebase credentials and VAPID key for web push |
| `config/services.php` | Third-party service configuration |

---

## Rules & Naming Conventions

### Notification Classes

- **Location:** `app/Notifications/`
- **Naming:** PascalCase, descriptive of the event — e.g. `NewPendingRequest`, `RequestResult`, `Reschedule`, `RequestFacilityDecision`
- **All push notifications must implement `ShouldQueue`** and use the `Queueable` trait to avoid blocking HTTP responses
- **`via()` method** returns `['database', FcmChannel::class]` for FCM+DB notifications, or `[FcmChannel::class]` for FCM-only
- **`toFcm()` method** returns a `FcmMessage` instance

### FcmMessage Building

- **`notification`** — Use `new FcmNotification(title:, body:, image:)` for display notifications
- **`image`** — Always `/FRAI.png`
- **`title`** — Use the request title as the notification title
- **`body`** — Descriptive status message explaining what happened
- **`data`** — Include `url` (request detail page), `tag` (dedup key). For admin action notifications, also include `recommended_action_url` and `deny_url` as signed URLs
- **`tag`** — Unique tag to prevent duplicate notifications. Format: `"{status}-{requestTitle}-{timestamp}"` (e.g. `"pending-MyRequest-2026-01-01"`)

### Signed URLs for Action Buttons

- Use `URL::temporarySignedRoute()` with a 24-hour expiry
- Route name: `requests.push_action`
- Parameters: `id` (request ID), `action` (approve/reject/conditionally_approve/for_reschedule), `admin_id`
- The `handleSignedPushAction()` method validates the admin role and permission before processing

### Database Payload (`toDatabase` / `toArray`)

All FCM+DB notifications should return an array with:
```php
[
    'title'    => string,
    'body'     => string,
    'url'      => string,  // Request detail URL
    'category' => string,  // e.g. 'new_pending_request', 'request_result', 'reschedule', 'facility_decision'
    'status'   => string,  // RequestStatus enum value
]
```

### Device Token Management

- **Table:** `device_tokens` — stores FCM tokens per user per platform
- **Platforms:** `web`, `android`, `ios`
- **Uniqueness:** Token column is unique (one row per device)
- **Active state:** `is_active` flag for soft-delete (invalid tokens marked inactive, not removed)
- **Trait:** `HasFcmTokens` on User model provides `registerFcmToken()`, `removeFcmToken()`, `routeNotificationForFcm()`
- **Routing:** `routeNotificationForFcm()` returns array of all active tokens for multicast delivery

### Frontend Component

- **Location:** `resources/js/components/notification/pushNotification.tsx`
- **Platform detection:** Uses `window.Capacitor` to detect native vs web
- **Native (Capacitor):** `@capacitor/push-notifications` for permissions + `@capacitor-community/fcm` for FCM token
- **Web (PWA):** Firebase JS SDK (`firebase/messaging`) with VAPID key from env
- **Token submission:** POST to `/push/subscribe` with `{ token, platform }`

### Environment Variables

| Variable | Where Used | Description |
|---|---|---|
| `FIREBASE_CREDENTIALS` | Laravel backend | Path to Firebase service account JSON file |
| `VITE_FIREBASE_API_KEY` | Frontend | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Frontend | Firebase project ID |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Frontend | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | Frontend | Firebase app ID |
| `VITE_FIREBASE_VAPID_KEY` | Frontend (web only) | VAPID key for web push authentication |

---

## Firebase Setup Steps

### 1. Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click "Add project" → Enter project name (e.g. `frai-notifications`) → Disable Google Analytics (optional) → Create project
3. Wait for project creation to complete

### 2. Register Your App

**Web (PWA):**
1. Project Settings → General → "Add app" → Select `</>` (Web)
2. Enter app nickname → Check "Also set up Firebase Hosting" (optional) → Register
3. Copy the `firebaseConfig` object (API key, auth domain, project ID, etc.)
4. Note the values for `.env` variables

**Android:**
1. Project Settings → General → "Add app" → Select Android
2. Enter package name (e.g. `com.frai.app`) → Register
3. Download `google-services.json` → Place in `android/app/`
4. Follow the Gradle setup instructions shown

**iOS:**
1. Project Settings → General → "Add app" → Select iOS
2. Enter bundle ID (e.g. `com.frai.app`) → Register
3. Download `GoogleService-Info.plist` → Add to Xcode project (ensure Target Membership is checked)
4. Enable "Push Notifications" capability in Xcode

### 3. Generate Service Account Key

1. Project Settings → Service Accounts tab
2. Click "Generate new private key"
3. Save the JSON file as `storage/app/firebase-service-account.json`
4. Set in `.env`: `FIREBASE_CREDENTIALS=firebase-service-account.json`

### 4. Enable Cloud Messaging

1. Project Settings → Cloud Messaging tab
2. **Android:** Ensure FCM is enabled (default)
3. **iOS:** Upload your APNs authentication key or certificate under "Apple app configuration"
4. **Web:** Generate a key pair under "Web push certificates" → Copy the VAPID key
5. Set in `.env`: `VITE_FIREBASE_VAPID_KEY=<your-vapid-key>`

### 5. Configure Laravel

```bash
# Install packages (run when network is available)
composer require kreait/laravel-firebase laravel-notification-channels/fcm

# Remove old WebPush packages
composer remove laravel-notification-channels/webpush minishlink/web-push

# Publish Firebase config
php artisan vendor:publish --provider="Kreait\Laravel\Firebase\ServiceProvider" --tag=config

# Run migration
php artisan migrate
```

### 6. Configure Capacitor

```bash
# Install Capacitor push plugins
npm install @capacitor/push-notifications @capacitor-community/fcm

# Sync with native platforms
npx cap sync
```

### 7. Set Environment Variables

```env
# .env
FIREBASE_CREDENTIALS=firebase-service-account.json
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_VAPID_KEY=your-vapid-key
```
