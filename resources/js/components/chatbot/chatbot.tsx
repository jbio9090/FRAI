import { Braces, MessageCircle, RefreshCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCurrentPageContext } from '@/lib/useCurrentPageContext';
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
    const [isContextOpen, setIsContextOpen] = useState(false);
    const [contextOutput, setContextOutput] = useState<unknown>(null);
    const [contextError, setContextError] = useState<string | null>(null);
    const [isContextLoading, setIsContextLoading] = useState(false);
    const [debugRawResponse, setDebugRawResponse] = useState<string>('');
    const { messages, addMessage, setMessages, clearMessages } = useMessages();
    const { isLoading, sendMessage } = useChatAPI();
    const pageContext = useCurrentPageContext();
    const devMode = new URLSearchParams(window.location.search).has('devmode');

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

    const loadContext = async () => {
        setIsContextLoading(true);
        setContextError(null);

        try {
            const response = await fetch(route('api.page.context'), {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-Page-URL': window.location.href,
                },
                credentials: 'same-origin',
            });
            const payload = (await response.json()) as { context?: unknown; message?: string };

            if (!response.ok) {
                throw new Error(payload.message ?? `Unable to load context (${response.status}).`);
            }

            setContextOutput(payload.context ?? payload);
        } catch (err) {
            setContextError(err instanceof Error ? err.message : 'Unable to load page context.');
        } finally {
            setIsContextLoading(false);
        }
    };

    const sanitizeStreamingContent = (value: string): string => {
        let output = '';
        let buffer = value;
        let inThinking = false;

        while (buffer.length > 0) {
            if (!inThinking) {
                const openMatch = buffer.match(/<think(?:ing)?>/i);
                if (!openMatch) {
                    output += buffer;
                    break;
                }

                const openIndex = buffer.indexOf(openMatch[0]);
                output += buffer.slice(0, openIndex);
                buffer = buffer.slice(openIndex + openMatch[0].length);
                inThinking = true;
            } else {
                const closeMatch = buffer.match(/<\/think(?:ing)?>/i);
                if (!closeMatch) {
                    buffer = '';
                    break;
                }

                const closeIndex = buffer.indexOf(closeMatch[0]);
                buffer = buffer.slice(closeIndex + closeMatch[0].length);
                inThinking = false;
            }
        }

        let cleaned = output;
        cleaned = cleaned.replace(/<\/?think(?:ing)?>/gi, ' ');
        cleaned = cleaned.replace(/(?:^|\n)\s*here(?:['’]s)?\s*(?:a\s*)?(?:thinking|reasoning|analysis|thought(?:\s+process)?)\s*(?:process)?\s*[:.-]?\s*/gi, '\n');
        cleaned = cleaned.replace(/(?:^|\n)\s*(?:step\s*\d+|analysis|reasoning|thought\s+process)\s*[:.-]?\s*/gi, '');
        cleaned = cleaned.replace(/(?:^|\n)\s*(?:\d+\.|\d+\))\s*/g, '');
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/\s{2,}/g, ' ').trim();

        return cleaned;
    };

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
        if (devMode) {
            setDebugRawResponse('');
        }

        try {
            await sendMessage(queuedMessages, undefined, undefined, false, pageContext, (token) => {
                streamingContent += token;
                if (devMode) {
                    setDebugRawResponse((previous) => previous + token);
                }

                const visibleContent = sanitizeStreamingContent(streamingContent);
                setMessages((previous) => {
                    if (previous.length === 0) {
                        return previous;
                    }

                    const updated = [...previous];
                    const last = updated[updated.length - 1];
                    updated[updated.length - 1] = {
                        ...last,
                        content: visibleContent,
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
            {devMode && isContextOpen ? (
                <section className="flex h-[min(560px,calc(100vh-8rem))] w-[min(560px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-amber-300 bg-slate-950 text-slate-100 shadow-2xl">
                    <header className="flex items-center justify-between gap-3 border-b border-amber-300/30 bg-amber-300/10 px-4 py-3">
                        <div>
                            <p className="text-xs font-semibold tracking-[0.2em] text-amber-300 uppercase">Developer mode</p>
                            <h2 className="text-sm font-semibold">Current page context</h2>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => void loadContext()}
                                disabled={isContextLoading}
                                aria-label="Refresh page context"
                                className="rounded-full p-1.5 hover:bg-white/10 disabled:opacity-50"
                            >
                                <RefreshCw className={`h-4 w-4 ${isContextLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsContextOpen(false)}
                                aria-label="Close context viewer"
                                className="rounded-full p-1.5 hover:bg-white/10"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </header>
                    <div className="min-h-0 flex-1 overflow-auto p-4">
                        <div className="mb-4">
                            <h3 className="mb-2 text-xs font-semibold tracking-[0.2em] text-amber-300 uppercase">Page context</h3>
                            <pre className="rounded-md border border-amber-300/20 bg-black/20 p-3 text-xs leading-relaxed break-words whitespace-pre-wrap">
                                {isContextLoading ? 'Loading context…' : (contextError ?? JSON.stringify(contextOutput, null, 2))}
                            </pre>
                        </div>
                        <div>
                            <h3 className="mb-2 text-xs font-semibold tracking-[0.2em] text-amber-300 uppercase">Raw model output</h3>
                            <pre className="rounded-md border border-amber-300/20 bg-black/20 p-3 text-xs leading-relaxed break-words whitespace-pre-wrap">
                                {debugRawResponse || 'No raw model output captured yet.'}
                            </pre>
                        </div>
                    </div>
                </section>
            ) : null}
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
            {devMode ? (
                <button
                    type="button"
                    onClick={() => {
                        setIsContextOpen((open) => !open);
                        if (!isContextOpen && contextOutput === null) void loadContext();
                    }}
                    aria-label="Open page context developer viewer"
                    aria-expanded={isContextOpen}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-lg ring-4 ring-amber-400/20 transition hover:scale-105 hover:bg-amber-300 focus-visible:ring-4 focus-visible:ring-amber-300/40 focus-visible:outline-none"
                >
                    <Braces className="h-5 w-5" />
                </button>
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
