import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { ensureForegroundPushListener } from '@/lib/firebasePush';
import '../css/app.css';

const appName = import.meta.env.VITE_APP_NAME || 'FRAI';

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
        // Best-effort: attaches onMessage when permission was already granted.
        // When permission is granted later via Settings → Enable, registerWeb
        // calls ensureForegroundPushListener again (skips are not cached).
        void ensureForegroundPushListener(
            (props as unknown as { firebaseConfig?: Record<string, unknown> }).firebaseConfig,
        ).then((result) => {
            if (result !== 'attached') {
                console.debug(`FCM foreground listener not attached at boot: ${result}`);
            }
        });

        const root = createRoot(el);
        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});
