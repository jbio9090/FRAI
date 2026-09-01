import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import '../css/app.css';

const appName = import.meta.env.VITE_APP_NAME || 'FRAI';

function setupForegroundPushListener(firebaseConfig: Record<string, unknown> | undefined): void {
    const isNative = typeof (window as Window & { Capacitor?: unknown }).Capacitor !== 'undefined';
    const supportsWebPush = 'serviceWorker' in navigator && 'PushManager' in window;

    if (isNative || !supportsWebPush || !firebaseConfig) {
        return;
    }

    // Register Service Worker for PWA web push notifications
    void navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
        .then((reg) => {
            console.log('FCM Service Worker registered:', reg.scope);
        })
        .catch((err) => {
            console.error('FCM Service Worker registration failed:', err);
        });

    void import('firebase/app')
        .then(async ({ getApps, initializeApp }) => {
            const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

            const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
            const messaging = getMessaging(app);

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

const pages = import.meta.glob('./pages/**/*.tsx', { eager: true });

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) => {
        const page = (pages[`./pages/${name}.tsx`] || pages[`./pages/${name}/index.tsx`]) as { default: React.ComponentType };
        if (!page) {
            throw new Error(`Page not found: ${name}`);
        }
        return page;
    },
    setup({ el, App, props }) {
        setupForegroundPushListener((props as unknown as { firebaseConfig?: Record<string, unknown> }).firebaseConfig);

        const root = createRoot(el);
        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});
