import DefaultLayout from "@/layout.tsx/default.";


interface Facility {
    name: string;
    building: string;
    capacity: number
}

interface DetailProps {
    facility: Facility;
}

export default function FacilityDetail({ facility }: DetailProps) {
    return (
        <DefaultLayout>
            <h1>{facility.name}</h1>
        </DefaultLayout>
    );
}