import { createInertiaApp } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { renderToString } from 'react-dom/server';
import { applyPageShell, type PageShell } from '@/layout.tsx/page-shell';

const appName = import.meta.env.VITE_APP_NAME || 'FRAI';

createServer((page) =>
    createInertiaApp({
        page,
        render: renderToString,
        title: (title) => (title ? `${title} - ${appName}` : appName),
        resolve: async (name) =>
            applyPageShell(
                (await resolvePageComponent([`./pages/${name}.tsx`, `./pages/${name}/index.tsx`], import.meta.glob('./pages/**/*.tsx'))) as React.ComponentType & {
                    layout?: PageShell;
                },
                name,
            ),
        setup: ({ App, props }) => <App {...props} />,
    }),
);
