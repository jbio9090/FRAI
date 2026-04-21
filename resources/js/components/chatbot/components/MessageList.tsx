import { Message } from '../types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import TypingText from './TypingText';

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

const isGuidedAssistantMessage = (message: Message): boolean => {
    if (message.role !== 'assistant') {
        return false;
    }

    const content = message.content.toLowerCase();
    return (
        content.includes('guided booking is active') ||
        content.includes('guided availability check is active') ||
        content.includes('guided flow cancelled') ||
        content.includes('guided flow is active') ||
        content.includes('quick replies below') ||
        content.includes('please choose the participant count') ||
        content.includes('choose your start time') ||
        content.includes('choose your end time') ||
        content.includes('schedule saved') ||
        content.includes('please select your event type') ||
        content.includes('equipment saved') ||
        content.includes('availability is confirmed')
    );
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
                    className={`flex gap-2 animate-in fade-in sm:gap-3 lg:gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                >
                    <div
                        className={`flex max-w-[92%] gap-2 sm:max-w-[82%] sm:gap-3 lg:max-w-[72%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                            }`}
                    >
                        {/* Avatar */}
                        <Avatar className="h-8 w-8 rounded-lg flex-shrink-0 sm:h-10 sm:w-10">
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
                            <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5">
                                <Badge
                                    variant="outline"
                                    className="text-xs font-mono text-muted-foreground mb-2 tracking-wide uppercase border-none p-0 h-auto"
                                >
                                    {msg.role}
                                </Badge>
                                <div className="text-sm whitespace-pre-wrap break-words text-card-foreground">
                                    {isGuidedAssistantMessage(msg) ? (
                                        <TypingText text={getDisplayContent(msg, equipmentSelectorActive)} charDelayMs={12} showCursor />
                                    ) : (
                                        getDisplayContent(msg, equipmentSelectorActive)
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ))}
            
            {/* Confirmation Buttons */}
            {showConfirmationButtons && onConfirm && onCancel && (
                <div className="mt-4 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 sm:flex-row sm:justify-center sm:gap-3">
                    <Button 
                        onClick={onConfirm}
                        className="w-full bg-green-600 text-white hover:bg-green-700 sm:w-auto"
                    >
                        ✅ Confirm & Submit
                    </Button>
                    <Button 
                        onClick={onCancel}
                        variant="outline"
                        className="w-full border-red-300 text-red-600 hover:bg-red-50 sm:w-auto"
                    >
                        ❌ Cancel
                    </Button>
                </div>
            )}
            
            <div ref={messagesEndRef} />
        </>
    );
}
