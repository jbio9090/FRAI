import { useState, useCallback } from 'react';
import { Message, ChatRequest, CreateRequestPayload } from '../types';
import { sendChatMessageStream } from '../services/chatService';
import { createRequest } from '../services/requestService';

export function useChatAPI() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendMessage = useCallback(async (
        messages: Message[],
        participantCount?: number,
        bookingContext?: string,
        onToken?: (token: string) => void,
        onBookingPayload?: (json: string) => void,
    ) => {
        setIsLoading(true);
        setError(null);

        return new Promise<string>((resolve, reject) => {
            const payload: ChatRequest = { messages };
            if (participantCount) payload.participant_count = participantCount;
            if (bookingContext)   payload.booking_context   = bookingContext;

            let fullContent = '';

            sendChatMessageStream(
                payload,

                (token) => {
                    fullContent += token;
                    onToken?.(token);
                },

                (json) => {
                    try {
                        console.log('useChatAPI received booking payload:', json);
                        // Don't auto-submit - pass to caller for confirmation
                        onBookingPayload?.(json);
                    } catch (e) {
                        console.error('Error handling booking payload:', e);
                    }
                },

                (message) => {
                    fullContent = message;
                    onToken?.(message);
                },

                () => {
                    setIsLoading(false);
                    resolve(fullContent);
                },

                (message) => {
                    setIsLoading(false);
                    setError(message);
                    reject(new Error(message));
                },
            );
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