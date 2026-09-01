export function getCsrfToken(): string {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) {
        const token = meta.getAttribute('content');
        if (token) return token;
    }

    const win = window as Window & { Laravel?: { csrfToken?: string }; csrf_token?: string };
    const winToken = win.Laravel?.csrfToken || win.csrf_token;
    if (winToken) return winToken;

    const matches = document.cookie.match(/XSRF-TOKEN=([^;]*)/);
    if (matches) return decodeURIComponent(matches[1]);

    return '';
}
