/**
 * CSRF headers for raw fetch() calls.
 *
 * Never source the token from <meta name="csrf-token">. That tag is rendered
 * once, when the Blade root view is served; Inertia client-side visits never
 * re-render it, and LoginController::authenticate() calls session()->regenerate(),
 * which mints a new token via Store::regenerateToken(). The tag therefore goes
 * stale the moment you log in and every raw fetch that trusts it gets a 419.
 * Inertia's own docs say to omit the tag for this reason.
 *
 * Laravel re-issues the XSRF-TOKEN cookie on every response that passes through
 * VerifyCsrfToken, so the cookie is always current. EncryptCookies encrypts it,
 * and VerifyCsrfToken::getTokenFromRequest() only decrypts it when it arrives as
 * X-XSRF-TOKEN — so the cookie must be sent under that header name, never as
 * X-CSRF-TOKEN.
 */
export function csrfHeaders(): Record<string, string> {
    const raw = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)?.[1];
    const cookieToken = raw ? decodeURIComponent(raw) : '';

    if (cookieToken) {
        return {
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': cookieToken,
        };
    }

    return {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
    };
}

/**
 * Asks the server for the live token and refreshes the cookie. Used to recover
 * from a 419 when the cookie was stale or absent to begin with.
 */
export async function refreshCsrfToken(): Promise<string> {
    const response = await fetch(route('api.csrf'), {
        method: 'GET',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });

    if (!response.ok) {
        return '';
    }

    const payload = (await response.json().catch(() => null)) as { token?: string } | null;

    return typeof payload?.token === 'string' ? payload.token : '';
}