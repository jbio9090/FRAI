export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AttachedFileInfo {
    id: string;
    name: string;
    size: number;
    mime_type: string;
    url: string;
}

export interface ChatRequest {
    messages: Message[];
    page_context?: Record<string, unknown>;
    participant_count?: number;
    booking_context?: string;
    faq_mode?: boolean;
}

export interface CreateRequestPayload {
    title: string;
    participant_count?: number;
    facility_bookings: Array<{
        facility_id: number;
        date: string;
        time_start: string;
        time_end: string;
        expected_capacity?: number;
        equipment?: Array<{
            equipment_id: number;
            quantity_needed: number;
            facility_id?: number;
            is_borrowed?: boolean;
            source_facility_id?: number | null;
        }>;
    }>;
    description?: string;
    priority_level?: number;
    priority_reason?: string | null;
    files?: string[];
}
