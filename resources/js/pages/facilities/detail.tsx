import { useState } from "react";
import { User, Building, Pencil } from "lucide-react";
import FacilityCalendar from "@/components/FacilityCalendar";
import DefaultLayout from "@/layout.tsx/default.";
import { usePermission } from "@/hooks/use-permission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { router } from "@inertiajs/react";

interface Facility {
    id: number;
    name: string;
    building: string;
    capacity: number;
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
    const { hasPermission } = usePermission();
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(facility.name);
    const [building, setBuilding] = useState(facility.building);
    const [capacity, setCapacity] = useState(facility.capacity);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.put(route("facility.update", facility.id), {
            name,
            building,
            capacity,
        }, {
            onSuccess: () => setIsEditing(false),
        });
    };

    console.log(hasPermission("manage facilities"))

    return (
        <DefaultLayout hasPadding={false}>
            <div className="flex flex-col p-4 md:p-8">
                <div className="flex items-center gap-2">
                    <h3 className='font-semibold text-xl'>{facility.name}</h3>
                    {hasPermission("manage facilities") && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsEditing(!isEditing)}
                        >
                            <Pencil size={16}/>
                        </Button>
                    )}
                </div>

                <div className='flex text-muted-foreground font-semibold text-xl gap-1 mt-1'>
                    <Building size={16} />
                    <span className='text-sm text-wrap'>{facility.building}</span>
                </div>
                <div className='flex font-semibold text-xl items-center gap-1 mt-1'>
                    <User size={16} />
                    <span className='text-sm'>Capacity - {facility?.capacity || 'N/A'}</span>
                </div>

                {isEditing && (
                    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 rounded-md border p-4 max-w-sm">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="building">Building</Label>
                            <Input
                                id="building"
                                value={building}
                                onChange={(e) => setBuilding(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="capacity">Capacity</Label>
                            <Input
                                id="capacity"
                                type="number"
                                value={capacity}
                                onChange={(e) => setCapacity(Number(e.target.value))}
                            />
                        </div>

                        <div className="flex gap-2 max-w-full">
                            <Button type="submit" className="max-w-full">Save</Button>
                            <Button type="button" variant="outline" className="max-w-full" onClick={() => setIsEditing(false)}>
                                Cancel
                            </Button>
                        </div>
                    </form>
                )}
            </div>

            <FacilityCalendar
                facilityId={facility.id}
                initialEvents={initialEvents}
            />
        </DefaultLayout>
    );
}
