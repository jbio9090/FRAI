interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onKeyPress: (e: React.KeyboardEvent) => void;
    onSend: () => void;
    disabled: boolean;
}

export default function ChatInput({
    value,
    onChange,
    onKeyPress,
    onSend,
    disabled,
}: ChatInputProps) {
    return (
        <div className="border-t border-gray-200 bg-white p-6">
            <div className="flex gap-3">
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyPress={onKeyPress}
                    disabled={disabled}
                    placeholder="Type your message..."
                    rows={1}
                    className="flex-1 bg-white border border-gray-300 text-gray-900 placeholder-gray-500 rounded-lg px-4 py-3 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 disabled:opacity-50 resize-none"
                />
                <button
                    onClick={onSend}
                    disabled={disabled || !value.trim()}
                    className="bg-gray-400 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 uppercase text-sm tracking-wide"
                >
                    Send
                </button>
            </div>
        </div>
    );
}
