export interface Equipment {
    id: number;
    name: string;
    description?: string;
    quantity: number;
    facility_id: number;
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
