import DefaultLayout from '@/layout.tsx/default.';
import { useForm } from '@inertiajs/react';
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
import { CalendarIcon, X, User, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Card, CardHeader } from '@/components/ui/card';


interface Equipment {
    id: number;
    name: string;
    description?: string;
    quantity: number;
    facility_id: number;
}

interface Facility {
    id: number;
    name: string;
    description?: string;
    capacity?: number;
    building?: string;
    equipments?: Equipment[];
}

interface FacilityBooking {
    facility_id: number;
    facility_name: string;
    date: string;
    time_start: string;
    time_end: string;
    equipment: EquipmentRequest[];
}

interface EquipmentRequest {
    equipment_id: number;
    equipment_name: string;
    quantity_needed: number;
    max_quantity: number;
}

interface BookingSchedule {
    request_title: string;
    status: string;
    time_start: string;
    time_end: string;
}

interface FacilityScheduleData {
    bookings: BookingSchedule[];
    date: string;
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
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentRequest[]>([]);
    const [facilitySchedule, setFacilitySchedule] = useState<FacilityScheduleData | null>(null);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [hasTimeConflict, setHasTimeConflict] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        title: '',
        description: '',
        facility_bookings: [] as FacilityBooking[],
    });

    const availableEquipment = selectedFacility
        ? facilities.find(f => f.id === selectedFacility)?.equipments || []
        : [];

    function formatTime(time: string): string {
        return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }

    async function loadSchedule(facilityId: number, date: Date) {
        setLoadingSchedule(true);
        try {
            const dateString = format(date, 'yyyy-MM-dd');
            const response = await fetch(
                route('facility.schedule', {
                    facility: facilityId,
                    date: dateString
                })
            );
            const data = await response.json();
            setFacilitySchedule(data);

            // Check for conflicts after loading schedule
            if (currentTimeStart && currentTimeEnd) {
                setHasTimeConflict(checkTimeConflict(currentTimeStart, currentTimeEnd));
            }
        } catch (error) {
            console.error('Failed to load schedule:', error);
            setFacilitySchedule(null);
        } finally {
            setLoadingSchedule(false);
        }
    };

    function handleFacilityChange(value: string) {
        const facilityId = Number(value);
        setSelectedFacility(facilityId);
        setSelectedEquipment([]); // Reset equipment when facility changes

        // Load schedule if date is already selected
        if (currentDate) {
            loadSchedule(facilityId, currentDate);
        }
    };

    const handleDateChange = (date: Date | undefined) => {
        setCurrentDate(date);

        // Load schedule if facility is already selected and date is set
        if (selectedFacility && date) {
            loadSchedule(selectedFacility, date);
        }
    };

    function clearEquipmentSelection(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        setSelectedEquipment([]);
    }

    function handleEquipmentToggle(equipment: Equipment) {
        const exists = selectedEquipment.find(e => e.equipment_id === equipment.id);

        if (exists) {
            setSelectedEquipment(selectedEquipment.filter(e => e.equipment_id !== equipment.id));
        } else {
            setSelectedEquipment([
                ...selectedEquipment,
                {
                    equipment_id: equipment.id,
                    equipment_name: equipment.name,
                    quantity_needed: equipment.quantity,
                    max_quantity: equipment.quantity,
                }
            ]);
        }
    }

    function updateEquipmentQuantity(equipmentId: number, quantity: number) {
        setSelectedEquipment(
            selectedEquipment.map(e =>
                e.equipment_id === equipmentId
                    ? { ...e, quantity_needed: quantity }
                    : e
            )
        );
    }

    function addFacilityBooking() {
        if (!selectedFacility || !currentDate || !currentTimeStart || !currentTimeEnd) {
            return;
        }

        const facility = facilities.find(f => f.id === selectedFacility);
        if (!facility) return;

        const newBooking: FacilityBooking = {
            facility_id: selectedFacility,
            facility_name: facility.name,
            date: format(currentDate, "yyyy-MM-dd"),
            time_start: currentTimeStart,
            time_end: currentTimeEnd,
            equipment: selectedEquipment,
        };

        const updatedBookings = [...facilityBookings, newBooking];
        setFacilityBookings(updatedBookings);
        setData('facility_bookings', updatedBookings);

        // Reset current inputs
        setSelectedFacility(null);
        setCurrentDate(undefined);
        setCurrentTimeStart('');
        setCurrentTimeEnd('');
        setSelectedEquipment([]);
        setFacilitySchedule(null);
        setHasTimeConflict(false); // Reset conflict state
    }

    function checkTimeConflict(startTime: string, endTime: string): boolean {
        if (!facilitySchedule || !facilitySchedule.bookings.length) {
            return false;
        }

        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);

        return facilitySchedule.bookings.some(booking => {
            const bookingStart = new Date(`2000-01-01T${booking.time_start}`);
            const bookingEnd = new Date(`2000-01-01T${booking.time_end}`);

            // Check if times overlap
            return (start < bookingEnd && end > bookingStart);
        });
    }

    function handleTimeStartChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newStartTime = e.target.value;
        setCurrentTimeStart(newStartTime);

        if (newStartTime && currentTimeEnd) {
            setHasTimeConflict(checkTimeConflict(newStartTime, currentTimeEnd));
        }
    };

    function handleTimeEndChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newEndTime = e.target.value;
        setCurrentTimeEnd(newEndTime);

        if (currentTimeStart && newEndTime) {
            setHasTimeConflict(checkTimeConflict(currentTimeStart, newEndTime));
        }
    };

    function removeBooking(index: number) {
        const updatedBookings = facilityBookings.filter((_, i) => i !== index);
        setFacilityBookings(updatedBookings);
        setData('facility_bookings', updatedBookings);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post(route('requests.store'));
    }


    return (
        <DefaultLayout>
            <div className="w-full lg:grid lg:grid-cols-[5fr_3fr] gap-8">
                <div className="max-w-3xl w-full mx-auto">
                    <form onSubmit={submit} className="space-y-6 flex flex-col gap-2">
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
                            <div className="space-y-4">
                                {/* Facility Selection */}
                                <div className="space-y-4">
                                    <Label>Select Facility</Label>
                                    <Select
                                        value={selectedFacility?.toString() || ''}
                                        onValueChange={handleFacilityChange}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Choose a Facility" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {facilities.map((facility) => (
                                                <SelectItem key={facility.id} value={facility.id.toString()}>
                                                    <b>
                                                        {facility.name}
                                                    </b>
                                                    <div className="flex items-center gap-1 font-semibold text-muted-foreground">
                                                        <User />
                                                        <span className='text-xs '>
                                                            {facility.capacity && facility.capacity}
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Equipment Selection - Only show if facility is selected */}
                                {selectedFacility && availableEquipment.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex justify-around items-end">
                                            <Label className='ml-0 mt-4 mb-2 mr-auto'>Select Equipment</Label>
                                            {(selectedEquipment.length > 0) && (
                                                <Button variant={"ghost"} size={"sm"} onClick={clearEquipmentSelection}>
                                                    <X />
                                                    <span>
                                                        Clear Selection
                                                    </span>
                                                </Button>
                                            )}
                                        </div>

                                        <div className="border rounded-md p-3 space-y-3 max-h-48 overflow-y-auto">
                                            {availableEquipment.map((equipment) => {
                                                const selected = selectedEquipment.find(e => e.equipment_id === equipment.id);
                                                return (
                                                    <div key={equipment.id} className="flex items-center justify-between gap-4">
                                                        <div className="flex items-center space-x-3 flex-1">
                                                            <Checkbox
                                                                id={`equipment-${equipment.id}`}
                                                                checked={!!selected}
                                                                onCheckedChange={() => handleEquipmentToggle(equipment)}
                                                            />
                                                            <div className="flex-1">
                                                                <Label
                                                                    htmlFor={`equipment-${equipment.id}`}
                                                                    className="text-sm text-foreground font-medium cursor-pointer"
                                                                >
                                                                    {equipment.name}
                                                                </Label>
                                                                <Label className="text-xs text-muted-foreground">
                                                                    Available: {equipment.quantity}
                                                                </Label>
                                                            </div>
                                                        </div>

                                                        {selected && (
                                                            <div className="flex items-center gap-2">
                                                                <Label className="text-sm">Qty:</Label>
                                                                <Input
                                                                    type="number"
                                                                    min="1"
                                                                    max={equipment.quantity}
                                                                    value={selected.quantity_needed}
                                                                    onChange={(e) => updateEquipmentQuantity(
                                                                        equipment.id,
                                                                        Math.min(Number(e.target.value), equipment.quantity)
                                                                    )}
                                                                    className="w-20 text-sm p-2"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr_2fr] gap-2 mt-8 w-full">
                                    {/* Date Picker */}
                                    <div className="space-y-2">
                                        <Label>Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal overflow-truncate",
                                                        !currentDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-1 h-4 w-4" />
                                                    {currentDate ? format(currentDate, "PPP") : "Pick a date"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={currentDate}
                                                    onSelect={handleDateChange}
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
                                            onChange={handleTimeStartChange}
                                            min={"7:00"}
                                            max={"20:00"}
                                            className={cn(hasTimeConflict && "border-red-500 focus-visible:ring-red-500")}
                                        />
                                    </div>

                                    {/* End Time */}
                                    <div className="space-y-2">
                                        <Label htmlFor="time_end">End Time</Label>
                                        <Input
                                            id="time_end"
                                            type="time"
                                            value={currentTimeEnd}
                                            onChange={handleTimeEndChange}
                                            min={"7:00"}
                                            max={"20:00"}
                                            className={cn(hasTimeConflict && "border-red-500 focus-visible:ring-red-500")}
                                        />
                                    </div>
                                </div>

                                {/* Time Conflict Warning */}
                                {hasTimeConflict && (
                                    <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
                                        <svg className="h-5 w-5 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-red-800">Time Conflict Detected</p>
                                            <p className="text-xs text-red-700 mt-1">
                                                Your selected time overlaps with an existing booking. Please choose a different time slot.
                                            </p>
                                        </div>
                                    </div>
                                )}

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
                                            <div key={index} className="p-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="text-sm flex-1">
                                                        <div className="font-bold text-lg">{booking.facility_name}</div>
                                                        <div className="text-muted-foreground flex gap-2 items-center">
                                                            <CalendarIcon size={16} />
                                                            <span className='mr-4'>
                                                                {format(booking.date, "PPP")}
                                                            </span>
                                                            <Clock size={16} />
                                                            <span>
                                                                {formatTime(booking.time_start)} - {formatTime(booking.time_end)}
                                                            </span>
                                                        </div>

                                                        {/* Show selected equipment */}
                                                        {booking.equipment.length > 0 && (
                                                            <div className="mt-2 space-y-1">
                                                                <div className="font-semibold">Equipment:</div>
                                                                {booking.equipment.map((eq, eqIndex) => (
                                                                    <div key={eqIndex} className="text-muted-foreground">
                                                                        • {eq.equipment_name} (Qty: {eq.quantity_needed})
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
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
                </div>

                {/* Facility Info Sidebar */}
                <div className='hidden lg:block space-y-4'>


                    <h2 className='font-semibold text-sm text-muted-foreground'>Facility Info</h2>


                    {selectedFacility ? (
                        <div className=''>
                            {(() => {
                                const facility = facilities.find(f => f.id === selectedFacility);
                                return (
                                    <>
                                        <div className='mb-4'>
                                            <h3 className='font-semibold text-xl'>{facility?.name}</h3>
                                            {facility?.building && (
                                                <p className='text-sm text-muted-foreground'>
                                                    {facility.building}
                                                </p>
                                            )}
                                            <div className='flex items-center gap-2 mt-2'>
                                                <User size={16} />
                                                <span className='text-sm'>
                                                    Capacity - {facility?.capacity || 'N/A'}
                                                </span>
                                            </div>
                                        </div>

                                        {currentDate && (
                                            <div className='mt-6'>
                                                <h4 className='text-sm font-semibold mb-3 flex flex-wrap items-center'>
                                                    <CalendarIcon size={16} />
                                                    <span className='text-muted-foreground ml-2 mr-1'>
                                                        Schedule for
                                                    </span>
                                                    <span>
                                                        {format(currentDate, 'PPP')}
                                                    </span>
                                                </h4>

                                                {loadingSchedule ? (
                                                    <div className='text-sm text-muted-foreground py-4 text-center'>
                                                        Loading schedule...
                                                    </div>
                                                ) : facilitySchedule && facilitySchedule.bookings.length > 0 ? (
                                                    <div className='space-y-3'>
                                                        {facilitySchedule.bookings.map((booking, idx) => (
                                                            <div
                                                                key={idx}
                                                                className='border rounded-md p-3 bg-muted/30'
                                                            >
                                                                <div className='font-medium text-sm'>
                                                                    {booking.request_title}
                                                                </div>
                                                                <div className='flex items-center gap-2 text-xs text-muted-foreground mt-1'>
                                                                    <Clock size={14} />
                                                                    <span>
                                                                        {formatTime(booking.time_start)} - {formatTime(booking.time_end)}
                                                                    </span>
                                                                </div>
                                                                <div className='mt-1'>
                                                                    <span className='text-xs px-2 py-1 bg-green-100 text-green-800 rounded'>
                                                                        {booking.status}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className='text-sm text-muted-foreground py-4 text-center border rounded-md bg-muted/10'>
                                                        No bookings for this date
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {!currentDate && (
                                            <div className='text-sm text-muted-foreground py-4 text-center'>
                                                Select a date to view schedule
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className='px-6 pb-6 text-sm text-muted-foreground text-center py-8'>
                            Select a facility to view details
                        </div>
                    )}

                </div>
            </div>
        </DefaultLayout>
    );
}