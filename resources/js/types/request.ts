export interface Request {
    id: number;
    title: string;
    description: string;
    status: string;
    comment: string;
    recommended_action: string;
    recommended_action_reason: string;
    user: {
        name: string;
        email: string;
    };
    request_facilities: RequestFacility[];
    facilities: Facility[];
    created_at: string;
    updated_at: string;
}

export interface RequestFacility {
    facility_id: number;
    id: number,
    time_end: string,
    time_start: string,
    date_requested: string;
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
