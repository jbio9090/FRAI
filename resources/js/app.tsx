import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import '../css/app.css';

const appName = import.meta.env.VITE_APP_NAME || 'FRAI';

function setupForegroundPushListener(firebaseConfig: Record<string, any> | undefined): void {
    const isNative = typeof (window as any).Capacitor !== 'undefined';
    const supportsWebPush = 'serviceWorker' in navigator && 'PushManager' in window;

    if (isNative || !supportsWebPush || !firebaseConfig) {
        return;
    }

    void import('firebase/app')
        .then(async ({ getApps, initializeApp }) => {
            const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

            const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
            const messaging = getMessaging(app);

            // Initialize the FCM channel / service worker so onMessage fires on every
            // page, not only after visiting Settings (the only place getToken runs today).
            try {
                await getToken(messaging, {
                    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
                });
            } catch (err) {
                console.warn('FCM getToken init failed — foreground push may not fire:', err);
            }

            onMessage(messaging, (payload) => {
                console.log('Foreground push received:', payload);

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
            });
        })
        .catch((err) => {
            console.error('Failed to initialize foreground push listener:', err);
        });
}

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            [`./pages/${name}.tsx`, `./pages/${name}/index.tsx`],
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        setupForegroundPushListener((props as any).firebaseConfig);

        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});
