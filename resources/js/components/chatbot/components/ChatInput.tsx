interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onKeyPress: (e: React.KeyboardEvent) => void;
    onSend: () => void;
    disabled: boolean;
    placeholder?: string;
}

export default function ChatInput({
    value,
    onChange,
    onKeyPress,
    onSend,
    disabled,
    placeholder = 'Type your message...',
}: ChatInputProps) {
    return (
        <div className="border-t border-border bg-background p-6">
            <div className="flex gap-3">
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyPress={onKeyPress}
                    disabled={disabled}
                    placeholder={placeholder}
                    rows={1}
                    className="flex-1 bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg px-4 py-3 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50 resize-none"
                />
                <button
                    onClick={onSend}
                    disabled={disabled || !value.trim()}
                    className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold py-3 px-6 rounded-lg transition-all duration-200 uppercase text-sm tracking-wide"
                >
                    Send
                </button>
            </div>
        </div>
    );
}