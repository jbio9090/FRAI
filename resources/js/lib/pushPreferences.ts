export const PUSH_OPT_OUT_KEY = 'push-opt-out';

export function isPushOptedOut(): boolean {
    try {
        return window.localStorage.getItem(PUSH_OPT_OUT_KEY) === '1';
    } catch {
        return false;
    }
}

export function setPushOptedOut(optedOut: boolean): void {
    try {
        if (optedOut) {
            window.localStorage.setItem(PUSH_OPT_OUT_KEY, '1');
        } else {
            window.localStorage.removeItem(PUSH_OPT_OUT_KEY);
        }
    } catch {
        // Storage unavailable (private mode) — server truth still applies.
    }
}
