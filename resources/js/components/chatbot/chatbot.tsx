import React, { useRef, useEffect, useState } from 'react';
import { Message, CreateRequestPayload, AttachedFileInfo } from './types';
import { useMessages } from './hooks/useMessages';
import { useParticipantCount } from './hooks/useParticipantCount';
import { useChatAPI } from './hooks/useChatAPI';
import { QuickReply } from './components/QuickReplies';
import { Facility, useBookingFlow } from './hooks/useBookingFlow';
import { Equipment } from '@/types/equipment';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getCsrfToken } from './utils/csrfToken';
import WelcomeMessage from './components/WelcomeMessage';
import MessageList from './components/MessageList';
import LoadingIndicator from './components/LoadingIndicator';
import ChatInput from './components/ChatInput';
import BookingFlow from './components/BookingFlow';
import AvailabilityQuickFlow from './components/AvailabilityQuickFlow';
import DatePicker from './components/DatePicker';

type ChatMode = 'idle' | 'booking' | 'availability' | 'ai';
type GuidedFlowMode = 'none' | 'booking' | 'availability';
type GuidedFlowStep = 'attachments' | 'participants' | 'facility' | 'date' | 'time_start' | 'time_end' | 'equipment';
type SelectedEquipmentItem = {
    equipment_id: number;
    equipment_name: string;
    facility_id: number;
    facility_name: string | null;
    quantity_needed: number;
};

type BookingEquipmentSelection = {
    equipment_id: number;
    quantity_needed: number;
};

type GuidedEquipmentDecision = 'unknown' | 'selected' | 'none';

type GuidedFlowState = {
    mode: GuidedFlowMode;
    step: GuidedFlowStep | null;
    participantCount: number | null;
    facilityId: number | null;
    date: string | null;
    timeStart: string | null;
    timeEnd: string | null;
    equipmentDecision: GuidedEquipmentDecision;
};

type GuidedQuickReplyOption = {
    id: string;
    label: string;
    onSelect: () => void | Promise<void>;
    variant?: 'default' | 'outline';
    disabled?: boolean;
};

const GUIDED_TIME_OPTIONS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];

const INITIAL_GUIDED_FLOW: GuidedFlowState = {
    mode: 'none',
    step: null,
    participantCount: null,
    facilityId: null,
    date: null,
    timeStart: null,
    timeEnd: null,
    equipmentDecision: 'unknown',
};

const toPositiveInt = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed !== '' && /^\d+$/.test(trimmed)) {
            const parsed = Number(trimmed);
            return parsed > 0 ? parsed : null;
        }
    }

    return null;
};

const mergeEquipmentSelections = (base: BookingEquipmentSelection[] = [], extra: BookingEquipmentSelection[] = []): BookingEquipmentSelection[] => {
    const totals = new Map<number, number>();

    [...base, ...extra].forEach((selection) => {
        const equipmentId = toPositiveInt((selection as unknown as { equipment_id?: unknown })?.equipment_id);
        const quantityNeeded = toPositiveInt((selection as unknown as { quantity_needed?: unknown })?.quantity_needed);

        if (!equipmentId || !quantityNeeded) {
            return;
        }

        totals.set(equipmentId, (totals.get(equipmentId) ?? 0) + quantityNeeded);
    });

    return Array.from(totals.entries()).map(([equipment_id, quantity_needed]) => ({
        equipment_id,
        quantity_needed,
    }));
};

const normalizeEquipmentSelections = (rawValue: unknown): BookingEquipmentSelection[] => {
    const normalized: BookingEquipmentSelection[] = [];

    if (Array.isArray(rawValue)) {
        rawValue.forEach((entry) => {
            if (!entry || typeof entry !== 'object') return;

            const equipmentId = toPositiveInt(
                (entry as { equipment_id?: unknown; id?: unknown }).equipment_id ?? (entry as { equipment_id?: unknown; id?: unknown }).id,
            );
            const quantityNeeded = toPositiveInt(
                (entry as { quantity_needed?: unknown; quantity?: unknown }).quantity_needed ??
                    (entry as { quantity_needed?: unknown; quantity?: unknown }).quantity,
            );

            if (!equipmentId || !quantityNeeded) {
                return;
            }

            normalized.push({
                equipment_id: equipmentId,
                quantity_needed: quantityNeeded,
            });
        });
    }

    return mergeEquipmentSelections([], normalized);
};

const normalizePayloadForSubmission = (payload: CreateRequestPayload): CreateRequestPayload => {
    const rawPayload = payload as unknown as Record<string, unknown>;
    const rawBookings = Array.isArray(rawPayload.facility_bookings) ? (rawPayload.facility_bookings as Array<Record<string, unknown>>) : [];

    const normalizedBookings: CreateRequestPayload['facility_bookings'] = [];
    let orphanEquipment: BookingEquipmentSelection[] = [];

    rawBookings.forEach((booking) => {
        if (!booking || typeof booking !== 'object') {
            return;
        }

        const facilityId = toPositiveInt(booking.facility_id);
        const date = typeof booking.date === 'string' ? booking.date : '';
        const timeStartRaw = booking.time_start ?? booking.start_time;
        const timeEndRaw = booking.time_end ?? booking.end_time;
        const timeStart = typeof timeStartRaw === 'string' ? timeStartRaw : '';
        const timeEnd = typeof timeEndRaw === 'string' ? timeEndRaw : '';
        const expectedCapacity = toPositiveInt(
            booking.expected_capacity ?? (booking as { participant_count?: unknown }).participant_count,
        );
        const normalizedEquipment = normalizeEquipmentSelections(booking.equipment);

        if (facilityId) {
            const normalizedBooking: CreateRequestPayload['facility_bookings'][number] = {
                facility_id: facilityId,
                date,
                time_start: timeStart,
                time_end: timeEnd,
            };

            if (expectedCapacity) {
                normalizedBooking.expected_capacity = expectedCapacity;
            }

            if (normalizedEquipment.length > 0) {
                normalizedBooking.equipment = normalizedEquipment;
            }

            normalizedBookings.push(normalizedBooking);
            return;
        }

        if (normalizedEquipment.length > 0) {
            orphanEquipment = mergeEquipmentSelections(orphanEquipment, normalizedEquipment);
        }
    });

    if (normalizedBookings.length > 0 && orphanEquipment.length > 0) {
        normalizedBookings[0].equipment = mergeEquipmentSelections(normalizedBookings[0].equipment ?? [], orphanEquipment);
    }

    const topLevelEquipment = normalizeEquipmentSelections(rawPayload.equipment);
    if (normalizedBookings.length > 0 && topLevelEquipment.length > 0) {
        normalizedBookings[0].equipment = mergeEquipmentSelections(normalizedBookings[0].equipment ?? [], topLevelEquipment);
    }

    if (normalizedBookings.length === 0) {
        return payload;
    }

    const payloadParticipantCount = toPositiveInt(rawPayload.participant_count);

    return {
        ...payload,
        ...(payloadParticipantCount ? { participant_count: payloadParticipantCount } : {}),
        facility_bookings: normalizedBookings,
    };
};

