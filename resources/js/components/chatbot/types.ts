export interface Message {
<<<<<<< Updated upstream
    role: 'user' | 'assistant';
=======
    role: 'user' | 'assistant' | 'system';
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
}
=======
}
>>>>>>> Stashed changes
