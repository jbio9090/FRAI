import React, { useRef, useEffect, useState } from 'react';
import { Message } from './types';
import { useMessages } from './hooks/useMessages';
import { useParticipantCount } from './hooks/useParticipantCount';
import { useChatAPI } from './hooks/useChatAPI';
import { QuickReply } from './components/QuickReplies';
import { Facility, useBookingFlow } from './hooks/useBookingFlow';
import WelcomeMessage from './components/WelcomeMessage';
import MessageList from './components/MessageList';
import LoadingIndicator from './components/LoadingIndicator';
import ChatInput from './components/ChatInput';
import BookingFlow from './components/BookingFlow';
import { getCsrfToken } from './utils/csrfToken';

type ChatMode = 'idle' | 'booking' | 'ai';

export default function Chatbot() {
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [input, setInput] = React.useState('');
    const [mode, setMode] = useState<ChatMode>('idle');
    const [facilities, setFacilities] = useState<Facility[]>([]);

    const { messages, addMessage, addMessages, setMessages, getMessagesText } = useMessages();
    const { isLoading, sendMessage, submitRequest } = useChatAPI();
    const { extractAndSet, getCurrentCount } = useParticipantCount();
    const bookingFlow = useBookingFlow(facilities);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, mode]);

    useEffect(() => {
        fetch(route('chat.facilities'), {
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        })
            .then(res => res.json())
            .then(json => { if (json.data) setFacilities(json.data); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetch(route('chat.session.get'), {
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': getCsrfToken(),
            },
            credentials: 'same-origin',
        })
            .then(res => res.json())
            .then(json => {
                if (json.messages && json.messages.length > 0) {
                    addMessages(json.messages); 
                    setMode('ai');
                }
            })
            .catch(() => {});
    }, []);

    const processAndSend = async (userMessage: Message, contextNote?: string) => {
        addMessage(userMessage);

        // Add an empty assistant message as a placeholder for incoming tokens
        addMessage({ role: 'assistant', content: '' });

        try {
            extractAndSet(userMessage.content);

            const allMessages: Message[] = [
                ...(contextNote ? [{ role: 'system' as const, content: contextNote }] : []),
                ...messages,
                userMessage,
            ];

            const currentCount = getCurrentCount(getMessagesText()) ?? undefined;

            let accumulatedContent = '';

            await sendMessage(
                allMessages,
                currentCount,
                contextNote,

                // onToken — append each token to the last message in state
                (token) => {
                    accumulatedContent += token;

                    const jsonMatch = accumulatedContent.match(/\{[\s\S]*\}/);

                    if (jsonMatch) {
                        const jsonString = jsonMatch[0];

                        onBookingPayload?.(jsonString);

                        accumulatedContent = accumulatedContent.replace(jsonString, '');
                    }

                    setMessages(prev => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];

                        const displayContent = accumulatedContent.trimEnd();

                        updated[updated.length - 1] = {
                            role: 'assistant',
                            content: displayContent || last.content,
                        };

                        return updated;
                    });
                },

                // onBookingPayload — silently submit JSON without showing it to the user
                async (json) => {
                    try {
                        const payload = JSON.parse(json);
                        if (payload.title && payload.facility_bookings) {
                            const result = await submitRequest(payload);
                            if (result) {
                                addMessage({
                                    role: 'assistant',
                                    content: `Request #${result.request_id} has been created successfully.`,
                                });
                            }
                        }
                    } catch (err) {
                        const errorMsg = err instanceof Error ? err.message : 'Failed to create request';
                        addMessage({ role: 'assistant', content: `Failed to create request: ${errorMsg}` });
                    }
                },
            );

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
            addMessage({ role: 'assistant', content: `Error: ${errorMsg}` });
        }
    };

    const handleQuickReply = (option: QuickReply) => {
        if (option.id === 'book_facility') {
            setMode('booking');
            return;
        }
        setMode('ai');
        const isBookingActive = bookingFlow.step !== 'title' && bookingFlow.step !== 'done';
        const context = isBookingActive ? bookingFlow.buildContextSummary() : option.context;
        processAndSend({ role: 'user', content: option.message }, context);
    };

    const handleSendMessage = async () => {
        const message = input.trim();
        if (!message || isLoading) return;
        setInput('');

        const isBookingActive = bookingFlow.step !== 'title' && bookingFlow.step !== 'done';

        if (isBookingActive) {
            const context = bookingFlow.buildContextSummary();
            setMode('ai');
            await processAndSend({ role: 'user', content: message }, context);
            return;
        }

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
        addMessage({ role: 'assistant', content: resultMessage });
        setMode('ai');
    };

    return (
        <div className="w-full h-full flex flex-col bg-background">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {mode === 'idle' && (
                    <WelcomeMessage onQuickReply={handleQuickReply} />
                )}

                {mode === 'booking' && (
                    <BookingFlow
                        bookingFlow={bookingFlow}
                        onComplete={handleBookingComplete}
                        onCancel={() => setMode('idle')}
                    />
                )}

                {mode === 'ai' && (
                    <>
                        <MessageList messages={messages} messagesEndRef={messagesEndRef} />
                        {isLoading && <LoadingIndicator />}
                    </>
                )}

                <div ref={messagesEndRef} />
            </div>

            <ChatInput
                value={input}
                onChange={setInput}
                onKeyPress={handleKeyPress}
                onSend={handleSendMessage}
                disabled={isLoading}
                placeholder={
                    mode === 'booking'
                        ? 'Type here to ask a question or switch to AI chat...'
                        : 'Type your message...'
                }
            />
        </div>
    );
}