import React, { useRef, useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { useMessages } from './hooks/useMessages';
import { useParticipantCount } from './hooks/useParticipantCount';
import { useChatAPI } from './hooks/useChatAPI';
import { Message } from './types';
import { QuickReply } from './components/QuickReplies';
import { Facility } from './hooks/useBookingFlow';
import WelcomeMessage from './components/WelcomeMessage';
import MessageList from './components/MessageList';
import LoadingIndicator from './components/LoadingIndicator';
import ChatInput from './components/ChatInput';
import BookingFlow from './components/BookingFlow';

type ChatMode = 'idle' | 'booking' | 'ai';

export default function Chatbot() {
    const page = usePage();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = React.useState('');
    const [mode, setMode] = useState<ChatMode>('idle');
    const [facilities, setFacilities] = useState<Facility[]>([]);

    const { messages, addMessage, getMessagesText } = useMessages();
    const { extractAndSet, getCurrentCount } = useParticipantCount();
    const csrfToken = (page.props as any).csrf_token || '';
    const { isLoading, sendMessage } = useChatAPI(csrfToken);
    const [pendingPayload, setPendingPayload] = useState(null);

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
            .catch(() => { });
    }, []);

    const processAndSend = async (userMessage: Message, contextNote?: string) => {
        addMessage(userMessage);

        // Check if user is confirming a pending request
        const isConfirming = pendingPayload && /\b(yes|proceed|confirm|ok)\b/i.test(userMessage.content);

        if (isConfirming && pendingPayload) {
            try {
                const result = await submitRequest(pendingPayload);
                setPendingPayload(null);
                addMessage({ role: 'assistant', content: `✓ Request #${result.request_id} created successfully!` });
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Failed to create request';
                addMessage({ role: 'assistant', content: `✗ Failed to create request: ${errorMsg}` });
            }
            return; // don't send to AI again
        }

        try {
            extractAndSet(userMessage.content);

            const allMessages: Message[] = [
                ...(contextNote ? [{ role: 'system' as const, content: `QUICK REPLY CONTEXT: ${contextNote}` }] : []),
                ...messages,
                userMessage,
            ];

            const currentCount = getCurrentCount(getMessagesText()) ?? undefined;
            const responseContent = await sendMessage(allMessages, currentCount);
            addMessage({ role: 'assistant', content: responseContent });

            // Detect JSON payload in AI response and stage it — don't submit yet
            const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const payload = JSON.parse(jsonMatch[0]);
                    if (payload.title && payload.facility_bookings && Array.isArray(payload.facility_bookings)) {
                        setPendingPayload(payload); // stage for confirmation
                    }
                } catch (_) { 
                    console.log("eyy");
                }
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

    const handleSendMessage = async () => {
        const message = input.trim();
        if (!message || isLoading) return;
        setInput('');
        if (mode === 'idle') setMode('ai');
        await processAndSend({ role: 'user', content: message });
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

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
