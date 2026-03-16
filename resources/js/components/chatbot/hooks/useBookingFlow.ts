import { useState } from 'react';

export type BookingStep =
    | 'title'
    | 'description'
    | 'priority'
    | 'priority_reason'
    | 'participants'
    | 'facility'
    | 'date'
    | 'time_start'
    | 'time_end'
    | 'equipment'
    | 'equipment_quantity'
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
    // Temp state for multi-equipment selection
    current_equipment_id: number | null;
    current_equipment_name: string;
}

export interface Facility {
    id: number;
    name: string;
}

export interface Equipment {
    id: number;
    name: string;
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
};

const PRIORITY_MAP: Record<string, { level: 0 | 1 | 2; label: string }> = {
    'Normal Event':               { level: 0, label: 'Normal Event' },
    'School Event':               { level: 1, label: 'School Event' },
    'Government / High Authority': { level: 2, label: 'Government / High Authority' },
};

const TIME_OPTIONS = [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
];

const EQUIPMENT_OPTIONS: Equipment[] = [
    { id: 1, name: 'Projector' },
    { id: 2, name: 'Microphone' },
    { id: 3, name: 'Sound System' },
    { id: 4, name: 'Whiteboard' },
];

const PARTICIPANT_RANGES = ['1–100', '101–300', '301–500', '501–800', '801–1000'];

