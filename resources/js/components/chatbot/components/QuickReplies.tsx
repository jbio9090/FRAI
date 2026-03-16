interface QuickReply {
    id: string;
    label: string;
    message: string;
    context: string;
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
    },
    {
        id: 'check_availability',
        label: 'Check Availability',
        message: 'I want to check facility availability.',
        context: 'User wants to check which facilities are currently available. Ask for their preferred date and time range to help narrow it down.',
    },
    {
        id: 'view_requests',
        label: 'View My Requests',
        message: 'Can you show me my current facility requests?',
        context: 'User wants to see a summary of their existing facility requests, including pending and approved ones.',
    },
    {
        id: 'ask_rules',
        label: 'Facility Rules',
        message: 'What are the rules for using the facilities?',
        context: 'User wants to know the rules and policies for facility usage. Summarize the relevant rules clearly.',
    },
];

export type { QuickReply };
export { QUICK_REPLIES };

export default function QuickReplies({ onSelect }: QuickRepliesProps) {
    return (
        <div className="mt-6 w-full max-w-sm mx-auto flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-gray-400 font-mono text-center mb-1">
                Quick Actions
            </p>
            {QUICK_REPLIES.map((option) => (
                <button
                    key={option.id}
                    onClick={() => onSelect(option)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-400 text-sm text-gray-700 font-medium transition-all duration-150 shadow-sm hover:shadow active:scale-[0.98]"
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}