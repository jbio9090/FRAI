import type { ChatRequest } from '../types';
import { getCsrfToken } from '../utils/csrfToken';
import { collectPageContext, type ClientPageContext } from '../utils/pageContext';

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

        function getServerPageContext(pageContext: ClientPageContext): Pick<ClientPageContext, 'url' | 'path' | 'route' | 'component' | 'title'> {
            return {
                url: pageContext.url,
                path: pageContext.path,
                route: pageContext.route,
                component: pageContext.component,
                title: pageContext.title,
            };
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

interface ChatJsonResponse {
    message?: {
        role?: string;
        content?: string;
    };
    response?: string;
    deterministic?: Record<string, unknown>;
    debug?: { tool_calls?: unknown[] };
    error?: string;
}

export async function sendChatMessage(
    payload: ChatRequest,
    pageContextOverride?: ClientPageContext,
    devmode?: boolean,
): Promise<{
    content: string;
    bookingPayload: string | null;
    deterministic: Record<string, unknown> | null;
    debug: { tool_calls: unknown[] } | null;
}> {
    const pageContext = pageContextOverride ?? collectPageContext();
    const response = await fetch(route('api.chat'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': getCsrfToken(),
            'X-Page-URL': window.location.href,
        },
        credentials: 'same-origin',
        body: JSON.stringify({ ...payload, page_context: getServerPageContext(pageContext), devmode: !!devmode }),
    });

    if (response.status === 419) {
        throw new Error('Session timed out. Please try sending your message again.');
    }

    const data = (await response.json().catch(() => null)) as (ChatJsonResponse & { message?: string | { role?: string; content?: string } }) | null;

    if (!response.ok) {
        const message = typeof data?.message === 'string' ? data.message : (data?.message?.content ?? data?.error ?? `HTTP error ${response.status}`);
        throw new Error(message);
    }

    const content = (typeof data?.message === 'string' ? data.message : data?.message?.content) ?? data?.response ?? '';

    return {
        content,
        bookingPayload: extractBookingPayloadFromText(content),
        deterministic: data?.deterministic ?? null,
        debug: data?.debug?.tool_calls ? { tool_calls: data.debug.tool_calls } : null,
    };
}

export async function sendChatMessageStream(
    payload: ChatRequest,
    onToken: (token: string) => void,
    onBookingPayload: (json: string) => void,
    onDeterministic: (payload: Record<string, unknown>) => void,
    onViolation: (message: string) => void,
    onDone: () => void,
    onError: (message: string) => void,
    pageContextOverride?: ClientPageContext,
): Promise<void> {
    const pageContext = pageContextOverride ?? collectPageContext();
    const response = await fetch(route('chat.stream'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': getCsrfToken(),
            'X-Page-URL': window.location.href,
        },
        credentials: 'same-origin',
        body: JSON.stringify({ ...payload, page_context: getServerPageContext(pageContext) }),
    });

    if (response.status === 419) {
        onError('Session timed out. Please try sending your message again.');
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
            if (!jsonLine || jsonLine === '[DONE]') {
                if (jsonLine === '[DONE]') {
                    onDone();
                }
                continue;
            }

            try {
                const event = JSON.parse(jsonLine);
                const tokenVal = event.token ?? event.text;

                if (tokenVal) {
                    const token: string = String(tokenVal);
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
                    const payloadStr = typeof event.booking_payload === 'string' ? event.booking_payload : JSON.stringify(event.booking_payload);
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
            } catch {
                // Ignore parse errors on partial stream chunks
            }
        }
    }
}
