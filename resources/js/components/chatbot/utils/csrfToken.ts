export function getCsrfToken(): string {
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) {
        const token = meta.getAttribute('content');
        if (token) return token;
    }

    const winToken = (window as any).Laravel?.csrfToken || (window as any).csrf_token;
    if (winToken) return winToken;

    const matches = document.cookie.match(/XSRF-TOKEN=([^;]*)/);
    if (matches) return decodeURIComponent(matches[1]);

    return '';
}
