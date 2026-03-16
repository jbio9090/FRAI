<<<<<<< Updated upstream
import React, { useRef, useEffect } from 'react';
=======
import React, { useRef, useEffect, useState } from 'react';
>>>>>>> Stashed changes
import { usePage } from '@inertiajs/react';
import { Message } from './types';
import { useMessages } from './hooks/useMessages';
import { useParticipantCount } from './hooks/useParticipantCount';
import { useChatAPI } from './hooks/useChatAPI';
<<<<<<< Updated upstream
=======
import { QuickReply } from './components/QuickReplies';
import { Facility } from './hooks/useBookingFlow';
>>>>>>> Stashed changes
import WelcomeMessage from './components/WelcomeMessage';
import MessageList from './components/MessageList';
import LoadingIndicator from './components/LoadingIndicator';
import ChatInput from './components/ChatInput';
<<<<<<< Updated upstream
=======
import BookingFlow from './components/BookingFlow';

type ChatMode = 'idle' | 'booking' | 'ai';
>>>>>>> Stashed changes

export default function Chatbot() {
    const page = usePage();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = React.useState('');
<<<<<<< Updated upstream

    const { messages, addMessage, getMessagesText } = useMessages();
    const { participantCount, extractAndSet, getCurrentCount } = useParticipantCount();
    const csrfToken = (page.props as any).csrf_token || '';
    const { isLoading, error, sendMessage, detectAndSubmitRequest } = useChatAPI(csrfToken);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
=======
    const [mode, setMode] = useState<ChatMode>('idle');
    const [facilities, setFacilities] = useState<Facility[]>([]);

    const { messages, addMessage, getMessagesText } = useMessages();
    const { extractAndSet, getCurrentCount } = useParticipantCount();
    const csrfToken = (page.props as any).csrf_token || '';
    const { isLoading, sendMessage, detectAndSubmitRequest } = useChatAPI(csrfToken);

    // Auto-scroll to bottom when messages change or mode changes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, mode]);

    // Fetch facilities for the booking flow
    useEffect(() => {
        fetch('/chat/facilities', {
            headers: { 'X-CSRF-TOKEN': csrfToken },
        })
            .then(res => res.json())
            .then(json => {
                if (json.data) setFacilities(json.data);
            })
            .catch(() => {});
    }, []);

    const processAndSend = async (userMessage: Message, contextNote?: string) => {
        addMessage(userMessage);

        try {
            extractAndSet(userMessage.content);

            const allMessages: Message[] = [
                ...(contextNote
                    ? [{ role: 'system' as const, content: `QUICK REPLY CONTEXT: ${contextNote} Guide the conversation accordingly from the very first response.` }]
                    : []),
                ...messages,
                userMessage,
            ];

            const currentCount = getCurrentCount(getMessagesText()) ?? undefined;
            const responseContent = await sendMessage(allMessages, currentCount);
            addMessage({ role: 'assistant', content: responseContent });

            try {
                const result = await detectAndSubmitRequest(responseContent);
                if (result) {
                    addMessage({ role: 'assistant', content: `✓ Request #${result.request_id} created successfully!` });
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Failed to create request';
                addMessage({ role: 'assistant', content: `✗ Failed to create request: ${errorMsg}` });
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
            addMessage({ role: 'assistant', content: `Error: ${errorMsg}` });
        }
    };

    const handleQuickReply = (option: QuickReply) => {
        if (option.id === 'book_facility') {
            // Enter structured booking flow — no AI needed
            setMode('booking');
            return;
        }
        // All other quick replies go to AI mode
        setMode('ai');
        processAndSend({ role: 'user', content: option.message }, option.context);
    };
>>>>>>> Stashed changes

    const handleSendMessage = async () => {
        const message = input.trim();
        if (!message || isLoading) return;
<<<<<<< Updated upstream

        // Add user message
        const userMessage: Message = { role: 'user', content: message };
        addMessage(userMessage);
        setInput('');

        try {
            // Update participant count if mentioned in this message
            extractAndSet(message);

            // Get all messages including the new one
            const allMessages = [...messages, userMessage];
            const currentCount = getCurrentCount(getMessagesText());

            // Send message to API
            const responseContent = await sendMessage(allMessages, currentCount);

            // Add assistant response
            addMessage({
                role: 'assistant',
                content: responseContent,
            });

            // Try to detect and submit request creation
            try {
                const result = await detectAndSubmitRequest(responseContent);
                if (result) {
                    addMessage({
                        role: 'assistant',
                        content: `✓ Request #${result.request_id} created successfully!`,
                    });
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Failed to create request';
                addMessage({
                    role: 'assistant',
                    content: `✗ Failed to create request: ${errorMsg}`,
                });
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
            addMessage({
                role: 'assistant',
                content: `Error: ${errorMsg}`,
            });
        }
=======
        setInput('');
        if (mode === 'idle') setMode('ai');
        await processAndSend({ role: 'user', content: message });
>>>>>>> Stashed changes
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

<<<<<<< Updated upstream
    return (
        <div className="w-full h-full flex flex-col">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                    <WelcomeMessage />
                ) : (
                    <MessageList messages={messages} messagesEndRef={messagesEndRef} />
                )}

                {isLoading && <LoadingIndicator />}
            </div>

            {/* Input Area */}
            <ChatInput
                value={input}
                onChange={setInput}
                onKeyPress={handleKeyPress}
                onSend={handleSendMessage}
                disabled={isLoading}
            />
        </div>
    );
}
=======
    const handleBookingComplete = (resultMessage: string) => {
        setMode('ai');
        addMessage({ role: 'assistant', content: resultMessage });
    };

    return (
        <div className="w-full h-full flex flex-col bg-white">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Idle — show welcome + quick reply buttons */}
                {mode === 'idle' && (
                    <WelcomeMessage onQuickReply={handleQuickReply} />
                )}

                {/* Booking flow — fully structured, no AI */}
                {mode === 'booking' && (
                    <BookingFlow
                        facilities={facilities}
                        csrfToken={csrfToken}
                        onComplete={handleBookingComplete}
                        onCancel={() => setMode('idle')}
                    />
                )}

                {/* AI chat mode */}
                {mode === 'ai' && (
                    <>
                        <MessageList messages={messages} messagesEndRef={messagesEndRef} />
                        {isLoading && <LoadingIndicator />}
                    </>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area — hidden during booking flow */}
            {mode !== 'booking' && (
                <ChatInput
                    value={input}
                    onChange={setInput}
                    onKeyPress={handleKeyPress}
                    onSend={handleSendMessage}
                    disabled={isLoading}
                />
            )}
        </div>
    );
}
>>>>>>> Stashed changes
