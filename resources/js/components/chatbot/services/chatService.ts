import { Message, ChatRequest } from '../types';
import { getCsrfToken } from '../utils/csrfToken';

/**
 * Send a message to the chat API
 */
export async function sendChatMessage(payload: ChatRequest, csrfToken?: string): Promise<{ message?: { content: string }; response?: string }> {
    const token = csrfToken || getCsrfToken();
    
    const response = await fetch(route('api.chat'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-Token': token,
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
}
