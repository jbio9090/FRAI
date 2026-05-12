import type { ChatRequest } from '../types';
import { getCsrfToken } from '../utils/csrfToken';

function extractBookingPayloadFromText(content: string): string | null {
    let depth = 0;
    let start = -1;

    for (let index = 0; index < content.length; index += 1) {
        const char = content[index];

        if (char === '{') {
            if (depth === 0) {
                start = index;
            }
            depth += 1;
            continue;
        }

        if (char !== '}' || depth === 0) {
            continue;
        }

        depth -= 1;
        if (depth !== 0 || start < 0) {
            continue;
        }

        const candidate = content.slice(start, index + 1);

        try {
            const parsed = JSON.parse(candidate);
            if (parsed?.title && Array.isArray(parsed?.facility_bookings)) {
                return JSON.stringify(parsed);
            }
        } catch {
            // Continue scanning until a full valid JSON object is found.
        }
    }

    return null;
}

export async function sendChatMessageStream(
    payload: ChatRequest,
    onToken: (token: string) => void,
    onBookingPayload: (json: string) => void,
    onDeterministic: (payload: Record<string, unknown>) => void,
    onViolation: (message: string) => void,
    onDone: () => void,
    onError: (message: string) => void,
): Promise<void> {

    const response = await fetch(route('chat.stream'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': getCsrfToken(),
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
    });

    if (response.status === 419) {
        window.location.reload();
        return;
    }

    if (!response.ok) {
        const text = await response.text();
        onError(`HTTP error ${response.status}: ${text.substring(0, 200)}`);
        return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let fullContent = '';
    let bookingPayloadEmitted = false;
    let tokenDisplayMode: 'undecided' | 'visible' | 'hiddenPayload' = 'undecided';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            const jsonLine = line.slice(6).trim();
            if (!jsonLine) continue;

            try {
                const event = JSON.parse(jsonLine);

                if (event.token) {
                    const token: string = event.token;
                    fullContent += token;

                    if (!bookingPayloadEmitted) {
                        const payload = extractBookingPayloadFromText(fullContent);
                        if (payload) {
                            bookingPayloadEmitted = true;
                            tokenDisplayMode = 'hiddenPayload';
                            onBookingPayload(payload);
                        }
                    }

                    if (tokenDisplayMode === 'undecided') {
                        const trimmedContent = fullContent.trimStart();

                        if (trimmedContent === '') {
                            continue;
                        }

                        if (trimmedContent.startsWith('{')) {
                            tokenDisplayMode = bookingPayloadEmitted ? 'hiddenPayload' : 'undecided';
                            continue;
                        }

                        tokenDisplayMode = 'visible';
                    }

                    if (tokenDisplayMode === 'hiddenPayload') {
                        continue;
                    }

                    onToken(token);
                }

                if (event.booking_payload) {
                    // event.booking_payload is already a string from the backend
                    const payloadStr = typeof event.booking_payload === 'string' 
                        ? event.booking_payload 
                        : JSON.stringify(event.booking_payload);
                    bookingPayloadEmitted = true;
                    onBookingPayload(payloadStr);
                }

                if (event.deterministic && typeof event.deterministic === 'object') {
                    onDeterministic(event.deterministic as Record<string, unknown>);
                }

                if (event.violation) {
                    onViolation(event.violation);
                }

                if (event.done) {
                    if (tokenDisplayMode === 'undecided' && !bookingPayloadEmitted && fullContent.trim() !== '') {
                        tokenDisplayMode = 'visible';
                        onToken(fullContent);
                    }

                    onDone();
                }

                if (event.error) {
                    onError(event.error);
                }

            } catch {}
        }
    }
}
