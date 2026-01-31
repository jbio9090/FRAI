import { useForm } from '@inertiajs/react';
import DefaultLayout from '@/layout.tsx/default.';
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
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

interface RequestDate {
    date: Date;
    time_start: string;
    time_end: string;
}

interface CreateRequestProps {
    facilities: Facility[];
}

export default function CreateRequest({ facilities }: CreateRequestProps) {
    const [selectedFacilities, setSelectedFacilities] = useState<number[]>([]);
    const [requestDates, setRequestDates] = useState<RequestDate[]>([]);
    const [currentDate, setCurrentDate] = useState<Date | undefined>(undefined);
    const [currentTimeStart, setCurrentTimeStart] = useState<string>('');
    const [currentTimeEnd, setCurrentTimeEnd] = useState<string>('');

    const { data, setData, post, processing, errors } = useForm({
        title: '',
        description: '',
        facility_ids: [] as number[],
        dates: [] as RequestDate[],
    });

    function handleFacilityToggle(facilityId: number) {
        const updatedFacilities = selectedFacilities.includes(facilityId)
            ? selectedFacilities.filter(id => id !== facilityId)
            : [...selectedFacilities, facilityId];

        setSelectedFacilities(updatedFacilities);
        setData('facility_ids', updatedFacilities);
    }

    function addDateTimeSlot() {
        if (!currentDate || !currentTimeStart || !currentTimeEnd) {
            return;
        }

        const newDate: RequestDate = {
            date: currentDate,
            time_start: currentTimeStart,
            time_end: currentTimeEnd,
        };

        const updatedDates = [...requestDates, newDate];
        setRequestDates(updatedDates);
        setData('dates', updatedDates);

        // Reset current inputs
        setCurrentDate(undefined);
        setCurrentTimeStart('');
        setCurrentTimeEnd('');
    }

    function removeDateTimeSlot(index: number) {
        const updatedDates = requestDates.filter((_, i) => i !== index);
        setRequestDates(updatedDates);
        setData('dates', updatedDates);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        // post(route('requests.store'));
        console.log('Form data:', data);
    }

    return (
        <DefaultLayout>
            <div className="w-4xl max-w-2xl mx-auto">
                <form onSubmit={submit} className="space-y-6 flex flex-col gap-2">
                    {/* Title Field */}
                    <h1 className='w-full font-extrabold text-muted-foreground'>Create Request</h1>
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

                    {/* Facilities Selection */}
                    <div className="space-y-2">
                        <Label>Select Facilities</Label>
                        <div className="border rounded-md space-y-3 max-h-64 overflow-y-scroll">
                            {facilities.map((facility) => (
                                <div key={facility.id} className="flex items-center space-x-4 hover:bg-gray-100 py-2 px-4">
                                    <Checkbox
                                        id={`facility-${facility.id}`}
                                        checked={selectedFacilities.includes(facility.id)}
                                        onCheckedChange={() => handleFacilityToggle(facility.id)}
                                    />
                                    <div className="flex-1">
                                        <label
                                            htmlFor={`facility-${facility.id}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                        >
                                            {facility.name}
                                        </label>
                                        {facility.description && (
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {facility.description}
                                            </p>
                                        )}
                                        {facility.capacity && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Capacity: {facility.capacity} people
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {errors.facility_ids && (
                            <p className="text-sm text-red-500">{errors.facility_ids}</p>
                        )}
                    </div>

                    {/* Date and Time Selection */}
                    <div className="space-y-4">
                        <Label>Add Date & Time Slots</Label>
                        <div className="border rounded-md p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Date Picker */}
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
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
                                onClick={addDateTimeSlot}
                                disabled={!currentDate || !currentTimeStart || !currentTimeEnd}
                                className="w-full"
                            >
                                Add Time Slot
                            </Button>
                        </div>

                        {/* Display Added Date/Time Slots */}
                        {requestDates.length > 0 && (
                            <div className="space-y-2">
                                <Label>Selected Time Slots</Label>
                                <div className="border rounded-md divide-y">
                                    {requestDates.map((slot, index) => (
                                        <div key={index} className="p-3 flex items-center justify-between">
                                            <div className="text-sm">
                                                <span className="font-medium">
                                                    {format(slot.date, "PPP")}
                                                </span>
                                                <span className="text-muted-foreground ml-2">
                                                    {slot.time_start} - {slot.time_end}
                                                </span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className='cursor-pointer'
                                                onClick={() => removeDateTimeSlot(index)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {errors.dates && (
                            <p className="text-sm text-red-500">{errors.dates}</p>
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
            </div>
        </DefaultLayout>
    );
}