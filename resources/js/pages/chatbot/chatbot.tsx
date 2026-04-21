import DefaultLayout from '@/layout.tsx/default.';
import Chatbot from '@/components/chatbot';

export default function ChatbotPage() {
    return (
        <DefaultLayout hasPadding={false}>
            <div className="flex min-h-0 flex-1 min-w-0 flex-col px-2 sm:px-4 md:px-6">
                <Chatbot />
            </div>
        </DefaultLayout>
    );
}
