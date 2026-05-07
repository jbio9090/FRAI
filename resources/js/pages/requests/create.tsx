import { useForm, router } from '@inertiajs/react';
import { format } from 'date-fns';
import {
    CalendarIcon,
    X,
    User,
    Clock,
    Building,
    AlertCircleIcon,
    SquareMousePointer,
    Minus,
    Plus,
    Paperclip,
    Info,
    Search,
    ArrowUpDown,
    Box,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import MotionChevron from '@/components/animated_icons/MotionChevron';
import { AttachedFileList } from '@/components/attached-file-list';
import { BookingCard } from '@/components/booking-card';
import { FacilityInfo } from '@/components/create-page/facility-info';
import { BookingCardList } from '@/components/request/create/booking-card-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import DefaultLayout from '@/layout.tsx/default.';
import { cn } from '@/lib/utils';
import type { EquipmentConflict, FacilityEquipment } from '@/types/equipment';
import type { Facility } from '@/types/facility';
import { PRIORITY_LABELS } from '@/types/request';

interface BorrowedEquipmentRequest {
    equipment_id: number;
    equipment_name: string;
    source_facility_id: number;
    source_facility_name: string;
    quantity_needed: number;
    max_quantity: number;
}

export interface FacilityBooking {
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
    request_id?: number;
    request_title: string;
    status: string;
    time_start: string;
    time_end: string;
    date?: string;
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
const MIN_SCHEDULE_ADVANCE_DAYS = 5;
const WARNING_ADVANCE_DAYS = 6;
const MIN_BOOKING_TIME = '07:00';
const MAX_BOOKING_TIME = '20:00';
const BOOKING_TIME_STEP_MINUTES = 30;

function getTodayStart(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function addCalendarDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    next.setHours(0, 0, 0, 0);
    return next;
}

function isTimeWithinBookingHours(time: string): boolean {
    if (!time) return false;
    return time >= MIN_BOOKING_TIME && time <= MAX_BOOKING_TIME;
}

function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const BOOKING_TIME_OPTIONS = Array.from(
    {
        length: Math.floor((timeToMinutes(MAX_BOOKING_TIME) - timeToMinutes(MIN_BOOKING_TIME)) / BOOKING_TIME_STEP_MINUTES) + 1,
    },
    (_, index) => minutesToTime(timeToMinutes(MIN_BOOKING_TIME) + index * BOOKING_TIME_STEP_MINUTES),
);

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
        localStorage.setItem(
            getDraftKey(existingId),
            JSON.stringify({
                ...data,
                savedAt: Date.now(),
            }),
        );
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
    { id: 1, name: 'Faculty' },
    { id: 3, name: 'College Dean' },
    { id: 4, name: 'Chairperson' },
    { id: 5, name: 'OSA' },
    { id: 6, name: 'VP AA' },
    { id: 7, name: 'VP Admin' },
    { id: 8, name: 'President' },
];

export default function CreateRequest({ facilities, existingRequest }: CreateRequestProps) {
    const isEditing = !!existingRequest;
    const draft = loadDraft(existingRequest?.id);
    const minSelectableDate = addCalendarDays(getTodayStart(), MIN_SCHEDULE_ADVANCE_DAYS);
    const warningCutoffDate = addCalendarDays(getTodayStart(), WARNING_ADVANCE_DAYS);

    function draftDiffersFromExisting(draft: DraftData, existing: ExistingRequest): boolean {
        if (draft.title !== existing.title) return true;
        if (draft.description !== existing.description) return true;
        if (draft.priority_level !== existing.priority_level) return true;
        if (draft.priority_reason !== existing.priority_reason) return true;
        if (JSON.stringify(draft.facility_bookings) !== JSON.stringify(existing.facility_bookings)) return true;
        return false;
    }

    const hasMeaningfulDraft = !!draft && (!isEditing || (!!existingRequest && draftDiffersFromExisting(draft, existingRequest)));

    const [showDraftBanner, setShowDraftBanner] = useState<boolean>(hasMeaningfulDraft);
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

    const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [currentTimeStart, setCurrentTimeStart] = useState<string>('');
    const [currentTimeEnd, setCurrentTimeEnd] = useState<string>('');
    const [externalEquipment, setExternalEquipment] = useState<{ name: string }[]>([]);
    const [externalEquipmentInput, setExternalEquipmentInput] = useState<string>('');
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentRequest[]>([]);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [scheduleConflicts, setScheduleConflicts] = useState<BookingSchedule[]>([]);
    const [borrowingEquipmentId, setBorrowingEquipmentId] = useState<number | null>(null);
    const [selectedBorrowedEquipment, setSelectedBorrowedEquipment] = useState<BorrowedEquipmentRequest[]>([]);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [facilitySchedule, setFacilitySchedule] = useState<FacilityScheduleData | null>(null);
    const [expectedCapacity, setExpectedCapacity] = useState<number | ''>('');
    const [hasOutsiders, setHasOutsiders] = useState<boolean>(false);
    const [existingFiles, setExistingFiles] = useState<ExistingFile[]>(existingRequest?.existing_files ?? []);
    const [deletedFileIds, setDeletedFileIds] = useState<number[]>([]);
    const [approvedBy, setApprovedBy] = useState<string[]>(existingRequest?.approved_by ?? []);
    const [equipmentConflicts, setEquipmentConflicts] = useState<Record<number, EquipmentConflict[]>>({});
    const [checkingEquipmentConflicts, setCheckingEquipmentConflicts] = useState(false);
    const [equipmentAvailability, setEquipmentAvailability] = useState<
        Record<number, { total_quantity: number; available_quantity: number; is_limited: boolean }>
    >({});
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [borrowableAvailability, setBorrowableAvailability] = useState<Record<number, Record<number, number>>>({});
    const [isExternalOpen, setIsExternalOpen] = useState(false);
    const [isBorrowOpen, setIsBorrowOpen] = useState(false);

    // Edit-in-place state
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [originalBookingData, setOriginalBookingData] = useState<FacilityBooking | null>(null);

    // Borrow panel: search, sort, filter
    const [borrowSearch, setBorrowSearch] = useState('');
    const [borrowSort, setBorrowSort] = useState<'name-asc' | 'name-desc' | 'qty-asc' | 'qty-desc'>('name-asc');
    const [borrowFacilityFilter, setBorrowFacilityFilter] = useState<string>('all');
    const hasNearMinimumScheduleDate = selectedDates.some((date) => date >= minSelectableDate && date <= warningCutoffDate);
    const canSaveFacilityBooking =
        !!selectedFacility &&
        selectedDates.length > 0 &&
        selectedDates.every((date) => addCalendarDays(date, 0) >= minSelectableDate) &&
        isTimeWithinBookingHours(currentTimeStart) &&
        isTimeWithinBookingHours(currentTimeEnd);

    const handleCheckboxChange = (name: string) => {
        setData('approved_by', data.approved_by.includes(name) ? data.approved_by.filter((item) => item !== name) : [...data.approved_by, name]);
    };

    const allBorrowableEquipment = facilities
        .filter((f) => f.id !== selectedFacility)
        .flatMap((f) => (f.equipment ?? []).map((eq) => ({ ...eq, facilityId: f.id, facilityName: f.name })))
        .reduce(
            (unique, eq) => {
                const existing = unique.find((e) => e.id === eq.id);
                if (!existing) {
                    unique.push({ ...eq, sources: [{ facilityId: eq.facilityId, facilityName: eq.facilityName, quantity: eq.pivot.quantity }] });
                } else {
                    existing.sources.push({ facilityId: eq.facilityId, facilityName: eq.facilityName, quantity: eq.pivot.quantity });
                }
                return unique;
            },
            [] as Array<FacilityEquipment & { sources: { facilityId: number; facilityName: string; quantity: number }[] }>,
        );

    // All unique source facilities for the filter dropdown
    const allSourceFacilities = facilities.filter((f) => f.id !== selectedFacility);

    // Derived: filtered + sorted borrowable equipment list
    const filteredBorrowableEquipment = allBorrowableEquipment
        .filter((eq) => eq.name.toLowerCase().includes(borrowSearch.toLowerCase()))
        .filter((eq) => borrowFacilityFilter === 'all' || eq.sources.some((s) => s.facilityId === Number(borrowFacilityFilter)))
        .sort((a, b) => {
            if (borrowSort === 'name-asc') return a.name.localeCompare(b.name);
            if (borrowSort === 'name-desc') return b.name.localeCompare(a.name);
            const totalA = a.sources.reduce((s, src) => s + (borrowableAvailability[src.facilityId]?.[a.id] ?? src.quantity), 0);
            const totalB = b.sources.reduce((s, src) => s + (borrowableAvailability[src.facilityId]?.[b.id] ?? src.quantity), 0);
            if (borrowSort === 'qty-asc') return totalA - totalB;
            return totalB - totalA;
        });

    const { data, setData, post, put, processing, errors, transform } = useForm({
        title: existingRequest?.title ?? '',
        description: existingRequest?.description ?? '',
        facility_bookings: existingRequest?.facility_bookings ?? ([] as FacilityBooking[]),
        priority_level: existingRequest?.priority_level ?? 0,
        priority_reason: existingRequest?.priority_reason ?? '',
        approved_by: existingRequest?.approved_by ?? ([] as string[]),
        files: [] as File[],
        existing_file_ids: [] as number[],
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
            saveDraft(
                {
                    title: data.title,
                    description: data.description,
                    facility_bookings: data.facility_bookings,
                    priority_level: data.priority_level as 0 | 1 | 2,
                    priority_reason: data.priority_reason,
                    approved_by: data.approved_by,
                },
                existingRequest?.id,
            );

            toast.success('Draft saved', {
                description: 'Your progress has been saved locally.',
                duration: 2000,
                position: 'top-right',
            });
        }, 2000);

        return () => clearTimeout(timeout);
    }, [data.title, data.description, data.priority_level, data.priority_reason, data.facility_bookings, data.approved_by, showDraftBanner]);

    useEffect(() => {
        const ids = selectedEquipment.map((e) => e.equipment_id);
        if (ids.length > 0) fetchEquipmentConflicts(ids);
        else setEquipmentConflicts({});

        if (selectedFacility && selectedDates.length > 0 && currentTimeStart && currentTimeEnd) {
            fetchEquipmentAvailability();
        } else {
            setEquipmentAvailability({});
        }
    }, [currentTimeStart, currentTimeEnd, selectedDates, selectedFacility]);

    useEffect(() => {
        if (selectedDates.length > 0 && currentTimeStart && currentTimeEnd) {
            fetchBorrowableAvailability();
        } else {
            setBorrowableAvailability({});
        }
    }, [currentTimeStart, currentTimeEnd, selectedDates, selectedFacility]);

    useEffect(() => {
        setData(
            'files',
            attachedFiles.map((f) => f.file),
        );
    }, [attachedFiles]);

    useEffect(() => {
        if (!selectedFacility || selectedDates.length === 0 || !currentTimeStart || !currentTimeEnd) {
            setScheduleConflicts([]);
            return;
        }

        const allConflicts = selectedDates.flatMap((date) => {
            const formattedDate = format(date, 'yyyy-MM-dd');

            return checkLocalConflicts(selectedFacility, formattedDate, currentTimeStart, currentTimeEnd).map((conflict) => ({
                ...conflict,
                date: formattedDate,
            }));
        });

        setScheduleConflicts(allConflicts);
    }, [selectedFacility, selectedDates, currentTimeStart, currentTimeEnd, facilitySchedule]);

    function editBooking(index: number) {
        const booking = data.facility_bookings[index];

        setSelectedFacility(booking.facility_id);
        setSelectedDates([new Date(booking.date)]);
        setCurrentTimeStart(booking.time_start);
        setCurrentTimeEnd(booking.time_end);
        setSelectedEquipment(booking.equipment);
        setSelectedBorrowedEquipment(booking.borrowed_equipment ?? []);
        setExternalEquipment(booking.external_equipment ?? []);
        setExpectedCapacity(booking.expected_capacity ?? '');
        setHasOutsiders(booking.has_outsiders ?? false);
        setEquipmentConflicts(booking.equipment_conflicts ?? {});

        // Store which card is being edited and a snapshot for change-detection
        setEditingIndex(index);
        setOriginalBookingData({ ...booking });

        loadSchedule(booking.facility_id, new Date(booking.date));
        // NOTE: removeBooking is intentionally NOT called here —
        // the card stays in the list while the form is populated.
    }

    function cancelEditBooking() {
        setEditingIndex(null);
        setOriginalBookingData(null);
        setSelectedFacility(null);
        setSelectedDates([]);
        setCurrentTimeStart('');
        setCurrentTimeEnd('');
        setSelectedEquipment([]);
        setSelectedBorrowedEquipment([]);
        setBorrowingEquipmentId(null);
        setExternalEquipment([]);
        setExternalEquipmentInput('');
        setExpectedCapacity('');
        setHasOutsiders(false);
        setEquipmentConflicts({});
        setScheduleConflicts([]);
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

    const availableEquipment: FacilityEquipment[] = selectedFacility ? (facilities.find((f) => f.id === selectedFacility)?.equipment ?? []) : [];

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
                    date: dateString,
                }),
            );

            const data = await response.json();

            setFacilitySchedule({
                bookings: data.bookings ?? [],
                date: dateString,
            });
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
        setScheduleConflicts([]);
        // Load schedule for the first selected date (for conflict preview)
        if (selectedDates.length > 0) loadSchedule(facilityId, selectedDates[0]);
    }

    const handleDateChange = (dates: Date[] | undefined) => {
        const next = dates ?? [];
        // In edit mode, clamp to single selection
        if (editingIndex !== null && next.length > 1) {
            setSelectedDates([next[next.length - 1]]);
        } else {
            setSelectedDates(next);
        }
        const primary = (dates ?? [])[0];
        if (selectedFacility && primary) loadSchedule(selectedFacility, primary);
    };

    function clearEquipmentSelection(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        setSelectedEquipment([]);
    }

    function selectAllEquipment(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        setSelectedEquipment(
            availableEquipment.map((equipment) => ({
                equipment_id: equipment.id,
                equipment_name: equipment.name,
                quantity_needed: equipment.pivot.quantity,
                max_quantity: equipment.pivot.quantity,
            })),
        );
    }

    async function fetchBorrowableAvailability() {
        if (!selectedDates.length || !currentTimeStart || !currentTimeEnd) return;
        const currentDate = selectedDates[0];

        const sourceFacilities = facilities.filter((f) => f.id !== selectedFacility);
        if (sourceFacilities.length === 0) return;

        const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')!.content;

        const results = await Promise.allSettled(
            sourceFacilities.map(async (facility) => {
                const res = await fetch(route('equipment.availability'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
                    body: JSON.stringify({
                        facility_id: facility.id,
                        date: format(currentDate, 'yyyy-MM-dd'),
                        time_start: currentTimeStart,
                        time_end: currentTimeEnd,
                    }),
                });
                const json = await res.json();
                return { facilityId: facility.id, availability: json.availability ?? [] };
            }),
        );

        const map: Record<number, Record<number, number>> = {};
        for (const result of results) {
            if (result.status === 'fulfilled') {
                const { facilityId, availability } = result.value;
                map[facilityId] = {};
                for (const item of availability) {
                    map[facilityId][item.equipment_id] = item.available_quantity;
                }
            }
        }
        setBorrowableAvailability(map);
    }

    function handleEquipmentToggle(equipment: FacilityEquipment) {
        const exists = selectedEquipment.find((e) => e.equipment_id === equipment.id);
        let updated: EquipmentRequest[];
        if (exists) {
            updated = selectedEquipment.filter((e) => e.equipment_id !== equipment.id);
            setEquipmentConflicts((prev) => {
                const n = { ...prev };
                delete n[equipment.id];
                return n;
            });
        } else {
            updated = [
                ...selectedEquipment,
                {
                    equipment_id: equipment.id,
                    equipment_name: equipment.name,
                    quantity_needed: equipment.pivot.quantity,
                    max_quantity: equipment.pivot.quantity,
                },
            ];
        }
        setSelectedEquipment(updated);
        fetchEquipmentConflicts(updated.map((e) => e.equipment_id));
    }

    function updateEquipmentQuantity(equipmentId: number, quantity: number) {
        setSelectedEquipment(selectedEquipment.map((e) => (e.equipment_id === equipmentId ? { ...e, quantity_needed: quantity } : e)));
    }

    function checkTimeConflictWithData(schedule: FacilityScheduleData | null, startTime: string, endTime: string): boolean {
        if (!schedule || !schedule.bookings.length) return false;
        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);
        return schedule.bookings.some((booking) => {
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
        return schedule.bookings.filter((booking) => {
            const bookingStart = new Date(`2000-01-01T${booking.time_start}`);
            const bookingEnd = new Date(`2000-01-01T${booking.time_end}`);
            return start < bookingEnd && end > bookingStart;
        });
    }

    function handleTimeStartChange(newStartTime: string) {
        if (newStartTime && !isTimeWithinBookingHours(newStartTime)) return;
        setCurrentTimeStart(newStartTime);
    }

    function handleTimeEndChange(newEndTime: string) {
        if (newEndTime && !isTimeWithinBookingHours(newEndTime)) return;
        setCurrentTimeEnd(newEndTime);
    }

    function checkLocalConflicts(facilityId: number, date: string, startTime: string, endTime: string): BookingSchedule[] {
        if (!facilitySchedule) return [];

        if (facilityId !== selectedFacility) return [];

        if (facilitySchedule.date !== date) return [];

        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);

        return facilitySchedule.bookings.filter((booking) => {
            if (booking.status !== 'Approved' && booking.status !== 'Conditionally Approved') {
                return false;
            }

            const bookingStart = new Date(`2000-01-01T${booking.time_start}`);
            const bookingEnd = new Date(`2000-01-01T${booking.time_end}`);

            return start < bookingEnd && end > bookingStart;
        });
    }

    function addFacilityBooking() {
        if (!canSaveFacilityBooking) return;
        const facility = facilities.find((f) => f.id === selectedFacility);
        if (!facility) return;

        if (editingIndex !== null) {
            // ── EDIT MODE ──────────────────────────────────────────────────────────
            const date = selectedDates[0];
            const newBooking: FacilityBooking = {
                facility_id: selectedFacility,
                facility_name: facility.name,
                date: format(date, 'yyyy-MM-dd'),
                time_start: currentTimeStart,
                time_end: currentTimeEnd,
                equipment: selectedEquipment,
                borrowed_equipment: selectedBorrowedEquipment,
                conflicts: scheduleConflicts.filter((c) => c.date === format(date, 'yyyy-MM-dd')),
                external_equipment: externalEquipment,
                expected_capacity: expectedCapacity === '' ? null : expectedCapacity,
                has_outsiders: hasOutsiders,
                equipment_conflicts: equipmentConflicts,
            };

            // If nothing changed, just exit edit mode without touching the array.
            if (originalBookingData && JSON.stringify(newBooking) === JSON.stringify(originalBookingData)) {
                cancelEditBooking();
                return;
            }

            // Update the booking at editingIndex in-place.
            const updatedBookings = data.facility_bookings.map((b, i) => (i === editingIndex ? newBooking : b));
            setData('facility_bookings', updatedBookings);
        } else {
            // ── BATCH ADD MODE ─────────────────────────────────────────────────────
            const newBatch: FacilityBooking[] = selectedDates.map((date) => {
                const formattedDate = format(date, 'yyyy-MM-dd');

                return {
                    facility_id: selectedFacility,
                    facility_name: facility.name,
                    date: formattedDate,
                    time_start: currentTimeStart,
                    time_end: currentTimeEnd,
                    equipment: selectedEquipment,
                    borrowed_equipment: selectedBorrowedEquipment,
                    conflicts: checkLocalConflicts(selectedFacility, formattedDate, currentTimeStart, currentTimeEnd),
                    external_equipment: externalEquipment,
                    expected_capacity: expectedCapacity === '' ? null : expectedCapacity,
                    has_outsiders: hasOutsiders,
                    equipment_conflicts: equipmentConflicts,
                };
            });

            setData('facility_bookings', [...data.facility_bookings, ...newBatch]);
        }

        // Reset all facility form state and edit tracking.
        setEditingIndex(null);
        setOriginalBookingData(null);
        setSelectedFacility(null);
        setSelectedDates([]);
        setCurrentTimeStart('');
        setCurrentTimeEnd('');
        setSelectedEquipment([]);
        setSelectedBorrowedEquipment([]);
        setBorrowingEquipmentId(null);
        setScheduleConflicts([]);
        setExternalEquipment([]);
        setExternalEquipmentInput('');
        setExpectedCapacity('');
        setHasOutsiders(false);
        setEquipmentConflicts({});
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = [
        'image/jpeg',
        'image/png',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const selected = Array.from(e.target.files ?? []);
        const rejected: string[] = [];
        const accepted: AttachedFile[] = [];

        for (const file of selected) {
            if (file.size > MAX_FILE_SIZE) {
                rejected.push(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 10MB`);
                continue;
            }
            if (!ALLOWED_TYPES.includes(file.type)) {
                rejected.push(`"${file.name}" is not an allowed file type`);
                continue;
            }
            accepted.push({
                file,
                preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
            });
        }

        if (rejected.length > 0) {
            toast.error('Some files were rejected', {
                description: rejected.join('\n'),
                duration: 5000,
            });
        }

        if (accepted.length > 0) {
            setAttachedFiles((prev) => [...prev, ...accepted]);
        }

        e.target.value = '';
    }

    function removeFile(index: number) {
        setAttachedFiles((prev) => {
            const updated = [...prev];
            if (updated[index].preview) URL.revokeObjectURL(updated[index].preview!);
            updated.splice(index, 1);
            return updated;
        });
    }

    function removeExistingFile(index: number) {
        setExistingFiles((prev) => prev.filter((_, i) => i !== index));
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
            existing_file_ids: existingFiles.map((f) => f.id),
        }));

        const options = {
            forceFormData: true,
            onSuccess: () => clearDraft(existingRequest?.id),
            onError: (errs) => console.log('validation errors:', errs),
        };

        if (isEditing) {
            put(route('requests.update', existingRequest!.id), options);
        } else {
            post(route('requests.store'), options);
        }
    }

    async function fetchEquipmentConflicts(equipmentIds: number[]) {
        if (!selectedDates.length || !currentTimeStart || !currentTimeEnd || equipmentIds.length === 0) return;
        const currentDate = selectedDates[0];

        setCheckingEquipmentConflicts(true);
        try {
            const res = await fetch(route('equipment.check-conflicts'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')!.content,
                },
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
        if (!selectedFacility || !selectedDates.length || !currentTimeStart || !currentTimeEnd) return;
        const currentDate = selectedDates[0];

        setCheckingAvailability(true);
        try {
            const res = await fetch(route('equipment.availability'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')!.content,
                },
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
            <AlertDialog
                open={showDraftBanner}
                onOpenChange={(open) => {
                    if (!open) discardDraft();
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore unsaved draft?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have an unsaved draft from <span className="font-medium text-foreground">{draft ? timeAgo(draft.savedAt) : ''}</span>.
                            Would you like to restore it, or start fresh?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={discardDraft}>Discard</AlertDialogCancel>
                        <AlertDialogAction onClick={restoreDraft}>Restore Draft</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="relative w-full">
                <form onSubmit={submit} className="flex flex-col gap-6 space-y-8">
                    {Object.keys(errors).length > 0 && (
                        <Alert variant="destructive" className="mt-0 mb-0 max-w-2xl border-destructive bg-destructive/4">
                            <AlertCircleIcon />
                            <AlertTitle>Error with submission. Please properly fill in all the details.</AlertTitle>
                            <AlertDescription>
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                    {Object.entries(errors).map(([key, msg]) => (
                                        <li key={key}>{msg as string}</li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    <Tabs defaultValue="details" className="w-full">
                        <TabsList className="mb-6 w-full max-w-2xl">
                            <TabsTrigger value="details" className="flex-1">
                                Details
                            </TabsTrigger>
                            <TabsTrigger value="facility" className="flex-1">
                                Facility
                            </TabsTrigger>
                        </TabsList>

                        {/* ── Details Tab ── */}
                        <TabsContent value="details" className="mt-0 max-w-2xl space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="title">
                                    Request Title <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="title"
                                    type="text"
                                    value={data.title}
                                    onChange={(e) => setData('title', e.target.value)}
                                    placeholder="e.g., Gamecon"
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
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-4">
                                <Label className="font-semibold">Approved By</Label>

                                <div className="mt-2 flex flex-wrap gap-4">
                                    {approversList.map((approver) => {
                                        const isChecked = data.approved_by.includes(approver.name);

                                        return (
                                            <div key={approver.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`approver-${approver.id}`}
                                                    checked={isChecked}
                                                    onCheckedChange={() => handleCheckboxChange(approver.name)}
                                                />
                                                <Label htmlFor={`approver-${approver.id}`}>{approver.name}</Label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* File Attachments */}
                            <div className="space-y-3">
                                <Label>Attachments</Label>
                                <p className="text-xs text-muted-foreground">Attach supporting documents, images, or files (max 10MB each).</p>

                                <label
                                    htmlFor="file-upload"
                                    className="flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border transition-colors hover:border-primary/50 hover:bg-muted/20"
                                >
                                    <Paperclip size={20} className="mb-2 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">Click to attach files</span>
                                    <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, PDF, DOC, XLSX, PPTX up to 10MB</span>
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

                                {/* File errors — catches both array-level and per-file errors */}
                                {(() => {
                                    const fileErrors = Object.entries(errors)
                                        .filter(([key]) => key === 'files' || key.startsWith('files.'))
                                        .map(([, msg]) => msg as string);

                                    return fileErrors.length > 0 ? (
                                        <ul className="mt-1 space-y-1 text-sm text-destructive">
                                            {fileErrors.map((msg, i) => (
                                                <li key={i}>{msg}</li>
                                            ))}
                                        </ul>
                                    ) : null;
                                })()}
                            </div>
                        </TabsContent>

                        {/* Facility Tab */}
                        <TabsContent value="facility" className="mt-0 space-y-6">
                            {/* Two-column grid on desktop — form | sticky sidebar */}
                            <div className="lg:grid lg:grid-cols-[5fr_3fr] lg:items-start lg:gap-12">
                                {/* ── Left: form content ── */}
                                <div className="space-y-6">
                                    {/* Date + Time row */}
                                    <div className="grid w-full grid-cols-[1fr_1fr] gap-4 md:grid-cols-[3fr_2fr_2fr]">
                                        <div className="col-span-full space-y-2 md:col-span-1">
                                            <Label>
                                                Date <span className="text-destructive">*</span>
                                            </Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className={cn(
                                                            'w-full justify-start text-left font-normal',
                                                            selectedDates.length === 0 && 'text-muted-foreground',
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-1 h-4 w-4" />
                                                        {selectedDates.length === 0
                                                            ? 'Pick a date'
                                                            : selectedDates.length === 1
                                                                ? format(selectedDates[0], 'PPP')
                                                                : `${selectedDates.length} dates selected`}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        mode="multiple"
                                                        selected={selectedDates}
                                                        onSelect={handleDateChange}
                                                        initialFocus
                                                        disabled={(date) => addCalendarDays(date, 0) < minSelectableDate}
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            {hasNearMinimumScheduleDate && (
                                                <Alert className="border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-400">
                                                    <AlertCircleIcon className="text-amber-600 dark:text-amber-500" />
                                                    <AlertTitle className="font-semibold text-amber-800 dark:text-amber-300">
                                                        Short Notice Schedule
                                                    </AlertTitle>
                                                    <AlertDescription>
                                                        This selected date is close to the minimum lead time. Please make sure all requirements
                                                        can be prepared before submitting.
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="time_start">
                                                Start Time <span className="text-destructive">*</span>
                                            </Label>
                                            <Select value={currentTimeStart} onValueChange={handleTimeStartChange}>
                                                <SelectTrigger id="time_start" className="w-full text-sm">
                                                    <SelectValue placeholder="Select start time" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {BOOKING_TIME_OPTIONS.map((time) => (
                                                        <SelectItem key={time} value={time}>
                                                            {formatTime(time)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="time_end">
                                                End Time <span className="text-destructive">*</span>
                                            </Label>
                                            <Select value={currentTimeEnd} onValueChange={handleTimeEndChange}>
                                                <SelectTrigger id="time_end" className="w-full text-sm">
                                                    <SelectValue placeholder="Select end time" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {BOOKING_TIME_OPTIONS.map((time) => (
                                                        <SelectItem key={time} value={time}>
                                                            {formatTime(time)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Attendees + Outsiders */}
                                    <div className="flex w-fit items-end gap-4">
                                        <div className="flex-1 space-y-2">
                                            <Label htmlFor="expected_capacity">Expected Attendees</Label>
                                            <Input
                                                id="expected_capacity"
                                                type="number"
                                                min="1"
                                                value={expectedCapacity}
                                                onChange={(e) => setExpectedCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="How many attendees?"
                                                className="max-w-84 text-sm"
                                            />
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2 pb-2">
                                            <Checkbox
                                                id="has_outsiders"
                                                checked={hasOutsiders}
                                                onCheckedChange={(checked) => setHasOutsiders(!!checked)}
                                            />
                                            <Label htmlFor="has_outsiders" className="cursor-pointer text-sm whitespace-nowrap">
                                                Has Outsiders
                                            </Label>
                                        </div>
                                    </div>

                                    {scheduleConflicts.length > 0 && (
                                        <Alert
                                            variant="destructive"
                                            className="border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-400"
                                        >
                                            <AlertCircleIcon className="text-amber-600 dark:text-amber-500" />
                                            <AlertTitle className="font-semibold text-amber-800 dark:text-amber-300">
                                                Time Conflict Detected
                                            </AlertTitle>
                                            <AlertDescription>
                                                <p className="mb-2 text-amber-700 dark:text-amber-400">
                                                    Your selected time overlaps with existing facility bookings:
                                                </p>
                                                <div className="space-y-1.5">
                                                    {scheduleConflicts.map((c, i) => (
                                                        <div
                                                            key={i}
                                                            className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-100/50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                                        >
                                                            <AlertCircleIcon size={14} className="mt-0.5 shrink-0" />
                                                            <span>
                                                                <strong>{c.request_title}</strong> <br />
                                                                Time: {formatTime(c.time_start)} - {formatTime(c.time_end)} —{' '}
                                                                <span
                                                                    className={
                                                                        c.status === 'Approved'
                                                                            ? 'font-semibold text-red-600 dark:text-red-400'
                                                                            : 'font-semibold'
                                                                    }
                                                                >
                                                                    {c.status}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {/* Facility picker */}
                                    <div className="space-y-2">
                                        <div className="flex justify-start gap-1">
                                            <Label>
                                                Facility <span className="text-destructive">*</span>
                                            </Label>
                                            <div className="block lg:hidden">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                        >
                                                            <Info size={14} />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-h-[80vh] overflow-y-auto">
                                                        <DialogHeader>
                                                            <DialogTitle>Facility Info</DialogTitle>
                                                        </DialogHeader>
                                                        <FacilityInfo facilities={facilities} isForSidebar={false} />
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                        <Select value={selectedFacility?.toString() || ''} onValueChange={handleFacilityChange}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Choose a Facility" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {facilities.map((facility) => (
                                                    <SelectItem key={facility.id} value={facility.id.toString()}>
                                                        <b>{facility.name}</b>
                                                        <div className="flex items-center gap-1 text-muted-foreground">
                                                            <User className="h-3 w-3" />
                                                            <span className="text-xs">{facility.capacity}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Equipment selection */}
                                    {selectedFacility && availableEquipment.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex items-center">
                                                <Label className="mr-auto">Equipment</Label>
                                                {selectedEquipment.length < availableEquipment.length && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={selectAllEquipment}
                                                        className="text-muted-foreground hover:text-foreground"
                                                    >
                                                        <span className="text-sm">Select All</span>
                                                        <SquareMousePointer />
                                                    </Button>
                                                )}
                                                {selectedEquipment.length > 0 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={clearEquipmentSelection}
                                                        className="text-muted-foreground hover:text-foreground"
                                                    >
                                                        <span className="text-sm">Clear All</span>
                                                        <X />
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border p-3">
                                                {availableEquipment.map((equipment) => {
                                                    const selected = selectedEquipment.find((e) => e.equipment_id === equipment.id);
                                                    const conflicts = equipmentConflicts[equipment.id] ?? [];
                                                    const availability = equipmentAvailability[equipment.id];
                                                    const displayQty = availability ? availability.available_quantity : equipment.pivot.quantity;
                                                    const isLimited = availability ? availability.is_limited : false;
                                                    const exceedsAvailable =
                                                        selected && availability && selected.quantity_needed > availability.available_quantity;

                                                    return (
                                                        <div key={equipment.id} className="space-y-1">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="flex flex-1 items-center space-x-3">
                                                                    <Checkbox
                                                                        id={`equipment-${equipment.id}`}
                                                                        checked={!!selected}
                                                                        onCheckedChange={() => handleEquipmentToggle(equipment)}
                                                                    />
                                                                    <div className="flex-1">
                                                                        <Label
                                                                            htmlFor={`equipment-${equipment.id}`}
                                                                            className="cursor-pointer text-sm font-medium"
                                                                        >
                                                                            {equipment.name}
                                                                        </Label>
                                                                        <Label
                                                                            className={cn(
                                                                                'block text-xs',
                                                                                isLimited
                                                                                    ? 'font-medium text-orange-600 dark:text-orange-400'
                                                                                    : 'text-muted-foreground',
                                                                            )}
                                                                        >
                                                                            Available: {displayQty}
                                                                            {isLimited && ` (${availability?.total_quantity} total)`}
                                                                        </Label>
                                                                    </div>
                                                                </div>
                                                                {selected && (
                                                                    <div className="flex items-center gap-2">
                                                                        <Label className="text-sm">Qty:</Label>
                                                                        <Input
                                                                            type="number"
                                                                            min="1"
                                                                            max={displayQty}
                                                                            value={selected.quantity_needed}
                                                                            onChange={(e) =>
                                                                                updateEquipmentQuantity(
                                                                                    equipment.id,
                                                                                    Math.min(Number(e.target.value), displayQty),
                                                                                )
                                                                            }
                                                                            className={cn(
                                                                                'w-20 p-2 text-sm',
                                                                                exceedsAvailable &&
                                                                                'border-orange-400 bg-orange-50 dark:bg-orange-950/20',
                                                                            )}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {exceedsAvailable && (
                                                                <div className="ml-7 flex items-start gap-1.5 rounded border border-orange-200 bg-orange-50 px-2 py-1 text-xs text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                                                                    <AlertCircleIcon size={12} className="mt-0.5 shrink-0" />
                                                                    <span>
                                                                        Only <strong>{availability?.available_quantity}</strong> available for the
                                                                        selected time
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {selected && conflicts.length > 0 && (
                                                                <div className="ml-7 space-y-1">
                                                                    {conflicts.map((c, i) => (
                                                                        <div
                                                                            key={i}
                                                                            className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                                                                        >
                                                                            <AlertCircleIcon size={12} className="mt-0.5 shrink-0" />
                                                                            <span>
                                                                                Also requested by <strong>{c.requester}</strong> ("{c.request_title}")
                                                                                —{' '}
                                                                                <span
                                                                                    className={
                                                                                        c.status === 'Approved' ? 'font-semibold text-red-600' : ''
                                                                                    }
                                                                                >
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

                                    {/* Optional extras — external equipment + borrow */}
                                    <div className="space-y-2">
                                        {/* External equipment */}
                                        <Collapsible open={isExternalOpen} onOpenChange={setIsExternalOpen}>
                                            <CollapsibleTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                                                >
                                                    {isExternalOpen ? <Minus size={16} /> : <Plus size={16} />}
                                                    <span>Add external equipment</span>
                                                    {externalEquipment.length > 0 && (
                                                        <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                                                            {externalEquipment.length}
                                                        </span>
                                                    )}
                                                </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <div className="mt-3 space-y-3 px-1">
                                                    <p className="text-sm text-muted-foreground">
                                                        List equipment you'll be bringing that isn't in our inventory.
                                                    </p>
                                                    {externalEquipment.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {externalEquipment.map((item, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="flex w-fit items-center justify-between gap-1 rounded-md border bg-muted/20 px-2 py-1 text-sm"
                                                                >
                                                                    <span>{item.name}</span>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                                        onClick={() =>
                                                                            setExternalEquipment((prev) => prev.filter((_, idx) => idx !== i))
                                                                        }
                                                                    >
                                                                        <X size={14} />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
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
                                                                    setExternalEquipment((prev) => [...prev, { name: trimmed }]);
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
                                                                setExternalEquipment((prev) => [...prev, { name: trimmed }]);
                                                                setExternalEquipmentInput('');
                                                            }}
                                                        >
                                                            Add
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>

                                        {/* ── Borrow from another facility ── */}
                                        {selectedFacility && (
                                            <Collapsible open={isBorrowOpen} onOpenChange={setIsBorrowOpen}>
                                                <CollapsibleTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                                                    >
                                                        {isBorrowOpen ? <Minus size={16} /> : <Plus size={16} />}
                                                        <span>Borrow from another facility</span>
                                                        {selectedBorrowedEquipment.length > 0 && (
                                                            <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                                                                {selectedBorrowedEquipment.length}
                                                            </span>
                                                        )}
                                                    </Button>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="mt-2">
                                                    {allBorrowableEquipment.length === 0 ? (
                                                        <p className="py-4 text-center text-sm text-muted-foreground">
                                                            No equipment available to borrow.
                                                        </p>
                                                    ) : (
                                                        <div className="overflow-hidden rounded-md border">
                                                            {/* ── Search + Sort + Filter toolbar ── */}
                                                            <div className="space-y-2 border-b bg-muted/20 p-2">
                                                                {/* Search bar */}
                                                                <div className="relative">
                                                                    <Search
                                                                        size={14}
                                                                        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                                                                    />
                                                                    <Input
                                                                        placeholder="Search equipment..."
                                                                        value={borrowSearch}
                                                                        onChange={(e) => setBorrowSearch(e.target.value)}
                                                                        className="h-8 pl-8 text-sm"
                                                                    />
                                                                    {borrowSearch && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setBorrowSearch('')}
                                                                            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                                        >
                                                                            <X size={13} />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {/* Sort + Filter row */}
                                                                <div className="flex flex-col gap-2 md:flex-row">
                                                                    {/* Sort */}
                                                                    <Select
                                                                        value={borrowSort}
                                                                        onValueChange={(v) => setBorrowSort(v as typeof borrowSort)}
                                                                    >
                                                                        <SelectTrigger className="h-8 flex-1 gap-1 text-sm">
                                                                            <ArrowUpDown size={16} className="shrink-0 text-muted-foreground" />
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="name-asc">Name A–Z</SelectItem>
                                                                            <SelectItem value="name-desc">Name Z–A</SelectItem>
                                                                            <SelectItem value="qty-desc">Most Available</SelectItem>
                                                                            <SelectItem value="qty-asc">Least Available</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>

                                                                    {/* Filter by facility */}
                                                                    <Select value={borrowFacilityFilter} onValueChange={setBorrowFacilityFilter}>
                                                                        <SelectTrigger className="h-8 flex-1 gap-1 text-sm">
                                                                            <Box size={16} className="shrink-0 text-muted-foreground" />
                                                                            <SelectValue className="truncate" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="all">All Facilities</SelectItem>
                                                                            {allSourceFacilities.map((f) => (
                                                                                <SelectItem key={f.id} value={f.id.toString()}>
                                                                                    {f.name}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>

                                                            {/* ── Equipment list in ScrollArea ── */}
                                                            <ScrollArea className="h-64">
                                                                <div className="divide-y">
                                                                    {filteredBorrowableEquipment.length === 0 ? (
                                                                        <p className="py-6 text-center text-sm text-muted-foreground">
                                                                            No equipment matches your search.
                                                                        </p>
                                                                    ) : (
                                                                        filteredBorrowableEquipment.map((equipment) => {
                                                                            const isExpanded = borrowingEquipmentId === equipment.id;
                                                                            const borrowed = selectedBorrowedEquipment.filter(
                                                                                (e) => e.equipment_id === equipment.id,
                                                                            );
                                                                            const totalBorrowed = borrowed.reduce((s, e) => s + e.quantity_needed, 0);
                                                                            const totalAvailable = equipment.sources.reduce(
                                                                                (s, src) =>
                                                                                    s +
                                                                                    (borrowableAvailability[src.facilityId]?.[equipment.id] ??
                                                                                        src.quantity),
                                                                                0,
                                                                            );
                                                                            const totalStock = equipment.sources.reduce(
                                                                                (s, src) => s + src.quantity,
                                                                                0,
                                                                            );
                                                                            const isAnyLimited = totalAvailable < totalStock;

                                                                            return (
                                                                                <div key={equipment.id}>
                                                                                    {/* Equipment header row */}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            setBorrowingEquipmentId(isExpanded ? null : equipment.id)
                                                                                        }
                                                                                        className={cn(
                                                                                            'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors',
                                                                                            isExpanded ? 'bg-muted/40' : 'hover:bg-muted/20',
                                                                                        )}
                                                                                    >
                                                                                        <span className="font-medium">{equipment.name}</span>
                                                                                        <div className="flex items-center gap-2">
                                                                                            {totalBorrowed > 0 && (
                                                                                                <span className="text-xs font-medium text-primary">
                                                                                                    {totalBorrowed} selected
                                                                                                </span>
                                                                                            )}
                                                                                            <span
                                                                                                className={cn(
                                                                                                    'text-xs tabular-nums',
                                                                                                    isAnyLimited
                                                                                                        ? 'font-medium text-orange-600 dark:text-orange-400'
                                                                                                        : 'text-muted-foreground',
                                                                                                )}
                                                                                            >
                                                                                                {totalAvailable} avail.
                                                                                            </span>
                                                                                            <MotionChevron openCollapsible={isExpanded} />
                                                                                        </div>
                                                                                    </button>

                                                                                    {/* Sources — shown when expanded */}
                                                                                    {isExpanded && (
                                                                                        <div className="divide-y border-t bg-muted/10 px-3">
                                                                                            {equipment.sources
                                                                                                .filter(
                                                                                                    (source) =>
                                                                                                        borrowFacilityFilter === 'all' ||
                                                                                                        source.facilityId ===
                                                                                                        Number(borrowFacilityFilter),
                                                                                                )
                                                                                                .map((source) => {
                                                                                                    const item = borrowed.find(
                                                                                                        (e) =>
                                                                                                            e.source_facility_id ===
                                                                                                            source.facilityId,
                                                                                                    );
                                                                                                    const available =
                                                                                                        borrowableAvailability[source.facilityId]?.[
                                                                                                        equipment.id
                                                                                                        ] ?? source.quantity;
                                                                                                    const isLimited = available < source.quantity;

                                                                                                    return (
                                                                                                        <div
                                                                                                            key={source.facilityId}
                                                                                                            className="flex items-center gap-3 py-2.5"
                                                                                                        >
                                                                                                            <Checkbox
                                                                                                                id={`borrow-${equipment.id}-${source.facilityId}`}
                                                                                                                checked={!!item}
                                                                                                                onCheckedChange={() => {
                                                                                                                    if (item) {
                                                                                                                        setSelectedBorrowedEquipment(
                                                                                                                            (prev) =>
                                                                                                                                prev.filter(
                                                                                                                                    (e) =>
                                                                                                                                        !(
                                                                                                                                            e.equipment_id ===
                                                                                                                                            equipment.id &&
                                                                                                                                            e.source_facility_id ===
                                                                                                                                            source.facilityId
                                                                                                                                        ),
                                                                                                                                ),
                                                                                                                        );
                                                                                                                    } else {
                                                                                                                        setSelectedBorrowedEquipment(
                                                                                                                            (prev) => [
                                                                                                                                ...prev,
                                                                                                                                {
                                                                                                                                    equipment_id:
                                                                                                                                        equipment.id,
                                                                                                                                    equipment_name:
                                                                                                                                        equipment.name,
                                                                                                                                    source_facility_id:
                                                                                                                                        source.facilityId,
                                                                                                                                    source_facility_name:
                                                                                                                                        source.facilityName,
                                                                                                                                    quantity_needed: 1,
                                                                                                                                    max_quantity:
                                                                                                                                        available,
                                                                                                                                },
                                                                                                                            ],
                                                                                                                        );
                                                                                                                    }
                                                                                                                }}
                                                                                                            />
                                                                                                            <div className="min-w-0 flex-1">
                                                                                                                <Label
                                                                                                                    htmlFor={`borrow-${equipment.id}-${source.facilityId}`}
                                                                                                                    className="block cursor-pointer truncate text-sm font-medium"
                                                                                                                >
                                                                                                                    {source.facilityName}
                                                                                                                </Label>
                                                                                                                <span
                                                                                                                    className={cn(
                                                                                                                        'text-xs',
                                                                                                                        isLimited
                                                                                                                            ? 'font-medium text-orange-600 dark:text-orange-400'
                                                                                                                            : 'text-muted-foreground',
                                                                                                                    )}
                                                                                                                >
                                                                                                                    {available} available
                                                                                                                    {isLimited &&
                                                                                                                        ` of ${source.quantity}`}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            {item && (
                                                                                                                <div className="flex shrink-0 items-center gap-1.5">
                                                                                                                    <Label className="text-xs text-muted-foreground">
                                                                                                                        Qty
                                                                                                                    </Label>
                                                                                                                    <Input
                                                                                                                        type="number"
                                                                                                                        min="1"
                                                                                                                        max={available}
                                                                                                                        value={item.quantity_needed}
                                                                                                                        onChange={(e) => {
                                                                                                                            const qty = Math.min(
                                                                                                                                Number(
                                                                                                                                    e.target.value,
                                                                                                                                ),
                                                                                                                                available,
                                                                                                                            );
                                                                                                                            setSelectedBorrowedEquipment(
                                                                                                                                (prev) =>
                                                                                                                                    prev.map((i) =>
                                                                                                                                        i.equipment_id ===
                                                                                                                                            equipment.id &&
                                                                                                                                            i.source_facility_id ===
                                                                                                                                            source.facilityId
                                                                                                                                            ? {
                                                                                                                                                ...i,
                                                                                                                                                quantity_needed:
                                                                                                                                                    qty,
                                                                                                                                            }
                                                                                                                                            : i,
                                                                                                                                    ),
                                                                                                                            );
                                                                                                                        }}
                                                                                                                        className="h-7 w-16 px-2 text-sm"
                                                                                                                    />
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    );
                                                                                                })}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })
                                                                    )}
                                                                </div>
                                                            </ScrollArea>
                                                        </div>
                                                    )}

                                                    {/* Summary when nothing is expanded */}
                                                    {!borrowingEquipmentId && selectedBorrowedEquipment.length > 0 && (
                                                        <div className="mt-3 space-y-2 rounded-md border bg-muted/10 px-3 py-2.5">
                                                            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                                                Selected to borrow
                                                            </p>
                                                            {Object.entries(
                                                                selectedBorrowedEquipment.reduce(
                                                                    (groups, eq) => ({
                                                                        ...groups,
                                                                        [eq.equipment_name]: [...(groups[eq.equipment_name] ?? []), eq],
                                                                    }),
                                                                    {} as Record<string, BorrowedEquipmentRequest[]>,
                                                                ),
                                                            ).map(([name, items]) => (
                                                                <div key={name}>
                                                                    <p className="text-xs font-medium">
                                                                        {name}
                                                                        <span className="ml-1 font-normal text-muted-foreground">
                                                                            · {items.reduce((s, e) => s + e.quantity_needed, 0)} total
                                                                        </span>
                                                                    </p>
                                                                    {items.map((eq) => (
                                                                        <div
                                                                            key={`${eq.equipment_id}-${eq.source_facility_id}`}
                                                                            className="flex items-center justify-between py-0.5 pl-3 text-xs text-muted-foreground"
                                                                        >
                                                                            <span>
                                                                                from {eq.source_facility_name} · {eq.quantity_needed}
                                                                            </span>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-5 w-5 text-destructive hover:text-destructive/70"
                                                                                onClick={() =>
                                                                                    setSelectedBorrowedEquipment((prev) =>
                                                                                        prev.filter(
                                                                                            (e) =>
                                                                                                !(
                                                                                                    e.equipment_id === eq.equipment_id &&
                                                                                                    e.source_facility_id === eq.source_facility_id
                                                                                                ),
                                                                                        ),
                                                                                    )
                                                                                }
                                                                            >
                                                                                <X size={10} />
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        )}
                                    </div>

                                    <div className="w-full flex-col mt-12 flex gap-1">
                                        {data.facility_bookings.length === 0 && editingIndex === null && (
                                            <p className="text-xs text-destructive">At least one facility booking is required.</p>
                                        )}
                                        <div className="flex w-full grid-cols-3 gap-2 md:grid">
                                            {editingIndex !== null && (
                                                <Button type="button" variant="outline" onClick={cancelEditBooking} className="">
                                                    Cancel Edit
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={addFacilityBooking}
                                                disabled={!canSaveFacilityBooking}
                                                className={'w-full ' + (editingIndex !== null ? 'col-span-2' : 'col-span-full')}
                                            >
                                                {editingIndex !== null
                                                    ? 'Save changes to facility booking'
                                                    : selectedDates.length > 1
                                                        ? `Add ${selectedDates.length} Facility Bookings`
                                                        : 'Add Facility Booking'}
                                            </Button>
                                        </div>
                                    </div>

                                    {data.facility_bookings.length > 0 && (
                                        <BookingCardList
                                            bookings={data.facility_bookings}
                                            editingIndex={editingIndex}
                                            onEdit={editBooking}
                                            onRemove={removeBooking}
                                            facilities={facilities}
                                        />
                                    )}
                                </div>

                                {/* ── Right: sticky sidebar (desktop only) ── */}
                                <Card className="hidden border bg-background shadow-sm lg:block">
                                    <CardContent className="sticky top-6">
                                        {/* ── Desktop: FacilityInfo manages its own facility + date ── */}
                                        <FacilityInfo facilities={facilities} isForSidebar={true} />
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="sticky bottom-0 z-5 -mx-6 flex justify-end gap-4 border-t border-border bg-background/80 px-6 py-4 backdrop-blur-sm md:-mx-8 md:px-8">
                        <Button type="button" variant="outline" size="lg" className="text-md font-semibold" onClick={() => window.history.back()}>
                            Cancel
                        </Button>
                        <Button type="submit" size="lg" className="text-md font-semibold" disabled={processing}>
                            {processing ? (isEditing ? 'Saving...' : 'Submitting...') : isEditing ? 'Save Changes' : 'Submit Request'}
                        </Button>
                    </div>
                </form>
            </div>
        </DefaultLayout>
    );
}
