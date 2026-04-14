import { useEffect, useState } from 'react';
import { getCsrfToken } from '../utils/csrfToken';

export type BookingStep =
    | 'title'
    | 'event_type'
    | 'participants'
    | 'facility'
    | 'date'
    | 'time_start'
    | 'time_end'
    | 'equipment'
    | 'equipment_quantity'
    | 'description'
    | 'files'
    | 'review'
    | 'edit_pick'
    | 'done';

export interface EquipmentItem {
    equipment_id: number;
    equipment_name: string;
    quantity_needed: number;
}

export interface BookingPayload {
    title: string;
    description: string;
    priority_level: 0 | 1 | 2;
    priority_reason: string | null;
    facility_bookings: Array<{
        facility_id: number;
        date: string;
        time_start: string;
        time_end: string;
        equipment: Array<{ equipment_id: number; quantity_needed: number }>;
    }>;
    files?: string[];
}

export interface BookingData {
    title: string;
    description: string;
    priority_level: 0 | 1 | 2;
    priority_reason: string | null;
    participant_range: string;
    facility_id: number | null;
    facility_name: string;
    date: string;
    time_start: string;
    time_end: string;
    equipment: EquipmentItem[];
    current_equipment_id: number | null;
    current_equipment_name: string;
    attachedFiles: Array<{ id: string; name: string }>;
}

export interface Facility {
    id: number;
    name: string;
    capacity?: number;
}

export interface Equipment {
    id: number;
    name: string;
    facility_id: number;
    quantity: number;
}

const INITIAL_DATA: BookingData = {
    title: '',
    description: '',
    priority_level: 0,
    priority_reason: null,
    participant_range: '',
    facility_id: null,
    facility_name: '',
    date: '',
    time_start: '',
    time_end: '',
    equipment: [],
    current_equipment_id: null,
    current_equipment_name: '',
    attachedFiles: [],
};

const PRIORITY_MAP: Record<string, { level: 0 | 1 | 2; label: string }> = {
    'Academic':      { level: 0, label: 'Academic' },
    'Organizational': { level: 1, label: 'Organizational' },
    'University':     { level: 1, label: 'University' },
    'Government':     { level: 2, label: 'Government' },
};

const TIME_OPTIONS = [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
];

const PARTICIPANT_RANGES = ['1-100', '101-300', '301-500', '501-800', '801-1000'];

const EDITABLE_FIELDS: Array<{ key: BookingStep; label: string }> = [
    { key: 'title',           label: 'Title' },
    { key: 'event_type',      label: 'Event Type' },
    { key: 'facility',        label: 'Facility' },
    { key: 'date',            label: 'Date' },
    { key: 'time_start',      label: 'Start Time' },
    { key: 'time_end',        label: 'End Time' },
    { key: 'equipment',       label: 'Equipment' },
    { key: 'description',     label: 'Additional Information' },
];

