import { Equipment } from "@/pages/requests/equipment";

export interface Facility {
    id: number;
    name: string;
    description?: string;
    capacity: number;
    building: string;
    equipments?: Equipment[];
}