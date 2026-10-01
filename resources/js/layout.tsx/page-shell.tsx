import type { ReactNode } from 'react';
import DefaultLayout from './default';

/**
 * Persistent layout wiring (Inertia v2).
 *
 * The app shell is attached to each page as `Component.layout` instead of being
 * wrapped around it in JSX. Inertia then renders the layout *outside* the keyed
 * page component and keeps a single shell instance alive between visits, so
 * sidebar state and scroll position, in-flight toasts and the chatbot session
 * all survive navigation.
 *
 * Pages must therefore NOT render <DefaultLayout> themselves — that would nest a
 * second, per-visit shell inside the persistent one and defeat the whole point.
 *
 * Both entry points (app.tsx for CSR, ssr.tsx for SSR) must apply this.
 */
export type PageShell = (children: ReactNode) => ReactNode;

const paddedShell: PageShell = (children) => <DefaultLayout>{children}</DefaultLayout>;

/** Pages that bring their own edge-to-edge spacing (tables, boards, calendars). */
const edgeToEdgeShell: PageShell = (children) => <DefaultLayout hasPadding={false}>{children}</DefaultLayout>;

/** Pages that own their chrome entirely and must stay outside the app shell. */
const UNSHELLED_PAGES = new Set(['login', 'welcome', 'auth/ForcePasswordReset', 'Errors/Error']);

const EDGE_TO_EDGE_PAGES = new Set(['dashboard', 'requests/index', 'requests/detail', 'facilities/detail', 'chatbot/chatbot']);

export function resolvePageShell(name: string): PageShell | undefined {
    if (UNSHELLED_PAGES.has(name)) {
        return undefined;
    }

    if (EDGE_TO_EDGE_PAGES.has(name)) {
        return edgeToEdgeShell;
    }

    return paddedShell;
}

/**
 * Attaches the resolved shell to a page component. Inertia reads the static from
 * the component it resolved, so the assignment has to happen on the component
 * itself — not on the ES module namespace.
 */
export function applyPageShell<T extends { layout?: PageShell }>(component: T, name: string): T {
    component.layout = resolvePageShell(name);

    return component;
}
