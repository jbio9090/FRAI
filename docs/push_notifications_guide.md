# FRAI — Push Notifications Guide

## How It Works

Push notifications in FRAI deliver real-time notifications to users across **web, Android, and iOS** via **Firebase Cloud Messaging (FCM)**. The system supports multi-device delivery with a unified token-based architecture.

### Flow

1. **Registration** — The user taps "Enable Push Notifications" on the Settings page. The frontend component (`pushNotification.tsx`) detects the platform:
   - **Native (Capacitor):** Uses `@capacitor/push-notifications` for permissions and `@capacitor-community/fcm` to obtain the FCM token
   - **Web (PWA):** Uses Firebase JS SDK (`firebase/messaging`) to obtain the FCM token with a VAPID key. A static service worker (`public/firebase-messaging-sw.js`) handles background messages.

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
| Web service worker | `public/firebase-messaging-sw.js` (compat SDK via `importScripts`) |
| Queue | Laravel database queue (all notifications implement `ShouldQueue`) |
| Database | `device_tokens` table (via `HasFcmTokens` trait) |

---

## Relevant Files & Folders

### Backend (PHP)

| File | Purpose |
|---|---|
| `app/Models/User.php` | Uses `HasFcmTokens` trait — gives User `registerFcmToken()`, `removeFcmToken()`, `routeNotificationForFcm()` |
| `app/Models/DeviceToken.php` | Eloquent model for `device_tokens` table |
| `app/Models/Traits/HasFcmTokens.php` | Trait with FCM token CRUD and notification routing. Imports `App\Models\DeviceToken` explicitly (required when trait is in a sub-namespace) |
| `app/Http/Controllers/NotificationController.php` | `subscribe()`, `unsubscribe()`, `send()` — handles FCM token registration and test sends |
| `app/Http/Controllers/RequestController.php` | `handleSignedPushAction()` — processes approve/reject from notification action URLs |
| `app/Services/NotificationService.php` | Orchestrates all push notification dispatch (`notifyAdmin`, `notifyUser`, `notifyUserForRequestReschedule`, `notifyUserFacilityDecision`, `notifyOnHold`) |
| `app/Notifications/NewPendingRequest.php` | FCM+DB notification with approve/reject action URLs (signed) |
| `app/Notifications/RequestResult.php` | FCM+DB notification for request status changes |
| `app/Notifications/Reschedule.php` | FCM+DB notification for reschedule requests |
| `app/Notifications/RequestFacilityDecision.php` | FCM+DB notification for per-facility decisions |
| `app/Notifications/TestPushNotification.php` | FCM-only test notification |
| `app/Http/Middleware/HandleInertiaRequests.php` | Shares Firebase config to frontend via Inertia props (`firebaseConfig`) |
| `config/services.php` | Frontend Firebase config (api_key, auth_domain, etc.) — **not** used by backend FCM |
| `storage/app/firebase-auth.json` | Firebase service account key — **never commit to git** |

### Frontend (React/TypeScript)

| File | Purpose |
|---|---|
| `resources/js/components/notification/pushNotification.tsx` | Platform-aware registration UI — Capacitor native + Firebase web. Uses `getApps()` guard to prevent duplicate `initializeApp()` calls |
| `resources/js/pages/settings/index.tsx` | Settings page where `PushNotifications` component is rendered |

### Service Worker

| File | Purpose |
|---|---|
| `public/firebase-messaging-sw.js` | Firebase messaging service worker for web push. Uses compat SDK via `importScripts()` from CDN. Handles `onBackgroundMessage` for background notifications. This file **must** be a static asset in `public/` — it cannot use bare ES module imports. |

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

---

## Rules & Naming Conventions

### Notification Classes

- **Location:** `app/Notifications/`
- **Naming:** PascalCase, descriptive of the event — e.g. `NewPendingRequest`, `RequestResult`, `Reschedule`, `RequestFacilityDecision`
- **All push notifications must implement `ShouldQueue`** and use the `Queueable` trait to avoid blocking HTTP responses
- **`via()` method** returns `['database', FcmChannel::class]` for FCM+DB notifications, or `[FcmChannel::class]` for FCM-only
- **`toFcm($notifiable)` method** — takes only `$notifiable` as parameter (NOT `$notification`). Returns a `FcmMessage` instance. The `laravel-notification-channels/fcm` package calls it with 1 argument.