const extractPayloadFromText = (content: string): CreateRequestPayload | null => {
    const trimmed = content.trim();
    if (!trimmed) {
        return null;
    }

    const directCandidate = trimmed
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    const tryParse = (candidate: string): CreateRequestPayload | null => {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { facility_bookings?: unknown }).facility_bookings)) {
                return parsed as CreateRequestPayload;
            }
        } catch (_) {}
        return null;
    };

    const directParsed = tryParse(directCandidate);
    if (directParsed) {
        return directParsed;
    }

    let depth = 0;
    let start = -1;

    for (let index = 0; index < content.length; index += 1) {
        const char = content[index];

        if (char === '{') {
            if (depth === 0) {
                start = index;
            }
            depth += 1;
            continue;
        }

        if (char !== '}' || depth === 0) {
            continue;
        }

        depth -= 1;
        if (depth !== 0 || start < 0) {
            continue;
        }

        const candidate = content.slice(start, index + 1);
        const parsed = tryParse(candidate);
        if (parsed) {
            return parsed;
        }
    }

    return null;
};

const toMinutes = (time: string): number => {
    const candidate = time.trim();
    if (!candidate) return NaN;

    if (/^\d{1,2}:\d{2}$/.test(candidate)) {
        const [hours, minutes] = candidate.split(':').map(Number);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return NaN;
        return hours * 60 + minutes;
    }

    const [timePart, rawModifier] = candidate.split(' ');
    const modifier = (rawModifier ?? '').toUpperCase();
    const [rawHours, rawMinutes] = timePart.split(':').map(Number);
    if (Number.isNaN(rawHours) || Number.isNaN(rawMinutes)) return NaN;

    let hours = rawHours;
    const minutes = rawMinutes;
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
};

