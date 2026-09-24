---
paths:
  - 'resources/js/**'
---

# Js

## Resolve VAPID key at runtime, share one SW registration
Resolve the VAPID key at runtime via usePage().props.firebaseConfig.vapidKey (see lib/firebasePush resolveVapidKey), never import.meta.env alone: Vite bakes env at build time and it is empty in the Docker image. Mint/check FCM tokens against one shared service-worker registration (getPushServiceWorkerRegistration), and guard mount-time getToken on Notification.permission === 'granted'.