### FcmMessage Building

```php
use NotificationChannels\Fcm\FcmMessage;
use NotificationChannels\Fcm\Resources\Notification as FcmNotification;

return (new FcmMessage(
    notification: new FcmNotification(
        title: $this->request_title,
        body: 'Description of what happened',
        image: '/FRAI.png',
    )
))->data([
    'url'    => $this->url,                          // Request detail URL
    'tag'    => 'status-requestTitle-timestamp',      // Dedup key
    // For admin action notifications, also include:
    'recommended_action_url' => $recommendedUrl,      // Signed URL
    'deny_url'               => $denyUrl,             // Signed URL
]);
```

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
- **Namespace gotcha:** The `HasFcmTokens` trait lives in `App\Models\Traits` — it must explicitly `use App\Models\DeviceToken;` because PHP resolves unqualified class names relative to the trait's namespace

### Frontend Component

- **Location:** `resources/js/components/notification/pushNotification.tsx`
- **Platform detection:** Uses `window.Capacitor` to detect native vs web
- **Native (Capacitor):** `@capacitor/push-notifications` for permissions + `@capacitor-community/fcm` for FCM token
- **Web (PWA):** Firebase JS SDK (`firebase/messaging`) with VAPID key from env. Uses `getFirebaseApp()` helper with `getApps()` guard to prevent duplicate `initializeApp()` calls
- **Token submission:** POST to `/push/subscribe` with `{ token, platform }`
- **All Firebase dynamic imports must use `await import()`** — `require()` is not available in Vite's browser context

### Firebase Config (Web Service Worker)

The `public/firebase-messaging-sw.js` file uses the compat SDK via `importScripts()` from the Firebase CDN. It **cannot** use bare ES module imports (`import { ... } from 'firebase/app'`) because it's a static file outside Vite's bundle.

```js
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({ /* config here */ });
const messaging = firebase.messaging();
```

### Environment Variables

