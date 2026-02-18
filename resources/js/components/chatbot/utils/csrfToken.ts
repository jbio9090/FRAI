/**
 * Get CSRF token from meta tag or document
 */
export function getCsrfToken(): string {
    // Try multiple sources for CSRF token
    
    // 1. Check meta tag
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) {
        const token = meta.getAttribute('content');
        if (token) return token;
    }

    // 2. Check window object (Laravel sets it here)
    const winToken = (window as any).Laravel?.csrfToken || (window as any).csrf_token;
    if (winToken) return winToken;

    // 3. Try document cookie
    const matches = document.cookie.match(/XSRF-TOKEN=([^;]*)/);
    if (matches) return decodeURIComponent(matches[1]);

    return '';
}
