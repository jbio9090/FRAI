import { Message } from '../types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface MessageListProps {
    messages: Message[];
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    showConfirmationButtons?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
    equipmentSelectorActive?: boolean;
}

const looksLikeEquipmentListMessage = (content: string): boolean => {
    const normalized = content.toLowerCase();
    const hasEquipmentKeywords =
        normalized.includes('equipment') ||
        normalized.includes('facility id') ||
        normalized.includes('quantity') ||
        normalized.includes('id:');

    if (!hasEquipmentKeywords) {
        return false;
    }

    const hasListFormatting =
        /(^|\n)\s*[-*]\s+/m.test(content) ||
        /(^|\n)\s*\d+\.\s+/m.test(content) ||
        content.includes(', ');

    return hasListFormatting;
};

const getDisplayContent = (message: Message, equipmentSelectorActive: boolean): string => {
    if (message.role !== 'assistant') {
        return message.content;
    }

    if (!equipmentSelectorActive) {
        return message.content;
    }

    if (!looksLikeEquipmentListMessage(message.content)) {
        return message.content;
    }

    return 'Equipment options are available in the selector below.';
};

export default function MessageList({ 
    messages, 
    messagesEndRef, 
    showConfirmationButtons = false,
    onConfirm,
    onCancel,
    equipmentSelectorActive = false,
}: MessageListProps) {
    return (
        <>
            {messages.map((msg, index) => (
                <div
                    key={index}
                    className={`flex gap-4 animate-in fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                >
                    <div
                        className={`flex gap-3 max-w-[70%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                            }`}
                    >
                        {/* Avatar */}
                        <Avatar className="h-10 w-10 rounded-lg flex-shrink-0">
                            <AvatarFallback
                                className={`rounded-lg text-sm font-bold ${msg.role === 'user'
                                        ? 'bg-muted text-muted-foreground'
                                        : 'bg-secondary text-secondary-foreground'
                                    }`}
                            >
                                {msg.role === 'user' ? 'U' : 'AI'}
                            </AvatarFallback>
                        </Avatar>

                        {/* Message Content */}
                        <Card
                            className={`border ${msg.role === 'user'
                                    ? 'bg-primary/5 border-border'
                                    : 'bg-muted-background border-border'
                                }`}
                        >
                            <CardContent className="px-5 py-3">
                                <Badge
                                    variant="outline"
                                    className="text-xs font-mono text-muted-foreground mb-2 tracking-wide uppercase border-none p-0 h-auto"
                                >
                                    {msg.role}
                                </Badge>
                                <div className="text-sm whitespace-pre-wrap break-words text-card-foreground">
                                    {getDisplayContent(msg, equipmentSelectorActive)}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ))}
            
            {/* Confirmation Buttons */}
            {showConfirmationButtons && onConfirm && onCancel && (
                <div className="flex gap-3 justify-center mt-4 animate-in fade-in slide-in-from-bottom-2">
                    <Button 
                        onClick={onConfirm}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        ✅ Confirm & Submit
                    </Button>
                    <Button 
                        onClick={onCancel}
                        variant="outline"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                        ❌ Cancel
                    </Button>
                </div>
            )}
            
            <div ref={messagesEndRef} />
        </>
    );
}
