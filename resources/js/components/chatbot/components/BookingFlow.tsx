import { useState, useEffect } from 'react';
import { useBookingFlow } from '../hooks/useBookingFlow';
import DatePicker from './DatePicker';
import TypingMessage from './TypingMessage';

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
    const { step, data, isSubmitting, submitResult, canGoBack, getCurrentEquipmentMaxQuantity, getStepConfig, handleInput, goBack, reset, update } = bookingFlow;
    const [textInput, setTextInput] = useState('');
    const [history, setHistory] = useState<FlowMessage[]>([]);
    const [isTypingPrompt, setIsTypingPrompt] = useState(true);

    const config = getStepConfig();
    const promptKey = `${step}:${config.botMessage}`;

    useEffect(() => {
        update({ attachedFiles });
    }, [attachedFiles]);

    useEffect(() => {
        setIsTypingPrompt(true);
    }, [promptKey]);

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
        if (step === 'equipment_quantity') {
            const numericValue = Number.parseInt(val, 10);
            const maxQuantity = getCurrentEquipmentMaxQuantity();

            if (Number.isNaN(numericValue) || numericValue < 1) {
                return;
            }

            pushHistory(String(Math.min(numericValue, maxQuantity)));
            setTextInput('');
            handleInput(String(Math.min(numericValue, maxQuantity)));
            return;
        }

        pushHistory(val);
        setTextInput('');
        handleInput(val);
    };

    const handleReturn = () => {
        setTextInput('');
        setHistory(prev => prev.slice(0, -1));
        goBack();
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
            <div className="flex justify-start gap-2 animate-in fade-in sm:gap-3 lg:gap-4">
                <BotAvatar />
                <div className="max-w-[92%] rounded-lg border border-border bg-muted px-3 py-2.5 text-foreground sm:max-w-[82%] sm:px-4 sm:py-3 lg:max-w-[72%] lg:px-5">
                    <div className="text-xs uppercase font-mono text-muted-foreground mb-2 tracking-wide">
                        assistant
                    </div>
                    <p className={`text-sm font-medium ${submitResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {submitResult.message}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
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
                    className={`flex gap-2 animate-in fade-in sm:gap-3 lg:gap-4 ${
                        msg.from === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                >
                    {msg.from === 'bot' && <BotAvatar />}
                    <div className={`flex max-w-[92%] gap-2 sm:max-w-[82%] sm:gap-3 lg:max-w-[72%] ${msg.from === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        {msg.from === 'user' && (
                            <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold flex-shrink-0 sm:h-10 sm:w-10 sm:text-sm">
                                U
                            </div>
                        )}
                        <div className={`rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5 ${
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
                <div className="flex justify-start gap-2 animate-in fade-in sm:gap-3 lg:gap-4">
                    <BotAvatar />
                    <div className="max-w-[92%] rounded-lg border border-border bg-muted px-3 py-2.5 text-foreground sm:max-w-[82%] sm:px-4 sm:py-3 lg:max-w-[72%] lg:px-5">
                        <div className="text-xs uppercase font-mono text-muted-foreground mb-2 tracking-wide">
                            assistant
                        </div>
                        <TypingMessage
                            text={config.botMessage}
                            messageKey={promptKey}
                            onComplete={() => setIsTypingPrompt(false)}
                        />

                        {!isTypingPrompt && config.quickReplies.length > 0 && (
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

                        {!isTypingPrompt && config.showDatePicker && (
                            <DatePicker onSelect={(iso) => handleQuickReply(iso)} minAdvanceDays={2} />
                        )}

                        {!isTypingPrompt && config.isTextInput && (
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <input
                                    type={step === 'equipment_quantity' ? 'number' : 'text'}
                                    value={textInput}
                                    onChange={e => setTextInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    min={step === 'equipment_quantity' ? 1 : undefined}
                                    max={step === 'equipment_quantity' ? getCurrentEquipmentMaxQuantity() : undefined}
                                    placeholder={step === 'equipment_quantity'
                                        ? `Enter a quantity up to ${getCurrentEquipmentMaxQuantity()}`
                                        : 'Type your answer...'}
                                    autoFocus
                                    className="flex-1 text-sm border border-input bg-background text-foreground placeholder:text-muted-foreground rounded-lg px-3 py-2 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                                />
                                <button
                                    onClick={handleTextSubmit}
                                    disabled={!textInput.trim()}
                                    className="w-full rounded-lg bg-primary px-4 py-2 text-xs font-semibold tracking-wide text-primary-foreground uppercase transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                                >
                                    Next
                                </button>
                            </div>
                        )}

                        {!isTypingPrompt && canGoBack && (
                            <div className="mt-3">
                                <button
                                    onClick={handleReturn}
                                    className="text-xs text-muted-foreground hover:text-foreground underline"
                                >
                                    Return
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isSubmitting && (
                <div className="flex justify-start gap-2 sm:gap-3 lg:gap-4">
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
        <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold flex-shrink-0 sm:h-10 sm:w-10 sm:text-sm">
            AI
        </div>
    );
}
