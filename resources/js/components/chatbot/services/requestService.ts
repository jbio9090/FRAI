import { CreateRequestPayload } from '../types';
import { getCsrfToken } from '../utils/csrfToken';

/**
 * Create a request via API
 */
export async function createRequest(payload: CreateRequestPayload, csrfToken?: string): Promise<{ request_id: string }> {
    const token = csrfToken || getCsrfToken();
    
    const response = await fetch(route('api.db.create.request'), {
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
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
}