| Variable | Where Used | Description |
|---|---|---|
| `FIREBASE_CREDENTIALS` | Laravel backend | Path to Firebase service account JSON (e.g. `storage/app/firebase-auth.json`) — resolved relative to project root by `kreait/laravel-firebase`. On Render Docker use the absolute `/etc/secrets/firebase-auth.json` (see [Render secret files](#secret-files-on-render-docker)) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Laravel backend (fallback) | Same file, fallback path |
| `VITE_FIREBASE_API_KEY` | Frontend + Inertia | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Frontend + Inertia | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Frontend + Inertia | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Frontend + Inertia | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Frontend + Inertia | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | Frontend + Inertia | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Frontend + Inertia | Firebase Analytics measurement ID |
| `VITE_FIREBASE_VAPID_KEY` | Frontend (web only) | VAPID key from Firebase Console → Cloud Messaging → Web push certificates (~86 chars) |

---

## Common Issues & Fixes

### "FirebaseError: Messaging: We are unable to register the default service worker"
**Cause:** Missing `public/firebase-messaging-sw.js`. Firebase auto-registers a service worker at this path.
**Fix:** Create `public/firebase-messaging-sw.js` using the compat SDK via `importScripts()`.

### "InvalidAccessError: The provided applicationServerKey is not valid"
**Cause:** VAPID key is wrong, too short, or empty. Firebase VAPID keys are ~86 characters.
**Fix:** Get the correct key from Firebase Console → Project Settings → Cloud Messaging → Web push certificates. **Do not** use the Cloud Messaging API server key.

### "Class 'App\Models\Traits\DeviceToken' not found"
**Cause:** The `HasFcmTokens` trait is in `App\Models\Traits` namespace. PHP resolves `DeviceToken::class` relative to the trait's namespace.
**Fix:** Add `use App\Models\DeviceToken;` to the trait file.

### "Too few arguments to function toFcm(), 1 passed and exactly 2 expected"
**Cause:** `laravel-notification-channels/fcm` calls `toFcm($notifiable)` with 1 argument. Your `toFcm($notifiable, $notification)` expects 2.
**Fix:** Remove `$notification` from the `toFcm()` signature in all notification classes.

### "Cannot read properties of undefined (reading 'getProvider')"
**Cause:** `getFirebaseApp()` is async but callers forgot to `await` it — `app` is a Promise, not a Firebase app.
**Fix:** Ensure all calls to `getFirebaseApp()` use `await`.

### "require is not defined"
**Cause:** Used `require()` in a Vite-bundled file. Vite doesn't provide CommonJS `require` in browser context.
**Fix:** Use `await import()` for all dynamic Firebase imports.

### Notifications not delivering (queued jobs pile up)
**Cause:** All notification classes implement `ShouldQueue`. Jobs sit in the `jobs` table if `php artisan queue:work` isn't running.
**Fix for testing:** Set `QUEUE_CONNECTION=sync` in `.env`. For production, run `php artisan queue:work`.

### Firebase credentials not found
**Cause:** `FIREBASE_CREDENTIALS=firebase-auth.json` resolves relative to the project root, but the file is at `storage/app/firebase-auth.json`.
**Fix:** Set `FIREBASE_CREDENTIALS=storage/app/firebase-auth.json` in `.env`.

### "Permission denied" reading `/etc/secrets/firebase-auth.json` (Render Docker)
**Cause:** Render mounts secret files group-readable by group `1000` only. The queue worker runs as `www-data`, which is not in group `1000` on the base PHP image, so opening the file fails with `SplFileObject::__construct(...): Failed to open stream: Permission denied`.
**Fix (one of):**
1. Add `www-data` to group `1000` in the image (requires a full image rebuild):
   ```dockerfile
   RUN apk add --no-cache shadow \
       && usermod -a -G 1000 www-data
   ```
2. Or copy the secret at boot in `entrypoint.sh` (runs as root, immune to group permissions) before `config:cache`:
   ```sh
   if [ -f /etc/secrets/firebase-auth.json ]; then
       cp /etc/secrets/firebase-auth.json /var/www/html/storage/app/firebase-auth.json
       chown www-data:www-data /var/www/html/storage/app/firebase-auth.json
   fi
   ```
   and point `FIREBASE_CREDENTIALS` at `storage/app/firebase-auth.json`.

**Troubleshooting note:** this failure does **not** appear in the queue worker output — the job just logs `FAIL` and the exception lives in `failed_jobs.exception`. Check that table (see [Server-Side Push Logging](#server-side-push-logging)) to see the real error.

---

## Server-Side Push Logging

Notifications are delivered from the queue worker via `App\Notifications\Channels\LoggableFcmChannel` (a wrapper around `NotificationChannels\Fcm\FcmChannel`). It logs the following to the default log channel (`storage/logs/laravel.log`, `LOG_CHANNEL=stack`):

| Message | Level | When | Key context |
|---|---|---|---|
| `FCM send starting.` | info | efore sending, only when the recipient has ≥1 active token | `notifiable`, `id`, `notification`, `token_count` |
| `FCM client initialization failed.` | error | Building the Firebase `Messaging` client throws (e.g. missing/closed service account, wrong path, `Permission denied`) | `error`, `trace` — **job still fails and lands in `failed_jobs`** |
| `FCM send completed.` | info | A multicast send finished without throwing | — |
| `FCM token-level failure.` | warning | An individual token was rejected by FCM (no throw, job completes) — e.g. `UNREGISTERED`, expired token, bad image URL | `token` (truncated), `error`, `unknown_token` |
| `FCM send threw an exception.` | error | The send itself threw (rare; client init usually throws first) | `error`, `trace` |
| `Queuing NewPendingRequest push notifications.` | notice | Request created; emitted by `NotificationService::notifyAdmin()` | `request_id`, `admin_count`, `recipient_ids` |

Because the client is resolved **lazily inside `send()`** (not in the channel constructor), init exceptions are caught and logged here instead of failing silently at construction.

### Reading the real failure
Queue worker `FAIL` lines don't print the exception. To see it:
1. `failed_jobs.exception` (default `QUEUE_CONNECTION=database`) — full stack trace.
2. `storage/logs/laravel.log` — `FCM client initialization failed.` with `error` + `trace`.
3. Reproduce in a worker shell:
   ```sh
   php artisan tinker --execute="Firebase::project()->messaging(); echo 'messaging OK';"
   ```

### Secret Files on Render (Docker)
1. Render Dashboard → service → **Environment** → **Secret Files** → add file `firebase-auth.json` (service account JSON contents).
2. It is mounted at `/etc/secrets/firebase-auth.json`.
3. Set `FIREBASE_CREDENTIALS=/etc/secrets/firebase-auth.json` (and optionally `GOOGLE_APPLICATION_CREDENTIALS` to the same value). Because the deploy runs `config:cache`, redeploy after changing these.
4. Ensure `www-data` can read it (group `1000`, see above).

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
3. Save the JSON file as `storage/app/firebase-auth.json`
4. **Add to `.gitignore`:** `/storage/app/firebase-auth.json`
5. Set in `.env`: `FIREBASE_CREDENTIALS=storage/app/firebase-auth.json`

### 4. Generate VAPID Key (Web Push)

1. Project Settings → Cloud Messaging tab → **Web push certificates** section
2. Click "Generate key pair"
3. Copy the key (~86 characters)
4. Set in `.env`: `VITE_FIREBASE_VAPID_KEY=<your-vapid-key>`
5. **Do not** confuse this with the Cloud Messaging API server key

### 5. Configure Laravel

```bash
# Install packages
composer require kreait/laravel-firebase laravel-notification-channels/fcm

# Publish Firebase config (optional, for customization)
php artisan vendor:publish --provider="Kreait\Laravel\Firebase\ServiceProvider" --tag=config

# Run migration
php artisan migrate

# Clear config cache
php artisan config:clear
```

### 6. Create Service Worker

Create `public/firebase-messaging-sw.js` with the compat SDK:

```js
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'your-api-key',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project-id',
    storageBucket: 'your-project.firebasestorage.app',
    messagingSenderId: 'your-sender-id',
    appId: 'your-app-id',
    measurementId: 'your-measurement-id',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    self.registration.showNotification(
        payload.notification?.title || 'Notification',
        {
            body: payload.notification?.body || '',
            icon: '/FRAI.png',
            data: payload.data || {},
        }
    );
});
```

### 7. Configure Capacitor (for native)

```bash
npm install @capacitor/push-notifications @capacitor-community/fcm
npx cap sync
```

### 8. Set Environment Variables

```env
# .env
FIREBASE_CREDENTIALS=storage/app/firebase-auth.json
GOOGLE_APPLICATION_CREDENTIALS=storage/app/firebase-auth.json
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=1:your-sender-id:web:your-app-id
VITE_FIREBASE_MEASUREMENT_ID=G-YOURID
VITE_FIREBASE_VAPID_KEY=your-vapid-key-from-console
```

### 9. Test

1. Go to Settings page → Click "Enable Push Notifications"
2. Browser asks for permission → Allow
3. Check `device_tokens` table for your token
4. Send test via Tinker:
   ```php
   $user = App\Models\User::find(1);
   $user->notify(new App\Notifications\TestPushNotification('Test', 'Hello!', route('dashboard')));
   ```
5. Or trigger a real flow by submitting a facility request

### Production Notes

- `QUEUE_CONNECTION` must be `database` (not `sync`) — run `php artisan queue:work` or configure Supervisor
- `FIREBASE_CREDENTIALS` path must work on the production server (e.g. Render)
- Add `storage/app/firebase-auth.json` to `.gitignore` — use production env vars or deploy the file securely
- Firebase client config (API keys, project ID) is **public by design** — security comes from Firebase Security Rules, not from hiding the config
