import { Equipment } from "@/types/equipment";

export interface Facility {
    id: number;
    name: string;
    description?: string;
    capacity: number;
    building: string;
    equipments?: Equipment[];
}