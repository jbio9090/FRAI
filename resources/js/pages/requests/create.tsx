import { useForm, router } from '@inertiajs/react';
import { format } from "date-fns";
import { CalendarIcon, X, User, Clock, Building, AlertCircleIcon, SquareMousePointer, Plus, Paperclip, Pen, ImageIcon, File } from "lucide-react";
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
import { AttachedFileList } from '@/components/attached-file-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import DefaultLayout from '@/layout.tsx/default.';
import { cn } from "@/lib/utils";
import MotionChevron from '@/components/animated_icons/MotionChevron';
import { Facility } from '@/types/facility';
import { EquipmentConflict, FacilityEquipment } from '@/types/equipment';
import { PRIORITY_LABELS } from '@/types/request';
import { toast } from "sonner";
import { FacilityBookingList } from '@/components/facility-booking-list';


interface BorrowedEquipmentRequest {
    equipment_id: number;
    equipment_name: string;
    source_facility_id: number;
    source_facility_name: string;
    quantity_needed: number;
    max_quantity: number;
}

interface FacilityBooking {
    facility_id: number;
    facility_name: string;
    date: string;
    time_start: string;
    time_end: string;
    equipment: EquipmentRequest[];
    borrowed_equipment: BorrowedEquipmentRequest[];
    conflicts: BookingSchedule[];
    external_equipment: { name: string }[];
    expected_capacity: number | null;
    has_outsiders: boolean;
    equipment_conflicts: Record<number, EquipmentConflict[]>;
}

interface EquipmentRequest {
    equipment_id: number;
    equipment_name: string;
    quantity_needed: number;
    max_quantity: number;
    conflicts?: EquipmentConflict[];
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
    existing_files: ExistingFile[];
    approved_by: string[];
}

interface ExistingFile {
    id: number;
    original_name: string;
    mime_type: string;
    size: number;
    url: string;
    path: string;
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
    savedAt: number;
    approved_by: string[];
}

