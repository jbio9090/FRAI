export interface Equipment {
    id: number;
    name: string;
    description?: string;
    quantity: number;
    facility_id: number;
    facility?: string | null;
    total_quantity?: number;
    reserved_quantity?: number;
    remaining_quantity?: number;
}

export interface EquipmentConflict {
    request_id: number;
    request_title: string;
    requester: string;
    status: string;
}

/**
 * Per-slot availability attached to equipment on a saved booking. Optional
 * everywhere because it is computed per booking row server-side and an older
 * payload simply won't carry it — absence means "not reported", never "all free".
 */
export interface SlotAvailability {
    total_quantity: number;
    reserved_quantity: number;
    available_quantity: number;
}

export interface FacilityEquipment extends Equipment {
    pivot: {
        quantity: number; // how many this facility holds
    };
}
