---
paths:
  - 'resources/js/**'
  - 'resources/js/**/*.tsx'
---

# Js

## Resolve VAPID key at runtime, share one SW registration
Resolve the VAPID key at runtime via usePage().props.firebaseConfig.vapidKey (see lib/firebasePush resolveVapidKey), never import.meta.env alone: Vite bakes env at build time and it is empty in the Docker image. Mint/check FCM tokens against one shared service-worker registration (getPushServiceWorkerRegistration), and guard mount-time getToken on Notification.permission === 'granted'.

## Never define a component inside another component's body
Never declare a React component inside another component's function body (e.g. a shared form-fields renderer defined in the middle of a page). Each parent render creates a new component type, so React unmounts/remounts the subtree and controlled inputs lose focus after one keystroke. Put shared renderers at module scope or in a separate file under pages/<page>/components/, and pass all parent state in as props instead of closing over it. This is what made the Add User modal in resources/js/pages/accounts/index.tsx type one letter at a time and lock the Position field.
