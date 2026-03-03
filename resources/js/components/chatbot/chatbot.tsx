import React, { useRef, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { Message } from './types';
import { useMessages } from './hooks/useMessages';
import { useParticipantCount } from './hooks/useParticipantCount';
import { useChatAPI } from './hooks/useChatAPI';
import WelcomeMessage from './components/WelcomeMessage';
import MessageList from './components/MessageList';
import LoadingIndicator from './components/LoadingIndicator';
import ChatInput from './components/ChatInput';

export default function Chatbot() {
    const page = usePage();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = React.useState('');

    const { messages, addMessage, getMessagesText } = useMessages();
    const { participantCount, extractAndSet, getCurrentCount } = useParticipantCount();
    const csrfToken = (page.props as any).csrf_token || '';
    const { isLoading, error, sendMessage, detectAndSubmitRequest } = useChatAPI(csrfToken);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        const message = input.trim();
        if (!message || isLoading) return;

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
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-white">
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