const formatDateYmd = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function Chatbot() {
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [input, setInput] = React.useState('');
    const [mode, setMode] = useState<ChatMode>('idle');
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [equipmentOptions, setEquipmentOptions] = useState<Array<Equipment>>([]);
    const [selectedEquipment, setSelectedEquipment] = useState<SelectedEquipmentItem[]>([]);
    // NEW: Track the message index of the last equipment question we responded to
    const [lastEquipmentQuestionIndex, setLastEquipmentQuestionIndex] = useState<number>(-1);
    // NEW: Track whether to show equipment selection UI
    const [showEquipmentSelection, setShowEquipmentSelection] = useState<boolean>(false);

    const { messages, addMessage, addMessages, setMessages, getMessagesText } = useMessages();
    const { participantCount: trackedParticipantCount, setParticipantCount, extractAndSet, getCurrentCount } = useParticipantCount();
    const bookingFlow = useBookingFlow(facilities, equipmentOptions);
    const { isLoading, sendMessage, submitRequest } = useChatAPI();
    const [pendingPayload, setPendingPayload] = useState<CreateRequestPayload | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFileInfo[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const messageQueueRef = useRef<Array<{ message: Message; context?: string }>>([]);
    const [guidedFlow, setGuidedFlow] = useState<GuidedFlowState>({ ...INITIAL_GUIDED_FLOW });
    const [customParticipantCount, setCustomParticipantCount] = useState<string>('');
    const [customStartTime, setCustomStartTime] = useState<string>('');
    const [customEndTime, setCustomEndTime] = useState<string>('');
    const guidedFileInputRef = useRef<HTMLInputElement | null>(null);

    const withAttachedFiles = (payload: CreateRequestPayload): CreateRequestPayload => {
        const fileIds = attachedFiles.map((file) => file.id);

        if (fileIds.length === 0) {
            const { files: _files, ...rest } = payload;
            return rest;
        }

        return {
            ...payload,
            files: fileIds,
        };
    };

    const resolveParticipantCountForSubmission = (): number | null => {
        const guidedCount = toPositiveInt(guidedFlow.participantCount);
        if (guidedCount) {
            return guidedCount;
        }

        const trackedCount = toPositiveInt(trackedParticipantCount);
        if (trackedCount) {
            return trackedCount;
        }

        const inferredCount = toPositiveInt(getCurrentCount(getMessagesText()));
        return inferredCount ?? null;
    };

    const withParticipantCountMetadata = (payload: CreateRequestPayload): CreateRequestPayload => {
        const payloadParticipantCount = toPositiveInt((payload as unknown as { participant_count?: unknown }).participant_count);
        const resolvedParticipantCount = payloadParticipantCount ?? resolveParticipantCountForSubmission();

        if (!resolvedParticipantCount) {
            return payload;
        }

        return {
            ...payload,
            participant_count: resolvedParticipantCount,
            facility_bookings: payload.facility_bookings.map((booking) => {
                const existingExpectedCapacity = toPositiveInt((booking as unknown as { expected_capacity?: unknown }).expected_capacity);

                if (existingExpectedCapacity) {
                    return booking;
                }

                return {
                    ...booking,
                    expected_capacity: resolvedParticipantCount,
                };
            }),
        };
    };

    const buildSubmissionPayload = (payload: CreateRequestPayload): CreateRequestPayload => {
        return withAttachedFiles(withParticipantCountMetadata(normalizePayloadForSubmission(payload)));
    };

    const getPayloadValidationError = (payload: CreateRequestPayload): string | null => {
        const bookingsWithFacilityId = payload.facility_bookings.filter((booking) => Number.isFinite(booking.facility_id) && booking.facility_id > 0);

        if (bookingsWithFacilityId.length === 0) {
            return 'The chatbot payload is incomplete and does not contain a valid facility ID. Please select a facility and try again.';
        }

        const invalidFacilityIds = bookingsWithFacilityId
            .map((booking) => booking.facility_id)
            .filter((facilityId) => !facilities.some((facility) => facility.id === facilityId));

        if (invalidFacilityIds.length === 0) {
            return null;
        }

        const availableFacilities = facilities.map((facility) => `ID ${facility.id}: ${facility.name}`).join(', ');

        return `The chatbot selected an invalid facility ID (${invalidFacilityIds.join(', ')}). Please choose a valid facility from the current list: ${availableFacilities}`;
    };

    const resetGuidedFlow = () => {
        setGuidedFlow({ ...INITIAL_GUIDED_FLOW });
    };

    const isFacilityRecommendedForParticipants = (facility: Facility, participantCount: number): boolean => {
        if (participantCount <= 0 || typeof facility.capacity !== 'number') {
            return false;
        }

        return facility.capacity >= participantCount && facility.capacity <= participantCount * 2;
    };

    const getGuidedBookingFacilities = (participantCount: number): Facility[] => {
        return [...facilities].sort((a, b) => {
            const aRecommended = isFacilityRecommendedForParticipants(a, participantCount);
            const bRecommended = isFacilityRecommendedForParticipants(b, participantCount);

            if (aRecommended === bRecommended) {
                return a.id - b.id;
            }

            return aRecommended ? -1 : 1;
        });
    };

    const getGuidedEndTimeOptions = (startTime: string): string[] => {
        return GUIDED_TIME_OPTIONS.filter((option) => toMinutes(option) > toMinutes(startTime));
    };

    const normalizeGuidedTimeInput = (value: string): string => {
        return value.trim();
    };

    const startGuidedFlow = (flowMode: Exclude<GuidedFlowMode, 'none'>) => {
        setMode('ai');
        setShowEquipmentSelection(false);
        setGuidedFlow({
            ...INITIAL_GUIDED_FLOW,
            mode: flowMode,
            step: flowMode === 'booking' ? 'attachments' : 'facility',
        });

        addMessage({
            role: 'assistant',
            content:
                flowMode === 'booking'
                    ? 'Guided booking is active. Before we continue, do you have any approval paper or related supporting document to attach?'
                    : 'Guided availability check is active. Please choose a facility using the quick replies below.',
        });
    };

    const handleGuidedCancel = () => {
        resetGuidedFlow();
        setShowEquipmentSelection(false);
        addMessage({
            role: 'assistant',
            content: 'Guided flow cancelled. You can start a new guided flow or continue with normal chat.',
        });
    };

    const handleGuidedBack = () => {
        setShowEquipmentSelection(false);
        setGuidedFlow((prev) => {
            if (prev.mode === 'none' || !prev.step) {
                return prev;
            }

            if (prev.mode === 'booking') {
                switch (prev.step) {
                    case 'attachments':
                        return { ...INITIAL_GUIDED_FLOW };
                    case 'participants':
                        return { ...prev, step: 'attachments' };
                    case 'facility':
                        return { ...prev, step: 'participants', facilityId: null };
                    case 'date':
                        return { ...prev, step: 'facility', date: null };
                    case 'time_start':
                        return { ...prev, step: 'date', timeStart: null };
                    case 'time_end':
                        return { ...prev, step: 'time_start', timeEnd: null };
                    case 'equipment':
                        return { ...prev, step: 'time_end', equipmentDecision: 'unknown' };
                    default:
                        return prev;
                }
            }

            switch (prev.step) {
                case 'facility':
                    return { ...INITIAL_GUIDED_FLOW };
                case 'date':
                    return { ...prev, step: 'facility', date: null };
                case 'time_start':
                    return { ...prev, step: 'date', timeStart: null };
                case 'time_end':
                    return { ...prev, step: 'time_start', timeEnd: null };
                default:
                    return prev;
            }
        });
    };

    const handleGuidedParticipantSelection = (participantCount: number) => {
        setParticipantCount(participantCount);
        addMessage({ role: 'user', content: `Participants: ${participantCount}` });
        const recommendedCount = facilities.filter((facility) =>
            isFacilityRecommendedForParticipants(facility, participantCount),
        ).length;

        setGuidedFlow((prev) => ({
            ...prev,
            mode: 'booking',
            step: 'facility',
            participantCount,
            facilityId: null,
        }));
        addMessage({
            role: 'assistant',
            content:
                recommendedCount > 0
                    ? `I prioritized ${recommendedCount} recommended room option(s) for ${participantCount} participants. You can still choose any facility; final capacity validation is handled by the backend during submission.`
                    : `No exact capacity-range recommendation was found for ${participantCount} participants. You can still choose any facility, and backend validation will make the final decision on submission.`,
        });
    };

    const handleCustomParticipantSubmit = () => {
        const parsed = Number(customParticipantCount);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            addMessage({
                role: 'assistant',
                content: 'Please enter a valid participant count greater than zero.',
            });
            return;
        }

        setCustomParticipantCount('');
        handleGuidedParticipantSelection(Math.floor(parsed));
    };

    const proceedToGuidedParticipantStep = () => {
        setGuidedFlow((prev) => ({
            ...prev,
            mode: 'booking',
            step: 'participants',
        }));
        addMessage({
            role: 'assistant',
            content: 'Thanks. Now please choose the participant count using the quick replies or custom input.',
        });
    };

    const handleGuidedNoAttachment = () => {
        addMessage({ role: 'user', content: 'No attachment for now.' });
        proceedToGuidedParticipantStep();
    };

    const handleGuidedAttachFileClick = () => {
        guidedFileInputRef.current?.click();
    };

    const handleGuidedFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) {
            return;
        }

        addMessage({
            role: 'user',
            content: `I will attach ${files.length} supporting document(s).`,
        });
        await handleAttachFiles(files);
        event.target.value = '';
        proceedToGuidedParticipantStep();
    };

    const handleGuidedFacilitySelection = (facilityId: number) => {
        const facility = facilities.find((item) => item.id === facilityId);
        if (!facility) {
            return;
        }

        addMessage({ role: 'user', content: `Facility: ID ${facility.id} (${facility.name})` });
        setGuidedFlow((prev) => ({
            ...prev,
            step: 'date',
            facilityId,
            date: null,
        }));
        addMessage({
            role: 'assistant',
            content: 'Great. Choose a date using the quick replies below.',
        });
    };

    const handleGuidedDateSelection = (date: string) => {
        addMessage({ role: 'user', content: `Date: ${date}` });
        setGuidedFlow((prev) => ({
            ...prev,
            step: 'time_start',
            date,
            timeStart: null,
            timeEnd: null,
        }));
        addMessage({
            role: 'assistant',
            content: 'Choose your start time.',
        });
    };

    const handleGuidedStartTimeSelection = (timeStart: string) => {
        addMessage({ role: 'user', content: `Start time: ${timeStart}` });
        setGuidedFlow((prev) => ({
            ...prev,
            step: 'time_end',
            timeStart,
            timeEnd: null,
        }));
        addMessage({
            role: 'assistant',
            content: 'Choose your end time.',
        });
    };

    const handleCustomStartTimeSubmit = () => {
        const normalized = normalizeGuidedTimeInput(customStartTime);
        if (!normalized) {
            addMessage({
                role: 'assistant',
                content: 'Please choose a custom start time first.',
            });
            return;
        }

        setCustomStartTime('');
        handleGuidedStartTimeSelection(normalized);
    };

    const handleGuidedEndTimeSelection = async (timeEnd: string) => {
        const currentFacility = facilities.find((item) => item.id === guidedFlow.facilityId);
        if (!currentFacility || !guidedFlow.date || !guidedFlow.timeStart) {
            return;
        }

        addMessage({ role: 'user', content: `End time: ${timeEnd}` });

        if (guidedFlow.mode === 'availability') {
            const userMessage: Message = {
                role: 'user',
                content: `Check availability for ${currentFacility.name} on ${guidedFlow.date} from ${guidedFlow.timeStart} to ${timeEnd}.`,
            };
            const context = `Guided quick reply collected availability details. Facility: ${currentFacility.name} (ID ${currentFacility.id}). Date: ${guidedFlow.date}. Start time: ${guidedFlow.timeStart}. End time: ${timeEnd}.`;

            resetGuidedFlow();

            if (isLoading) {
                addMessage(userMessage);
                messageQueueRef.current.push({ message: userMessage, context });
                return;
            }

            await processAndSend(userMessage, context);
            return;
        }

        setGuidedFlow((prev) => ({
            ...prev,
            step: 'equipment',
            timeEnd,
        }));
        addMessage({
            role: 'assistant',
            content: 'Schedule saved. Choose your equipment option below, then continue to request details.',
        });
    };

    const handleCustomEndTimeSubmit = async () => {
        const normalized = normalizeGuidedTimeInput(customEndTime);
        if (!normalized) {
            addMessage({
                role: 'assistant',
                content: 'Please choose a custom end time first.',
            });
            return;
        }

        if (!guidedFlow.timeStart || toMinutes(normalized) <= toMinutes(guidedFlow.timeStart)) {
            addMessage({
                role: 'assistant',
                content: 'End time must be later than start time.',
            });
            return;
        }

        setCustomEndTime('');
        await handleGuidedEndTimeSelection(normalized);
    };

    const handleGuidedNoEquipment = () => {
        setShowEquipmentSelection(false);
        setGuidedFlow((prev) => ({
            ...prev,
            equipmentDecision: 'none',
            step: 'equipment',
        }));
        addMessage({ role: 'user', content: 'No equipment needed.' });
        addMessage({
            role: 'assistant',
            content: 'Noted. You can now continue to request details.',
        });
    };

    const handleGuidedContinueBooking = async (equipmentSelectionForGuided?: SelectedEquipmentItem[]) => {
        const facility = facilities.find((item) => item.id === guidedFlow.facilityId);
        if (!facility || !guidedFlow.participantCount || !guidedFlow.date || !guidedFlow.timeStart || !guidedFlow.timeEnd) {
            addMessage({
                role: 'assistant',
                content: 'Guided booking details are incomplete. Please finish the quick-reply steps first.',
            });
            return;
        }

        const serializedEquipmentSelection = (equipmentSelectionForGuided ?? [])
            .filter((item) => item.facility_id === facility.id)
            .map((item) => ({
                equipment_id: item.equipment_id,
                facility_id: item.facility_id,
                quantity_needed: item.quantity_needed,
            }));

        const equipmentInstruction =
            serializedEquipmentSelection.length > 0
                ? `Use this exact guided equipment selection: ${JSON.stringify(serializedEquipmentSelection)}.`
                : guidedFlow.equipmentDecision === 'selected'
                  ? 'Use the exact equipment IDs and quantities already selected in previous user messages.'
                  : guidedFlow.equipmentDecision === 'none'
                    ? 'No equipment is needed for this request.'
                    : 'Ask once if equipment is needed. If not needed, proceed without equipment.';

        const userMessage: Message = {
            role: 'user',
            content:
                `Continue request creation with these locked details: participant_count=${guidedFlow.participantCount}, facility_id=${facility.id} (${facility.name}), date=${guidedFlow.date}, time_start=${guidedFlow.timeStart}, time_end=${guidedFlow.timeEnd}. ` +
                `${equipmentInstruction} Do not change these locked details. Collect only missing fields (title, event type, description, optional files), then prepare the confirmation JSON payload.`,
        };
        const context =
            'Guided flow locked booking details. The assistant must keep the selected participant count, facility ID, date, and time window unchanged while collecting only missing fields.';

        resetGuidedFlow();
        setShowEquipmentSelection(false);

        if (isLoading) {
            addMessage(userMessage);
            messageQueueRef.current.push({ message: userMessage, context });
            return;
        }

        await processAndSend(userMessage, context);
    };

    // Reset equipment selection UI when mode changes
    useEffect(() => {
        setShowEquipmentSelection(false);
        setSelectedEquipment([]);
        if (mode !== 'ai') {
            setGuidedFlow({ ...INITIAL_GUIDED_FLOW });
        }
    }, [mode]);

    useEffect(() => {
        setCustomParticipantCount('');
        setCustomStartTime('');
        setCustomEndTime('');
    }, [guidedFlow.mode, guidedFlow.step]);

    useEffect(() => {
        if (guidedFlow.mode !== 'booking' || guidedFlow.step !== 'equipment' || !guidedFlow.facilityId) {
            return;
        }

        setSelectedEquipment((prev) => prev.filter((item) => item.facility_id === guidedFlow.facilityId));
    }, [guidedFlow.mode, guidedFlow.step, guidedFlow.facilityId]);

    // Fetch facilities and equipment for the booking flow
    useEffect(() => {
        fetch(route('chat.facilities'), {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        })
            .then((res) => res.json())
            .then((json) => {
                if (json.data) setFacilities(json.data);
            })
            .catch(() => {});

        fetch(route('chat.equipment'), {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        })
            .then((res) => res.json())
            .then((json) => {
                if (json.data) {
                    const normalizedEquipment = json.data
                        .map((item: Equipment) => ({
                            ...item,
                            id: Number(item.id),
                            facility_id: Number(item.facility_id),
                            quantity: Number(item.quantity),
                            facility: typeof item.facility === 'string' ? item.facility : null,
                        }))
                        .filter((item: Equipment) => Number.isFinite(item.id) && Number.isFinite(item.facility_id) && item.facility_id > 0);

                    console.log('[Chatbot equipment fetch] Raw equipment payload:', json.data);
                    console.log('[Chatbot equipment fetch] Normalized equipment payload:', normalizedEquipment);

                    setEquipmentOptions(normalizedEquipment);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetch(route('chat.session.get'), {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': getCsrfToken(),
            },
            credentials: 'same-origin',
        })
            .then((res) => res.json())
            .then((json) => {
                if (json.messages && json.messages.length > 0) {
                    setMessages(json.messages);
                    setMode('ai');
                }
            })
            .catch(() => {});
    }, []);

    const processAndSend = async (userMessage: Message, contextNote?: string, skipUserAdd = false) => {
        if (!skipUserAdd) {
            addMessage(userMessage);
        }
        addMessage({ role: 'assistant', content: '' });

        // Check if user is confirming a pending request
        const isConfirming = pendingPayload && /\b(yes|proceed|confirm|ok)\b/i.test(userMessage.content);

        if (isConfirming && pendingPayload) {
            try {
                const payload = buildSubmissionPayload(pendingPayload);
                const validationError = getPayloadValidationError(payload);

                if (validationError) {
                    setPendingPayload(null);
                    addMessage({ role: 'assistant', content: validationError });
                    return;
                }

                const result = await submitRequest(payload);
                setPendingPayload(null);
                setAttachedFiles([]);
                addMessage({ role: 'assistant', content: `✓ Request #${result.request_id} created successfully!` });
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Failed to create request';
                addMessage({ role: 'assistant', content: `✗ Failed to create request: ${errorMsg}` });
            }
            return; // don't send to AI again
        }

        try {
            const extractedCount = extractAndSet(userMessage.content);

            const allMessages: Message[] = [
                ...(contextNote ? [{ role: 'system' as const, content: `QUICK REPLY CONTEXT: ${contextNote}` }] : []),
                ...messages,
                userMessage,
            ];

            const currentCount = extractedCount ?? getCurrentCount(`${getMessagesText()} ${userMessage.content}`) ?? undefined;
            const activeBookingContext = bookingFlow.step !== 'title' && bookingFlow.step !== 'done' ? bookingFlow.buildContextSummary() : undefined;

            let streamingContent = '';

            await sendMessage(
                allMessages,
                currentCount,
                activeBookingContext,
                (token) => {
                    streamingContent += token;
                    setMessages((prev) => {
                        if (prev.length === 0) return prev;
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        updated[updated.length - 1] = {
                            ...last,
                            content: streamingContent,
                        };
                        return updated;
                    });
                },
                (json) => {
                    try {
                        const payload = JSON.parse(json);
                        if (payload && payload.facility_bookings && Array.isArray(payload.facility_bookings)) {
                            setPendingPayload(withAttachedFiles(normalizePayloadForSubmission(payload)));
                        }
                    } catch (_) {}
                },
            );

            if (messageQueueRef.current.length > 0) {
                const next = messageQueueRef.current.shift();
                if (next) {
                    await processAndSend(next.message, next.context, true);
                }
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
            setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: 'assistant',
                    content: `Error: ${errorMsg}`,
                };
                return updated;
            });
        }
    };

    const buildRequestSummary = (payload: CreateRequestPayload): string => {
        const bookings = payload.facility_bookings
            .map((b, i) => {
                const facility = facilities.find((f) => f.id === b.facility_id);
                const equipmentList =
                    b.equipment
                        ?.map((e) => {
                            const eq = equipmentOptions.find((opt) => opt.id === e.equipment_id);
                            return `${eq?.name || 'Unknown'} x${e.quantity_needed}`;
                        })
                        .join(', ') || 'None';
                const facilityName = facility?.name || 'Unknown';
                const facilityInfo = `${i + 1}. ${facilityName} on ${b.date} (${b.time_start} - ${b.time_end})`;
                return `${facilityInfo} | Equipment: ${equipmentList}`;
            })
            .join('\n');

        const titleLine = `Title: ${payload.title}`;
        const descriptionLine = `Description: ${payload.description || 'N/A'}`;
        const priorityLine = `Priority: ${payload.priority_level ?? 0}`;
        return `${titleLine}\n${descriptionLine}\n${priorityLine}\n\nFacilities:\n${bookings}`;
    };

    const handleConfirmRequest = async () => {
        if (!pendingPayload) return;

        try {
            const payload = buildSubmissionPayload(pendingPayload);
            const validationError = getPayloadValidationError(payload);

            if (validationError) {
                setPendingPayload(null);
                addMessage({ role: 'assistant', content: validationError });
                return;
            }

            const result = await submitRequest(payload);
            setPendingPayload(null);
            setAttachedFiles([]);
            addMessage({ role: 'assistant', content: `✓ Request #${result.request_id} created successfully!` });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to create request';
            addMessage({ role: 'assistant', content: `✗ Failed to create request: ${errorMsg}` });
        }
    };

    const handleCancelRequest = () => {
        setPendingPayload(null);
        addMessage({ role: 'assistant', content: 'Request cancelled. How else can I help you?' });
    };

    const getCurrentFacilityId = (): number | null => {
        if (guidedFlow.facilityId) {
            return guidedFlow.facilityId;
        }
        if (bookingFlow.data.facility_id) {
            return bookingFlow.data.facility_id;
        }
        if (pendingPayload && pendingPayload.facility_bookings.length > 0) {
            return pendingPayload.facility_bookings[0].facility_id;
        }
        return null;
    };

    const getFilteredEquipment = () => {
        const facilityId = getCurrentFacilityId();
        if (!facilityId) return equipmentOptions;
        return equipmentOptions.filter((eq) => eq.facility_id === facilityId);
    };

    const getLatestAssistantMessage = (): { message: Message; index: number } | null => {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (messages[i].role === 'assistant') {
                return { message: messages[i], index: i };
            }
        }

        return null;
    };

    const getLatestUserMessageBeforeIndex = (endIndex: number): { message: Message; index: number } | null => {
        for (let i = endIndex - 1; i >= 0; i -= 1) {
            if (messages[i].role === 'user') {
                return { message: messages[i], index: i };
            }
        }

        return null;
    };

    const isEquipmentAvailabilityIntent = (text: string): boolean => {
        return [
            /\bavailable equipment\b/,
            /\bequipment available\b/,
            /\bwhat equipment(?:s)? (?:are )?available\b/,
            /\bwhich equipment(?:s)? (?:are )?available\b/,
            /\bshow\b.*\bequipment\b/,
            /\blist\b.*\bequipment\b/,
            /\bselect equipment\b/,
            /\bchoose equipment\b/,
            /\bdo you need\b.*\bequipment\b/,
            /\bwould you like\b.*\bequipment\b/,
            /\bneed any of (?:these )?equipment\b/,
            /\bneed any of these\b.*\bequipment\b/,
            /\bplease let me know if you need\b.*\bequipment\b/,
            /\bi(?:'|’)ll add (?:them|it) to the facility request\b/,
            /\bany additional equipment\b/,
            /\bavailable for use\b/,
        ].some((pattern) => pattern.test(text));
    };

    const shouldShowEquipmentPicker = (): boolean => {
        const latest = getLatestAssistantMessage();
        if (!latest) return false;

        if (latest.index <= lastEquipmentQuestionIndex) return false;

        const latestAssistantText = latest.message.content.toLowerCase();
        const latestUser = getLatestUserMessageBeforeIndex(latest.index);
        const latestUserText = latestUser?.message.content.toLowerCase() ?? '';

        const assistantAskedAboutEquipment = isEquipmentAvailabilityIntent(latestAssistantText);
        const userAskedAboutEquipmentAvailability = isEquipmentAvailabilityIntent(latestUserText);

        return getFilteredEquipment().length > 0 && (assistantAskedAboutEquipment || userAskedAboutEquipmentAvailability);
    };

    useEffect(() => {
        if (mode !== 'ai' || showEquipmentSelection) {
            return;
        }

        if (shouldShowEquipmentPicker()) {
            setShowEquipmentSelection(true);
        }
    }, [mode, showEquipmentSelection, messages, equipmentOptions, bookingFlow.data.facility_id, guidedFlow.facilityId, pendingPayload]);

    useEffect(() => {
        if (pendingPayload || messages.length === 0) {
            return;
        }

        const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
        if (!latestAssistant || !latestAssistant.content) {
            return;
        }

        const extracted = extractPayloadFromText(latestAssistant.content);
        if (!extracted) {
            return;
        }

        setPendingPayload(withAttachedFiles(normalizePayloadForSubmission(extracted)));
    }, [messages, pendingPayload, attachedFiles]);

    const handleEquipmentToggle = (equipment: Equipment) => {
        setSelectedEquipment((prev) => {
            const exists = prev.find((item) => item.equipment_id === equipment.id && item.facility_id === equipment.facility_id);
            if (exists) {
                return prev.filter((item) => !(item.equipment_id === equipment.id && item.facility_id === equipment.facility_id));
            } else {
                return [
                    ...prev,
                    {
                        equipment_id: equipment.id,
                        equipment_name: equipment.name,
                        facility_id: equipment.facility_id,
                        facility_name: equipment.facility ?? null,
                        quantity_needed: 1,
                    },
                ];
            }
        });
    };

    const updateEquipmentQuantity = (equipmentId: number, facilityId: number, quantity: number) => {
        setSelectedEquipment((prev) =>
            prev.map((item) =>
                item.equipment_id === equipmentId && item.facility_id === facilityId ? { ...item, quantity_needed: quantity } : item,
            ),
        );
    };

    const buildEquipmentSelectionMessage = (selection: SelectedEquipmentItem[]): string => {
        if (selection.length === 0) {
            return "I don't need any additional equipment.";
        }
        const items = selection
            .map((e) => `${e.equipment_name} (ID: ${e.equipment_id}, Facility ID: ${e.facility_id}, quantity: ${e.quantity_needed})`)
            .join(', ');
        return `I need the following equipment: ${items}`;
    };

    const handleAttachFiles = async (fileList: FileList) => {
        if (!fileList || fileList.length === 0) {
            setUploadError('No files selected');
            return;
        }

        setUploading(true);
        setUploadError(null);

        const formData = new FormData();
        Array.from(fileList).forEach((file) => formData.append('files[]', file));

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(route('chat.upload'), {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: formData,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Upload error response:', response.status, errorText);
                setUploadError(`Upload failed: ${response.status} ${response.statusText}`);
                setUploading(false);
                return;
            }

            const data = await response.json();
            console.log('Upload response:', data);

            if (data.success && data.files) {
                setAttachedFiles((prev) => [...prev, ...data.files]);
            } else {
                setUploadError(data.error || data.message || 'Upload failed');
            }
            setUploading(false);
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                setUploadError('Upload timeout - request took too long');
            } else {
                setUploadError(err instanceof Error ? err.message : 'Network error during upload');
            }
            console.error('Upload error:', err);
            setUploading(false);
        }
    };

    const submitEquipmentSelection = async (selection: SelectedEquipmentItem[] = selectedEquipment) => {
        const guidedFacilityId = guidedFlow.mode === 'booking' && guidedFlow.step === 'equipment' ? guidedFlow.facilityId : null;
        const normalizedSelection =
            guidedFacilityId && guidedFacilityId > 0 ? selection.filter((equipment) => equipment.facility_id === guidedFacilityId) : selection;

        const message = buildEquipmentSelectionMessage(normalizedSelection);
        const serializedSelection = normalizedSelection.map((equipment) => ({
            equipment_id: equipment.equipment_id,
            facility_id: equipment.facility_id,
            quantity_needed: equipment.quantity_needed,
        }));
        const equipmentMsg =
            'The user selected equipment using the checkbox list. ' +
            `Use these exact selections when generating or updating the booking JSON payload: ${JSON.stringify(serializedSelection)}. ` +
            'Do not replace the equipment IDs with names or any other format.';
        const noEquipmentMsg = 'The user selected no additional equipment. ' + 'Do not ask for equipment again unless it is required later.';
        const context = selection.length > 0 ? equipmentMsg : noEquipmentMsg;

        // NEW: Mark this equipment question as answered by storing the message index
        const latest = getLatestAssistantMessage();
        if (latest) {
            setLastEquipmentQuestionIndex(latest.index);
        }

        if (guidedFlow.mode === 'booking' && guidedFlow.step === 'equipment') {
            setGuidedFlow((prev) => ({
                ...prev,
                equipmentDecision: normalizedSelection.length > 0 ? 'selected' : 'none',
            }));
            setSelectedEquipment([]);
            setShowEquipmentSelection(false);
            addMessage({ role: 'user', content: message });
            await handleGuidedContinueBooking(normalizedSelection);
            return;
        }

        setSelectedEquipment([]);
        setShowEquipmentSelection(false); // Reset the selection UI
        await processAndSend({ role: 'user', content: message }, context);
    };

    const submitNoEquipmentSelection = async () => {
        await submitEquipmentSelection([]);
    };

    const handleQuickReply = (option: QuickReply) => {
        if (option.id === 'guided_booking') {
            startGuidedFlow('booking');
            return;
        }

        if (option.id === 'guided_availability') {
            startGuidedFlow('availability');
            return;
        }

        if (option.id === 'book_facility') {
            // Enter structured booking flow — no AI needed
            setMode('booking');
            return;
        }

        if (option.action === 'availability') {
            setMode('availability');
            return;
        }

        if (option.action === 'navigate' && option.href) {
            window.location.href = option.href;
            return;
        }

        const userMessage: Message = { role: 'user', content: option.message };

        if (isLoading) {
            addMessage(userMessage);
            messageQueueRef.current.push({ message: userMessage, context: option.context });
            return;
        }

        // All other quick replies go to AI mode
        setMode('ai');
        processAndSend(userMessage, option.context);
    };

    const handleSendMessage = async () => {
        const message = input.trim();
        if (!message) return;
        setInput('');
        if (mode === 'idle' || mode === 'booking' || mode === 'availability') setMode('ai');

        if (guidedFlow.mode !== 'none') {
            const userMessage: Message = { role: 'user', content: message };
            addMessage(userMessage);

            if (/\b(cancel|exit|stop)\b.*\b(guided|flow)\b/i.test(message)) {
                resetGuidedFlow();
                setShowEquipmentSelection(false);
                addMessage({
                    role: 'assistant',
                    content: 'Guided flow cancelled. You can now type freely or start another guided flow.',
                });
                return;
            }

            addMessage({
                role: 'assistant',
                content: 'Guided flow is active. Please use the quick reply buttons below, or type "cancel guided flow" to return to free chat.',
            });
            return;
        }

        const userMessage: Message = { role: 'user', content: message };
        if (isLoading) {
            addMessage(userMessage);
            messageQueueRef.current.push({ message: userMessage });
            return;
        }

        await processAndSend(userMessage);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleBookingComplete = (resultMessage: string) => {
        setMode('ai');
        addMessage({ role: 'assistant', content: resultMessage });
    };

    const handleAvailabilityComplete = async (selection: { facility: Facility; date: string; startTime: string; endTime: string }) => {
        const userMessage: Message = {
            role: 'user',
            content: `Check availability for ${selection.facility.name} on ${selection.date} from ${selection.startTime} to ${selection.endTime}.`,
        };
        const context = `Quick reply collected availability details. Facility: ${selection.facility.name} (ID ${selection.facility.id}). Date: ${selection.date}. Start time: ${selection.startTime}. End time: ${selection.endTime}.`;

        setMode('ai');

        if (isLoading) {
            addMessage(userMessage);
            messageQueueRef.current.push({ message: userMessage, context });
            return;
        }

        await processAndSend(userMessage, context);
    };

    const shouldRenderEquipmentPicker = showEquipmentSelection || shouldShowEquipmentPicker();
    const currentFacilityId = getCurrentFacilityId();

    const buildGuidedQuickReplies = (): GuidedQuickReplyOption[] => {
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        const plusThreeDays = new Date();
        plusThreeDays.setDate(today.getDate() + 3);
        const plusSevenDays = new Date();
        plusSevenDays.setDate(today.getDate() + 7);

        if (pendingPayload) {
            return [
                {
                    id: 'guided-confirm-submit',
                    label: 'Confirm and Submit',
                    onSelect: handleConfirmRequest,
                    variant: 'default',
                },
                {
                    id: 'guided-cancel-submit',
                    label: 'Cancel Request',
                    onSelect: handleCancelRequest,
                    variant: 'outline',
                },
            ];
        }

        if (guidedFlow.mode === 'none') {
            return [
                {
                    id: 'guided-start-booking',
                    label: 'Guided Booking',
                    onSelect: () => startGuidedFlow('booking'),
                    variant: 'default',
                },
                {
                    id: 'guided-start-availability',
                    label: 'Guided Availability',
                    onSelect: () => startGuidedFlow('availability'),
                    variant: 'outline',
                },
                {
                    id: 'guided-open-booking-wizard',
                    label: 'Open Booking Wizard',
                    onSelect: () => setMode('booking'),
                    variant: 'outline',
                },
                {
                    id: 'guided-open-availability-wizard',
                    label: 'Open Availability Wizard',
                    onSelect: () => setMode('availability'),
                    variant: 'outline',
                },
            ];
        }

        if (guidedFlow.mode === 'booking') {
            if (guidedFlow.step === 'attachments') {
                return [
                    {
                        id: 'guided-attach-file',
                        label: 'Attach a File',
                        onSelect: handleGuidedAttachFileClick,
                        variant: 'default',
                    },
                    {
                        id: 'guided-no-attachment',
                        label: 'No Attachment',
                        onSelect: handleGuidedNoAttachment,
                        variant: 'outline',
                    },
                    { id: 'guided-back', label: 'Back', onSelect: handleGuidedBack, variant: 'outline' },
                ];
            }

            if (guidedFlow.step === 'participants') {
                return [
                    { id: 'guided-p-25', label: '25 Participants', onSelect: () => handleGuidedParticipantSelection(25) },
                    { id: 'guided-p-50', label: '50 Participants', onSelect: () => handleGuidedParticipantSelection(50) },
                    { id: 'guided-p-100', label: '100 Participants', onSelect: () => handleGuidedParticipantSelection(100) },
                    { id: 'guided-p-200', label: '200 Participants', onSelect: () => handleGuidedParticipantSelection(200) },
                    { id: 'guided-cancel', label: 'Cancel Guided Flow', onSelect: handleGuidedCancel, variant: 'outline' },
                ];
            }

            if (guidedFlow.step === 'facility') {
                const participantCount = guidedFlow.participantCount ?? 0;
                const matchedFacilities = participantCount > 0 ? getGuidedBookingFacilities(participantCount) : facilities;

                const facilityReplies = matchedFacilities.slice(0, 12).map((facility) => {
                    const isRecommended = participantCount > 0 && isFacilityRecommendedForParticipants(facility, participantCount);

                    return {
                        id: `guided-booking-facility-${facility.id}`,
                        label: `${isRecommended ? 'Recommended - ' : ''}ID ${facility.id} ${facility.name}${typeof facility.capacity === 'number' ? ` (Capacity: ${facility.capacity})` : ''}`,
                        onSelect: () => handleGuidedFacilitySelection(facility.id),
                        variant: 'outline' as const,
                    };
                });

                return [
                    ...facilityReplies,
                    { id: 'guided-back', label: 'Back', onSelect: handleGuidedBack, variant: 'outline' },
                    { id: 'guided-cancel', label: 'Cancel Guided Flow', onSelect: handleGuidedCancel, variant: 'outline' },
                ];
            }

            if (guidedFlow.step === 'date') {
                return [
                    {
                        id: 'guided-date-today',
                        label: `Today (${formatDateYmd(today)})`,
                        onSelect: () => handleGuidedDateSelection(formatDateYmd(today)),
                    },
                    {
                        id: 'guided-date-tomorrow',
                        label: `Tomorrow (${formatDateYmd(tomorrow)})`,
                        onSelect: () => handleGuidedDateSelection(formatDateYmd(tomorrow)),
                    },
                    {
                        id: 'guided-date-plus3',
                        label: `In 3 Days (${formatDateYmd(plusThreeDays)})`,
                        onSelect: () => handleGuidedDateSelection(formatDateYmd(plusThreeDays)),
                    },
                    {
                        id: 'guided-date-plus7',
                        label: `In 7 Days (${formatDateYmd(plusSevenDays)})`,
                        onSelect: () => handleGuidedDateSelection(formatDateYmd(plusSevenDays)),
                    },
                    { id: 'guided-back', label: 'Back', onSelect: handleGuidedBack, variant: 'outline' },
                    { id: 'guided-cancel', label: 'Cancel Guided Flow', onSelect: handleGuidedCancel, variant: 'outline' },
                ];
            }

            if (guidedFlow.step === 'time_start') {
                return [
                    ...GUIDED_TIME_OPTIONS.filter((option) => option !== GUIDED_TIME_OPTIONS[GUIDED_TIME_OPTIONS.length - 1]).map((time) => ({
                        id: `guided-start-${time}`,
                        label: time,
                        onSelect: () => handleGuidedStartTimeSelection(time),
                        variant: 'outline' as const,
                    })),
                    { id: 'guided-back', label: 'Back', onSelect: handleGuidedBack, variant: 'outline' },
                    { id: 'guided-cancel', label: 'Cancel Guided Flow', onSelect: handleGuidedCancel, variant: 'outline' },
                ];
            }

            if (guidedFlow.step === 'time_end' && guidedFlow.timeStart) {
                return [
                    ...getGuidedEndTimeOptions(guidedFlow.timeStart).map((time) => ({
                        id: `guided-end-${time}`,
                        label: time,
                        onSelect: () => handleGuidedEndTimeSelection(time),
                        variant: 'outline' as const,
                    })),
                    { id: 'guided-back', label: 'Back', onSelect: handleGuidedBack, variant: 'outline' },
                    { id: 'guided-cancel', label: 'Cancel Guided Flow', onSelect: handleGuidedCancel, variant: 'outline' },
                ];
            }

            if (guidedFlow.step === 'equipment') {
                return [
                    {
                        id: 'guided-equipment-select',
                        label: 'Select Equipment',
                        onSelect: () => setShowEquipmentSelection(true),
                        disabled: getFilteredEquipment().length === 0,
                    },
                    { id: 'guided-equipment-none', label: 'No Equipment Needed', onSelect: handleGuidedNoEquipment, variant: 'outline' },
                    {
                        id: 'guided-equipment-continue',
                        label: 'Continue to Request Details',
                        onSelect: handleGuidedContinueBooking,
                        variant: 'default',
                    },
                    { id: 'guided-back', label: 'Back', onSelect: handleGuidedBack, variant: 'outline' },
                    { id: 'guided-cancel', label: 'Cancel Guided Flow', onSelect: handleGuidedCancel, variant: 'outline' },
                ];
            }
        }

        if (guidedFlow.mode === 'availability') {
            if (guidedFlow.step === 'facility') {
                const facilityReplies = facilities.slice(0, 12).map((facility) => ({
                    id: `guided-availability-facility-${facility.id}`,
                    label: `ID ${facility.id} ${facility.name}`,
                    onSelect: () => handleGuidedFacilitySelection(facility.id),
                    variant: 'outline' as const,
                }));

                return [...facilityReplies, { id: 'guided-cancel', label: 'Cancel Guided Flow', onSelect: handleGuidedCancel, variant: 'outline' }];
            }

            if (guidedFlow.step === 'date') {
                return [
                    {
                        id: 'guided-av-date-today',
                        label: `Today (${formatDateYmd(today)})`,
                        onSelect: () => handleGuidedDateSelection(formatDateYmd(today)),
                    },
                    {
                        id: 'guided-av-date-tomorrow',
                        label: `Tomorrow (${formatDateYmd(tomorrow)})`,
                        onSelect: () => handleGuidedDateSelection(formatDateYmd(tomorrow)),
                    },
                    {
                        id: 'guided-av-date-plus3',
                        label: `In 3 Days (${formatDateYmd(plusThreeDays)})`,
                        onSelect: () => handleGuidedDateSelection(formatDateYmd(plusThreeDays)),
                    },
                    {
                        id: 'guided-av-date-plus7',
                        label: `In 7 Days (${formatDateYmd(plusSevenDays)})`,
                        onSelect: () => handleGuidedDateSelection(formatDateYmd(plusSevenDays)),
                    },
                    { id: 'guided-back', label: 'Back', onSelect: handleGuidedBack, variant: 'outline' },
                    { id: 'guided-cancel', label: 'Cancel Guided Flow', onSelect: handleGuidedCancel, variant: 'outline' },
                ];
            }

            if (guidedFlow.step === 'time_start') {
                return [
                    ...GUIDED_TIME_OPTIONS.filter((option) => option !== GUIDED_TIME_OPTIONS[GUIDED_TIME_OPTIONS.length - 1]).map((time) => ({
                        id: `guided-av-start-${time}`,
                        label: time,
                        onSelect: () => handleGuidedStartTimeSelection(time),
                        variant: 'outline' as const,
                    })),
                    { id: 'guided-back', label: 'Back', onSelect: handleGuidedBack, variant: 'outline' },
                    { id: 'guided-cancel', label: 'Cancel Guided Flow', onSelect: handleGuidedCancel, variant: 'outline' },
                ];
            }

            if (guidedFlow.step === 'time_end' && guidedFlow.timeStart) {
                return [
                    ...getGuidedEndTimeOptions(guidedFlow.timeStart).map((time) => ({
                        id: `guided-av-end-${time}`,
                        label: time,
                        onSelect: () => handleGuidedEndTimeSelection(time),
                        variant: 'outline' as const,
                    })),
                    { id: 'guided-back', label: 'Back', onSelect: handleGuidedBack, variant: 'outline' },
                    { id: 'guided-cancel', label: 'Cancel Guided Flow', onSelect: handleGuidedCancel, variant: 'outline' },
                ];
            }
        }

        return [];
    };

    const guidedQuickReplies = mode === 'booking' || mode === 'availability' ? [] : buildGuidedQuickReplies();
    const guidedQuickReplyHint = pendingPayload
        ? 'Review action'
        : guidedFlow.mode === 'booking'
          ? `Guided booking step: ${guidedFlow.step ?? 'none'}`
          : guidedFlow.mode === 'availability'
            ? `Guided availability step: ${guidedFlow.step ?? 'none'}`
            : 'Quick actions';

    return (
        <div className="flex h-full w-full flex-col bg-background">
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {/* Idle — show welcome + quick reply buttons */}
                {mode === 'idle' && <WelcomeMessage onQuickReply={handleQuickReply} />}

                {/* Booking flow — fully structured, no AI */}
                {mode === 'booking' && (
                    <BookingFlow
                        bookingFlow={bookingFlow}
                        onComplete={handleBookingComplete}
                        onCancel={() => setMode('idle')}
                        attachedFiles={attachedFiles}
                        onAttachFile={handleAttachFiles}
                        uploading={uploading}
                        uploadError={uploadError}
                    />
                )}

                {mode === 'availability' && (
                    <AvailabilityQuickFlow facilities={facilities} onComplete={handleAvailabilityComplete} onCancel={() => setMode('idle')} />
                )}

                {/* AI chat mode */}
                {mode === 'ai' && (
                    <>
                        <div className="mb-3 flex justify-end">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowEquipmentSelection(true)}
                                disabled={isLoading || getFilteredEquipment().length === 0}
                            >
                                Select Equipment
                            </Button>
                        </div>

                        <MessageList
                            messages={messages}
                            messagesEndRef={messagesEndRef}
                            showConfirmationButtons={!!pendingPayload}
                            onConfirm={handleConfirmRequest}
                            onCancel={handleCancelRequest}
                        />

                        {shouldRenderEquipmentPicker && (
                            <div className="mb-4 rounded-lg border border-border bg-background p-4">
                                {!showEquipmentSelection ? (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold">Equipment Selection</p>
                                            <p className="text-xs text-muted-foreground">
                                                Click the button to select equipment from the available list.
                                            </p>
                                        </div>
                                        <Button size="sm" onClick={() => setShowEquipmentSelection(true)} disabled={isLoading}>
                                            Select Equipment
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-sm font-semibold">Equipment selection</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Tick the items you need, adjust quantities, then submit your selection.
                                                </p>
                                                {!currentFacilityId && (
                                                    <p className="mt-1 text-xs text-muted-foreground">Showing equipment across all facilities.</p>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setShowEquipmentSelection(false)}
                                                    disabled={isLoading}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={submitNoEquipmentSelection} disabled={isLoading}>
                                                    No Equipment Needed
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => submitEquipmentSelection()}
                                                    disabled={isLoading || selectedEquipment.length === 0}
                                                >
                                                    Send equipment
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="max-h-64 space-y-3 overflow-y-auto">
                                            {getFilteredEquipment().length === 0 && (
                                                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                                                    No equipment options are available right now.
                                                </div>
                                            )}
                                            {getFilteredEquipment().map((equipment) => {
                                                const selected = selectedEquipment.find(
                                                    (item) => item.equipment_id === equipment.id && item.facility_id === equipment.facility_id,
                                                );
                                                return (
                                                    <div
                                                        key={`${equipment.id}-${equipment.facility_id}`}
                                                        className="rounded-lg border border-border p-3"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <Checkbox
                                                                id={`equipment-${equipment.id}-${equipment.facility_id}`}
                                                                checked={!!selected}
                                                                onCheckedChange={() => handleEquipmentToggle(equipment)}
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <Label
                                                                    htmlFor={`equipment-${equipment.id}-${equipment.facility_id}`}
                                                                    className="cursor-pointer text-sm font-medium"
                                                                >
                                                                    {equipment.name}
                                                                </Label>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Facility: {equipment.facility ?? `Facility #${equipment.facility_id}`} |
                                                                    Available: {equipment.quantity}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {selected && (
                                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                                                <Label className="text-sm">Quantity</Label>
                                                                <Input
                                                                    type="number"
                                                                    min={1}
                                                                    max={equipment.quantity}
                                                                    value={selected.quantity_needed}
                                                                    onChange={(e) => {
                                                                        const value = Number(e.target.value);
                                                                        const bounded = Math.min(Math.max(1, value), equipment.quantity);
                                                                        updateEquipmentQuantity(equipment.id, equipment.facility_id, bounded);
                                                                    }}
                                                                    className="w-24"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {isLoading && <LoadingIndicator />}
                    </>
                )}

                <div ref={messagesEndRef} />
            </div>

            {guidedQuickReplies.length > 0 && (
                <div className="border-t border-border bg-background px-6 py-3">
                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{guidedQuickReplyHint}</p>
                    <input
                        ref={guidedFileInputRef}
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        onChange={handleGuidedFileSelection}
                        style={{ display: 'none' }}
                    />

                    {guidedFlow.mode !== 'none' && guidedFlow.step === 'participants' && (
                        <div className="mb-3 flex flex-wrap items-end gap-2">
                            <div>
                                <Label className="mb-1 block text-xs text-muted-foreground">Custom participant count</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={customParticipantCount}
                                    onChange={(e) => setCustomParticipantCount(e.target.value)}
                                    className="w-44"
                                />
                            </div>
                            <Button size="sm" variant="outline" onClick={handleCustomParticipantSubmit} disabled={isLoading}>
                                Set Custom Count
                            </Button>
                        </div>
                    )}

                    {guidedFlow.mode !== 'none' && guidedFlow.step === 'date' && (
                        <div className="mb-3 rounded-md border border-border p-3">
                            <p className="mb-2 text-xs text-muted-foreground">Custom date (calendar)</p>
                            <DatePicker onSelect={handleGuidedDateSelection} />
                        </div>
                    )}

                    {guidedFlow.mode !== 'none' && guidedFlow.step === 'time_start' && (
                        <div className="mb-3 flex flex-wrap items-end gap-2">
                            <div>
                                <Label className="mb-1 block text-xs text-muted-foreground">Custom start time</Label>
                                <Input type="time" value={customStartTime} onChange={(e) => setCustomStartTime(e.target.value)} className="w-44" />
                            </div>
                            <Button size="sm" variant="outline" onClick={handleCustomStartTimeSubmit} disabled={isLoading}>
                                Set Custom Start
                            </Button>
                        </div>
                    )}

                    {guidedFlow.mode !== 'none' && guidedFlow.step === 'time_end' && (
                        <div className="mb-3 flex flex-wrap items-end gap-2">
                            <div>
                                <Label className="mb-1 block text-xs text-muted-foreground">Custom end time</Label>
                                <Input type="time" value={customEndTime} onChange={(e) => setCustomEndTime(e.target.value)} className="w-44" />
                            </div>
                            <Button size="sm" variant="outline" onClick={() => void handleCustomEndTimeSubmit()} disabled={isLoading}>
                                Set Custom End
                            </Button>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {guidedQuickReplies.map((option) => (
                            <Button
                                key={option.id}
                                size="sm"
                                variant={option.variant ?? 'outline'}
                                onClick={() => {
                                    void option.onSelect();
                                }}
                                disabled={isLoading || option.disabled}
                                className="max-w-full text-left whitespace-normal"
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input area — hidden during booking flow */}
            <ChatInput
                value={input}
                onChange={setInput}
                onKeyPress={handleKeyPress}
                onSend={handleSendMessage}
                disabled={uploading || isLoading}
                attachedFiles={attachedFiles}
                onAttachFile={handleAttachFiles}
                uploading={uploading}
                uploadError={uploadError}
                onRemoveFile={(fileId) => {
                    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
                }}
            />
        </div>
    );
}
