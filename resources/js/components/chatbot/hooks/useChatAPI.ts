import { useState, useCallback } from 'react';
import { Message, ChatRequest, CreateRequestPayload } from '../types';
import { sendChatMessage } from '../services/chatService';
import { createRequest } from '../services/requestService';

/**
 * Custom hook for managing chat API interactions
 */
export function useChatAPI(csrfToken?: string) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendMessage = useCallback(async (messages: Message[], participantCount?: number) => {
        setIsLoading(true);
        setError(null);

        try {
            const payload: ChatRequest = { messages };
            if (participantCount) {
                payload.participant_count = participantCount;
            }

            const data = await sendChatMessage(payload, csrfToken);
            return data.message?.content || data.response || 'No response received';
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMsg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [csrfToken]);

    const submitRequest = useCallback(async (payload: CreateRequestPayload) => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await createRequest(payload, csrfToken);
            return result;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMsg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [csrfToken]);

    const detectAndSubmitRequest = useCallback(async (content: string, userConfirmed: boolean = false) => {
        if (!userConfirmed) return null;  // <-- don't auto-submit

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
