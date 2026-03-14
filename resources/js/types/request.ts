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
        name: string;
        email: string;
    };
    request_facilities: RequestFacility[];
    facilities: Facility[];
    created_at: string;
    updated_at: string;
}

export const PRIORITY_LABELS: Record<0 | 1 | 2, string> = {
    0: 'Normal',
    1: 'School Event',
    2: 'Government / High Authority',
};

export interface RequestFacility {
    facility_id: number;
    id: number,
    time_end: string,
    time_start: string,
    date_requested: string;
    external_equipment: string;
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
