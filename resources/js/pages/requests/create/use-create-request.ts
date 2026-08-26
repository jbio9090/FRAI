import { useForm, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { EquipmentConflict } from '@/types/equipment';
import type { FacilityEquipment } from '@/types/equipment';
import type { AlternativeSlot } from '@/types/request';
import { fetchBorrowableAvailability, fetchEquipmentAvailability, fetchEquipmentConflicts, loadSchedule as loadFacilitySchedule } from './api';
import type { BorrowableAvailabilityMap, EquipmentAvailabilityMap } from './api';
import type { BorrowPanelProps } from './sections/borrow-panel';
import type { ExternalEquipmentProps } from './sections/external-equipment';
import type {
    AttachedFile,
    BookingSchedule,
    BorrowableEquipment,
    BorrowedEquipmentRequest,
    CreateRequestFormData,
    CreateRequestProps,
    EquipmentRequest,
    ExistingFile,
    FacilityBooking,
    FacilityScheduleData,
} from './types';
import { addCalendarDays, clearDraft, draftDiffersFromExisting, formatMaxFileSize, getTodayStart, loadDraft, maxFileSizeBytes, minutesToTime, saveDraft, timeToMinutes } from './utils';
import { ALLOWED_TYPES } from './utils';

export function useCreateRequest({ facilities, existingRequest }: Pick<CreateRequestProps, 'facilities' | 'existingRequest'>) {
    const isEditing = !!existingRequest;
    const draft = loadDraft(existingRequest?.id);

    const { requestOptions } = usePage<CreateRequestProps>().props;
    const {
        start_time: minBookingTime,
        end_time: maxBookingTime,
        days_of_week: availableDaysOfWeek,
        step_minutes: bookingStepMinutes,
    } = requestOptions.booking_window;
    const minAdvanceDays = requestOptions.min_advance_days;
    const warningAdvanceDays = minAdvanceDays + 1;
    const bookingTimeOptions = Array.from(
        {
            length: Math.floor((timeToMinutes(maxBookingTime) - timeToMinutes(minBookingTime)) / bookingStepMinutes) + 1,
        },
        (_, index) => minutesToTime(timeToMinutes(minBookingTime) + index * bookingStepMinutes),
    );
    const isTimeWithinBookingHours = (time: string): boolean => {
        if (!time) return false;
        return time >= minBookingTime && time <= maxBookingTime;
    };

    const minSelectableDate = addCalendarDays(getTodayStart(), minAdvanceDays);
    const warningCutoffDate = addCalendarDays(getTodayStart(), warningAdvanceDays);

    const hasMeaningfulDraft = !!draft && (!isEditing || (!!existingRequest && draftDiffersFromExisting(draft, existingRequest)));

    const [showDraftBanner, setShowDraftBanner] = useState<boolean>(hasMeaningfulDraft);

    const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [currentTimeStart, setCurrentTimeStart] = useState<string>('');
    const [currentTimeEnd, setCurrentTimeEnd] = useState<string>('');
    const [externalEquipment, setExternalEquipment] = useState<{ name: string }[]>([]);
    const [externalEquipmentInput, setExternalEquipmentInput] = useState<string>('');
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentRequest[]>([]);
    const [scheduleConflicts, setScheduleConflicts] = useState<BookingSchedule[]>([]);
    const [borrowingEquipmentId, setBorrowingEquipmentId] = useState<number | null>(null);
    const [selectedBorrowedEquipment, setSelectedBorrowedEquipment] = useState<BorrowedEquipmentRequest[]>([]);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [facilitySchedule, setFacilitySchedule] = useState<FacilityScheduleData | null>(null);
    const [expectedCapacity, setExpectedCapacity] = useState<number | ''>('');
    const [hasOutsiders, setHasOutsiders] = useState<boolean>(false);
    const [existingFiles, setExistingFiles] = useState<ExistingFile[]>(existingRequest?.existing_files ?? []);
    const [equipmentConflicts, setEquipmentConflicts] = useState<Record<number, EquipmentConflict[]>>({});
    const [equipmentAvailability, setEquipmentAvailability] = useState<EquipmentAvailabilityMap>({});
    const [borrowableAvailability, setBorrowableAvailability] = useState<BorrowableAvailabilityMap>({});
    const [isExternalOpen, setIsExternalOpen] = useState(false);
    const [isBorrowOpen, setIsBorrowOpen] = useState(false);

    // Edit-in-place state
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [originalBookingData, setOriginalBookingData] = useState<FacilityBooking | null>(null);

    // Alternatives for FOR_RESCHEDULE requests
    const [alternatives, setAlternatives] = useState<Record<number, AlternativeSlot[]>>({});
    const [alternativesLoading, setAlternativesLoading] = useState(false);
    const [alternativesError, setAlternativesError] = useState<string | null>(null);
    const [includeEquipmentFilter, setIncludeEquipmentFilter] = useState(false);

    // Borrow panel: search, sort, filter
    const [borrowSearch, setBorrowSearch] = useState('');
    const [borrowSort, setBorrowSort] = useState<'name-asc' | 'name-desc' | 'qty-asc' | 'qty-desc'>('name-asc');
    const [borrowFacilityFilter, setBorrowFacilityFilter] = useState<string>('all');
    const hasNearMinimumScheduleDate = selectedDates.some((date) => date >= minSelectableDate && date <= warningCutoffDate);
    const availableEndTimeOptions = currentTimeStart
        ? bookingTimeOptions.filter((time) => timeToMinutes(time) > timeToMinutes(currentTimeStart))
        : bookingTimeOptions;
    const canSaveFacilityBooking =
        !!selectedFacility &&
        selectedDates.length > 0 &&
        selectedDates.every((date) => addCalendarDays(date, 0) >= minSelectableDate) &&
        isTimeWithinBookingHours(currentTimeStart) &&
        isTimeWithinBookingHours(currentTimeEnd);

    const handleCheckboxChange = (name: string) => {
        setData('approved_by', data.approved_by.includes(name) ? data.approved_by.filter((item) => item !== name) : [...data.approved_by, name]);
    };

    const allBorrowableEquipment: BorrowableEquipment[] = facilities
        .filter((f) => f.id !== selectedFacility)
        .flatMap((f) => (f.equipment ?? []).map((eq) => ({ ...eq, facilityId: f.id, facilityName: f.name })))
        .reduce((unique, eq) => {
            const existing = unique.find((e) => e.id === eq.id);
            if (!existing) {
                unique.push({ ...eq, sources: [{ facilityId: eq.facilityId, facilityName: eq.facilityName, quantity: eq.pivot.quantity }] });
            } else {
                existing.sources.push({ facilityId: eq.facilityId, facilityName: eq.facilityName, quantity: eq.pivot.quantity });
            }
            return unique;
        }, [] as BorrowableEquipment[]);

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

    const initialForm: CreateRequestFormData = {
        title: existingRequest?.title ?? '',
        description: existingRequest?.description ?? '',
        facility_bookings: existingRequest?.facility_bookings ?? ([] as FacilityBooking[]),
        priority_level: existingRequest?.priority_level ?? 0,
        priority_reason: existingRequest?.priority_reason ?? '',
        approved_by: existingRequest?.approved_by ?? ([] as string[]),
        files: [] as File[],
        existing_file_ids: [] as number[],
    };

    const { data, setData, post, put, processing, errors, transform } = useForm(initialForm);

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
        if (ids.length > 0) {
            if (selectedDates.length > 0 && currentTimeStart && currentTimeEnd) {
                fetchEquipmentConflicts({
                    equipmentIds: ids,
                    currentDate: format(selectedDates[0], 'yyyy-MM-dd'),
                    timeStart: currentTimeStart,
                    timeEnd: currentTimeEnd,
                    excludeRequestId: existingRequest?.id ?? null,
                }).then((conflicts) => {
                    if (conflicts) setEquipmentConflicts(conflicts);
                });
            }
        } else {
            setEquipmentConflicts({});
        }

        if (selectedFacility && selectedDates.length > 0 && currentTimeStart && currentTimeEnd) {
            fetchEquipmentAvailability({
                facilityId: selectedFacility,
                currentDate: format(selectedDates[0], 'yyyy-MM-dd'),
                timeStart: currentTimeStart,
                timeEnd: currentTimeEnd,
            }).then((availability) => {
                if (availability) setEquipmentAvailability(availability);
            });
        } else {
            setEquipmentAvailability({});
        }
    }, [currentTimeStart, currentTimeEnd, selectedDates, selectedFacility, existingRequest?.id]);

    useEffect(() => {
        if (selectedDates.length > 0 && currentTimeStart && currentTimeEnd) {
            fetchBorrowableAvailability({
                facilities,
                selectedFacility,
                currentDate: format(selectedDates[0], 'yyyy-MM-dd'),
                timeStart: currentTimeStart,
                timeEnd: currentTimeEnd,
            }).then((map) => {
                if (map) setBorrowableAvailability(map);
            });
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

    const loadSchedule = async (facilityId: number, date: Date) => {
        setFacilitySchedule(await loadFacilitySchedule(facilityId, date));
    };

    // Fetch alternatives for FOR_RESCHEDULE requests
    useEffect(() => {
        if (!isEditing || existingRequest?.status !== 'For Reschedule') {
            setAlternatives({});
            return;
        }

        const fetchAlternatives = async () => {
            setAlternativesLoading(true);
            setAlternativesError(null);
            try {
                const params = new URLSearchParams({
                    include_equipment: String(includeEquipmentFilter),
                    max_results: '10',
                });
                const res = await fetch(`/requests/${existingRequest.id}/alternatives?${params.toString()}`, {
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) throw new Error('Failed to fetch alternatives');
                const json = await res.json();
                setAlternatives(json.alternatives ?? {});
            } catch (e) {
                setAlternativesError(e instanceof Error ? e.message : 'Failed to load alternatives');
            } finally {
                setAlternativesLoading(false);
            }
        };

        fetchAlternatives();
    }, [isEditing, existingRequest?.id, existingRequest?.status, includeEquipmentFilter]);

    function applyAlternative(slot: AlternativeSlot) {
        const facility = facilities.find((f) => f.id === slot.facility_id);
        if (!facility) return;

        setSelectedFacility(slot.facility_id);
        setSelectedDates([new Date(slot.date)]);
        setCurrentTimeStart(slot.time_start.slice(0, 5));
        setCurrentTimeEnd(slot.time_end.slice(0, 5));
        setExpectedCapacity('');
        setHasOutsiders(false);
        setSelectedEquipment([]);
        setSelectedBorrowedEquipment([]);
        setExternalEquipment([]);
        setEquipmentConflicts({});
        setScheduleConflicts([]);

        loadSchedule(slot.facility_id, new Date(slot.date));
    }

    function editBooking(index: number) {
        const booking = data.facility_bookings[index];

        setSelectedFacility(booking.facility_id);
        setSelectedDates([new Date(booking.date)]);
        setCurrentTimeStart(booking.time_start.slice(0, 5));
        setCurrentTimeEnd(booking.time_end.slice(0, 5));
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
    };

    const discardDraft = () => {
        clearDraft(existingRequest?.id);
        setShowDraftBanner(false);
    };

    const availableEquipment: FacilityEquipment[] = selectedFacility ? (facilities.find((f) => f.id === selectedFacility)?.equipment ?? []) : [];

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

        if (updated.length > 0 && selectedDates.length > 0 && currentTimeStart && currentTimeEnd) {
            fetchEquipmentConflicts({
                equipmentIds: updated.map((e) => e.equipment_id),
                currentDate: format(selectedDates[0], 'yyyy-MM-dd'),
                timeStart: currentTimeStart,
                timeEnd: currentTimeEnd,
                excludeRequestId: existingRequest?.id ?? null,
            }).then((conflicts) => {
                if (conflicts) setEquipmentConflicts(conflicts);
            });
        }
    }

    function updateEquipmentQuantity(equipmentId: number, quantity: number) {
        setSelectedEquipment(selectedEquipment.map((e) => (e.equipment_id === equipmentId ? { ...e, quantity_needed: quantity } : e)));
    }

    function handleTimeStartChange(newStartTime: string) {
        if (newStartTime && !isTimeWithinBookingHours(newStartTime)) return;
        setCurrentTimeStart(newStartTime);
        if (currentTimeEnd && timeToMinutes(currentTimeEnd) <= timeToMinutes(newStartTime)) {
            setCurrentTimeEnd('');
        }
    }

    function handleTimeEndChange(newEndTime: string) {
        if (newEndTime && !isTimeWithinBookingHours(newEndTime)) return;
        if (currentTimeStart && timeToMinutes(newEndTime) <= timeToMinutes(currentTimeStart)) return;
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
                facility_capacity: facility.capacity,
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
                    facility_capacity: facility.capacity,
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

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const selected = Array.from(e.target.files ?? []);
        const rejected: string[] = [];
        const accepted: AttachedFile[] = [];
        const maxBytes = maxFileSizeBytes(requestOptions.max_file_size_mb);
        const limitLabel = formatMaxFileSize(requestOptions.max_file_size_mb);

        for (const file of selected) {
            if (maxBytes !== null && file.size > maxBytes) {
                rejected.push(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is ${limitLabel}`);
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

    const externalEquipmentProps: ExternalEquipmentProps = {
        isExternalOpen,
        setIsExternalOpen,
        externalEquipment,
        setExternalEquipment,
        externalEquipmentInput,
        setExternalEquipmentInput,
    };

    const borrowPanelProps: BorrowPanelProps = {
        selectedFacility,
        isBorrowOpen,
        setIsBorrowOpen,
        allBorrowableEquipment,
        allSourceFacilities,
        filteredBorrowableEquipment,
        borrowSearch,
        setBorrowSearch,
        borrowSort,
        setBorrowSort,
        borrowFacilityFilter,
        setBorrowFacilityFilter,
        borrowingEquipmentId,
        setBorrowingEquipmentId,
        selectedBorrowedEquipment,
        setSelectedBorrowedEquipment,
        borrowableAvailability,
    };

    return {
        // page
        isEditing,
        requestOptions,
        draft,
        showDraftBanner,
        restoreDraft,
        discardDraft,
        errors,
        processing,
        submit,
        data,
        setData,

        // form booking state
        selectedFacility,
        selectedDates,
        currentTimeStart,
        currentTimeEnd,
        selectedEquipment,
        scheduleConflicts,
        attachedFiles,
        expectedCapacity,
        hasOutsiders,
        existingFiles,
        equipmentConflicts,
        equipmentAvailability,
        editingIndex,

        // alternatives
        alternatives,
        alternativesLoading,
        alternativesError,
        includeEquipmentFilter,
        setIncludeEquipmentFilter,
        applyAlternative,

        // grouped panels
        externalEquipmentProps,
        borrowPanelProps,

        // setters
        setExpectedCapacity,
        setHasOutsiders,

        // handlers
        handleCheckboxChange,
        handleFileSelect,
        removeFile,
        removeExistingFile,
        editBooking,
        cancelEditBooking,
        handleFacilityChange,
        handleDateChange,
        clearEquipmentSelection,
        selectAllEquipment,
        handleEquipmentToggle,
        updateEquipmentQuantity,
        handleTimeStartChange,
        handleTimeEndChange,
        addFacilityBooking,
        removeBooking,

        // derived
        minSelectableDate,
        availableDaysOfWeek,
        hasNearMinimumScheduleDate,
        bookingTimeOptions,
        availableEndTimeOptions,
        canSaveFacilityBooking,
        availableEquipment,
    };
}
