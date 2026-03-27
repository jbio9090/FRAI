import { ChatRequest } from '../types';
import { getCsrfToken } from '../utils/csrfToken';

export async function sendChatMessage(
    payload: ChatRequest
): Promise<{ message?: { content: string }; response?: string }> {

    const response = await fetch(route('api.chat'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': getCsrfToken(), // always read fresh from DOM
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
    });

    if (response.status === 419) {
        window.location.reload(); // token expired, reload to get a fresh one
        return {};
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP error ${response.status}: ${text.substring(0, 200)}`);
    }

    return await response.json();
}