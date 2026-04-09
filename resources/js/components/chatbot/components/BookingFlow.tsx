import { useState, useEffect } from 'react';
import { useBookingFlow } from '../hooks/useBookingFlow';
import DatePicker from './DatePicker';

interface BookingFlowProps {
    bookingFlow: ReturnType<typeof useBookingFlow>;
    onComplete: (message: string) => void;
    onCancel: () => void;
    attachedFiles?: Array<{ id: string; name: string }>;
    onAttachFile?: (files: FileList) => void;
    uploading?: boolean;
    uploadError?: string | null;
}

interface FlowMessage {
    from: 'bot' | 'user';
    text: string;
}

export default function BookingFlow({ bookingFlow, onComplete, onCancel, attachedFiles = [], onAttachFile, uploading = false, uploadError = null }: BookingFlowProps) {
    const { step, data, isSubmitting, submitResult, getStepConfig, handleInput, reset, update } = bookingFlow;
    const [textInput, setTextInput] = useState('');
    const [history, setHistory] = useState<FlowMessage[]>([]);

    const config = getStepConfig();

    useEffect(() => {
        update({ attachedFiles });
    }, [attachedFiles]);

    const pushHistory = (userText: string) => {
        setHistory(prev => [...prev, { from: 'user', text: userText }]);
    };

    const handleQuickReply = (value: string) => {
        if (step === 'files' && value === 'Attach files') {
            return;
        }
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTextSubmit();
        }
    };

    const handleAttachFilesClick = () => {
        if (onAttachFile) {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = '.jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
            input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) {
                    onAttachFile(files);
                    handleQuickReply('Continue without files');
                }
            };
            input.click();
        }
    };

    if (step === 'done' && submitResult) {
        return (
            <div className="flex gap-4 justify-start animate-in fade-in">
                <BotAvatar />
                <div className="max-w-[70%] px-5 py-3 rounded-lg border bg-muted border-border text-foreground">
                    <div className="text-xs uppercase font-mono text-muted-foreground mb-2 tracking-wide">
                        assistant
                    </div>
                    <p className={`text-sm font-medium ${submitResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {submitResult.message}
                    </p>
                    <div className="mt-3 flex gap-4">
                        {submitResult.success && (
                            <button
                                onClick={() => onComplete(submitResult.message)}
                                className="text-xs text-muted-foreground hover:text-foreground underline"
                            >
                                Continue to chat
                            </button>
                        )}
                        {!submitResult.success && submitResult.shouldRedirectToEdit && (
                            <button
                                onClick={() => bookingFlow.goToStep('edit_pick')}
                                className="text-xs text-muted-foreground hover:text-foreground underline"
                            >
                                Edit Request
                            </button>
                        )}
                        {!submitResult.success && !submitResult.shouldRedirectToEdit && (
                            <button
                                onClick={() => bookingFlow.goToStep('review')}
                                className="text-xs text-muted-foreground hover:text-foreground underline"
                            >
                                Try again
                            </button>
                        )}
                        <button
                            onClick={() => reset()}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                            {submitResult.success ? 'Submit another request' : 'Reset'}
                        </button>
                        <button
                            onClick={onCancel}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Conversation history */}
            {history.map((msg, i) => (
                <div
                    key={i}
                    className={`flex gap-4 animate-in fade-in ${
                        msg.from === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                >
                    {msg.from === 'bot' && <BotAvatar />}
                    <div className={`flex gap-3 max-w-[70%] ${msg.from === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        {msg.from === 'user' && (
                            <div className="h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 bg-muted text-muted-foreground">
                                U
                            </div>
                        )}
                        <div className={`px-5 py-3 rounded-lg border ${
                            msg.from === 'user'
                                ? 'bg-primary/5 border-border text-foreground'
                                : 'bg-muted border-border text-foreground'
                        }`}>
                            <div className="text-xs uppercase font-mono text-muted-foreground mb-2 tracking-wide">
                                {msg.from === 'user' ? 'user' : 'assistant'}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
                        </div>
                    </div>
                </div>
            ))}

            {/* Current step prompt */}
            {config.botMessage && (
                <div className="flex gap-4 justify-start animate-in fade-in">
                    <BotAvatar />
                    <div className="max-w-[70%] px-5 py-3 rounded-lg border bg-muted border-border text-foreground">
                        <div className="text-xs uppercase font-mono text-muted-foreground mb-2 tracking-wide">
                            assistant
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{config.botMessage}</div>

                        {config.quickReplies.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {config.quickReplies.map(option => (
                                    <button
                                        key={option}
                                        onClick={() => {
                                            if (step === 'files' && option === 'Attach files') {
                                                handleAttachFilesClick();
                                            } else {
                                                handleQuickReply(option);
                                            }
                                        }}
                                        disabled={isSubmitting || uploading}
                                        className="px-3 py-1.5 text-xs rounded-lg border
                                            border-border bg-background text-foreground
                                            hover:bg-muted hover:border-ring
                                            dark:border-white/20 dark:bg-transparent dark:text-white
                                            dark:hover:bg-white/10 dark:hover:border-white/60
                                            font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
                                    >
                                        {step === 'files' && option === 'Attach files' && attachedFiles.length > 0
                                            ? `${option} (${attachedFiles.length})`
                                            : option}
                                    </button>
                                ))}
                            </div>
                        )}

                        {config.showDatePicker && (
                            <DatePicker onSelect={(iso) => handleQuickReply(iso)} />
                        )}

                        {config.isTextInput && (
                            <div className="mt-3 flex gap-2">
                                <input
                                    type="text"
                                    value={textInput}
                                    onChange={e => setTextInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type your answer..."
                                    autoFocus
                                    className="flex-1 text-sm border border-input bg-background text-foreground placeholder:text-muted-foreground rounded-lg px-3 py-2 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                                />
                                <button
                                    onClick={handleTextSubmit}
                                    disabled={!textInput.trim()}
                                    className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed font-semibold uppercase tracking-wide transition-colors"
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
                    <div className="flex items-center space-x-2">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse"></div>
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse delay-200"></div>
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse delay-400"></div>
                    </div>
                </div>
            )}
        </div>
    );
}

function BotAvatar() {
    return (
        <div className="bg-muted h-10 w-10 rounded-lg flex items-center justify-center font-bold text-muted-foreground flex-shrink-0 text-sm">
            AI
        </div>
    );
}