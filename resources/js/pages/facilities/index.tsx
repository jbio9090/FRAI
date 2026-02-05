import DefaultLayout from "@/layout.tsx/default.";
import { useState } from "react";


interface Facility {
    id: number;
    name: string;
    room_number: string;
    capacity: number
}

interface FacilityProps {
    children: React.ReactNode;
    facilities: Facility[];
}

export default function Facilities({ children, facilities }: FacilityProps) {
    return (
        <DefaultLayout>
            <h1>Facilities</h1>

            {facilities.map((facility) => (
                <h1>
                    {facility.name}
                </h1>
            ))}
        </DefaultLayout>
    );
}