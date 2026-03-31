import React, { useRef, useEffect, useState } from 'react';
import { Message, CreateRequestPayload } from './types';
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
    const [pendingPayload, setPendingPayload] = useState<CreateRequestPayload | null>(null);

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
            let capturedJson = '';

            await sendMessage(
                allMessages,
                currentCount,
                contextNote,

                // onToken — append each token to the last message in state, but skip JSON
                (token) => {
                    accumulatedContent += token;

                    // Check if we've captured a complete JSON object
                    const jsonMatch = accumulatedContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch && !capturedJson) {
                        capturedJson = jsonMatch[0];
                        // Remove JSON from display content
                        accumulatedContent = accumulatedContent.replace(capturedJson, '').trimEnd();
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

                // onBookingPayload — store payload for confirmation, don't auto-submit
                async (json) => {
                    try {
                        console.log('Received booking payload (raw):', json);
                        // Handle both string and already-parsed objects
                        const payload = typeof json === 'string' 
                            ? JSON.parse(json) as CreateRequestPayload 
                            : json as CreateRequestPayload;
                        console.log('Parsed booking payload:', payload);
                        if (payload.title && payload.facility_bookings) {
                            setPendingPayload(payload);
                            console.log('Set pending payload, showing confirmation');
                            // Show confirmation prompt with summary
                            const summary = buildRequestSummary(payload);
                            addMessage({
                                role: 'assistant',
                                content: summary,
                            });
                        } else {
                            console.log('Payload missing required fields:', { title: payload.title, bookings: payload.facility_bookings });
                        }
                    } catch (err) {
                        console.error('Invalid booking payload:', err);
                        console.error('Raw JSON was:', json);
                    }
                },
            );

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
            addMessage({ role: 'assistant', content: `Error: ${errorMsg}` });
        }
    };

    const buildRequestSummary = (payload: CreateRequestPayload): string => {
        const bookings = payload.facility_bookings.map((b, i) => {
            const facility = facilities.find(f => f.id === b.facility_id);
            const facilityName = facility?.name || `Facility #${b.facility_id}`;
            const equipment = b.equipment?.map(e => {
                return `${e.quantity_needed}x equipment`;
            }).join(', ') || 'None';
            return `${i + 1}. ${facilityName} on ${b.date} from ${b.time_start} to ${b.time_end} (Equipment: ${equipment})`;
        }).join('\n');

        return `📋 **Booking Summary**\n\n` +
            `**Title:** ${payload.title}\n` +
            `**Description:** ${payload.description || 'N/A'}\n` +
            `**Priority:** ${payload.priority_level === 2 ? 'High (Government/Authority)' : payload.priority_level === 1 ? 'School Event' : 'Normal'}\n\n` +
            `**Bookings:**\n${bookings}\n\n` +
            `Reply "confirm" to submit this request, or "cancel" to discard it.`;
    };

    const handleConfirmRequest = async () => {
        if (!pendingPayload) return;
        const payload = pendingPayload;
        setPendingPayload(null);

        addMessage({ role: 'user', content: 'Confirm' });

        try {
            const result = await submitRequest(payload);
            if (result) {
                addMessage({
                    role: 'assistant',
                    content: `✅ Request #${result.request_id} has been created successfully!`,
                });
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to create request';
            addMessage({ role: 'assistant', content: `❌ Failed to create request: ${errorMsg}` });
        }
    };

    const handleCancelRequest = () => {
        setPendingPayload(null);
        addMessage({ role: 'user', content: 'Cancel' });
        addMessage({
            role: 'assistant',
            content: 'Request cancelled. Is there anything else I can help you with?',
        });
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

        // Check if user is responding to a confirmation prompt
        if (pendingPayload) {
            const lowerMessage = message.toLowerCase();
            if (lowerMessage === 'confirm' || lowerMessage === 'yes' || lowerMessage === 'proceed' || lowerMessage === 'submit') {
                await handleConfirmRequest();
                return;
            }
            if (lowerMessage === 'cancel' || lowerMessage === 'no' || lowerMessage === 'discard') {
                handleCancelRequest();
                return;
            }
        }

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
                        <MessageList 
                            messages={messages} 
                            messagesEndRef={messagesEndRef} 
                            showConfirmationButtons={!!pendingPayload}
                            onConfirm={handleConfirmRequest}
                            onCancel={handleCancelRequest}
                        />
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