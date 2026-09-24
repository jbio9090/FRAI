---
paths:
  - 'app/Notifications/**'
---

# Notifications

## FCM payloads must include notification + data.url/tag
Every FCM web push must include a `notification` payload (title/body) and show it immediately in the service worker. Safari/iOS revoke push permission for silent data-only pushes, and the service worker's notificationclick handler opens `data.url` — so always set `data.url` and `data.tag` in toFcm(). Firebase web config for the worker is served by NotificationController::swConfig (/push/sw-config.js); never hardcode a second copy of the keys.
