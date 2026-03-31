export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatRequest {
    messages: Message[];
    participant_count?: number;
    booking_context?: string;
}

export interface CreateRequestPayload {
    title: string;
    facility_bookings: Array<{
        facility_id: number;
        date: string;
        time_start: string;
        time_end: string;
        equipment?: Array<{
            equipment_id: number;
            quantity_needed: number;
        }>;
    }>;
    description?: string;
    priority_level?: number;
    priority_reason?: string | null;
}
