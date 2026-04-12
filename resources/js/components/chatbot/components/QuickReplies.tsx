interface QuickReply {
    id: string;
    label: string;
    message: string;
    context: string;
    action?: 'navigate' | 'chat' | 'availability';
    href?: string;
}

interface QuickRepliesProps {
    onSelect: (option: QuickReply) => void;
}

const QUICK_REPLIES: QuickReply[] = [
    {
        id: 'book_facility',
        label: 'Book a Facility',
        message: 'I would like to book a facility.',
        context: 'User wants to create a facility booking request. Guide them through selecting a facility, date, time, and number of participants.',
        action: 'chat',
    },
    {
        id: 'check_availability',
        label: 'Check room availability',
        message: 'Check room availability',
        context: 'User wants to check room availability by selecting a room, date, and time first.',
        action: 'availability',
    },
    {
        id: 'view_requests',
        label: 'View My Requests',
        message: 'View my pending requests',
        context: 'User navigated to their pending requests page.',
        action: 'navigate',
        href: route('requests.index', { status: 'pending' }),
    },
    {
        id: 'ask_rules',
        label: 'Facility Policy',
        message: 'View facility Policy',
        context: 'User navigated to the facility rules page.',
        action: 'navigate',
        href: route('rules'),
    },
];

export type { QuickReply };
export { QUICK_REPLIES };

export default function QuickReplies({ onSelect }: QuickRepliesProps) {
    return (
        <div className="mt-6 w-full max-w-sm mx-auto flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-gray-400 dark:text-gray-500 font-mono text-center mb-1">
                Quick Actions
            </p>
            {QUICK_REPLIES.map((option) => (
                <button
                    key={option.id}
                    onClick={() => onSelect(option)}
                    className="w-full text-left px-4 py-3 rounded-lg border
                    border-gray-200 bg-white text-gray-700
                    hover:bg-gray-50 hover:border-gray-400
                    
                    dark:bg-gray-900 dark:border-white dark:text-white
                    dark:hover:bg-gray-800 dark:hover:border-white
                    
                    text-sm font-medium transition-all duration-150 shadow-sm hover:shadow active:scale-[0.98]"
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
