import DefaultLayout from "@/layout.tsx/default.";
import FacilityCalendar from "@/components/FacilityCalendar";
import { User, Building } from "lucide-react";


interface Facility {
    id: number;
    name: string;
    building: string;
    capacity: number
}

interface Event {
    start: Date;
    end: Date;
    title: string;
    id: number;
}

interface DetailProps {
    facility: Facility;
    initialEvents: Event[];
}

export default function FacilityDetail({ facility, initialEvents }: DetailProps) {
    return (
        <DefaultLayout>
            <div className="flex flex-col">
                <h3 className='font-semibold text-xl mb-2'>{facility.name}</h3>
                <div className='flex text-muted-foreground font-semibold text-xl gap-1 mt-1'>
                    <Building size={16} />
                    <span className='text-sm text-wrap'>
                        {facility.building}
                    </span>
                </div>
                <div className='flex font-semibold text-xl items-center gap-1 mt-1'>
                    <User size={16} />
                    <span className='text-sm'>
                        Capacity - {facility?.capacity || 'N/A'}
                    </span>
                </div>
            </div>

            <FacilityCalendar
                facilityId={facility.id}
                initialEvents={initialEvents}
            />

        </DefaultLayout>
    );
}