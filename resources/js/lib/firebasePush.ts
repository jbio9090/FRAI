type FirebaseWebConfig = Record<string, unknown>;

/**
 * The Firebase web config arrives at runtime via Inertia props. All keys are
 * public by design. A config without a projectId means the server has no
 * VITE_FIREBASE_* values (or config:cache baked empty ones) — calling
 * initializeApp with it would throw a generic Firebase error.
 */
export function isFirebaseConfigValid(config: FirebaseWebConfig | undefined): boolean {
    return (
        typeof config !== 'undefined' &&
        typeof config.projectId === 'string' &&
        config.projectId.length > 0 &&
        typeof config.apiKey === 'string' &&
        config.apiKey.length > 0
    );
}

/**
 * Resolve the VAPID key. import.meta.env is baked at Vite build time and is
 * empty inside the Docker image, so prefer the runtime value the backend
 * shares via Inertia props (config/services.php `firebase.vapid_key`).
 */
export function resolveVapidKey(config: FirebaseWebConfig | undefined): string | undefined {
    const runtimeKey = config?.vapidKey;

    if (typeof runtimeKey === 'string' && runtimeKey.length > 0) {
        return runtimeKey;
    }

    const buildKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

    return typeof buildKey === 'string' && buildKey.length > 0 ? buildKey : undefined;
}

/**
 * Single registration point for the push service worker so the settings
 * toggle and the foreground listener mint tokens against the same
 * registration instead of racing two register() calls.
 */
export async function getPushServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
    if (!('serviceWorker' in navigator)) {
        throw new Error('Push notifications are not supported in this browser.');
    }

    const existing = await navigator.serviceWorker.getRegistration();

    if (existing) {
        return existing;
    }

    return navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
}
