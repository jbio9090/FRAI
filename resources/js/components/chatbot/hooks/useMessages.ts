import { useState, useCallback } from 'react';
import type { Message } from '../types';

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

    const streamMessage = useCallback((content: string, onDone?: () => void) => {
        let index = 0;

        // Insert filler msgr
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        const interval = setInterval(() => {
            index += 4; // char p/s 

            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: 'assistant',
                    content: content.slice(0, index),
                };
                return updated;
            });

            if (index >= content.length) {
                clearInterval(interval);
                onDone?.();
            }
        }, 16); // 16ms per tick — roughly 60fps
    }, []);

    return {
        messages,
        addMessage,
        addMessages,
        clearMessages,
        streamMessage,
        setMessages,
        getMessagesText: () => messages.map((m) => m.content).join(' '),
    };
}