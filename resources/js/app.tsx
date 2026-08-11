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
            const { getMessaging, onMessage } = await import('firebase/messaging');

            const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
            const messaging = getMessaging(app);

            onMessage(messaging, (payload) => {
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
