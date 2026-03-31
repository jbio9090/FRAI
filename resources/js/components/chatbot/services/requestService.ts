import { CreateRequestPayload } from '../types';
import { getCsrfToken } from '../utils/csrfToken';

export async function createRequest(payload: CreateRequestPayload): Promise<{ request_id: string }> {

    const response = await fetch(route('api.db.create.request'), {
        method: 'POST',
        headers: {
            'Content-Type':     'application/json',
            'Accept':           'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN':     getCsrfToken(), 
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
    });

    if (response.status === 419) {
        window.location.reload();
        return Promise.reject(new Error('CSRF token expired, reloading...'));
    }

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
    }

    return await response.json();
}