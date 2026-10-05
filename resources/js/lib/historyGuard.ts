import { router } from '@inertiajs/react';

type AuthProps = {
    auth?: { user?: { id?: number | null } | null } | null;
};

/**
 * Drops stale history entries when the signed-in user changes.
 *
 * The bug this prevents: login is an Inertia visit (useForm().post() in
 * components/login-form.tsx), so the /login history entry outlives it. Pressing
 * Back is a `popstate` inside the same document, and Inertia restores the page
 * straight from `history.state` without issuing any request — see
 * @inertiajs/core's `handlePopstateEvent`, which calls `page.setQuietly()` on
 * the stored page. No request means the `guest` middleware on /login never runs,
 * so an authenticated user is shown the login form again. No response header or
 * pageshow/bfcache handler can help: there is no response, and `pageshow` only
 * fires for real document navigations.
 *
 * The fix uses Inertia's own mechanism. `router.clearHistory()` removes the
 * history encryption key from sessionStorage, which makes every older entry
 * undecryptable; the popstate handler then fails to decrypt, calls
 * `onMissingHistoryItem()`, and the router re-visits the current URL for real.
 * The server redirect applies again and the user lands on the dashboard.
 *
 * This only bites if history encryption is on (`config/inertia.php`
 * `history.encrypt`) *and* the page runs in a secure context — without
 * `crypto.subtle` (plain HTTP) Inertia silently stores plaintext and clearing
 * has nothing to invalidate.
 *
 * Tracked on `success`, which only fires for visits that actually hit the
 * server, so a popstate restore can never look like an auth change.
 */
export function watchAuthTransitions(initialProps: unknown): void {
    let currentUserId = authenticatedUserId(initialProps);

    router.on('success', (event) => {
        const nextUserId = authenticatedUserId(event.detail.page.props);

        if (nextUserId === currentUserId) {
            return;
        }

        currentUserId = nextUserId;
        router.clearHistory();
    });
}

function authenticatedUserId(props: unknown): number | null {
    const user = (props as AuthProps | undefined)?.auth?.user;

    return user ? (user.id ?? null) : null;
}