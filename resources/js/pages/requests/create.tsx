import { useForm } from '@inertiajs/react';
import { format } from "date-fns";
import { CalendarIcon, X, User, Clock, Building, AlertCircleIcon, SquareMousePointer, Plus, Save } from "lucide-react";
import { motion } from "motion/react"
import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger, } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea";
import DefaultLayout from '@/layout.tsx/default.';
import { cn } from "@/lib/utils";
import MotionChevron from '@/components/animated_icons/MotionChevron';
import { Facility } from '@/types/facility';
import { Equipment } from '@/types/equipment';
import { PRIORITY_LABELS } from '@/types/request';
import { toast } from "sonner";

interface FacilityBooking {
    facility_id: number;
    facility_name: string;
    date: string;
    time_start: string;
    time_end: string;
    equipment: EquipmentRequest[];
    conflicts: BookingSchedule[];
    external_equipment: string;
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

interface ExistingRequest {
    id: number;
    title: string;
    description: string;
    priority_level: 0 | 1 | 2;
    priority_reason: string;
    facility_bookings: FacilityBooking[];
}

interface CreateRequestProps {
    facilities: Facility[];
    existingRequest?: ExistingRequest;
}

interface DraftData {
    title: string;
    description: string;
    facility_bookings: FacilityBooking[];
    priority_level: 0 | 1 | 2;
    priority_reason: string;
    savedAt: number; // unix timestamp
}

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

function getDraftKey(existingId?: number) {
    return existingId ? `request_draft_edit_${existingId}` : 'request_draft_create';
}

function loadDraft(existingId?: number): DraftData | null {
    try {
        const raw = localStorage.getItem(getDraftKey(existingId));
        if (!raw) return null;
        const draft: DraftData = JSON.parse(raw);
        if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
            localStorage.removeItem(getDraftKey(existingId));
            return null;
        }
        return draft;
    } catch {
        return null;
    }
}

function saveDraft(data: Omit<DraftData, 'savedAt'>, existingId?: number) {
    try {
        localStorage.setItem(getDraftKey(existingId), JSON.stringify({
            ...data,
            savedAt: Date.now(),
        }));
    } catch {
        // localStorage might be full or unavailable
    }
}

function clearDraft(existingId?: number) {
    localStorage.removeItem(getDraftKey(existingId));
}

