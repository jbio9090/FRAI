import { useState, useCallback } from 'react';
import { sendChatMessage } from '../services/chatService';
import { createRequest } from '../services/requestService';
import type { Message, ChatRequest, CreateRequestPayload } from '../types';
import { collectPageContext, type ClientPageContext } from '../utils/pageContext';

const RETRY_DELAY_MS = 2 * 60 * 1000;

function isTransientAiFailure(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    const message = error.message.toLowerCase();
    return message.includes('429')
        || message.includes('rate limit')
        || message.includes('too many requests')
        || message.includes('502')
        || message.includes('503')
        || message.includes('504')
        || message.includes('timeout')
        || message.includes('network')
        || message.includes('failed to fetch')
        || message.includes('temporarily unavailable');
}

function typeOutContent(content: string, onToken?: (token: string) => void): Promise<void> {
    return new Promise((resolve) => {
        if (!content) {
            resolve();
            return;
        }

        let index = 0;
        const chunkSize = 4;
        const interval = window.setInterval(() => {
            const nextIndex = Math.min(index + chunkSize, content.length);
            const token = content.slice(index, nextIndex);
            index = nextIndex;
            onToken?.(token);

            if (index >= content.length) {
                window.clearInterval(interval);
                resolve();
            }
        }, 16);
    });
}

export function useChatAPI() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendMessage = useCallback(async (
        messages: Message[],
        participantCount?: number,
        bookingContext?: string,
        faqMode?: boolean,
        pageContext?: ClientPageContext,
        onToken?: (token: string) => void,
        onBookingPayload?: (json: string) => void,
        onDeterministic?: (payload: Record<string, unknown>) => void,
        devmode?: boolean,
        onDebugToolCalls?: (calls: unknown[]) => void,
    ) => {
        setIsLoading(true);
        setError(null);

        const runRequest = async () => {
            const payload: ChatRequest = {
                messages,
                page_context: pageContext ?? collectPageContext(),
            };
            if (participantCount) payload.participant_count = participantCount;
            if (bookingContext) payload.booking_context = bookingContext;
            if (faqMode) payload.faq_mode = true;

            let fullContent = '';
            let attempt = 0;

            while (true) {
                try {
                    const response = await sendChatMessage(payload, pageContext, devmode);
                    fullContent = response.content;

                    if (response.deterministic) {
                        onDeterministic?.(response.deterministic);
                    }

                    if (response.debug?.tool_calls?.length) {
                        onDebugToolCalls?.(response.debug.tool_calls);
                    }

                    if (response.bookingPayload) {
                        onBookingPayload?.(response.bookingPayload);
                    } else {
                        await typeOutContent(response.content, onToken);
                    }

                    setIsLoading(false);
                    setError(null);
                    return fullContent;
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown error occurred';
                    const retryable = isTransientAiFailure(error);

                    if (!retryable || attempt >= 1) {
                        setIsLoading(false);
                        setError(message);
                        throw error instanceof Error ? error : new Error(message);
                    }

                    attempt += 1;
                    setError('AI request failed. Retrying automatically in 2 minutes…');
                    await new Promise((waitResolve) => window.setTimeout(waitResolve, RETRY_DELAY_MS));
                }
            }
        };

        return runRequest();
    }, []);

    const submitRequest = useCallback(async (payload: CreateRequestPayload) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await createRequest(payload); 
            return result;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMsg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []); 

    const detectAndSubmitRequest = useCallback(async (content: string, userConfirmed: boolean = false) => {
        if (!userConfirmed) return null;

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        try {
            const payload = JSON.parse(jsonMatch[0]);
            if (payload.title && payload.facility_bookings && Array.isArray(payload.facility_bookings)) {
                return await submitRequest(payload);
            }
        } catch (jsonError) {
            console.log('Could not parse JSON payload:', jsonError);
        }

        return null;
    }, [submitRequest]);

    return {
        isLoading,
        error,
        sendMessage,
        submitRequest,
        detectAndSubmitRequest,
        clearError: () => setError(null),
    };
}