interface AttachedFile {
    file: File;
    preview?: string;
}

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

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
    } catch (err) {
        console.error(err);
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

const approversList = [
    { id: 1, name: "Faculty" },
    { id: 3, name: "College Dean" },
    { id: 4, name: "Chairperson" },
    { id: 5, name: "OSA" },
    { id: 6, name: "VP AA" },
    { id: 7, name: "VP Admin" },
    { id: 8, name: "President" },
];


export default function CreateRequest({ facilities, existingRequest }: CreateRequestProps) {
    const isEditing = !!existingRequest;
    const draft = loadDraft(existingRequest?.id);

    function draftDiffersFromExisting(draft: DraftData, existing: ExistingRequest): boolean {
        if (draft.title !== existing.title) return true;
        if (draft.description !== existing.description) return true;
        if (draft.priority_level !== existing.priority_level) return true;
        if (draft.priority_reason !== existing.priority_reason) return true;
        if (JSON.stringify(draft.facility_bookings) !== JSON.stringify(existing.facility_bookings)) return true;
        return false;
    }

    const hasMeaningfulDraft =
        !!draft && (!isEditing || (!!existingRequest && draftDiffersFromExisting(draft, existingRequest)));

    const [showDraftBanner, setShowDraftBanner] = useState<boolean>(hasMeaningfulDraft);
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

    const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
    const [currentDate, setCurrentDate] = useState<Date | undefined>(undefined);
    const [currentTimeStart, setCurrentTimeStart] = useState<string>('');
    const [currentTimeEnd, setCurrentTimeEnd] = useState<string>('');
    const [externalEquipment, setExternalEquipment] = useState<{ name: string }[]>([]);
    const [externalEquipmentInput, setExternalEquipmentInput] = useState<string>('');
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentRequest[]>([]);
    const [facilitySchedule, setFacilitySchedule] = useState<FacilityScheduleData | null>(null);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [hasTimeConflict, setHasTimeConflict] = useState(false);
    const [openCollapsible, setCollapsibleState] = useState(false);
    const [borrowingEquipmentId, setBorrowingEquipmentId] = useState<number | null>(null);
    const [selectedBorrowedEquipment, setSelectedBorrowedEquipment] = useState<BorrowedEquipmentRequest[]>([]);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expectedCapacity, setExpectedCapacity] = useState<number | ''>('');
    const [hasOutsiders, setHasOutsiders] = useState<boolean>(false);
    const [existingFiles, setExistingFiles] = useState<ExistingFile[]>(
        existingRequest?.existing_files ?? []
    );
    const [deletedFileIds, setDeletedFileIds] = useState<number[]>([]);
    const [approvedBy, setApprovedBy] = useState<string[]>(
        existingRequest?.approved_by ?? []
    );
    const [equipmentConflicts, setEquipmentConflicts] = useState<Record<number, EquipmentConflict[]>>({});
    const [checkingEquipmentConflicts, setCheckingEquipmentConflicts] = useState(false);
    const [equipmentAvailability, setEquipmentAvailability] = useState<Record<number, { total_quantity: number; available_quantity: number; is_limited: boolean }>>({});
    const [checkingAvailability, setCheckingAvailability] = useState(false);

    const handleCheckboxChange = (name: string) => {
        setData('approved_by', data.approved_by.includes(name)
            ? data.approved_by.filter((item) => item !== name)
            : [...data.approved_by, name]
        );
    };

    const allBorrowableEquipment = facilities
        .filter(f => f.id !== selectedFacility)
        .flatMap(f => (f.equipment ?? []).map(eq => ({ ...eq, facilityId: f.id, facilityName: f.name })))
        .reduce((unique, eq) => {
            const existing = unique.find(e => e.id === eq.id);
            if (!existing) {
                unique.push({ ...eq, sources: [{ facilityId: eq.facilityId, facilityName: eq.facilityName, quantity: eq.pivot.quantity }] });
            } else {
                existing.sources.push({ facilityId: eq.facilityId, facilityName: eq.facilityName, quantity: eq.pivot.quantity });
            }
            return unique;
        }, [] as Array<FacilityEquipment & { sources: { facilityId: number; facilityName: string; quantity: number }[] }>);

    const { data, setData, post, processing, errors, transform } = useForm({
        title: existingRequest?.title ?? '',
        description: existingRequest?.description ?? '',
        facility_bookings: existingRequest?.facility_bookings ?? [] as FacilityBooking[],
        priority_level: existingRequest?.priority_level ?? 0,
        priority_reason: existingRequest?.priority_reason ?? '',
        approved_by: existingRequest?.approved_by ?? [] as string[],
        files: [] as File[],
        existing_file_ids: [] as number[],
        _method: '',
    });

    useEffect(() => {
        if (showDraftBanner) return;

        const isEmpty =
            !data.title.trim() &&
            !data.description.trim() &&
            !data.priority_reason.trim() &&
            data.facility_bookings.length === 0 &&
            data.priority_level === 0;

        if (isEmpty) return;

        const timeout = setTimeout(() => {
            saveDraft({
                title: data.title,
                description: data.description,
                facility_bookings: data.facility_bookings,
                priority_level: data.priority_level as 0 | 1 | 2,
                priority_reason: data.priority_reason,
                approved_by: data.approved_by,
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
    }, [data.title, data.description, data.priority_level, data.priority_reason, data.facility_bookings, data.approved_by, showDraftBanner]);

    useEffect(() => {
        const ids = selectedEquipment.map(e => e.equipment_id);
        if (ids.length > 0) fetchEquipmentConflicts(ids);
        else setEquipmentConflicts({});

        if (selectedFacility && currentDate && currentTimeStart && currentTimeEnd) {
            fetchEquipmentAvailability();
        } else {
            setEquipmentAvailability({});
        }
    }, [currentTimeStart, currentTimeEnd, currentDate]);

    function editBooking(index: number) {
        const booking = data.facility_bookings[index];

        setSelectedFacility(booking.facility_id);
        setCurrentDate(new Date(booking.date));
        setCurrentTimeStart(booking.time_start);
        setCurrentTimeEnd(booking.time_end);
        setSelectedEquipment(booking.equipment);
        setSelectedBorrowedEquipment(booking.borrowed_equipment ?? []);
        setExternalEquipment(booking.external_equipment ?? []);
        setExpectedCapacity(booking.expected_capacity ?? '');
        setHasOutsiders(booking.has_outsiders ?? false);

        loadSchedule(booking.facility_id, new Date(booking.date));

        removeBooking(index);
    }

    const restoreDraft = () => {
        if (!draft) return;
        setData('title', draft.title);
        setData('description', draft.description);
        setData('priority_level', draft.priority_level);
        setData('priority_reason', draft.priority_reason);
        setData('facility_bookings', draft.facility_bookings);
        setData('approved_by', draft.approved_by ?? []);
        setShowDraftBanner(false);
        setLastSavedAt(draft.savedAt);
    };

    const discardDraft = () => {
        clearDraft(existingRequest?.id);
        setShowDraftBanner(false);
    };

    const availableEquipment: FacilityEquipment[] = selectedFacility
        ? facilities.find(f => f.id === selectedFacility)?.equipment ?? []
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
            quantity_needed: equipment.pivot.quantity,
            max_quantity: equipment.pivot.quantity,
        })));
    }


    function handleEquipmentToggle(equipment: FacilityEquipment) {
        const exists = selectedEquipment.find(e => e.equipment_id === equipment.id);
        let updated: EquipmentRequest[];
        if (exists) {
            updated = selectedEquipment.filter(e => e.equipment_id !== equipment.id);
            setEquipmentConflicts(prev => { const n = { ...prev }; delete n[equipment.id]; return n; });
        } else {
            updated = [...selectedEquipment, {
                equipment_id: equipment.id,
                equipment_name: equipment.name,
                quantity_needed: equipment.pivot.quantity,
                max_quantity: equipment.pivot.quantity,
            }];
        }
        setSelectedEquipment(updated);
        fetchEquipmentConflicts(updated.map(e => e.equipment_id));
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
            borrowed_equipment: selectedBorrowedEquipment,
            conflicts: getTimeConflictsFromData(facilitySchedule, currentTimeStart, currentTimeEnd),
            external_equipment: externalEquipment,
            expected_capacity: expectedCapacity === '' ? null : expectedCapacity,
            has_outsiders: hasOutsiders,
            equipment_conflicts: equipmentConflicts,
        };

        const updatedBookings = [...data.facility_bookings, newBooking];
        setData('facility_bookings', updatedBookings);

        setSelectedFacility(null);
        setCurrentDate(undefined);
        setCurrentTimeStart('');
        setCurrentTimeEnd('');
        setSelectedEquipment([]);
        setSelectedBorrowedEquipment([]);
        setBorrowingEquipmentId(null);
        setFacilitySchedule(null);
        setHasTimeConflict(false);
        setExternalEquipment([]);
        setExternalEquipmentInput('');
        setExpectedCapacity('');
        setHasOutsiders(false);
        setEquipmentConflicts({});
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const selected = Array.from(e.target.files ?? []);
        const newFiles: AttachedFile[] = selected.map(file => ({
            file,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        }));
        setAttachedFiles(prev => [...prev, ...newFiles]);
        e.target.value = '';
    }

    function removeFile(index: number) {
        setAttachedFiles(prev => {
            const updated = [...prev];
            if (updated[index].preview) URL.revokeObjectURL(updated[index].preview!);
            updated.splice(index, 1);
            return updated;
        });
    }

    function removeExistingFile(index: number) {
        setExistingFiles(prev => prev.filter((_, i) => i !== index));
    }

    function removeBooking(index: number) {
        const updatedBookings = data.facility_bookings.filter((_, i) => i !== index);
        setData('facility_bookings', updatedBookings);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();

        transform((d) => ({
            ...d,
            facility_bookings: JSON.stringify(d.facility_bookings),
            files: attachedFiles.map(f => f.file),
            existing_file_ids: existingFiles.map(f => f.id),
            _method: isEditing ? 'PUT' : '',
        }));

        const url = isEditing
            ? route('requests.update', existingRequest!.id)
            : route('requests.store');

        post(url, {
            forceFormData: true,
            onSuccess: () => clearDraft(existingRequest?.id),
            onError: (errs) => console.log('validation errors:', errs),
        });
    }

    async function fetchEquipmentConflicts(equipmentIds: number[]) {
        if (!currentDate || !currentTimeStart || !currentTimeEnd || equipmentIds.length === 0) return;

        setCheckingEquipmentConflicts(true);
        try {
            const res = await fetch(route('equipment.check-conflicts'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')!.content },
                body: JSON.stringify({
                    equipment_ids: equipmentIds,
                    date: format(currentDate, 'yyyy-MM-dd'),
                    time_start: currentTimeStart,
                    time_end: currentTimeEnd,
                }),
            });
            const data = await res.json();
            setEquipmentConflicts(data.conflicts ?? {});
        } catch (err) {
            console.error('Failed to check equipment conflicts', err);
        } finally {
            setCheckingEquipmentConflicts(false);
        }
    }

    async function fetchEquipmentAvailability() {
        if (!selectedFacility || !currentDate || !currentTimeStart || !currentTimeEnd) return;

        setCheckingAvailability(true);
        try {
            const res = await fetch(route('equipment.availability'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')!.content },
                body: JSON.stringify({
                    facility_id: selectedFacility,
                    date: format(currentDate, 'yyyy-MM-dd'),
                    time_start: currentTimeStart,
                    time_end: currentTimeEnd,
                }),
            });
            const data = await res.json();
            const availabilityMap = (data.availability ?? []).reduce((map: Record<number, any>, item: any) => {
                map[item.equipment_id] = {
                    total_quantity: item.total_quantity,
                    available_quantity: item.available_quantity,
                    is_limited: item.is_limited,
                };
                return map;
            }, {});
            setEquipmentAvailability(availabilityMap);
        } catch (err) {
            console.error('Failed to check equipment availability', err);
        } finally {
            setCheckingAvailability(false);
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

            <div className="w-full">
                <div className="max-w-3xl w-full mx-auto">
                    <form onSubmit={submit} className="space-y-8 flex flex-col gap-6">

                        {Object.keys(errors).length > 0 && (
                            <Alert variant="destructive" className="border-destructive bg-destructive/4 mb-0 mt-0">
                                <AlertCircleIcon />
                                <AlertTitle>Error with submission. Please properly fill in all the details.</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc pl-5 space-y-1 mt-1">
                                        {Object.entries(errors).map(([key, msg]) => (
                                            <li key={key}>{msg as string}</li>
                                        ))}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}

                        <Tabs defaultValue="details" className="w-full">
                            <TabsList className="w-full mb-6">
                                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                                <TabsTrigger value="facility" className="flex-1">Facility</TabsTrigger>
                            </TabsList>

                            {/* ── Details Tab ── */}
                            <TabsContent value="details" className="space-y-6 mt-0">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Request Title</Label>
                                    <Input
                                        id="title"
                                        type="text"
                                        value={data.title}
                                        onChange={(e) => setData('title', e.target.value)}
                                        placeholder="e.g., Annual Company Meeting"
                                    />
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
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="priority">Event Type</Label>
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
                                </div>

                                <div className="space-y-4">
                                    <Label className="font-semibold">Approved By</Label>

                                    <div className="flex flex-wrap gap-4 mt-2">
                                        {approversList.map((approver) => {
                                            const isChecked = data.approved_by.includes(approver.name)

                                            return (
                                                <div key={approver.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`approver-${approver.id}`}
                                                        checked={isChecked}
                                                        onCheckedChange={() =>
                                                            handleCheckboxChange(approver.name)
                                                        }
                                                    />
                                                    <Label htmlFor={`approver-${approver.id}`}>
                                                        {approver.name}
                                                    </Label>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>


                                {/* File Attachments */}
                                <div className="space-y-3">
                                    <Label>Attachments</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Attach supporting documents, images, or files (max 10MB each).
                                    </p>

                                    <label
                                        htmlFor="file-upload"
                                        className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                                    >
                                        <Paperclip size={20} className="text-muted-foreground mb-2" />
                                        <span className="text-sm text-muted-foreground">
                                            Click to attach files
                                        </span>
                                        <span className="text-xs text-muted-foreground mt-1">
                                            JPG, PNG, PDF, DOC, XLSX, PPTX up to 10MB
                                        </span>
                                        <input
                                            id="file-upload"
                                            type="file"
                                            multiple
                                            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xlsx,.pptx"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                    </label>

                                    <AttachedFileList
                                        files={attachedFiles}
                                        serverFiles={existingFiles}
                                        onRemove={removeFile}
                                        onRemoveServer={removeExistingFile}
                                    />

                                    {errors.files && (
                                        <p className="text-sm text-destructive">{errors.files}</p>
                                    )}
                                </div>
                            </TabsContent>

                            {/* Facility Tab */}
                            <TabsContent value="facility" className="space-y-6 mt-0">
                                <div className="space-y-8">
                                    <div className="grid grid-cols-[1fr_1fr] md:grid-cols-[3fr_2fr_2fr] gap-6 md:gap-4 w-full">
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

                                    {/* Expected Attendees + Has Outsiders */}
                                    <div className="flex items-end gap-4">
                                        <div className="space-y-2 flex-1">
                                            <Label htmlFor="expected_capacity">Expected Attendees</Label>
                                            <Input
                                                id="expected_capacity"
                                                type="number"
                                                min="1"
                                                value={expectedCapacity}
                                                onChange={(e) => setExpectedCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="Input expected attendees for this facility at this time"
                                                className="text-sm"
                                            />
                                        </div>

                                        <div className="flex items-center gap-2 pb-2 shrink-0">
                                            <Checkbox
                                                id="has_outsiders"
                                                checked={hasOutsiders}
                                                onCheckedChange={(checked) => setHasOutsiders(!!checked)}
                                            />
                                            <Label htmlFor="has_outsiders" className="text-sm cursor-pointer whitespace-nowrap">
                                                Has Outsiders
                                            </Label>
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
                                </div>

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
                                                const conflicts = equipmentConflicts[equipment.id] ?? [];
                                                const availability = equipmentAvailability[equipment.id];
                                                const displayQty = availability ? availability.available_quantity : equipment.pivot.quantity;
                                                const isLimited = availability ? availability.is_limited : false;
                                                const exceedsAvailable = selected && availability && selected.quantity_needed > availability.available_quantity;

                                                return (
                                                    <div key={equipment.id} className="space-y-1">
                                                        <div className="flex items-center justify-between gap-4">
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
                                                                    <Label className={cn("text-xs block", isLimited ? "text-orange-600 dark:text-orange-400 font-medium" : "text-muted-foreground")}>
                                                                        Available: {displayQty} {isLimited && `(${availability?.total_quantity} total)`}
                                                                    </Label>
                                                                </div>
                                                            </div>
                                                            {selected && (
                                                                <div className="flex items-center gap-4">
                                                                    <Label className="text-sm">Qty:</Label>
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        max={displayQty}
                                                                        value={selected.quantity_needed}
                                                                        onChange={(e) => updateEquipmentQuantity(equipment.id, Math.min(Number(e.target.value), displayQty))}
                                                                        className={cn("w-20 text-sm p-2", exceedsAvailable && "border-orange-400 bg-orange-50 dark:bg-orange-950/20")}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Availability warning */}
                                                        {exceedsAvailable && (
                                                            <div className="ml-7 flex items-start gap-1.5 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded px-2 py-1">
                                                                <AlertCircleIcon size={12} className="shrink-0 mt-0.5" />
                                                                <span>
                                                                    Only <strong>{availability?.available_quantity}</strong> available for the selected date/time
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Equipment conflict warning */}
                                                        {selected && conflicts.length > 0 && (
                                                            <div className="ml-7 space-y-1">
                                                                {conflicts.map((c, i) => (
                                                                    <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-2 py-1">
                                                                        <AlertCircleIcon size={12} className="shrink-0 mt-0.5" />
                                                                        <span>
                                                                            Also requested by <strong>{c.requester}</strong> ("{c.request_title}") —{' '}
                                                                            <span className={c.status === 'Approved' ? 'text-red-600 font-semibold' : ''}>
                                                                                {c.status}
                                                                            </span>
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Optional actions group — external equipment + borrow */}
                                <div className="space-y-2">
                                    <Collapsible>
                                        <CollapsibleTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                                            >
                                                <Plus size={16} />
                                                <span>Add external equipment</span>
                                                {externalEquipment.length > 0 && (
                                                    <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                                                        {externalEquipment.length}
                                                    </span>
                                                )}
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <div className="mt-3 space-y-3 px-1">
                                                <p className="text-xs text-muted-foreground">
                                                    List equipment you'll be bringing that isn't in our inventory.
                                                </p>

                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="e.g., Portable speaker"
                                                        value={externalEquipmentInput}
                                                        onChange={(e) => setExternalEquipmentInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                const trimmed = externalEquipmentInput.trim();
                                                                if (!trimmed) return;
                                                                setExternalEquipment(prev => [...prev, { name: trimmed }]);
                                                                setExternalEquipmentInput('');
                                                            }
                                                        }}
                                                        className="text-sm"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={() => {
                                                            const trimmed = externalEquipmentInput.trim();
                                                            if (!trimmed) return;
                                                            setExternalEquipment(prev => [...prev, { name: trimmed }]);
                                                            setExternalEquipmentInput('');
                                                        }}
                                                    >
                                                        Add
                                                    </Button>
                                                </div>

                                                {externalEquipment.length > 0 && (
                                                    <div className="space-y-1.5">
                                                        {externalEquipment.map((item, i) => (
                                                            <div
                                                                key={i}
                                                                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm bg-muted/20"
                                                            >
                                                                <span>{item.name}</span>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                                    onClick={() =>
                                                                        setExternalEquipment(prev => prev.filter((_, idx) => idx !== i))
                                                                    }
                                                                >
                                                                    <X size={14} />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>

                                    {selectedFacility && (
                                        <Collapsible>
                                            <CollapsibleTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                                                >
                                                    <Plus size={16} />
                                                    <span>Borrow equipment from another facility</span>
                                                    {selectedBorrowedEquipment.length > 0 && (
                                                        <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                                                            {selectedBorrowedEquipment.length}
                                                        </span>
                                                    )}
                                                </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="mt-3 space-y-4">
                                                <div className="border rounded-md p-4 space-y-4 bg-muted/20">

                                                    {/* Step 1 — pick equipment */}
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                                Step 1 — Select Equipment
                                                            </Label>
                                                            {borrowingEquipmentId && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setBorrowingEquipmentId(null)}
                                                                    className="h-auto py-1 px-2 text-xs text-muted-foreground gap-1"
                                                                >
                                                                    <X size={12} />
                                                                    Done configuring
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Click an item to configure which facility to borrow it from. You can configure multiple equipment items.
                                                        </p>
                                                        <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                                                            {allBorrowableEquipment.length === 0 ? (
                                                                <p className="text-sm text-muted-foreground text-center py-2">
                                                                    No equipment available to borrow.
                                                                </p>
                                                            ) : allBorrowableEquipment.map((equipment) => {
                                                                const isSelected = borrowingEquipmentId === equipment.id;
                                                                const alreadyBorrowed = selectedBorrowedEquipment.filter(e => e.equipment_id === equipment.id);
                                                                return (
                                                                    <button
                                                                        key={equipment.id}
                                                                        type="button"
                                                                        onClick={() => setBorrowingEquipmentId(isSelected ? null : equipment.id)}
                                                                        className={cn(
                                                                            "w-full text-left rounded-md px-3 py-2 text-sm transition-colors",
                                                                            isSelected
                                                                                ? "bg-primary/10 border border-primary/30"
                                                                                : "hover:bg-muted/50 border border-transparent"
                                                                        )}
                                                                    >
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="font-medium">{equipment.name}</span>
                                                                            {alreadyBorrowed.length > 0 && (
                                                                                <span className="text-xs text-primary font-medium">
                                                                                    {alreadyBorrowed.reduce((s, e) => s + e.quantity_needed, 0)} borrowed
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                                            Available in {equipment.sources.length} {equipment.sources.length === 1 ? 'facility' : 'facilities'}
                                                                        </p>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Step 2 */}
                                                    {borrowingEquipmentId && (() => {
                                                        const equipment = allBorrowableEquipment.find(e => e.id === borrowingEquipmentId);
                                                        if (!equipment) return null;
                                                        return (
                                                            <div className="space-y-3">
                                                                <div className="space-y-2">
                                                                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                                        Step 2 — Choose Facility & Quantity for "{equipment.name}"
                                                                    </Label>
                                                                    <div className="space-y-2">
                                                                        {equipment.sources.map(source => {
                                                                            const borrowed = selectedBorrowedEquipment.find(
                                                                                e => e.equipment_id === equipment.id && e.source_facility_id === source.facilityId
                                                                            );
                                                                            return (
                                                                                <div
                                                                                    key={source.facilityId}
                                                                                    className="flex items-center justify-between gap-4 border rounded-md px-3 py-2 bg-background"
                                                                                >
                                                                                    <div className="flex items-center gap-3 flex-1">
                                                                                        <Checkbox
                                                                                            id={`borrow-${equipment.id}-${source.facilityId}`}
                                                                                            checked={!!borrowed}
                                                                                            onCheckedChange={() => {
                                                                                                if (borrowed) {
                                                                                                    setSelectedBorrowedEquipment(prev =>
                                                                                                        prev.filter(e => !(e.equipment_id === equipment.id && e.source_facility_id === source.facilityId))
                                                                                                    );
                                                                                                } else {
                                                                                                    setSelectedBorrowedEquipment(prev => [...prev, {
                                                                                                        equipment_id: equipment.id,
                                                                                                        equipment_name: equipment.name,
                                                                                                        source_facility_id: source.facilityId,
                                                                                                        source_facility_name: source.facilityName,
                                                                                                        quantity_needed: 1,
                                                                                                        max_quantity: source.quantity,
                                                                                                    }]);
                                                                                                }
                                                                                            }}
                                                                                        />
                                                                                        <div>
                                                                                            <Label htmlFor={`borrow-${equipment.id}-${source.facilityId}`} className="text-sm font-medium cursor-pointer">
                                                                                                {source.facilityName}
                                                                                            </Label>
                                                                                            <p className="text-xs text-muted-foreground">
                                                                                                Available: {source.quantity}
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
                                                                                    {borrowed && (
                                                                                        <div className="flex items-center gap-2">
                                                                                            <Label className="text-sm">Qty:</Label>
                                                                                            <Input
                                                                                                type="number"
                                                                                                min="1"
                                                                                                max={source.quantity}
                                                                                                value={borrowed.quantity_needed}
                                                                                                onChange={(e) => {
                                                                                                    const qty = Math.min(Number(e.target.value), source.quantity);
                                                                                                    setSelectedBorrowedEquipment(prev => prev.map(item =>
                                                                                                        item.equipment_id === equipment.id && item.source_facility_id === source.facilityId
                                                                                                            ? { ...item, quantity_needed: qty }
                                                                                                            : item
                                                                                                    ));
                                                                                                }}
                                                                                                className="w-20 text-sm p-2"
                                                                                            />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>

                                                                {/* Other already-configured equipment shown while in Step 2 */}
                                                                {(() => {
                                                                    const otherBorrowed = Object.entries(
                                                                        selectedBorrowedEquipment
                                                                            .reduce((groups, eq) => ({
                                                                                ...groups,
                                                                                [eq.equipment_name]: [...(groups[eq.equipment_name] ?? []), eq]
                                                                            }), {} as Record<string, BorrowedEquipmentRequest[]>)
                                                                    );
                                                                    if (otherBorrowed.length === 0) return null;
                                                                    return (
                                                                        <div className="border rounded-md px-3 py-2 bg-muted/10 space-y-2">
                                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                                                Other configured equipment
                                                                            </p>
                                                                            {otherBorrowed.map(([equipmentName, items]) => (
                                                                                <div key={equipmentName} className="text-sm">
                                                                                    <span className="font-medium">{equipmentName}</span>
                                                                                    <span className="text-muted-foreground text-xs ml-1">
                                                                                        · total {items.reduce((s, e) => s + e.quantity_needed, 0)}
                                                                                    </span>
                                                                                    <div className="pl-3 mt-0.5 space-y-0.5">
                                                                                        {items.map(eq => (
                                                                                            <div key={`${eq.equipment_id}-${eq.source_facility_id}`} className="text-xs text-muted-foreground flex justify-between items-center">
                                                                                                <span>from {eq.source_facility_name}</span>
                                                                                                <Button
                                                                                                    type="button"
                                                                                                    variant="ghost"
                                                                                                    size="icon"
                                                                                                    className="h-5 w-5 text-destructive hover:text-destructive/70"
                                                                                                    onClick={() => setSelectedBorrowedEquipment(prev =>
                                                                                                        prev.filter(e => !(e.equipment_id === eq.equipment_id && e.source_facility_id === eq.source_facility_id))
                                                                                                    )}
                                                                                                >
                                                                                                    <X size={10} />
                                                                                                </Button>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Summary when NOT configuring any specific equipment */}
                                                    {!borrowingEquipmentId && selectedBorrowedEquipment.length > 0 && (
                                                        <div className="space-y-3 pt-2 border-t">
                                                            <p className="text-xs text-muted-foreground font-medium">Selected to borrow:</p>
                                                            {Object.entries(
                                                                selectedBorrowedEquipment.reduce((groups, eq) => ({
                                                                    ...groups,
                                                                    [eq.equipment_name]: [...(groups[eq.equipment_name] ?? []), eq]
                                                                }), {} as Record<string, BorrowedEquipmentRequest[]>)
                                                            ).map(([equipmentName, items]) => (
                                                                <div key={equipmentName}>
                                                                    <p className="text-xs font-semibold mb-1">
                                                                        {equipmentName}
                                                                        <span className="text-muted-foreground font-normal ml-1">
                                                                            · total {items.reduce((s, e) => s + e.quantity_needed, 0)}
                                                                        </span>
                                                                    </p>
                                                                    {items.map(eq => (
                                                                        <div key={`${eq.equipment_id}-${eq.source_facility_id}`} className="flex justify-between items-center text-sm pl-2 text-muted-foreground">
                                                                            <span>from {eq.source_facility_name} · {eq.quantity_needed}</span>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-6 w-6 text-destructive hover:text-destructive/70"
                                                                                onClick={() => setSelectedBorrowedEquipment(prev =>
                                                                                    prev.filter(e => !(e.equipment_id === eq.equipment_id && e.source_facility_id === eq.source_facility_id))
                                                                                )}
                                                                            >
                                                                                <X size={12} />
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    )}
                                </div>

                                <div className="flex">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={addFacilityBooking}
                                        disabled={!selectedFacility || !currentDate || !currentTimeStart || !currentTimeEnd}
                                        className="w-full"
                                    >
                                        <span>
                                            Add Facility Booking
                                        </span>
                                    </Button>
                                </div>

                                <FacilityBookingList
                                    bookings={data.facility_bookings}
                                    onEdit={editBooking}
                                    onRemove={removeBooking}
                                    formatTime={formatTime}
                                />

                                <FacilityInfo
                                    selectedFacility={selectedFacility}
                                    facilities={facilities}
                                    currentDate={currentDate}
                                    loadingSchedule={loadingSchedule}
                                    facilitySchedule={facilitySchedule}
                                    formatTime={formatTime}
                                    isForSidebar={true}
                                />
                            </TabsContent>
                        </Tabs>

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
            </div>
        </DefaultLayout>
    );
}

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