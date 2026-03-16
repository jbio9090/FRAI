import { useState } from 'react';
import { useBookingFlow, Facility } from '../hooks/useBookingFlow';
import DatePicker from './DatePicker';

interface BookingFlowProps {
    facilities: Facility[];
    csrfToken: string;
    onComplete: (message: string) => void;
    onCancel: () => void;
}

interface FlowMessage {
    from: 'bot' | 'user';
    text: string;
}

export default function BookingFlow({ facilities, csrfToken, onComplete, onCancel }: BookingFlowProps) {
    const { step, isSubmitting, submitResult, getStepConfig, handleInput, reset } = useBookingFlow(facilities, csrfToken);
    const [textInput, setTextInput] = useState('');
    const [history, setHistory] = useState<FlowMessage[]>([]);

    const config = getStepConfig();

    const pushHistory = (userText: string, botNext?: string) => {
        setHistory(prev => {
            const next: FlowMessage[] = [...prev, { from: 'user', text: userText }];
            return next;
        });
    };

    const handleQuickReply = (value: string) => {
        pushHistory(value);
        handleInput(value);
    };

    const handleTextSubmit = () => {
        const val = textInput.trim();
        if (!val) return;
        pushHistory(val);
        setTextInput('');
        handleInput(val);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTextSubmit();
        }
    };

    // Done state
    if (step === 'done' && submitResult) {
        return (
            <div className="flex gap-4 justify-start animate-in fade-in">
                <BotAvatar />
                <div className="max-w-[70%] px-5 py-3 rounded-lg border bg-gray-50 border-gray-200 text-gray-900">
                    <div className="text-xs uppercase font-mono text-gray-500 mb-2 tracking-wide">assistant</div>
                    <p className={`text-sm font-medium ${submitResult.success ? 'text-green-700' : 'text-red-600'}`}>
                        {submitResult.message}
                    </p>
                    {submitResult.success && (
                        <button
                            onClick={() => { reset(); onComplete(submitResult.message); }}
                            className="mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                            Start a new request
                        </button>
                    )}
                    {!submitResult.success && (
                        <button
                            onClick={reset}
                            className="mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                            Try again
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Conversation history */}
            {history.map((msg, i) => (
                <div key={i} className={`flex gap-4 animate-in fade-in ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.from === 'bot' ? <BotAvatar /> : null}
                    <div className={`flex gap-3 max-w-[70%] ${msg.from === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        {msg.from === 'user' && (
                            <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-gray-400">
                                U
                            </div>
                        )}
                        <div className={`px-5 py-3 rounded-lg border ${msg.from === 'user' ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                            <div className="text-xs uppercase font-mono text-gray-500 mb-2 tracking-wide">
                                {msg.from === 'user' ? 'user' : 'assistant'}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
                        </div>
                    </div>
                </div>
            ))}

            {/* Current bot prompt */}
            {config.botMessage && (
                <div className="flex gap-4 justify-start animate-in fade-in">
                    <BotAvatar />
                    <div className="max-w-[70%] px-5 py-3 rounded-lg border bg-gray-50 border-gray-200 text-gray-900">
                        <div className="text-xs uppercase font-mono text-gray-500 mb-2 tracking-wide">assistant</div>
                        <div className="text-sm whitespace-pre-wrap">{config.botMessage}</div>

                        {/* Quick reply buttons */}
                        {config.quickReplies.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {config.quickReplies.map(option => (
                                    <button
                                        key={option}
                                        onClick={() => handleQuickReply(option)}
                                        disabled={isSubmitting}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 text-gray-700 font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Date picker */}
                        {config.showDatePicker && (
                            <DatePicker onSelect={(iso) => handleQuickReply(iso)} />
                        )}

                        {/* Text input for free-text steps */}
                        {config.isTextInput && (
                            <div className="mt-3 flex gap-2">
                                <input
                                    type="text"
                                    value={textInput}
                                    onChange={e => setTextInput(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    placeholder="Type your answer..."
                                    autoFocus
                                    className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
                                />
                                <button
                                    onClick={handleTextSubmit}
                                    disabled={!textInput.trim()}
                                    className="px-4 py-2 text-xs bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold uppercase tracking-wide transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isSubmitting && (
                <div className="flex gap-4 justify-start">
                    <BotAvatar />
                    <div className="space-x-2 flex items-center">
                        <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse"></div>
                        <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse delay-200"></div>
                        <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse delay-400"></div>
                    </div>
                </div>
            )}
        </div>
    );
}

function BotAvatar() {
    return (
        <div className="bg-gray-300 h-10 w-10 rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0 text-sm">
            AI
        </div>
    );
}