import { ChatRequest } from '../types';
import { getCsrfToken } from '../utils/csrfToken';

export async function sendChatMessageStream(
    payload: ChatRequest,
    onToken: (token: string) => void,
    onBookingPayload: (json: string) => void,
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

                    // Try to extract JSON from the accumulated content
                    const jsonMatch = fullContent.match(/\{[\s\S]*?\}/);
                    if (jsonMatch) {
                        try {
                            const parsed = JSON.parse(jsonMatch[0]);
                            if (parsed.title && parsed.facility_bookings && Array.isArray(parsed.facility_bookings)) {
                                onBookingPayload(JSON.stringify(parsed));
                                // Remove the JSON from the content so it doesn't appear in the message
                                fullContent = fullContent.replace(jsonMatch[0], '').trim();
                            }
                        } catch (e) {
                            // Not valid JSON yet, continue accumulating
                        }
                    }

                    onToken(token);
                }

                if (event.booking_payload) {
                    // event.booking_payload is already a string from the backend
                    const payloadStr = typeof event.booking_payload === 'string' 
                        ? event.booking_payload 
                        : JSON.stringify(event.booking_payload);
                    onBookingPayload(payloadStr);
                }

                if (event.violation) {
                    onViolation(event.violation);
                }

                if (event.done) {
                    onDone();
                }

                if (event.error) {
                    onError(event.error);
                }

            } catch {}
        }
    }
}