import { Message } from '../types';
<<<<<<< Updated upstream
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface MessageListProps {
    messages: Message[];
    messagesEndRef: React.RefObject<HTMLDivElement>;
=======

interface MessageListProps {
    messages: Message[];
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
>>>>>>> Stashed changes
}

export default function MessageList({ messages, messagesEndRef }: MessageListProps) {
    return (
        <>
            {messages.map((msg, index) => (
                <div
                    key={index}
<<<<<<< Updated upstream
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
                                    {msg.content}
                                </div>
                            </CardContent>
                        </Card>
=======
                    className={`flex gap-4 animate-in fade-in ${
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                >
                    <div
                        className={`flex gap-3 max-w-[70%] ${
                            msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                        }`}
                    >
                        {/* Avatar */}
                        <div
                            className={`h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                                msg.role === 'user'
                                    ? 'bg-gray-400'
                                    : 'bg-gray-300'
                            }`}
                        >
                            {msg.role === 'user' ? 'U' : 'AI'}
                        </div>

                        {/* Message Content */}
                        <div
                            className={`px-5 py-3 rounded-lg border ${
                                msg.role === 'user'
                                    ? 'bg-gray-100 border-gray-300 text-gray-900'
                                    : 'bg-gray-50 border-gray-200 text-gray-900'
                            }`}
                        >
                            <div className="text-xs uppercase font-mono text-gray-500 mb-2 tracking-wide">
                                {msg.role}
                            </div>
                            <div className="text-sm whitespace-pre-wrap break-words">
                                {msg.content}
                            </div>
                        </div>
>>>>>>> Stashed changes
                    </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </>
    );
<<<<<<< Updated upstream
}
=======
}
>>>>>>> Stashed changes
