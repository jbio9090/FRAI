export interface Request {
    id: number;
    title: string;
    description: string;
    status: string;
    comments: Comment[];
    recommended_action: string;
    recommended_action_reason: string | null;
    priority_level: 0 | 1 | 2;
    priority_reason: string | null;
    on_hold: boolean;
    held_by_request_id: number | null;
    user: User;
    equipment: RequestEquipment[];
    request_facilities: RequestFacility[];
    facilities: Facility[];
    created_at: string;
    updated_at: string;
    files: [
        {
            path: string
        }
    ]
    pending_conflict_rf_ids: number[] | null;
    approved_conflict_rf_ids: number[] | null;
    pending_conflicts?: ConflictingBooking[];
    approved_conflicts?: ConflictingBooking[];
    processed_by?: User,
    processed_at?: string,
    approved_by: string[],
}

export interface Comment {
    id: number;
    user: User;
    body: string;
    request_id: number;
    created_at: string;
}

export interface User {
    id: number;
    name: string;
    email: string;
    profile: string;
}

export interface RequestEquipment {
    id: number;
    name: string;
    quantity: number;
    pivot: {
        quantity_needed: number;
    };
}

export const PRIORITY_LABELS: Record<0 | 1 | 2 | 3, string> = {
    0: 'Academic',
    1: 'Organization',
    2: 'University',
    3: 'Government',
};

interface RequestFacility {
    id: number;
    request_id: number;
    facility_id: number;
    date_requested: string;
    time_start: string;
    time_end: string;
    expected_capacity: number | null;
    external_equipments: { id: number; name: string }[];
    has_outsiders: boolean;
}

export interface Facility {
    id: number;
    name: string;
    building: string;
    capacity: number
}

export interface RequestsPageProps {
    requests: Request[];
    page_title: string;
}

export interface ConflictingBooking {
    id: number;
    request_id: number;
    facility_id: number;
    date_requested: string;
    time_start: string;
    time_end: string;
    request: {
        id: number;
        title: string;
        status: string;
        user: { id: number; name: string };
    };
    facility: {
        id: number;
        name: string;
    };
}