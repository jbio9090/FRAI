import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
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
    const [isOpen, setIsOpen] = useState(false);
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
            await sendMessage(queuedMessages, undefined, undefined, false, (token) => {
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
            });
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
        <div className="fixed right-4 bottom-4 z-[110] flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
            {isOpen ? (
                <section
                    aria-label="FRAI AI Assistant"
                    className="flex h-[min(680px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-black/5"
                >
                    <header className="flex items-center justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground">
                        <div>
                            <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-75">FRAI assistant</p>
                            <h1 className="text-base font-semibold">How can I help?</h1>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => void handleClearChat()}
                                className="rounded-md px-2 py-1 text-xs font-medium transition hover:bg-primary-foreground/10"
                            >
                                New chat
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                aria-label="Close chatbot"
                                className="rounded-full p-1.5 transition hover:bg-primary-foreground/10"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto bg-background p-3 sm:p-4">
                        {messages.length === 0 && !isInitializing ? (
                            <div className="flex h-full items-center justify-center">
                                <div className="max-w-xs rounded-xl border border-dashed border-border bg-muted/50 p-5 text-center text-sm text-muted-foreground">
                                    Ask about facilities, equipment, requests, or rules.
                                </div>
                            </div>
                        ) : (
                            <MessageList messages={messages} messagesEndRef={messagesEndRef} />
                        )}
                        {isLoading ? (
                            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
                                <span className="flex gap-1">
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
                                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                                </span>
                                Thinking through your request…
                            </div>
                        ) : null}
                    </div>

                    <div className="border-t border-border bg-background px-3 py-3 sm:px-4">
                        {error ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

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
                </section>
            ) : null}
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-label={isOpen ? 'Close chatbot' : 'Open chatbot'}
                aria-expanded={isOpen}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl ring-4 ring-primary/15 transition hover:scale-105 hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-primary/30 focus-visible:outline-none"
            >
                {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
            </button>
        </div>
    );
}
