import { Button } from '@/components/ui/button';
import DefaultLayout from '@/layout.tsx/default.';
import { Link } from '@inertiajs/react';
import { Calendar as CalendarIcon } from 'lucide-react';
import moment from 'moment';
import FacilityCalendar from '@/components/FacilityCalendar';
import { Request as FacilityRequest } from '@/types/request';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { SlidersHorizontal } from 'lucide-react';

interface Event {
    start: Date;
    end: Date;
    title: string;
    id: number;
    request_id: string | number;
    building: string;
}

export default function Dashboard({
    pending,
    approved,
    denied,
    initialEvents,
    buildings,
}: {
    pending: FacilityRequest[];
    approved: FacilityRequest[];
    denied: FacilityRequest[];
    initialEvents: Event[];
    buildings: string[];
}) {
    const [selectedBuildings, setSelectedBuildings] = useState<string[]>(buildings);

    const toggleBuilding = (building: string) => {
        setSelectedBuildings(prev =>
            prev.includes(building)
                ? prev.filter(b => b !== building)
                : [...prev, building]
        );
    };

    const filteredEvents = initialEvents.filter(e =>
        selectedBuildings.includes(e.building)
    );

    return (
        <DefaultLayout hasPadding={false}>
            <div className="flex flex-col p-8">
                <div className="flex text-sm gap-2 items-center">
                    <CalendarIcon size={16} />
                    <p>{moment().format("MMM Do, YYYY")}</p>
                </div>

                <div className="flex flex-wrap gap-2 mt-4 md:grid grid-cols-[1fr_1fr_1fr]">
                    <div className="flex flex-col p-4 w-full border-1 border-border rounded">
                        <p className='text-sm'>Pending Requests</p>
                        <p className='text-4xl font-bold'>{pending.data.length}</p>
                        <Link href={route("requests.index", ['pending'])}>
                            <Button variant={"link"} className='px-0 mt-2'>See all</Button>
                        </Link>
                    </div>

                    <div className="flex flex-col p-4 w-full border-1 border-border rounded">
                        <p className='text-sm'>Approved Requests you made</p>
                        <p className='text-4xl font-bold'>{approved.data.length}</p>
                        <Link href={route("requests.index", ['approved'])}>
                            <Button variant={"link"} className='px-0 mt-2'>See all</Button>
                        </Link>
                    </div>

                    <div className="flex flex-col p-4 w-full border-1 border-border rounded">
                        <p className='text-sm'>Denied Requests you made</p>
                        <p className='text-4xl font-bold'>{denied.data.length}</p>
                        <Link href={route("requests.index", ['denied'])}>
                            <Button variant={"link"} className='px-0 mt-2'>See all</Button>
                        </Link>
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3 p-8">
                    <h2 className="font-semibold text-sm text-foreground">Facility Schedule</h2>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4" />
                                <span>Filter Buildings</span>
                                {selectedBuildings.length < buildings.length && (
                                    <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs w-4 h-4 flex items-center justify-center">
                                        {selectedBuildings.length}
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3" align="end">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold">Buildings</p>
                                <button
                                    className="text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() =>
                                        selectedBuildings.length === buildings.length
                                            ? setSelectedBuildings([])
                                            : setSelectedBuildings(buildings)
                                    }
                                >
                                    {selectedBuildings.length === buildings.length ? 'Deselect all' : 'Select all'}
                                </button>
                            </div>
                            <div className="flex flex-col gap-2">
                                {buildings.map(building => (
                                    <div key={building} className="flex items-center gap-2">
                                        <Checkbox
                                            id={`building-${building}`}
                                            checked={selectedBuildings.includes(building)}
                                            onCheckedChange={() => toggleBuilding(building)}
                                        />
                                        <label
                                            htmlFor={`building-${building}`}
                                            className="text-sm cursor-pointer"
                                        >
                                            {building}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <FacilityCalendar
                    facilityId={0}
                    initialEvents={filteredEvents}
                    calendarRoute="dashboard.calendar"
                />

                <div className="flex flex-col gap-4 mt-8 p-8">
                    <h2 className="font-semibold text-2xl text-muted-foreground">Reports</h2>
                </div>
            </div>
        </DefaultLayout>
    );
} 