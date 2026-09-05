import type { EquipmentConflict } from '@/types/equipment';

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
            path: string;
        },
    ];
    pending_conflict_rf_ids: number[] | null;
    approved_conflict_rf_ids: number[] | null;
    pending_conflicts?: ConflictingBooking[];
    approved_conflicts?: ConflictingBooking[];
    processed_by?: User;
    processed_at?: string;
    approved_by: string[];
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

export const PRIORITY_ACCENT: Record<number, { fill: string; ink: string }> = {
    0: { fill: 'var(--ads-ac-academic)', ink: 'var(--ads-ac-ink-academic)' },
    1: { fill: 'var(--ads-ac-community)', ink: 'var(--ads-ac-ink-community)' },
    2: { fill: 'var(--ads-ac-university)', ink: 'var(--ads-ac-ink-university)' },
    3: { fill: 'var(--ads-ac-department)', ink: 'var(--ads-ac-ink-department)' },
};

export interface BookingWindow {
    start_time: string;
    end_time: string;
    days_of_week: number[];
    step_minutes: number;
}

export interface RequestOptions {
    approvers: string[];
    booking_window: BookingWindow;
    min_advance_days: number;
    max_file_size_mb: number | null;
}

interface FacilityEquipmentItem {
    equipment_id: number;
    equipment_name: string;
    quantity_needed: number;
    max_quantity: number;
    conflicts?: EquipmentConflict[];
}

interface BorrowedEquipmentItem {
    equipment_id: number;
    equipment_name: string;
    source_facility_id: number;
    source_facility_name: string;
    quantity_needed: number;
    max_quantity: number;
}

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
    status: string;
    ai_recommended_status: string | null;
    ai_recommendation_reason: string | null;
    equipment?: FacilityEquipmentItem[];
    borrowed_equipment?: BorrowedEquipmentItem[];
    equipment_conflicts?: Record<number, EquipmentConflict[]>;
}

export interface Facility {
    id: number;
    name: string;
    building: string;
    capacity: number;
    status?: 'active' | 'unavailable';
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

export interface AlternativeSlot {
    facility_id: number;
    facility_name: string;
    facility_capacity: number;
    date: string;
    time_start: string;
    time_end: string;
    type: 'same_facility_time' | 'same_facility_date' | 'different_facility' | 'different_facility_date';
    equipment_available: boolean;
    capacity_fit: 'exact' | 'larger' | 'smaller';
}

export interface AlternativesResponse {
    alternatives: Record<number, AlternativeSlot[]>;
    metadata: {
        include_equipment: boolean;
        max_results: number;
        date_range_days: number;
        per_facility: boolean;
    };
}

export interface ChosenAlternative {
    id: number;
    facility_id: number;
    facility_name: string;
    date: string;
    time_start: string;
    time_end: string;
    type: 'same_facility_time' | 'same_facility_date' | 'different_facility' | 'different_facility_date';
    facility_capacity: number;
    capacity_fit: 'exact' | 'larger' | 'smaller';
    equipment_available: boolean;
    chosen_by_admin: { id: number; name: string };
    chosen_at: string;
}

export interface ChosenAlternativesResponse {
    alternatives: Record<number, ChosenAlternative[]>;
}

export interface ChosenAlternativeGroup {
    facility_id: number;
    facility_name: string;
    options: Array<{
        date: string;
        time_start: string;
        time_end: string;
        type: string;
        capacity_fit: string;
        equipment_available: boolean;
        chosen_by: string;
    }>;
}
