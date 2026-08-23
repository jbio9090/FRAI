import type { EquipmentConflict, FacilityEquipment } from '@/types/equipment';
import type { Facility } from '@/types/facility';
import type { RequestOptions } from '@/types/request';

export interface BorrowableEquipment extends FacilityEquipment {
    facilityId: number;
    facilityName: string;
    sources: { facilityId: number; facilityName: string; quantity: number }[];
}

export interface BorrowedEquipmentRequest {
    equipment_id: number;
    equipment_name: string;
    source_facility_id: number;
    source_facility_name: string;
    quantity_needed: number;
    max_quantity: number;
}

export interface EquipmentRequest {
    equipment_id: number;
    equipment_name: string;
    quantity_needed: number;
    max_quantity: number;
    conflicts?: EquipmentConflict[];
}

export interface BookingSchedule {
    request_id?: number;
    request_title: string;
    status: string;
    time_start: string;
    time_end: string;
    date?: string;
}

export interface FacilityScheduleData {
    bookings: BookingSchedule[];
    date: string;
}

export interface FacilityBooking {
    facility_id: number;
    facility_name: string;
    date: string;
    time_start: string;
    time_end: string;
    equipment: EquipmentRequest[];
    borrowed_equipment: BorrowedEquipmentRequest[];
    conflicts: BookingSchedule[];
    external_equipment: { name: string }[];
    expected_capacity: number | null;
    facility_capacity?: number | null;
    has_outsiders: boolean;
    equipment_conflicts: Record<number, EquipmentConflict[]>;
}

export interface ExistingRequest {
    id: number;
    title: string;
    description: string;
    priority_level: 0 | 1 | 2;
    priority_reason: string;
    facility_bookings: FacilityBooking[];
    existing_files: ExistingFile[];
    approved_by: string[];
    status: string;
}

export interface ExistingFile {
    id: number;
    original_name: string;
    mime_type: string;
    size: number;
    url: string;
    path: string;
}

export interface CreateRequestProps extends Record<string, unknown> {
    facilities: Facility[];
    existingRequest?: ExistingRequest;
    requestOptions: RequestOptions;
}

export interface CreateRequestFormData {
    title: string;
    description: string;
    facility_bookings: FacilityBooking[];
    priority_level: number;
    priority_reason: string;
    approved_by: string[];
    files: File[];
    existing_file_ids: number[];
}

export interface DraftData {
    title: string;
    description: string;
    facility_bookings: FacilityBooking[];
    priority_level: 0 | 1 | 2;
    priority_reason: string;
    savedAt: number;
    approved_by: string[];
}

export interface AttachedFile {
    file: File;
    preview?: string;
}

export interface EquipmentAvailabilityData {
    equipment_id: number;
    total_quantity: number;
    available_quantity: number;
    is_limited: boolean;
}

export type BorrowSort = 'name-asc' | 'name-desc' | 'qty-asc' | 'qty-desc';
