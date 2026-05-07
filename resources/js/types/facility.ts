import type { FacilityEquipment } from '@/types/equipment';

export interface Facility {
    id: number;
    name: string;
    description?: string;
    capacity: number;
    building: string;
    deleted_at?: string | null;
    campus_id?: number | null;
    building_id?: number | null;
    campus?: {
        id: number;
        name: string;
        deleted_at?: string | null;
    } | null;
    building_record?: {
        id: number;
        campus_id: number;
        name: string;
        deleted_at?: string | null;
    } | null;
    equipments?: FacilityEquipment[];
}
