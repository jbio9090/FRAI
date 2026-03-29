export interface Request {
    id: number;
    title: string;
    description: string;
    status: string;
    comment: string;
    recommended_action: string;
    recommended_action_reason: string;
    priority_level: 0 | 1 | 2;
    priority_reason: string | null;
    on_hold: boolean;
    held_by_request_id: number | null;
    user: {
        id: number; // was missing — needed for canEdit check
        name: string;
        email: string;
    };
    equipment: RequestEquipment[]; // no longer has facility_id
    request_facilities: RequestFacility[];
    facilities: Facility[];
    created_at: string;
    updated_at: string;
    files: [
        {
            path: string
        }
    ]
}

export interface RequestEquipment {
    id: number;
    name: string;
    quantity: number; // global total
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

export interface RequestFacility {
    facility_id: number;
    id: number,
    time_end: string,
    time_start: string,
    date_requested: string;
    external_equipment: string;
    expected_capacity: number;
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
