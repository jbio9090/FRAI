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

export interface FacilityEquipment extends Equipment {
    pivot: {
        quantity: number; // how many this facility holds
    };
}
