import { Message, ChatRequest } from '../types';
import { getCsrfToken } from '../utils/csrfToken';

export async function sendChatMessage(
    payload: ChatRequest,
    csrfToken?: string
): Promise<{ message?: { content: string }; response?: string }> {
    const token = csrfToken || getCsrfToken();

    const response = await fetch(route('api.chat'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': token,          // fixed casing
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();  // safe for HTML or JSON errors
        throw new Error(`HTTP error ${response.status}: ${text.substring(0, 200)}`);
    }

    return await response.json();
}