import { useState, useCallback } from 'react';
import { Message } from '../types';

/**
 * Custom hook for managing chat messages
 */
export function useMessages() {
    const [messages, setMessages] = useState<Message[]>([]);

    const addMessage = useCallback((message: Message) => {
        setMessages((prev) => [...prev, message]);
    }, []);

    const addMessages = useCallback((newMessages: Message[]) => {
        setMessages((prev) => [...prev, ...newMessages]);
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    return {
        messages,
        addMessage,
        addMessages,
        clearMessages,
        getMessagesText: () => messages.map((m) => m.content).join(' '),
    };
}