const EDITABLE_FIELDS: Array<{ key: BookingStep; label: string }> = [
    { key: 'title',           label: 'Title' },
    { key: 'description',     label: 'Description' },
    { key: 'priority',        label: 'Priority Level' },
    { key: 'priority_reason', label: 'Priority Reason' },
    { key: 'facility',        label: 'Facility' },
    { key: 'date',            label: 'Date' },
    { key: 'time_start',      label: 'Start Time' },
    { key: 'time_end',        label: 'End Time' },
    { key: 'equipment',       label: 'Equipment' },
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

export function useBookingFlow(facilities: Facility[], csrfToken: string) {
    const [step, setStep] = useState<BookingStep>('title');
    const [data, setData] = useState<BookingData>({ ...INITIAL_DATA });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string; request_id?: number } | null>(null);
    const [awaitingCustomTime, setAwaitingCustomTime] = useState(false);
    const [awaitingCustomDate, setAwaitingCustomDate] = useState(false);

    const update = (patch: Partial<BookingData>) =>
        setData(prev => ({ ...prev, ...patch }));

    // Returns { botMessage, quickReplies, isTextInput, showDatePicker }
    const getStepConfig = () => {
        switch (step) {
            case 'title':
                return {
                    botMessage: "Let's create a facility request. First, what is the title of the event?",
                    quickReplies: [],
                    isTextInput: true,
                    showDatePicker: false,
                };
            case 'description':
                return {
                    botMessage: 'Please provide a short description of the event.',
                    quickReplies: [],
                    isTextInput: true,
                    showDatePicker: false,
                };
            case 'priority':
                return {
                    botMessage: 'What is the priority level of this request?',
                    quickReplies: ['Normal Event', 'School Event', 'Government / High Authority'],
                    isTextInput: false,
                    showDatePicker: false,
                };
            case 'priority_reason':
                return {
                    botMessage: 'Please specify the reason for the high priority request.',
                    quickReplies: [],
                    isTextInput: true,
                    showDatePicker: false,
                };
            case 'participants':
                return {
                    botMessage: 'How many participants will attend? (Used to filter suitable facilities)',
                    quickReplies: PARTICIPANT_RANGES,
                    isTextInput: false,
                    showDatePicker: false,
                };
            case 'facility': {
                const options = facilities.length > 0
                    ? facilities.map(f => f.name)
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
                    quickReplies: ['Today', 'Tomorrow', 'Pick Date'],
                    isTextInput: false,
                    showDatePicker: awaitingCustomDate,
                };
            case 'time_start':
                return {
                    botMessage: 'What time will the event start?',
                    quickReplies: TIME_OPTIONS,
                    isTextInput: false,
                    showDatePicker: false,
                };
            case 'time_end':
                return {
                    botMessage: `What time will the event end? (Start: ${data.time_start})`,
                    quickReplies: awaitingCustomTime
                        ? TIME_OPTIONS
                        : ['+1 Hour', '+2 Hours', '+3 Hours', 'Custom'],
                    isTextInput: false,
                    showDatePicker: false,
                };
            case 'equipment': {
                const alreadyPicked = data.equipment.map(e => e.equipment_name);
                const remaining = EQUIPMENT_OPTIONS.filter(e => !alreadyPicked.includes(e.name)).map(e => e.name);
                const options = [...remaining, 'Done — No More Equipment'];
                return {
                    botMessage: data.equipment.length === 0
                        ? 'Do you need equipment for the event? Select all that apply, then press Done.'
                        : `Added: ${data.equipment.map(e => `${e.equipment_name} (${e.quantity_needed})`).join(', ')}. Add more or press Done.`,
                    quickReplies: options,
                    isTextInput: false,
                    showDatePicker: false,
                };
            }
            case 'equipment_quantity':
                return {
                    botMessage: `How many units of "${data.current_equipment_name}" do you need?`,
                    quickReplies: ['1', '2', '3', '4', '5'],
                    isTextInput: false,
                    showDatePicker: false,
                };
            case 'review': {
                const equipmentSummary = data.equipment.length > 0
                    ? data.equipment.map(e => `${e.equipment_name} (${e.quantity_needed})`).join(', ')
                    : 'None';
                const priorityLabel = PRIORITY_MAP[
                    Object.keys(PRIORITY_MAP).find(k => PRIORITY_MAP[k].level === data.priority_level) ?? 'Normal Event'
                ]?.label ?? 'Normal Event';

                const reviewText = [
                    '📋 Please review your request:',
                    '',
                    `📌 Title: ${data.title}`,
                    `📝 Description: ${data.description}`,
                    `⚡ Priority: ${priorityLabel}`,
                    data.priority_reason ? `📄 Priority Reason: ${data.priority_reason}` : null,
                    `🏛️ Facility: ${data.facility_name}`,
                    `📅 Date: ${data.date}`,
                    `⏰ Time: ${data.time_start} – ${data.time_end}`,
                    `🎛️ Equipment: ${equipmentSummary}`,
                    '',
                    'Submit this request?',
                ].filter(line => line !== null).join('\n');

                return {
                    botMessage: reviewText,
                    quickReplies: ['Submit Request', 'Edit Request', 'Cancel'],
                    isTextInput: false,
                    showDatePicker: false,
                };
            }
            case 'edit_pick': {
                const fields = data.priority_level === 0
                    ? EDITABLE_FIELDS.filter(f => f.key !== 'priority_reason')
                    : EDITABLE_FIELDS;
                return {
                    botMessage: 'Which field would you like to edit?',
                    quickReplies: fields.map(f => f.label),
                    isTextInput: false,
                    showDatePicker: false,
                };
            }
            default:
                return { botMessage: '', quickReplies: [], isTextInput: false, showDatePicker: false };
        }
    };

    const formatDate = (dateStr: string): string => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    const getTodayStr = (): string => {
        return new Date().toISOString().split('T')[0];
    };

    const getTomorrowStr = (): string => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    };

    // Main handler — called by quick reply click or text submit
    const handleInput = (value: string) => {
        switch (step) {
            case 'title':
                update({ title: value });
                setStep('description');
                break;

            case 'description':
                update({ description: value });
                setStep('priority');
                break;

            case 'priority': {
                const mapping = PRIORITY_MAP[value];
                if (!mapping) break;
                update({ priority_level: mapping.level, priority_reason: null });
                setStep(mapping.level > 0 ? 'priority_reason' : 'participants');
                break;
            }

            case 'priority_reason':
                update({ priority_reason: value });
                setStep('participants');
                break;

            case 'participants':
                update({ participant_range: value });
                setStep('facility');
                break;

            case 'facility': {
                const facility = facilities.find(f => f.name === value);
                if (!facility) break;
                update({ facility_id: facility.id, facility_name: facility.name });
                setStep('date');
                break;
            }

            case 'date':
                if (value === 'Today') {
                    update({ date: formatDate(getTodayStr()) });
                    setStep('time_start');
                } else if (value === 'Tomorrow') {
                    update({ date: formatDate(getTomorrowStr()) });
                    setStep('time_start');
                } else if (value === 'Pick Date') {
                    setAwaitingCustomDate(true);
                } else {
                    // Value from calendar — raw ISO string
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
                    update({ time_end: addHours(data.time_start, hours) });
                    setStep('equipment');
                } else {
                    // Custom time picked from list
                    update({ time_end: value });
                    setAwaitingCustomTime(false);
                    setStep('equipment');
                }
                break;

            case 'equipment':
                if (value === 'Done — No More Equipment') {
                    setStep('review');
                } else {
                    const eq = EQUIPMENT_OPTIONS.find(e => e.name === value);
                    if (!eq) break;
                    update({ current_equipment_id: eq.id, current_equipment_name: eq.name });
                    setStep('equipment_quantity');
                }
                break;

            case 'equipment_quantity': {
                const qty = parseInt(value);
                if (!data.current_equipment_id) break;
                update({
                    equipment: [
                        ...data.equipment,
                        {
                            equipment_id: data.current_equipment_id,
                            equipment_name: data.current_equipment_name,
                            quantity_needed: qty,
                        },
                    ],
                    current_equipment_id: null,
                    current_equipment_name: '',
                });
                setStep('equipment');
                break;
            }

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
                // Clear downstream data when editing a field
                if (field.key === 'equipment') {
                    update({ equipment: [] });
                }
                setStep(field.key);
                break;
            }
        }
    };

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
    });

    const submitRequest = async () => {
        setIsSubmitting(true);
        try {
            const payload = buildPayload();
            const token = csrfToken
                || (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content
                || document.cookie.split('; ').find(r => r.startsWith('XSRF-TOKEN='))?.split('=')[1]
                || '';

            console.log('[BookingFlow] Submitting payload:', JSON.stringify(payload, null, 2));
            console.log('[BookingFlow] CSRF token:', token ? `${token.slice(0, 10)}...` : 'MISSING');

            const url = route('api.db.create.request');
            console.log('[BookingFlow] POST →', url);

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': token,
                },
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            });

            console.log('[BookingFlow] Response status:', res.status, res.statusText);

            const rawText = await res.text();
            console.log('[BookingFlow] Raw response:', rawText);

            let json: any = {};
            try {
                json = JSON.parse(rawText);
            } catch {
                setSubmitResult({ success: false, message: `✗ Server returned unexpected response (${res.status}): ${rawText.slice(0, 200)}` });
                return;
            }

            if (res.ok && json.success) {
                setSubmitResult({ success: true, message: `✓ Request #${json.request_id} created successfully!`, request_id: json.request_id });
            } else {
                const errorDetail = json.errors
                    ? '\n' + Object.entries(json.errors).map(([k, v]) => `• ${k}: ${(v as string[]).join(', ')}`).join('\n')
                    : '';
                setSubmitResult({ success: false, message: `✗ Failed (${res.status}): ${json.message ?? json.error ?? 'Unknown error'}${errorDetail}` });
            }
        } catch (err) {
            console.error('[BookingFlow] Fetch error:', err);
            setSubmitResult({ success: false, message: `✗ Network error: ${err instanceof Error ? err.message : String(err)}` });
        } finally {
            setIsSubmitting(false);
            setStep('done');
        }
    };

    const reset = () => {
        setStep('title');
        setData({ ...INITIAL_DATA });
        setSubmitResult(null);
        setAwaitingCustomTime(false);
        setAwaitingCustomDate(false);
    };

    return {
        step,
        data,
        isSubmitting,
        submitResult,
        getStepConfig,
        handleInput,
        reset,
    };
}