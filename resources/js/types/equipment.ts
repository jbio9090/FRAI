export interface Equipment {
    id: number;
    name: string;
    description?: string;
    quantity: number;
    facility_id: number;
}

export interface FacilityEquipment extends Equipment {
    pivot: {
        quantity: number; // how many this facility holds
    };
}