function timeToHHMM(time: string): string {
    const [timePart, modifier] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function addHours(time: string, hours: number): string {
    const [timePart, modifier] = time.split(' ');
    let [h, m] = timePart.split(':').map(Number);
    if (modifier === 'PM' && h !== 12) h += 12;
    if (modifier === 'AM' && h === 12) h = 0;
    h += hours;
    const newModifier = h >= 12 ? 'PM' : 'AM';
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayH}:${String(m).padStart(2, '0')} ${newModifier}`;
}

function toMinutes(time: string): number {
    const [timePart, modifier] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return (hours * 60) + minutes;
}

const MAX_END_TIME = '5:00 PM';
const MAX_END_TIME_MINUTES = toMinutes(MAX_END_TIME);
const START_TIME_OPTIONS = TIME_OPTIONS.filter(time => toMinutes(time) < MAX_END_TIME_MINUTES);

function getAvailableEndTimeOptions(startTime: string): string[] {
    if (!startTime) {
        return TIME_OPTIONS;
    }

    const startMinutes = toMinutes(startTime);

    return TIME_OPTIONS.filter(time => {
        const endMinutes = toMinutes(time);
        return endMinutes > startMinutes && endMinutes <= MAX_END_TIME_MINUTES;
    });
}

function getAvailableDurationOptions(startTime: string): string[] {
    if (!startTime) {
        return ['+1 Hour', '+2 Hours', '+3 Hours', 'Custom'];
    }

    const startMinutes = toMinutes(startTime);
    const availableHours = Math.floor((MAX_END_TIME_MINUTES - startMinutes) / 60);
    const durationOptions = Array.from(
        { length: Math.max(availableHours, 0) },
        (_, index) => `+${index + 1} ${index === 0 ? 'Hour' : 'Hours'}`
    );

    return [...durationOptions, 'Custom'];
}

function getQuantityQuickReplies(maxQuantity: number): string[] {
    if (maxQuantity <= 0) {
        return [];
    }

    if (maxQuantity <= 10) {
        return Array.from({ length: maxQuantity }, (_, index) => String(index + 1));
    }

    if (maxQuantity < 100) {
        const options: string[] = [];

        for (let value = 10; value <= maxQuantity; value += 10) {
            options.push(String(value));
        }

        if (options.length === 0 || options[options.length - 1] !== String(maxQuantity)) {
            options.push(String(maxQuantity));
        }

        return options;
    }

    const options: string[] = [];

    for (let value = 100; value <= maxQuantity; value += 100) {
        options.push(String(value));
    }

    if (options.length === 0 || options[options.length - 1] !== String(maxQuantity)) {
        options.push(String(maxQuantity));
    }

    return options;
}

export function useBookingFlow(facilities: Facility[], equipmentOptions: Equipment[]) {
    const [step, setStep] = useState<BookingStep>('title');
    const [data, setData] = useState<BookingData>({ ...INITIAL_DATA });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState<{
        success: boolean;
        message: string;
        request_id?: number;
        shouldRedirectToEdit?: boolean;
    } | null>(null);
    const [awaitingCustomTime, setAwaitingCustomTime] = useState(false);
    const [awaitingCustomDate, setAwaitingCustomDate] = useState(false);

    const update = (patch: Partial<BookingData>) =>
        setData(prev => ({ ...prev, ...patch }));

    const getBookingEquipmentOptions = (): Equipment[] => {
        if (!data.facility_id) {
            return [];
        }

        return equipmentOptions.filter(
            equipment => Number(equipment.facility_id) === Number(data.facility_id)
        );
    };

    const getCurrentEquipmentMaxQuantity = (): number => {
        if (!data.current_equipment_id) {
            return 0;
        }

        return getBookingEquipmentOptions().find(
            equipment => equipment.id === data.current_equipment_id
        )?.quantity ?? 0;
    };

    useEffect(() => {
        if (step !== 'equipment') {
            return;
        }

        const filteredEquipment = getBookingEquipmentOptions();

        console.log('[BookingFlow equipment debug] Selected facility:', {
            facility_id: data.facility_id,
            facility_name: data.facility_name,
        });
        console.log('[BookingFlow equipment debug] All equipment options:', equipmentOptions);
        console.log('[BookingFlow equipment debug] Filtered facility equipment:', filteredEquipment);
        console.log('[BookingFlow equipment debug] Already selected equipment:', data.equipment);
    }, [step, data.facility_id, data.facility_name, data.equipment, equipmentOptions]);

    const getStepConfig = () => {
        switch (step) {
            case 'title':
                return {
                    botMessage: "Let's create a facility request. First, what is the title of the event?",
                    quickReplies: [],
                    isTextInput: true,
                    showDatePicker: false,
                };
            case 'event_type':
                return {
                    botMessage: 'What is the type of event?',
                    quickReplies: ['Academic', 'Organizational', 'University', 'Government'],
                    isTextInput: false,
                    showDatePicker: false,
                };
            case 'participants':
                return {
                    botMessage: 'How many participants will attend? This is used to filter suitable facilities.',
                    quickReplies: PARTICIPANT_RANGES,
                    isTextInput: false,
                    showDatePicker: false,
                };
            case 'facility': {
                const options = facilities.length > 0
                    ? facilities.map(f => `${f.name} (Capacity: ${f.capacity ?? 'N/A'})`)
                    : ['Loading facilities...'];
                return {
                    botMessage: 'Please choose a facility suitable for your event.',
                    quickReplies: options,
                    isTextInput: false,
                    showDatePicker: false,
                };
            }
            case 'date':
                return {
                    botMessage: 'Please select the date of the event.',
                    quickReplies: ['In 3 days', 'In a week', 'In a month', 'Pick date'],
                    isTextInput: false,
                    showDatePicker: awaitingCustomDate,
                };
            case 'time_start':
                return {
                    botMessage: 'What time will the event start?',
                    quickReplies: START_TIME_OPTIONS,
                    isTextInput: false,
                    showDatePicker: false,
                };
            case 'time_end':
                return {
                    botMessage: `What time will the event end? Start time is ${data.time_start}.`,
                    quickReplies: awaitingCustomTime
                        ? getAvailableEndTimeOptions(data.time_start)
                        : getAvailableDurationOptions(data.time_start),
                    isTextInput: false,
                    showDatePicker: false,
                };
            case 'equipment': {
                const alreadyPicked = data.equipment.map(e => e.equipment_name);
                const availableEquipment = getBookingEquipmentOptions();
                const remaining = availableEquipment
                    .filter(e => !alreadyPicked.includes(e.name))
                    .map(e => e.name);
                return {
                    botMessage: availableEquipment.length === 0
                        ? 'There is no equipment available right now. Press Done to continue.'
                        : data.equipment.length === 0
                            ? 'Do you need any equipment for the event? Select all that apply, then press Done.'
                        : `Added so far: ${data.equipment.map(e => `${e.equipment_name} (${e.quantity_needed})`).join(', ')}. Add more or press Done.`,
                    quickReplies: [...remaining, 'Done'],
                    isTextInput: false,
                    showDatePicker: false,
                };
            }
            case 'equipment_quantity':
                const maxQuantity = getCurrentEquipmentMaxQuantity();
                return {
                    botMessage: `How many units of "${data.current_equipment_name}" do you need? Maximum available is ${maxQuantity}.`,
                    quickReplies: getQuantityQuickReplies(maxQuantity),
                    isTextInput: true,
                    showDatePicker: false,
                };
            case 'description':
                return {
                    botMessage: 'Is there any additional information you would like to provide?',
                    quickReplies: ['None'],
                    isTextInput: true,
                    showDatePicker: false,
                };
            case 'files':
                return {
                    botMessage: 'Would you like to attach any files to this request? (Optional)',
                    quickReplies: ['Continue without files', 'Attach files'],
                    isTextInput: false,
                    showDatePicker: false,
                };
            case 'review': {
                const equipmentSummary = data.equipment.length > 0
                    ? data.equipment.map(e => `${e.equipment_name} (${e.quantity_needed})`).join(', ')
                    : 'None';
                const priorityLabel = Object.values(PRIORITY_MAP).find(
                    p => p.level === data.priority_level
                )?.label ?? 'Academic';

                const reviewText = [
                    'Please review your request before submitting:',
                    '',
                    `Title: ${data.title}`,
                    `Event Type: ${priorityLabel}`,
                    `Facility: ${data.facility_name}`,
                    `Date: ${data.date}`,
                    `Time: ${data.time_start} - ${data.time_end}`,
                    `Equipment: ${equipmentSummary}`,
                    data.description ? `Additional Information: ${data.description}` : null,
                    data.attachedFiles.length > 0 ? `Attached Files: ${data.attachedFiles.length}` : null,
                    '',
                    'Would you like to submit this request?',
                ].filter(line => line !== null).join('\n');

                return {
                    botMessage: reviewText,
                    quickReplies: ['Submit Request', 'Edit Request', 'Cancel'],
                    isTextInput: false,
                    showDatePicker: false,
                };
            }
            case 'edit_pick': {
                return {
                    botMessage: 'Which field would you like to edit?',
                    quickReplies: EDITABLE_FIELDS.map(f => f.label),
                    isTextInput: false,
                    showDatePicker: false,
                };
            }
            default:
                return {
                    botMessage: '',
                    quickReplies: [],
                    isTextInput: false,
                    showDatePicker: false,
                };
        }
    };

    const formatDate = (dateStr: string): string => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    const getFutureDateStr = (daysToAdd: number): string => {
        const d = new Date();
        d.setDate(d.getDate() + daysToAdd);
        return d.toISOString().split('T')[0];
    };

    const handleInput = (value: string) => {
        switch (step) {
            case 'title':
                update({ title: value });
                setStep('event_type');
                break;

            case 'event_type': {
                const mapping = PRIORITY_MAP[value];
                if (!mapping) break;
                update({ priority_level: mapping.level, priority_reason: null });
                setStep('participants');
                break;
            }

            case 'participants':
                update({ participant_range: value });
                setStep('facility');
                break;

            case 'facility': {
                const facilityName = value.replace(/ \(Capacity: \d+\)$/, '');
                const facility = facilities.find(f => f.name === facilityName);
                if (!facility) break;
                update({
                    facility_id: facility.id,
                    facility_name: facility.name,
                    equipment: [],
                    current_equipment_id: null,
                    current_equipment_name: '',
                });
                setStep('date');
                break;
            }

            case 'date':
                if (value === 'In 3 days') {
                    update({ date: formatDate(getFutureDateStr(3)) });
                    setStep('time_start');
                } else if (value === 'In a week') {
                    update({ date: formatDate(getFutureDateStr(7)) });
                    setStep('time_start');
                } else if (value === 'In a month') {
                    update({ date: formatDate(getFutureDateStr(30)) });
                    setStep('time_start');
                } else if (value === 'Pick date') {
                    setAwaitingCustomDate(true);
                } else {
                    update({ date: formatDate(value) });
                    setAwaitingCustomDate(false);
                    setStep('time_start');
                }
                break;

            case 'time_start':
                update({ time_start: value });
                setAwaitingCustomTime(false);
                setStep('time_end');
                break;

            case 'time_end':
                if (value === 'Custom') {
                    setAwaitingCustomTime(true);
                } else if (value.startsWith('+')) {
                    const hours = parseInt(value.replace(/\D/g, ''));
                    const calculatedEndTime = addHours(data.time_start, hours);
                    if (toMinutes(calculatedEndTime) > MAX_END_TIME_MINUTES) break;
                    update({ time_end: calculatedEndTime });
                    setStep('equipment');
                } else {
                    if (!getAvailableEndTimeOptions(data.time_start).includes(value)) break;
                    update({ time_end: value });
                    setAwaitingCustomTime(false);
                    setStep('equipment');
                }
                break;

            case 'equipment':
                if (value === 'Done') {
                    setStep('description');
                } else {
                    const eq = getBookingEquipmentOptions().find(e => e.name === value);
                    if (!eq) break;
                    update({ current_equipment_id: eq.id, current_equipment_name: eq.name });
                    setStep('equipment_quantity');
                }
                break;

            case 'equipment_quantity': {
                const qty = parseInt(value, 10);
                const maxQuantity = getCurrentEquipmentMaxQuantity();
                if (!data.current_equipment_id) break;
                if (Number.isNaN(qty) || qty < 1) break;
                update({
                    equipment: [
                        ...data.equipment,
                        {
                            equipment_id: data.current_equipment_id,
                            equipment_name: data.current_equipment_name,
                            quantity_needed: Math.min(qty, maxQuantity),
                        },
                    ],
                    current_equipment_id: null,
                    current_equipment_name: '',
                });
                setStep('equipment');
                break;
            }

            case 'description':
                update({ description: value === 'None' ? '' : value });
                setStep('files');
                break;

            case 'files':
                if (value === 'Continue without files') {
                    setStep('review');
                } else if (value === 'Attach files') {
                    // Will be handled by the component
                    setStep('review');
                }
                break;

            case 'review':
                if (value === 'Submit Request') {
                    submitRequest();
                } else if (value === 'Edit Request') {
                    setStep('edit_pick');
                } else if (value === 'Cancel') {
                    reset();
                }
                break;

            case 'edit_pick': {
                const field = EDITABLE_FIELDS.find(f => f.label === value);
                if (!field) break;
                if (field.key === 'equipment') {
                    update({ equipment: [] });
                }
                setStep(field.key);
                break;
            }
        }
    };

    const goBack = () => {
        switch (step) {
            case 'title':
            case 'done':
                break;

            case 'event_type':
                setStep('title');
                break;

            case 'participants':
                setStep('event_type');
                break;

            case 'facility':
                setStep('participants');
                break;

            case 'date':
                if (awaitingCustomDate) {
                    setAwaitingCustomDate(false);
                    break;
                }
                update({ date: '' });
                setStep('facility');
                break;

            case 'time_start':
                update({ time_start: '', time_end: '' });
                setStep('date');
                break;

            case 'time_end':
                if (awaitingCustomTime) {
                    setAwaitingCustomTime(false);
                    break;
                }
                update({ time_end: '' });
                setStep('time_start');
                break;

            case 'equipment':
                update({
                    equipment: [],
                    current_equipment_id: null,
                    current_equipment_name: '',
                });
                setStep('time_end');
                break;

            case 'equipment_quantity':
                update({
                    current_equipment_id: null,
                    current_equipment_name: '',
                });
                setStep('equipment');
                break;

            case 'description':
                update({ description: '' });
                setStep('equipment');
                break;

            case 'files':
                setStep('description');
                break;

            case 'review':
                setStep('files');
                break;

            case 'edit_pick':
                setStep('review');
                break;
        }
    };

    const canGoBack = step !== 'title' && step !== 'done';

    const buildPayload = (): BookingPayload => ({
        title: data.title,
        description: data.description,
        priority_level: data.priority_level,
        priority_reason: data.priority_reason,
        facility_bookings: [
            {
                facility_id: data.facility_id!,
                date: data.date,
                time_start: timeToHHMM(data.time_start),
                time_end: timeToHHMM(data.time_end),
                equipment: data.equipment.map(e => ({
                    equipment_id: e.equipment_id,
                    quantity_needed: e.quantity_needed,
                })),
            },
        ],
        files: data.attachedFiles.map(f => f.id),
    });

    const getEmptyFields = (): string[] => {
        const empty: string[] = [];
        if (!data.title) empty.push('Title');
        return empty;
    };

    const submitRequest = async () => {
        const emptyFields = getEmptyFields();
        if (emptyFields.length > 0) {
            setSubmitResult({
                success: false,
                message: `⚠️ ${emptyFields.join(', ')} is empty. You can still submit, but these fields should be filled.`,
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = buildPayload();
            const res = await fetch(route('api.db.create.request'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            });

            if (res.status === 419) {
                window.location.reload();
                return;
            }

            const rawText = await res.text();
            let json: any = {};
            try {
                json = JSON.parse(rawText);
            } catch {
                setSubmitResult({
                    success: false,
                    message: `Server returned an unexpected response (${res.status}): ${rawText.slice(0, 200)}`,
                    shouldRedirectToEdit: true,
                });
                setIsSubmitting(false);
                return;
            }

            if (res.ok && json.success) {
                setSubmitResult({
                    success: true,
                    message: `Request #${json.request_id} has been created successfully.`,
                    request_id: json.request_id,
                });
                setIsSubmitting(false);
                setStep('done');
            } else {
                const errorDetail = json.errors
                    ? '\n' + Object.entries(json.errors)
                        .map(([k, v]) => `- ${k}: ${(v as string[]).join(', ')}`)
                        .join('\n')
                    : '';
                setSubmitResult({
                    success: false,
                    message: `Submission failed (${res.status}): ${json.message ?? json.error ?? 'Unknown error'}${errorDetail}`,
                    shouldRedirectToEdit: true,
                });
                setIsSubmitting(false);
            }
        } catch (err) {
            setSubmitResult({
                success: false,
                message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
                shouldRedirectToEdit: true,
            });
            setIsSubmitting(false);
        }
    };

    const reset = () => {
        setStep('title');
        setData({ ...INITIAL_DATA });
        setSubmitResult(null);
        setAwaitingCustomTime(false);
        setAwaitingCustomDate(false);
    };

    const buildContextSummary = (): string => {
        const parts: string[] = [
            'The user is currently going through a structured facility booking flow. The following information has been collected so far:',
        ];
        if (data.title)            parts.push(`Event Title: ${data.title}`);
        if (data.priority_level !== undefined)
            parts.push(`Event Type: ${data.priority_level} (0 = Academic, 1 = Organizational/University, 2 = Government)`);
        if (data.facility_name)    parts.push(`Selected Facility: ${data.facility_name}`);
        if (data.date)             parts.push(`Event Date: ${data.date}`);
        if (data.time_start)       parts.push(`Start Time: ${data.time_start}`);
        if (data.time_end)         parts.push(`End Time: ${data.time_end}`);
        if (data.equipment.length > 0)
            parts.push(`Equipment: ${data.equipment.map(e => `${e.equipment_name} x${e.quantity_needed}`).join(', ')}`);
        if (data.description)      parts.push(`Additional Information: ${data.description}`);
        if (data.attachedFiles.length > 0)
            parts.push(`Attached Files: ${data.attachedFiles.length}`);
        parts.push('Use this context to assist with any follow-up questions the user has.');
        return parts.join('\n');
    };

    return {
        step,
        data,
        isSubmitting,
        submitResult,
        canGoBack,
        getStepConfig,
        handleInput,
        buildContextSummary,
        getCurrentEquipmentMaxQuantity,
        goBack,
        reset,
        update,
        goToStep: setStep,
    };
}
