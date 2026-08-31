import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Message } from '../types';
import TypingText from './TypingText';

interface MessageListProps {
    messages: Message[];
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    equipmentSelectorActive?: boolean;
}

const looksLikeEquipmentListMessage = (content: string): boolean => {
    const normalized = content.toLowerCase();
    const hasEquipmentKeywords =
        normalized.includes('equipment') || normalized.includes('facility id') || normalized.includes('quantity') || normalized.includes('id:');

    if (!hasEquipmentKeywords) {
        return false;
    }

    const hasListFormatting = /(^|\n)\s*[-*]\s+/m.test(content) || /(^|\n)\s*\d+\.\s+/m.test(content) || content.includes(', ');

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

const splitThinkingContent = (content: string): { thought: string | null; answer: string } => {
    const match = content.match(/<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/i);
    if (!match) {
        return { thought: null, answer: content };
    }

    return {
        thought: match[1].trim(),
        answer: content.replace(match[0], '').trim(),
    };
};

export default function MessageList({ messages, messagesEndRef, equipmentSelectorActive = false }: MessageListProps) {
    return (
        <>
            {messages.map((msg, index) =>
                (() => {
                    const thinking = msg.role === 'assistant' ? splitThinkingContent(msg.content) : { thought: null, answer: msg.content };
                    return (
                        <div
                            key={index}
                            className={`flex animate-in gap-2 fade-in sm:gap-3 lg:gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`flex max-w-[92%] gap-2 sm:max-w-[82%] sm:gap-3 lg:max-w-[72%] ${
                                    msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                                }`}
                            >
                                {/* Avatar */}
                                <Avatar className="h-8 w-8 flex-shrink-0 rounded-lg sm:h-10 sm:w-10">
                                    <AvatarFallback
                                        className={`rounded-lg text-sm font-bold ${
                                            msg.role === 'user' ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground'
                                        }`}
                                    >
                                        {msg.role === 'user' ? 'U' : 'AI'}
                                    </AvatarFallback>
                                </Avatar>

                                {/* Message Content */}
                                <Card
                                    className={`border ${msg.role === 'user' ? 'border-border bg-primary/5' : 'bg-muted-background border-border'}`}
                                >
                                    <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5">
                                        <Badge
                                            variant="outline"
                                            className="mb-2 h-auto border-none p-0 font-mono text-xs tracking-wide text-muted-foreground uppercase"
                                        >
                                            {msg.role}
                                        </Badge>
                                        {thinking.thought ? (
                                            <details className="mb-2 rounded-md border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-muted-foreground">
                                                <summary className="cursor-pointer font-medium select-none">View reasoning</summary>
                                                <p className="mt-2 whitespace-pre-wrap">{thinking.thought}</p>
                                            </details>
                                        ) : null}
                                        <div className="text-sm break-words whitespace-pre-wrap text-card-foreground">
                                            {isGuidedAssistantMessage(msg) ? (
                                                <TypingText
                                                    text={getDisplayContent({ ...msg, content: thinking.answer }, equipmentSelectorActive)}
                                                    charDelayMs={12}
                                                    showCursor
                                                />
                                            ) : (
                                                getDisplayContent({ ...msg, content: thinking.answer }, equipmentSelectorActive)
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    );
                })(),
            )}

            <div ref={messagesEndRef} />
        </>
    );
}
