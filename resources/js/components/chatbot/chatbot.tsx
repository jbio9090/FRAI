import { useEffect, useRef, useState } from 'react';
import ChatInput from './components/ChatInput';
import MessageList from './components/MessageList';
import { useChatAPI } from './hooks/useChatAPI';
import { useMessages } from './hooks/useMessages';
import { getCsrfToken } from './utils/csrfToken';

export default function Chatbot() {
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [input, setInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const { messages, addMessage, setMessages, clearMessages } = useMessages();
    const { isLoading, sendMessage } = useChatAPI();

    useEffect(() => {
        const loadSession = async () => {
            try {
                const response = await fetch(route('chat.session.get'), {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': getCsrfToken(),
                    },
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    return;
                }

                const payload = (await response.json()) as { messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> };
                if (Array.isArray(payload.messages) && payload.messages.length > 0) {
                    setMessages(payload.messages);
                }
            } catch (err) {
                console.error('Unable to load chat session', err);
            } finally {
                setIsInitializing(false);
            }
        };

        void loadSession();
    }, [setMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) {
            return;
        }

        setError(null);

        const userMessage = { role: 'user' as const, content: trimmed };
        const queuedMessages = [...messages, userMessage];

        addMessage(userMessage);
        setInput('');
        addMessage({ role: 'assistant', content: '' });

        let streamingContent = '';

        try {
            await sendMessage(
                queuedMessages,
                undefined,
                undefined,
                false,
                (token) => {
                    streamingContent += token;
                    setMessages((previous) => {
                        if (previous.length === 0) {
                            return previous;
                        }

                        const updated = [...previous];
                        const last = updated[updated.length - 1];
                        updated[updated.length - 1] = {
                            ...last,
                            content: streamingContent,
                        };

                        return updated;
                    });
                },
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to send message.';
            setError(message);
            setMessages((previous) => {
                if (previous.length === 0) {
                    return previous;
                }

                const updated = [...previous];
                updated[updated.length - 1] = {
                    role: 'assistant',
                    content: message,
                };

                return updated;
            });
        }
    };

    const handleClearChat = async () => {
        try {
            await fetch(route('chat.session.clear'), {
                method: 'DELETE',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'same-origin',
            });
        } catch (err) {
            console.error('Unable to clear chat session', err);
        }

        clearMessages();
        setError(null);
        setInput('');
    };

    return (
        <div className="flex min-h-[70vh] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">AI Assistant</p>
                    <h1 className="text-lg font-semibold text-foreground">Chat</h1>
                </div>

                <button
                    type="button"
                    onClick={() => void handleClearChat()}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
                >
                    New chat
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                {messages.length === 0 && !isInitializing ? (
                    <div className="flex h-full items-center justify-center">
                        <div className="max-w-md rounded-xl border border-dashed border-border bg-muted/50 p-6 text-center text-sm text-muted-foreground">
                            Ask anything and the assistant will help.
                        </div>
                    </div>
                ) : (
                    <MessageList messages={messages} messagesEndRef={messagesEndRef} />
                )}
            </div>

            <div className="border-t border-border bg-background px-3 py-3 sm:px-4">
                {error ? (
                    <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                <ChatInput
                    value={input}
                    onChange={setInput}
                    onKeyPress={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void handleSend();
                        }
                    }}
                    onSend={() => void handleSend()}
                    disabled={isLoading || isInitializing}
                    placeholder="Type your message..."
                />
            </div>
        </div>
    );
}
