import QuickReplies from './QuickReplies';
import { QuickReply } from './QuickReplies';

interface WelcomeMessageProps {
    onQuickReply: (option: QuickReply) => void;
}

export default function WelcomeMessage({ onQuickReply }: WelcomeMessageProps) {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Welcome to AI Chat</h2>
                <p className="text-gray-600">
                    Connected to <strong>FRAI</strong> model via CloudStudio Ollama.
                    <br />
                    Start a conversation by typing a message below, or choose a quick action.
                </p>
                <QuickReplies onSelect={onQuickReply} />
            </div>
        </div>
    );
}
