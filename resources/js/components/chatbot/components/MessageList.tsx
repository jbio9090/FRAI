import { Message } from '../types';

interface MessageListProps {
    messages: Message[];
    messagesEndRef: React.RefObject<HTMLDivElement>;
}

export default function MessageList({ messages, messagesEndRef }: MessageListProps) {
    return (
        <>
            {messages.map((msg, index) => (
                <div
                    key={index}
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
                    </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </>
    );
}