function timeAgo(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export default function CreateRequest({ facilities, existingRequest }: CreateRequestProps) {
    const isEditing = !!existingRequest;
    const draft = loadDraft(existingRequest?.id);

    // If there's a saved draft, we'll prompt to restore it
    const [showDraftBanner, setShowDraftBanner] = useState<boolean>(!!draft);
    const [draftRestoredAt] = useState<number | null>(draft?.savedAt ?? null);
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

    // Initialize from draft if restored, otherwise from existingRequest or empty
    const getInitialBookings = () => {
        if (draft && showDraftBanner) return draft.facility_bookings;
        return existingRequest?.facility_bookings ?? [];
    };

    const [facilityBookings, setFacilityBookings] = useState<FacilityBooking[]>(
        existingRequest?.facility_bookings ?? []
    );
    const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
    const [currentDate, setCurrentDate] = useState<Date | undefined>(undefined);
    const [currentTimeStart, setCurrentTimeStart] = useState<string>('');
    const [currentTimeEnd, setCurrentTimeEnd] = useState<string>('');
    const [externalEquipment, setExternalEquipment] = useState<string>('');
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentRequest[]>([]);
    const [facilitySchedule, setFacilitySchedule] = useState<FacilityScheduleData | null>(null);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [hasTimeConflict, setHasTimeConflict] = useState(false);
    const [openCollapsible, setCollapsibleState] = useState(false);

    const { data, setData, post, put, processing, errors } = useForm({
        title: existingRequest?.title ?? '',
        description: existingRequest?.description ?? '',
        facility_bookings: existingRequest?.facility_bookings ?? [] as FacilityBooking[],
        priority_level: existingRequest?.priority_level ?? 0,
        priority_reason: existingRequest?.priority_reason ?? '',
    });

    useEffect(() => {
        if (showDraftBanner) return;

        const timeout = setTimeout(() => {
            saveDraft({
                title: data.title,
                description: data.description,
                facility_bookings: facilityBookings,
                priority_level: data.priority_level as 0 | 1 | 2,
                priority_reason: data.priority_reason,
            }, existingRequest?.id);

            toast.success(
                'Draft saved',
                {
                    description: 'Your progress has been saved locally.',
                    duration: 2000,
                    position: "top-right"
                }
            );
        }, 2000);

        return () => clearTimeout(timeout);
    }, [data.title, data.description, data.priority_level, data.priority_reason, facilityBookings, showDraftBanner]);

    // Restore draft
    const restoreDraft = () => {
        if (!draft) return;
        setData('title', draft.title);
        setData('description', draft.description);
        setData('priority_level', draft.priority_level);
        setData('priority_reason', draft.priority_reason);
        setData('facility_bookings', draft.facility_bookings);
        setFacilityBookings(draft.facility_bookings);
        setShowDraftBanner(false);
        setLastSavedAt(draft.savedAt);
    };

    const discardDraft = () => {
        clearDraft(existingRequest?.id);
        setShowDraftBanner(false);
    };

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
                route('facility.schedule', { facility: facilityId, date: dateString })
            );
            const data = await response.json();
            setFacilitySchedule(data);
            if (currentTimeStart && currentTimeEnd) {
                setHasTimeConflict(checkTimeConflictWithData(data, currentTimeStart, currentTimeEnd));
            }
        } catch (error) {
            console.error('Failed to load schedule:', error);
            setFacilitySchedule(null);
        } finally {
            setLoadingSchedule(false);
        }
    }

    function handleFacilityChange(value: string) {
        const facilityId = Number(value);
        setSelectedFacility(facilityId);
        setSelectedEquipment([]);
        if (currentDate) loadSchedule(facilityId, currentDate);
    }

    const handleDateChange = (date: Date | undefined) => {
        setCurrentDate(date);
        if (selectedFacility && date) loadSchedule(selectedFacility, date);
    };

    function clearEquipmentSelection(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        setSelectedEquipment([]);
    }

    function selectAllEquipment(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        setSelectedEquipment(availableEquipment.map((equipment) => ({
            equipment_id: equipment.id,
            equipment_name: equipment.name,
            quantity_needed: equipment.quantity,
            max_quantity: equipment.quantity,
        })));
    }

    function handleEquipmentToggle(equipment: Equipment) {
        const exists = selectedEquipment.find(e => e.equipment_id === equipment.id);
        if (exists) {
            setSelectedEquipment(selectedEquipment.filter(e => e.equipment_id !== equipment.id));
        } else {
            setSelectedEquipment([...selectedEquipment, {
                equipment_id: equipment.id,
                equipment_name: equipment.name,
                quantity_needed: equipment.quantity,
                max_quantity: equipment.quantity,
            }]);
        }
    }

    function updateEquipmentQuantity(equipmentId: number, quantity: number) {
        setSelectedEquipment(selectedEquipment.map(e =>
            e.equipment_id === equipmentId ? { ...e, quantity_needed: quantity } : e
        ));
    }

    function checkTimeConflictWithData(schedule: FacilityScheduleData | null, startTime: string, endTime: string): boolean {
        if (!schedule || !schedule.bookings.length) return false;
        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);
        return schedule.bookings.some(booking => {
            const bookingStart = new Date(`2000-01-01T${booking.time_start}`);
            const bookingEnd = new Date(`2000-01-01T${booking.time_end}`);
            return start < bookingEnd && end > bookingStart;
        });
    }

    function checkTimeConflict(startTime: string, endTime: string): boolean {
        return checkTimeConflictWithData(facilitySchedule, startTime, endTime);
    }

    function getTimeConflictsFromData(schedule: FacilityScheduleData | null, startTime: string, endTime: string): BookingSchedule[] {
        if (!schedule || !schedule.bookings.length) return [];
        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);
        return schedule.bookings.filter(booking => {
            const bookingStart = new Date(`2000-01-01T${booking.time_start}`);
            const bookingEnd = new Date(`2000-01-01T${booking.time_end}`);
            return start < bookingEnd && end > bookingStart;
        });
    }

    function handleTimeStartChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newStartTime = e.target.value;
        setCurrentTimeStart(newStartTime);
        if (newStartTime && currentTimeEnd) setHasTimeConflict(checkTimeConflict(newStartTime, currentTimeEnd));
    }

    function handleTimeEndChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newEndTime = e.target.value;
        setCurrentTimeEnd(newEndTime);
        if (currentTimeStart && newEndTime) setHasTimeConflict(checkTimeConflict(currentTimeStart, newEndTime));
    }

    function addFacilityBooking() {
        if (!selectedFacility || !currentDate || !currentTimeStart || !currentTimeEnd) return;
        const facility = facilities.find(f => f.id === selectedFacility);
        if (!facility) return;

        const newBooking: FacilityBooking = {
            facility_id: selectedFacility,
            facility_name: facility.name,
            date: format(currentDate, "yyyy-MM-dd"),
            time_start: currentTimeStart,
            time_end: currentTimeEnd,
            equipment: selectedEquipment,
            conflicts: getTimeConflictsFromData(facilitySchedule, currentTimeStart, currentTimeEnd),
            external_equipment: externalEquipment,
        };

        const updatedBookings = [...facilityBookings, newBooking];
        setFacilityBookings(updatedBookings);
        setData('facility_bookings', updatedBookings);

        setSelectedFacility(null);
        setCurrentDate(undefined);
        setCurrentTimeStart('');
        setCurrentTimeEnd('');
        setSelectedEquipment([]);
        setFacilitySchedule(null);
        setHasTimeConflict(false);
        setExternalEquipment('');
    }

    function removeBooking(index: number) {
        const updatedBookings = facilityBookings.filter((_, i) => i !== index);
        setFacilityBookings(updatedBookings);
        setData('facility_bookings', updatedBookings);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (isEditing) {
            put(route('requests.update', existingRequest!.id), {
                onSuccess: () => clearDraft(existingRequest?.id),
            });
        } else {
            post(route('requests.store'), {
                onSuccess: () => clearDraft(),
            });
        }
    }

    return (
        <DefaultLayout>
            <AlertDialog open={showDraftBanner} onOpenChange={(open) => { if (!open) discardDraft(); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore unsaved draft?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have an unsaved draft from <span className="font-medium text-foreground">{draft ? timeAgo(draft.savedAt) : ''}</span>. Would you like to restore it, or start fresh?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={discardDraft}>
                            Discard
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={restoreDraft}>
                            Restore Draft
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="w-full lg:grid lg:grid-cols-[5fr_3fr] gap-8">
                <div className="max-w-3xl w-full mx-auto">
                    <form onSubmit={submit} className="space-y-8 flex flex-col gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Request Title</Label>
                            <Input
                                id="title"
                                type="text"
                                value={data.title}
                                onChange={(e) => setData('title', e.target.value)}
                                placeholder="e.g., Annual Company Meeting"
                            />
                            {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                placeholder="Provide details about your request"
                                rows={4}
                            />
                            {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="priority">Priority Level</Label>
                            <Select
                                value={data.priority_level.toString()}
                                onValueChange={(value) => setData('priority_level', parseInt(value) as 0 | 1 | 2)}
                            >
                                <SelectTrigger className='w-full'>
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.priority_level && <p className="text-sm text-destructive">{errors.priority_level}</p>}
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-6">
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
                                                    <b>{facility.name}</b>
                                                    <div className="flex items-center gap-1 font-semibold text-muted-foreground">
                                                        <User />
                                                        <span className='text-xs'>{facility.capacity && facility.capacity}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Collapsible className='text-sm block lg:hidden' open={openCollapsible} onOpenChange={setCollapsibleState}>
                                    <CollapsibleTrigger className='cursor-pointer flex items-center text-muted-foreground gap-4'>
                                        <MotionChevron openCollapsible={openCollapsible} />
                                        <span className='font-semibold'>Facility Info</span>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className={cn("text-popover-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2")}>
                                        <FacilityInfo
                                            selectedFacility={selectedFacility}
                                            facilities={facilities}
                                            currentDate={currentDate}
                                            loadingSchedule={loadingSchedule}
                                            facilitySchedule={facilitySchedule}
                                            formatTime={formatTime}
                                            isForSidebar={false}
                                        />
                                    </CollapsibleContent>
                                </Collapsible>

                                {selectedFacility && availableEquipment.length > 0 && (
                                    <>
                                        <div className="space-y-2">
                                            <div className="flex justify-around items-end">
                                                <Label className='ml-0 mt-4 mb-2 mr-auto'>Select Equipment</Label>
                                                {selectedEquipment.length < availableEquipment.length && (
                                                    <Button variant={"ghost"} size={"sm"} onClick={selectAllEquipment} className='text-muted-foreground hover:text-foreground'>
                                                        <span className="text-sm">Select All</span>
                                                        <SquareMousePointer />
                                                    </Button>
                                                )}
                                                {selectedEquipment.length > 0 && (
                                                    <Button variant={"ghost"} size={"sm"} onClick={clearEquipmentSelection} className='text-muted-foreground hover:text-foreground'>
                                                        <span className="text-sm">Clear All</span>
                                                        <X />
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="border rounded-md p-3 space-y-3 max-h-64 overflow-y-auto">
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
                                                                    <Label htmlFor={`equipment-${equipment.id}`} className="text-sm text-foreground font-medium cursor-pointer">
                                                                        {equipment.name}
                                                                    </Label>
                                                                    <Label className="text-xs text-muted-foreground">
                                                                        Available: {equipment.quantity}
                                                                    </Label>
                                                                </div>
                                                            </div>
                                                            {selected && (
                                                                <div className="flex items-center gap-4">
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

                                        <Collapsible>
                                            <CollapsibleTrigger asChild>
                                                <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                                                    <Plus size={16} />
                                                    <span>Add external equipment</span>
                                                </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <div className="mt-3 space-y-4">
                                                    <Label htmlFor="external_equipment">External Equipment</Label>
                                                    <Textarea
                                                        id="external_equipment"
                                                        placeholder="Describe any external equipment you'll be bringing (e.g., 2 portable speakers, 1 projector stand)"
                                                        rows={3}
                                                        value={externalEquipment}
                                                        onChange={(e) => setExternalEquipment(e.target.value)}
                                                    />
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </>
                                )}

                                <div className="grid grid-cols-[1fr_1fr] md:grid-cols-[3fr_2fr_2fr] gap-6 md:gap-4 mt-8 w-full">
                                    <div className="space-y-2 col-span-full md:col-span-1">
                                        <Label>Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className={cn("w-full justify-start text-left font-normal overflow-truncate", !currentDate && "text-muted-foreground")}
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

                                    <div className="space-y-2">
                                        <Label htmlFor="time_start">Start Time</Label>
                                        <Input
                                            id="time_start"
                                            type="time"
                                            value={currentTimeStart}
                                            onChange={handleTimeStartChange}
                                            min={"7:00"}
                                            max={"20:00"}
                                            className={"text-sm"}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="time_end">End Time</Label>
                                        <Input
                                            id="time_end"
                                            type="time"
                                            value={currentTimeEnd}
                                            onChange={handleTimeEndChange}
                                            min={"7:00"}
                                            max={"20:00"}
                                            className={"text-sm"}
                                        />
                                    </div>
                                </div>

                                {hasTimeConflict && (
                                    <Alert variant="destructive" className="border-destructive bg-destructive/4">
                                        <AlertCircleIcon />
                                        <AlertTitle>Time Conflict Detected</AlertTitle>
                                        <AlertDescription>
                                            Your selected time overlaps with an existing event. Please choose a different time slot.
                                        </AlertDescription>
                                    </Alert>
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

                            {facilityBookings.length > 0 && (
                                <div className="space-y-4 mt-16">
                                    <Label>{isEditing ? 'Facility Bookings' : 'Added Facility Bookings'}</Label>
                                    <div className="flex flex-wrap gap-2 lg:grid grid-cols-[1fr_1fr] ">
                                        {facilityBookings.map((booking, index) => (
                                            <div key={index} className="py-5 pl-7 pr-2 border border-border border-1 rounded-sm grow-1 bg-secondary/50">
                                                <div className="flex items-start justify-between">
                                                    <div className="text-sm flex-1">
                                                        <div className="font-bold text-lg">{booking.facility_name}</div>
                                                        <div className="text-foreground flex flex-wrap items-center">
                                                            <div className="flex items-center gap-1">
                                                                <CalendarIcon size={16} />
                                                                <span className='mr-4'>{format(booking.date, "PPP")}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Clock className="text-foreground" size={16} />
                                                                <span>{formatTime(booking.time_start)} - {formatTime(booking.time_end)}</span>
                                                            </div>
                                                        </div>

                                                        {booking.conflicts.length > 0 && booking.conflicts.map((conflict, i) => (
                                                            <Alert key={i} variant="destructive" className="my-4 border-destructive bg-destructive/4">
                                                                <AlertCircleIcon />
                                                                <AlertTitle>Time Conflict Detected</AlertTitle>
                                                                <AlertDescription>
                                                                    Your selected time overlaps with {conflict.request_title}, which is during {formatTime(conflict.time_start)}-{formatTime(conflict.time_end)}
                                                                </AlertDescription>
                                                            </Alert>
                                                        ))}

                                                        {booking.equipment.length > 0 && (
                                                            <div className="mt-4 space-y-1">
                                                                <div className="text-muted-foreground">Equipment:</div>
                                                                {booking.equipment.map((eq, eqIndex) => (
                                                                    <div key={eqIndex} className="">
                                                                        {eq.equipment_name} (Qty: {eq.quantity_needed})
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {booking.external_equipment && (
                                                            <div className="mt-4 flex flex-col">
                                                                <span className="text-muted-foreground">External Equipment: </span>
                                                                <span className="">{booking.external_equipment}</span>
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
                                <Alert variant="destructive" className="border-destructive bg-destructive/4">
                                    <AlertCircleIcon />
                                    <AlertTitle>Booking Conflict</AlertTitle>
                                    <AlertDescription>
                                        {Array.isArray(errors.facility_bookings) ? (
                                            <ul className="list-disc pl-5 space-y-1">
                                                {errors.facility_bookings.map((error, idx) => (
                                                    <li key={idx}>{error}</li>
                                                ))}
                                            </ul>
                                        ) : errors.facility_bookings}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        <div className="flex justify-end gap-4 mb-16">
                            <Button type="button" variant="outline" onClick={() => window.history.back()}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing
                                    ? (isEditing ? 'Saving...' : 'Submitting...')
                                    : (isEditing ? 'Save Changes' : 'Submit Request')}
                            </Button>
                        </div>
                    </form>
                </div>

                <FacilityInfo
                    selectedFacility={selectedFacility}
                    facilities={facilities}
                    currentDate={currentDate}
                    loadingSchedule={loadingSchedule}
                    facilitySchedule={facilitySchedule}
                    formatTime={formatTime}
                    isForSidebar={true}
                />
            </div>
        </DefaultLayout>
    );
}

// FacilityInfo unchanged
interface FacilityInfoProps {
    selectedFacility: number | null;
    facilities: Facility[];
    currentDate: Date | undefined;
    loadingSchedule: boolean;
    facilitySchedule: FacilityScheduleData | null;
    formatTime(time: string): string;
    isForSidebar: boolean;
}

function FacilityInfo({ selectedFacility, facilities, currentDate, loadingSchedule, facilitySchedule, formatTime, isForSidebar }: FacilityInfoProps) {
    return (
        <div className={'space-y-4 ' + ((isForSidebar) ? 'hidden lg:block' : 'block lg:hidden')}>
            {isForSidebar && <h2 className='font-semibold text-sm text-foreground'>Facility Info</h2>}
            {selectedFacility ? (
                <motion.div>
                    {(() => {
                        const facility = facilities.find(f => f.id === selectedFacility);
                        return (
                            <>
                                <div className='mb-4'>
                                    <h3 className='font-semibold text-xl mt-2'>{facility?.name}</h3>
                                    <div className='flex text-muted-foreground font-semibold text-xl gap-1 mt-2'>
                                        <Building size={16} className={cn(isForSidebar && "hidden")} />
                                        <span className='text-sm text-wrap'>{facility?.building}</span>
                                    </div>
                                    <div className='flex font-semibold text-xl items-center gap-1 mt-2'>
                                        <User size={16} />
                                        <span className='text-sm'>Capacity - {facility?.capacity || 'N/A'}</span>
                                    </div>
                                </div>
                                {currentDate && (
                                    <div className='mt-6'>
                                        <h4 className='text-sm font-semibold mb-3 flex flex-wrap items-center'>
                                            <CalendarIcon size={16} />
                                            <span className='text-muted-foreground ml-2 mr-1'>Schedule for</span>
                                            <span>{format(currentDate, 'PPP')}</span>
                                        </h4>
                                        {loadingSchedule ? (
                                            <div className='text-sm text-muted-foreground py-4 text-center'>Loading schedule...</div>
                                        ) : facilitySchedule && facilitySchedule.bookings.length > 0 ? (
                                            <div className='space-y-3'>
                                                {facilitySchedule.bookings.map((booking, idx) => (
                                                    <motion.div key={idx} className='border rounded-md p-3 bg-muted/30' initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                                        <div className='font-medium text-sm'>{booking.request_title}</div>
                                                        <div className='flex items-center gap-4 text-xs text-muted-foreground mt-1'>
                                                            <Clock size={14} />
                                                            <span>{formatTime(booking.time_start)} - {formatTime(booking.time_end)}</span>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        ) : (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='text-sm text-muted-foreground py-4 text-center border rounded-md bg-muted/10'>
                                                No bookings for this date
                                            </motion.div>
                                        )}
                                    </div>
                                )}
                                {!currentDate && (
                                    <div className='text-sm text-muted-foreground py-4 text-center'>Select a date to view schedule</div>
                                )}
                            </>
                        );
                    })()}
                </motion.div>
            ) : (
                <div className='px-6 pb-6 text-sm text-muted-foreground text-center py-8'>Select a facility to view details</div>
            )}
        </div>
    );
}