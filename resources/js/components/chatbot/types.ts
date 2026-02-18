export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatRequest {
    messages: Message[];
    participant_count?: number;
}

export interface CreateRequestPayload {
    title: string;
    facility_bookings: Array<{
        facility_id: number;
        start_time: string;
        end_time: string;
    }>;
    [key: string]: any;
}
