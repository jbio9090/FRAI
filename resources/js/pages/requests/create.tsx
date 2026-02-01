import { useForm } from '@inertiajs/react';
import DefaultLayout from '@/layout.tsx/default.';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Facility {
    id: number;
    name: string;
    description?: string;
    capacity?: number;
}

interface FacilityBooking {
    facility_id: number;
    facility_name: string;
    date: Date;
    time_start: string;
    time_end: string;
}

interface CreateRequestProps {
    facilities: Facility[];
}

export default function CreateRequest({ facilities }: CreateRequestProps) {
    const [facilityBookings, setFacilityBookings] = useState<FacilityBooking[]>([]);
    const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
    const [currentDate, setCurrentDate] = useState<Date | undefined>(undefined);
    const [currentTimeStart, setCurrentTimeStart] = useState<string>('');
    const [currentTimeEnd, setCurrentTimeEnd] = useState<string>('');

    const { data, setData, post, processing, errors } = useForm({
        title: '',
        description: '',
        facility_bookings: [] as FacilityBooking[],
    });

    function addFacilityBooking() {
        if (!selectedFacility || !currentDate || !currentTimeStart || !currentTimeEnd) {
            return;
        }

        const facility = facilities.find(f => f.id === selectedFacility);
        if (!facility) return;

        const newBooking: FacilityBooking = {
            facility_id: selectedFacility,
            facility_name: facility.name,
            date: currentDate,
            time_start: currentTimeStart,
            time_end: currentTimeEnd,
        };

        const updatedBookings = [...facilityBookings, newBooking];
        setFacilityBookings(updatedBookings);
        setData('facility_bookings', updatedBookings);

        // Reset current inputs
        setSelectedFacility(null);
        setCurrentDate(undefined);
        setCurrentTimeStart('');
        setCurrentTimeEnd('');
    }

    function removeBooking(index: number) {
        const updatedBookings = facilityBookings.filter((_, i) => i !== index);
        setFacilityBookings(updatedBookings);
        setData('facility_bookings', updatedBookings);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post(route('requests.store'));
        console.log('Form data:', data);
    }

    return (
        <DefaultLayout>
            <div className="w-full md:w-4xl max-w-3xl mx-auto">
                <form onSubmit={submit} className="space-y-6 flex flex-col gap-2">
                    <h1 className='w-full font-extrabold text-muted-foreground'>Create Request</h1>

                    {/* Title Field */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Request Title</Label>
                        <Input
                            id="title"
                            type="text"
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            placeholder="e.g., Annual Company Meeting"
                        />
                        {errors.title && (
                            <p className="text-sm text-red-500">{errors.title}</p>
                        )}
                    </div>

                    {/* Description Field */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Provide details about your request"
                            rows={4}
                        />
                        {errors.description && (
                            <p className="text-sm text-red-500">{errors.description}</p>
                        )}
                    </div>

                    {/* Add Facility Booking */}
                    <div className="space-y-4">
                        <Label>Add Facility Bookings</Label>
                        <div className="border rounded-md p-4 space-y-4">
                            {/* Facility Selection */}
                            <div className="space-y-2">
                                <Label>Select Facility</Label>
                                {/* <select
                                    value={selectedFacility || ''}
                                    onChange={(e) => setSelectedFacility(Number(e.target.value))}
                                    className="w-full border rounded-md p-2 text-sm"
                                >
                                    <option value="" className='text-sm'>Choose a facility...</option>
                                    {facilities.map((facility) => (
                                        <option key={facility.id} value={facility.id}>
                                            {facility.name} {facility.capacity && `(Capacity: ${facility.capacity})`}
                                        </option>
                                    ))}
                                </select> */}

                                <Select
                                    value={selectedFacility?.toString() || ''}
                                    onValueChange={(value) => setSelectedFacility(Number(value))}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Choose a Facility" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {facilities.map((facility) => (
                                            <SelectItem key={facility.id} value={facility.id.toString()}>
                                                {facility.name} {facility.capacity && `(Capacity: ${facility.capacity})`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Date Picker */}
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !currentDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {currentDate ? format(currentDate, "PPP") : "Pick a date"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={currentDate}
                                                onSelect={setCurrentDate}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Start Time */}
                                <div className="space-y-2">
                                    <Label htmlFor="time_start">Start Time</Label>
                                    <Input
                                        id="time_start"
                                        type="time"
                                        value={currentTimeStart}
                                        onChange={(e) => setCurrentTimeStart(e.target.value)}
                                    />
                                </div>

                                {/* End Time */}
                                <div className="space-y-2">
                                    <Label htmlFor="time_end">End Time</Label>
                                    <Input
                                        id="time_end"
                                        type="time"
                                        value={currentTimeEnd}
                                        onChange={(e) => setCurrentTimeEnd(e.target.value)}
                                    />
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                onClick={addFacilityBooking}
                                disabled={!selectedFacility || !currentDate || !currentTimeStart || !currentTimeEnd}
                                className="w-full"
                            >
                                Add Facility Booking
                            </Button>
                        </div>

                        {/* Display Added Bookings */}
                        {facilityBookings.length > 0 && (
                            <div className="space-y-2">
                                <Label>Added Facility Bookings</Label>
                                <div className="border rounded-md divide-y">
                                    {facilityBookings.map((booking, index) => (
                                        <div key={index} className="p-3 flex items-center justify-between">
                                            <div className="text-sm">
                                                <div className="font-bold">{booking.facility_name}</div>
                                                <div className="text-muted-foreground">
                                                    {format(booking.date, "PPP")} • {booking.time_start} - {booking.time_end}
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className='cursor-pointer'
                                                onClick={() => removeBooking(index)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {errors.facility_bookings && (
                            <p className="text-sm text-red-500">{errors.facility_bookings}</p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => window.history.back()}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Submitting...' : 'Submit Request'}
                        </Button>
                    </div>
                </form>
            </div >
        </DefaultLayout >
    );
}