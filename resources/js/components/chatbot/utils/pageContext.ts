import { getRichPageContext } from '@/lib/richPageContext';

export interface ClientPageContext {
    url: string;
    path: string;
    route?: string;
    component?: string | null;
    title: string;
    headings: string[];
    active_tabs: string[];
    visible_buttons: string[];
    visible_tables: string[];
    visible_content: string;
    forms: Array<{ label: string; value: string }>;
    rich: Record<string, unknown> | null;
}

const visibleText = (element: Element): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim();

export function collectPageContext(inertiaComponent?: string): ClientPageContext {
    const activeTabs = Array.from(document.querySelectorAll('[role="tab"][aria-selected="true"], [data-state="active"]'))
        .map(visibleText)
        .filter(Boolean);

    const rich = getRichPageContext();
    const visibleContent = visibleText(document.querySelector('main') ?? document.body).slice(0, 2000);
    const currentRoute = route?.current?.() ?? undefined;

    if (currentRoute && inertiaComponent) {
        const normalizedRoute = currentRoute.replace(/\./g, '/');
        if (normalizedRoute !== inertiaComponent) {
            console.warn('[pageContext] route/component mismatch', { route: currentRoute, component: inertiaComponent });
        }
    }

    return {
        url: window.location.href,
        path: window.location.pathname,
        route: currentRoute,
        component: inertiaComponent ?? null,
        title: document.title,
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(visibleText).filter(Boolean).slice(0, 30),
        active_tabs: [...new Set(activeTabs)].slice(0, 20),
        visible_buttons: Array.from(document.querySelectorAll('button'))
            .filter((button) => !!(button as HTMLElement).offsetParent)
            .map(visibleText)
            .filter(Boolean)
            .slice(0, 50),
        visible_tables: Array.from(document.querySelectorAll('table'))
            .filter((table) => !!(table as HTMLElement).offsetParent)
            .map(visibleText)
            .filter(Boolean)
            .slice(0, 10),
        visible_content: visibleContent,
        forms: Array.from(document.querySelectorAll('input, textarea, select'))
            .filter((field) => !!(field as HTMLElement).offsetParent)
            .map((field) => ({
                label: field.getAttribute('aria-label') || field.getAttribute('name') || field.tagName.toLowerCase(),
                value: (field as HTMLInputElement).value ?? '',
            }))
            .slice(0, 50),
        rich: rich ?? null,
    };
}
