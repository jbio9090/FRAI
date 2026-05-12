import { useState, useCallback } from 'react';
import { sendChatMessage } from '../services/chatService';
import { createRequest } from '../services/requestService';
import type { Message, ChatRequest, CreateRequestPayload } from '../types';

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
        onToken?: (token: string) => void,
        onBookingPayload?: (json: string) => void,
        onDeterministic?: (payload: Record<string, unknown>) => void,
    ) => {
        setIsLoading(true);
        setError(null);

        return new Promise<string>((resolve, reject) => {
            const payload: ChatRequest = { messages };
            if (participantCount) payload.participant_count = participantCount;
            if (bookingContext)   payload.booking_context   = bookingContext;
            if (faqMode) payload.faq_mode = true;

            let fullContent = '';
            void sendChatMessage(payload)
                .then(async ({ content, bookingPayload, deterministic }) => {
                    fullContent = content;

                    if (deterministic) {
                        onDeterministic?.(deterministic);
                    }

                    if (bookingPayload) {
                        onBookingPayload?.(bookingPayload);
                    } else {
                        await typeOutContent(content, onToken);
                    }

                    setIsLoading(false);
                    resolve(fullContent);
                })
                .catch((error) => {
                    const message = error instanceof Error ? error.message : 'Unknown error occurred';
                    setIsLoading(false);
                    setError(message);
                    reject(error instanceof Error ? error : new Error(message));
                });
        });
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
