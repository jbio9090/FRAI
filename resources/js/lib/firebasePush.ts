import { isPushOptedOut } from '@/lib/pushPreferences';

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

type ForegroundAttachResult =
    | 'attached'
    | 'skipped-native'
    | 'skipped-unsupported'
    | 'skipped-no-config'
    | 'skipped-opted-out'
    | 'skipped-no-permission'
    | 'skipped-no-vapid'
    | 'failed';

interface ForegroundPayload {
    notification?: { title?: string; body?: string } | null;
    data?: Record<string, unknown> | null;
}

function showForegroundNotification(payload: ForegroundPayload): void {
    const title = payload.notification?.title || 'Notification';
    const body = payload.notification?.body || '';
    const options = {
        body,
        icon: '/FRAI.png',
        data: payload.data || {},
    };

    void navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
            void registration.showNotification(title, options);
            return;
        }

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(title, options);
        }
    });
}

async function attachForegroundPushListener(config: FirebaseWebConfig | undefined): Promise<ForegroundAttachResult> {
    if (typeof (window as Window & { Capacitor?: unknown }).Capacitor !== 'undefined') {
        return 'skipped-native';
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return 'skipped-unsupported';
    }

    if (!isFirebaseConfigValid(config)) {
        return 'skipped-no-config';
    }

    // Per-device opt-out: never mint a fresh FCM token after the user disabled
    // push on this browser. Otherwise getToken() would recreate one and the
    // settings toggle would snap back to enabled.
    if (isPushOptedOut()) {
        return 'skipped-opted-out';
    }

    // Push permission (notably iOS Safari) is only granted from a user gesture
    // in settings. Skip token minting until then — getToken() would throw and
    // the settings toggle owns the permission-request flow.
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return 'skipped-no-permission';
    }

    const vapidKey = resolveVapidKey(config);

    if (!vapidKey) {
        return 'skipped-no-vapid';
    }

    const { getApps, initializeApp } = await import('firebase/app');
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

    const app = getApps().length ? getApps()[0] : initializeApp(config);
    const messaging = getMessaging(app);
    const registration = await getPushServiceWorkerRegistration();
    console.log('FCM Service Worker registered:', registration.scope);

    try {
        await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: registration,
        });
    } catch (err) {
        console.warn('FCM getToken init failed — foreground push may not fire:', err);
    }

    onMessage(messaging, (payload) => {
        console.log('Foreground push received:', payload);
        showForegroundNotification(payload as ForegroundPayload);
    });

    return 'attached';
}

let foregroundAttachPromise: Promise<ForegroundAttachResult> | null = null;

/**
 * Attach the foreground `onMessage` handler (idempotent per page session).
 * Safe to call from both app boot and the settings Enable flow: concurrent
 * calls share one attempt, and any non-attached outcome clears the cache so
 * a later call (e.g. after Enable grants permission) retries fresh instead
 * of replaying a stale skip.
 */
export function ensureForegroundPushListener(config: FirebaseWebConfig | undefined): Promise<ForegroundAttachResult> {
    if (foregroundAttachPromise) {
        return foregroundAttachPromise;
    }

    const attempt = attachForegroundPushListener(config);

    foregroundAttachPromise = attempt.then(
        (result) => {
            if (result !== 'attached') {
                foregroundAttachPromise = null;
            }
            return result;
        },
        () => {
            foregroundAttachPromise = null;
            return 'failed' as ForegroundAttachResult;
        },
    );

    return foregroundAttachPromise;
}
