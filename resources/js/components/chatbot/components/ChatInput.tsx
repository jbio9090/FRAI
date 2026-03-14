import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

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
        <div className="border-t border-border p-6">
            <div className="flex gap-3">
                <Textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyPress={onKeyPress}
                    disabled={disabled}
                    placeholder="Type your message..."
                    rows={1}
                    className="flex-1 resize-none bg-background text-foreground placeholder:text-muted-foreground"
                />
                <Button
                    onClick={onSend}
                    disabled={disabled || !value.trim()}
                    variant="secondary"
                    className="uppercase text-sm tracking-wide font-bold px-6"
                >
                    Send
                </Button>
            </div>
        </div>
    );
}