import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Equipment } from '@/types/equipment';
import AvailabilityQuickFlow from './components/AvailabilityQuickFlow';
import BookingFlow from './components/BookingFlow';
import ChatInput from './components/ChatInput';
import DatePicker from './components/DatePicker';
import LoadingIndicator from './components/LoadingIndicator';
import MessageList from './components/MessageList';
import WelcomeMessage from './components/WelcomeMessage';
import { useBookingFlow } from './hooks/useBookingFlow';
import type { Facility} from './hooks/useBookingFlow';
import { useChatAPI } from './hooks/useChatAPI';
import { useMessages } from './hooks/useMessages';
import { useParticipantCount } from './hooks/useParticipantCount';
import type { Message, CreateRequestPayload, AttachedFileInfo } from './types';
import { getCsrfToken } from './utils/csrfToken';

type ChatMode = 'idle' | 'booking' | 'availability' | 'ai';
type GuidedFlowMode = 'none' | 'booking' | 'availability' | 'faq';
type GuidedFlowStep = 'attachments' | 'participants' | 'facility' | 'date' | 'time_start' | 'time_end' | 'equipment' | 'event_type';
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
type EquipmentSourceMode = 'own' | 'borrow';

type GuidedFlowState = {
    mode: GuidedFlowMode;
    step: GuidedFlowStep | null;
    participantCount: number | null;
    facilityId: number | null;
    date: string | null;
    timeStart: string | null;
    timeEnd: string | null;
    equipmentDecision: GuidedEquipmentDecision;
    eventType: 0 | 1 | 2 | 3 | null;
};

type GuidedQuickReplyOption = {
    id: string;
    label: string;
    onSelect: () => void | Promise<void>;
    variant?: 'default' | 'outline';
    disabled?: boolean;
};

type AvailabilityFollowUpState = {
    status: 'available' | 'unavailable';
    facility: Facility;
    date: string;
    startTime: string;
    endTime: string;
    source: 'guided' | 'wizard';
};

type GuidedIntentRoute = 'booking' | 'availability' | 'equipment' | null;

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
    eventType: null,
};

const EVENT_TYPE_OPTIONS = [
    { id: 0 as const, label: 'Academic', priority: 0 as const },
    { id: 1 as const, label: 'Organizational', priority: 1 as const },
    { id: 2 as const, label: 'University', priority: 1 as const },
    { id: 3 as const, label: 'Government', priority: 2 as const },
];

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

    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(candidate)) {
        const [hours, minutes] = candidate.split(':').slice(0, 2).map(Number);
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

const toHHMM = (time: string): string | null => {
    const minutes = toMinutes(time);
    if (Number.isNaN(minutes) || minutes < 0) {
        return null;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 23 || mins > 59) {
        return null;
    }

    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getEquipmentRemainingQuantity = (equipment: Equipment): number => {
    if (typeof equipment.remaining_quantity === 'number' && Number.isFinite(equipment.remaining_quantity)) {
        return Math.max(0, Math.floor(equipment.remaining_quantity));
    }

    if (typeof equipment.quantity === 'number' && Number.isFinite(equipment.quantity)) {
        return Math.max(0, Math.floor(equipment.quantity));
    }

    return 0;
};

const formatDateYmd = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getAvailabilityStatus = (content: string): 'available' | 'unavailable' | null => {
    if (/\bis not available on\b/i.test(content) || /\bNOT available on\b/.test(content)) {
        return 'unavailable';
    }

    if (/\bis available on\b/i.test(content) || /\bis available\b/i.test(content)) {
        return 'available';
    }

    return null;
};

const parseAvailabilityUserMessage = (
    content: string,
): { facilityName: string; date: string; startTime: string; endTime: string } | null => {
    const match = content.match(/check availability for (.+) on (\d{4}-\d{2}-\d{2}) from (.+) to (.+)\.?$/i);
    if (!match) {
        return null;
    }

    const [, facilityName, date, startTime, endTime] = match;
    return {
        facilityName: facilityName.trim(),
        date: date.trim(),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
    };
};

export default function Chatbot() {
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [input, setInput] = React.useState('');
    const [mode, setMode] = useState<ChatMode>('idle');
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [equipmentOptions, setEquipmentOptions] = useState<Array<Equipment>>([]);
    const [baseEquipmentOptions, setBaseEquipmentOptions] = useState<Array<Equipment>>([]);
    const [selectedEquipment, setSelectedEquipment] = useState<SelectedEquipmentItem[]>([]);
    const [equipmentSelectionNotice, setEquipmentSelectionNotice] = useState<string | null>(null);
    const [isSlotScopedEquipmentList, setIsSlotScopedEquipmentList] = useState(false);
    const [equipmentSourceMode, setEquipmentSourceMode] = useState<EquipmentSourceMode>('own');
    // NEW: Track the message index of the last equipment question we responded to
    const [lastEquipmentQuestionIndex, setLastEquipmentQuestionIndex] = useState<number>(-1);
    // NEW: Track whether to show equipment selection UI
    const [showEquipmentSelection, setShowEquipmentSelection] = useState<boolean>(false);

    const { messages, addMessage, addMessages, setMessages, getMessagesText } = useMessages();
    const { participantCount: trackedParticipantCount, setParticipantCount, extractAndSet, getCurrentCount } = useParticipantCount();
    const bookingFlow = useBookingFlow(facilities, baseEquipmentOptions);
    const { isLoading, sendMessage, submitRequest } = useChatAPI();
    const [pendingPayload, setPendingPayload] = useState<CreateRequestPayload | null>(null);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFileInfo[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const messageQueueRef = useRef<Array<{ message: Message; context?: string }>>([]);
    const [guidedFlow, setGuidedFlow] = useState<GuidedFlowState>({ ...INITIAL_GUIDED_FLOW });
    const [availabilityFollowUp, setAvailabilityFollowUp] = useState<AvailabilityFollowUpState | null>(null);
    const [guidedEquipmentSnapshot, setGuidedEquipmentSnapshot] = useState<SelectedEquipmentItem[]>([]);
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
        setGuidedEquipmentSnapshot([]);
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
        setEquipmentSourceMode('own');
        setEquipmentSelectionNotice(null);
        setGuidedEquipmentSnapshot([]);
        setAvailabilityFollowUp(null);
        setGuidedFlow({
            ...INITIAL_GUIDED_FLOW,
            mode: flowMode,
            step: flowMode === 'booking' ? 'attachments' : flowMode === 'availability' ? 'facility' : null,
        });

        addMessage({
            role: 'assistant',
            content:
                flowMode === 'booking'
                    ? 'Guided booking is active. Before we continue, do you have any approval paper or related supporting document to attach?'
                    : flowMode === 'availability'
                      ? 'Guided availability check is active. Please choose a facility using the quick replies below.'
                      : 'FAQ mode is active. Ask your question in chat, and I will answer from the FAQ knowledge first.',
        });
    };

    const handleGuidedCancel = () => {
        resetGuidedFlow();
        setShowEquipmentSelection(false);
        setAvailabilityFollowUp(null);
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

            const hasLockedSchedule =
                !!prev.facilityId &&
                typeof prev.date === 'string' &&
                prev.date.length > 0 &&
                typeof prev.timeStart === 'string' &&
                prev.timeStart.length > 0 &&
                typeof prev.timeEnd === 'string' &&
                prev.timeEnd.length > 0;

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
                        return hasLockedSchedule
                            ? { ...prev, step: 'participants', equipmentDecision: 'unknown', eventType: null }
                            : { ...prev, step: 'time_end', equipmentDecision: 'unknown', eventType: null };
                    case 'event_type':
                        return { ...prev, step: 'equipment', eventType: null };
                    default:
                        return prev;
                }
            }

            if (prev.mode === 'faq') {
                return { ...INITIAL_GUIDED_FLOW };
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

        const hasLockedSchedule =
            !!guidedFlow.facilityId &&
            !!guidedFlow.date &&
            !!guidedFlow.timeStart &&
            !!guidedFlow.timeEnd;

        if (hasLockedSchedule) {
            setEquipmentSourceMode('own');
            setGuidedEquipmentSnapshot([]);
            setEquipmentSelectionNotice(null);
            setGuidedFlow((prev) => ({
                ...prev,
                mode: 'booking',
                step: 'equipment',
                participantCount,
            }));
            addMessage({
                role: 'assistant',
                content: 'Participant count saved. Your facility, date, and time are locked from the availability check. Choose equipment and event type to continue.',
            });
            return;
        }

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
            setAvailabilityFollowUp(null);

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
        setGuidedEquipmentSnapshot([]);
        setEquipmentSourceMode('own');
        setEquipmentSelectionNotice(null);
        addMessage({
            role: 'assistant',
            content: 'Schedule saved. Choose equipment, then select event type before continuing to request details.',
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
        setGuidedEquipmentSnapshot([]);
        setGuidedFlow((prev) => ({
            ...prev,
            equipmentDecision: 'none',
            step: 'event_type',
        }));
        addMessage({ role: 'user', content: 'No equipment needed.' });
        addMessage({
            role: 'assistant',
            content: 'Noted. Please select your event type.',
        });
    };

    const handleGuidedEventTypeSelection = (eventTypeId: 0 | 1 | 2 | 3) => {
        const option = EVENT_TYPE_OPTIONS.find((eventType) => eventType.id === eventTypeId);
        if (!option) {
            return;
        }

        setGuidedFlow((prev) => ({
            ...prev,
            step: 'event_type',
            eventType: eventTypeId,
        }));

        addMessage({
            role: 'user',
            content: `Event type: ${option.label} (ID: ${eventTypeId}, priority_level: ${option.priority})`,
        });
        addMessage({
            role: 'assistant',
            content: `${option.label} selected. You can continue to request details now.`,
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

        const effectiveGuidedSelection = equipmentSelectionForGuided ?? guidedEquipmentSnapshot;
        const serializedEquipmentSelection = effectiveGuidedSelection
            .map((item) => ({
                equipment_id: item.equipment_id,
                facility_id: item.facility_id,
                quantity_needed: item.quantity_needed,
                is_borrowed: item.facility_id !== facility.id,
                source_facility_id: item.facility_id !== facility.id ? item.facility_id : null,
            }));

        const equipmentInstruction =
            serializedEquipmentSelection.length > 0
                ? `Use this exact guided equipment selection: ${JSON.stringify(serializedEquipmentSelection)}.`
                : guidedFlow.equipmentDecision === 'selected'
                  ? 'Use the exact equipment IDs and quantities already selected in previous user messages.'
                  : guidedFlow.equipmentDecision === 'none'
                    ? 'No equipment is needed for this request.'
                    : 'Ask once if equipment is needed. If not needed, proceed without equipment.';
        const selectedEventType = EVENT_TYPE_OPTIONS.find((eventType) => eventType.id === guidedFlow.eventType);
        const eventTypeInstruction = selectedEventType
            ? `Use locked event_type=${selectedEventType.id} (${selectedEventType.label}) and priority_level=${selectedEventType.priority}. Do not ask event type again.`
            : 'If event type is still missing, ask once and map it deterministically before final payload.';

        const userMessage: Message = {
            role: 'user',
            content:
                `Continue request creation with these locked details: participant_count=${guidedFlow.participantCount}, facility_id=${facility.id} (${facility.name}), date=${guidedFlow.date}, time_start=${guidedFlow.timeStart}, time_end=${guidedFlow.timeEnd}. ` +
                `${equipmentInstruction} ${eventTypeInstruction} Do not change these locked details. Collect only missing fields (title, description, optional files, and event type only if not provided), then prepare the confirmation JSON payload.`,
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

    const normalizeEquipmentResponse = (items: unknown[]): Equipment[] => {
        return items
            .map((rawItem) => {
                if (!rawItem || typeof rawItem !== 'object') {
                    return null;
                }

                const item = rawItem as Partial<Equipment>;
                const remainingQuantityRaw =
                    typeof item.remaining_quantity === 'number' ? item.remaining_quantity : Number(item.remaining_quantity ?? item.quantity);
                const totalQuantityRaw =
                    typeof item.total_quantity === 'number' ? item.total_quantity : Number(item.total_quantity ?? item.quantity);
                const reservedQuantityRaw =
                    typeof item.reserved_quantity === 'number' ? item.reserved_quantity : Number(item.reserved_quantity ?? 0);

                return {
                    ...item,
                    id: Number(item.id),
                    facility_id: Number(item.facility_id),
                    quantity: Number.isFinite(remainingQuantityRaw) ? Math.max(0, Math.floor(remainingQuantityRaw)) : 0,
                    total_quantity: Number.isFinite(totalQuantityRaw) ? Math.max(0, Math.floor(totalQuantityRaw)) : 0,
                    reserved_quantity: Number.isFinite(reservedQuantityRaw) ? Math.max(0, Math.floor(reservedQuantityRaw)) : 0,
                    remaining_quantity: Number.isFinite(remainingQuantityRaw) ? Math.max(0, Math.floor(remainingQuantityRaw)) : 0,
                    facility: typeof item.facility === 'string' ? item.facility : null,
                    name: String(item.name ?? ''),
                } as Equipment;
            })
            .filter((item): item is Equipment => {
                if (!item) {
                    return false;
                }

                return Number.isFinite(item.id) && Number.isFinite(item.facility_id) && item.facility_id > 0 && item.name.trim() !== '';
            });
    };

    const reconcileSelectedEquipment = (options: Equipment[], notify: boolean) => {
        setSelectedEquipment((prev) => {
            const optionByKey = new Map<string, Equipment>(
                options.map((option) => [`${option.id}-${option.facility_id}`, option]),
            );

            let changed = false;
            const next = prev.flatMap((selection) => {
                const option = optionByKey.get(`${selection.equipment_id}-${selection.facility_id}`);
                if (!option) {
                    changed = true;
                    return [];
                }

                const remaining = getEquipmentRemainingQuantity(option);
                if (remaining <= 0) {
                    changed = true;
                    return [];
                }

                const clampedQuantity = Math.min(Math.max(1, selection.quantity_needed), remaining);
                if (clampedQuantity !== selection.quantity_needed) {
                    changed = true;
                }

                return [{ ...selection, quantity_needed: clampedQuantity }];
            });

            if (changed && notify) {
                setEquipmentSelectionNotice('Availability changed for this slot. Selected quantities were adjusted to the latest remaining stock.');
            }

            return next;
        });
    };

    const fetchEquipmentOptions = async (
        params?: { facilityId?: number; date?: string; timeStart?: string; timeEnd?: string; sourceMode?: EquipmentSourceMode },
        scope: 'default' | 'slot' = 'default',
    ) => {
        try {
            if (scope === 'default') {
                setEquipmentSelectionNotice(null);
            }

            const queryParams = new URLSearchParams();
            if (params?.facilityId) queryParams.set('facility_id', String(params.facilityId));
            if (params?.date) queryParams.set('date', params.date);
            if (params?.timeStart) queryParams.set('time_start', params.timeStart);
            if (params?.timeEnd) queryParams.set('time_end', params.timeEnd);
            queryParams.set('source', params?.sourceMode ?? 'own');

            const endpoint = queryParams.toString()
                ? `${route('chat.equipment')}?${queryParams.toString()}`
                : route('chat.equipment');

            const response = await fetch(endpoint, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            const json = await response.json();
            if (!json.data || !Array.isArray(json.data)) {
                return;
            }

            const normalizedEquipment = normalizeEquipmentResponse(json.data);
            const requestedSourceMode = params?.sourceMode ?? 'own';

            if (
                scope === 'slot' &&
                requestedSourceMode === 'own' &&
                !!params?.facilityId &&
                normalizedEquipment.length === 0
            ) {
                setEquipmentSourceMode('borrow');
                setEquipmentSelectionNotice('No equipment is assigned to this facility. Switched to Borrow Equipment.');
                return;
            }

            if (scope === 'slot') {
                setEquipmentSelectionNotice(null);
            }
            setEquipmentOptions(normalizedEquipment);
            reconcileSelectedEquipment(normalizedEquipment, scope === 'slot');

            if (scope === 'default') {
                setBaseEquipmentOptions(normalizedEquipment);
                setIsSlotScopedEquipmentList(false);
            } else {
                setIsSlotScopedEquipmentList(true);
            }
        } catch {
            if (scope === 'slot') {
                setEquipmentSelectionNotice('Unable to refresh slot-aware availability right now. Please try opening equipment again.');
            }
        }
    };

    // Reset equipment selection UI when mode changes
    useEffect(() => {
        setShowEquipmentSelection(false);
        setSelectedEquipment([]);
        setGuidedEquipmentSnapshot([]);
        setEquipmentSelectionNotice(null);
        setEquipmentSourceMode('own');
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
        if (mode !== 'ai') {
            if (isSlotScopedEquipmentList && baseEquipmentOptions.length > 0) {
                setEquipmentOptions(baseEquipmentOptions);
                setIsSlotScopedEquipmentList(false);
                reconcileSelectedEquipment(baseEquipmentOptions, false);
            }
            return;
        }

        const slotContext = getActiveSlotContext();
        if (!slotContext) {
            if (isSlotScopedEquipmentList && baseEquipmentOptions.length > 0) {
                setEquipmentOptions(baseEquipmentOptions);
                setIsSlotScopedEquipmentList(false);
                reconcileSelectedEquipment(baseEquipmentOptions, false);
            }
            return;
        }

        const normalizedStart = toHHMM(slotContext.timeStart);
        const normalizedEnd = toHHMM(slotContext.timeEnd);
        if (!normalizedStart || !normalizedEnd) {
            setEquipmentSelectionNotice('Please use a valid start/end time format to load slot-aware equipment availability.');
            return;
        }

        void fetchEquipmentOptions(
            {
                facilityId: slotContext.facilityId,
                date: slotContext.date,
                timeStart: normalizedStart,
                timeEnd: normalizedEnd,
                sourceMode: equipmentSourceMode,
            },
            'slot',
        );
    }, [
        mode,
        guidedFlow.mode,
        guidedFlow.step,
        guidedFlow.facilityId,
        guidedFlow.date,
        guidedFlow.timeStart,
        guidedFlow.timeEnd,
        pendingPayload,
        equipmentSourceMode,
        baseEquipmentOptions,
        isSlotScopedEquipmentList,
    ]);

    // Fetch facilities and baseline equipment for booking flows
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

        void fetchEquipmentOptions(undefined, 'default');
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

    const processAndSend = async (
        userMessage: Message,
        contextNote?: string,
        skipUserAdd = false,
        faqModeOverride?: boolean,
    ): Promise<string | null> => {
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
                    return null;
                }

                const result = await submitRequest(payload);
                setPendingPayload(null);
                setAttachedFiles([]);
                addMessage({ role: 'assistant', content: `Success: Request #${result.request_id} created successfully!` });
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Failed to create request';
                addMessage({ role: 'assistant', content: `Failed to create request: ${errorMsg}` });
            }
            return null; // don't send to AI again
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
            const faqMode = faqModeOverride ?? guidedFlow.mode === 'faq';

            let streamingContent = '';
            let deterministicAvailabilityStatus: 'available' | 'unavailable' | null = null;

            const assistantContent = await sendMessage(
                allMessages,
                currentCount,
                activeBookingContext,
                faqMode,
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
                (deterministic) => {
                    const check = typeof deterministic.check === 'string' ? deterministic.check : '';
                    const status = typeof deterministic.status === 'string' ? deterministic.status : '';
                    if (check !== 'availability') {
                        return;
                    }

                    if (status === 'available' || status === 'unavailable') {
                        deterministicAvailabilityStatus = status;
                    }
                },
            );

            if (
                contextNote &&
                (contextNote.startsWith('Quick reply collected availability details') ||
                    contextNote.startsWith('Guided quick reply collected availability details'))
            ) {
                const status = deterministicAvailabilityStatus ?? getAvailabilityStatus(assistantContent);
                const parsedSelection = parseAvailabilityUserMessage(userMessage.content);
                if (status && parsedSelection) {
                    const facility = facilities.find((item) => item.name.toLowerCase() === parsedSelection.facilityName.toLowerCase());
                    if (facility) {
                        setAvailabilityFollowUp({
                            status,
                            facility,
                            date: parsedSelection.date,
                            startTime: parsedSelection.startTime,
                            endTime: parsedSelection.endTime,
                            source: contextNote.startsWith('Guided quick reply collected availability details') ? 'guided' : 'wizard',
                        });
                        addMessage({
                            role: 'assistant',
                            content:
                                status === 'available'
                                    ? 'Would you like to proceed with booking, check another facility, change time slot, or cancel?'
                                    : 'Would you like to check another facility, change time slot, or cancel?',
                        });
                    }
                }
            }

            if (messageQueueRef.current.length > 0) {
                const next = messageQueueRef.current.shift();
                if (next) {
                    await processAndSend(next.message, next.context, true);
                }
            }
            return assistantContent;
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
            return null;
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
            addMessage({ role: 'assistant', content: `Success: Request #${result.request_id} created successfully!` });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to create request';
            addMessage({ role: 'assistant', content: `Failed to create request: ${errorMsg}` });
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

    const getActiveSlotContext = (): { facilityId: number; date: string; timeStart: string; timeEnd: string } | null => {
        const isGuidedSlotLocked =
            guidedFlow.mode === 'booking' &&
            guidedFlow.step === 'equipment' &&
            !!guidedFlow.facilityId &&
            !!guidedFlow.date &&
            !!guidedFlow.timeStart &&
            !!guidedFlow.timeEnd;

        if (isGuidedSlotLocked) {
            return {
                facilityId: guidedFlow.facilityId as number,
                date: guidedFlow.date as string,
                timeStart: guidedFlow.timeStart as string,
                timeEnd: guidedFlow.timeEnd as string,
            };
        }

        const pendingBooking = pendingPayload?.facility_bookings?.[0];
        const pendingFacilityId = pendingBooking?.facility_id;
        if (
            typeof pendingFacilityId === 'number' &&
            pendingFacilityId > 0 &&
            typeof pendingBooking?.date === 'string' &&
            typeof pendingBooking?.time_start === 'string' &&
            typeof pendingBooking?.time_end === 'string' &&
            pendingBooking.date.length > 0 &&
            pendingBooking.time_start.length > 0 &&
            pendingBooking.time_end.length > 0
        ) {
            return {
                facilityId: pendingFacilityId,
                date: pendingBooking.date,
                timeStart: pendingBooking.time_start,
                timeEnd: pendingBooking.time_end,
            };
        }

        return null;
    };

    const getFilteredEquipment = () => {
        const facilityId = getCurrentFacilityId();
        if (!facilityId) {
            return equipmentOptions;
        }

        if (equipmentSourceMode === 'borrow') {
            return equipmentOptions.filter((eq) => eq.facility_id !== facilityId);
        }

        return equipmentOptions.filter((eq) => eq.facility_id === facilityId);
    };

    const openEquipmentSelection = () => {
        setShowEquipmentSelection(true);

        const facilityId = getCurrentFacilityId();
        if (!facilityId || equipmentSourceMode !== 'own') {
            return;
        }

        const ownFacilityOptions = equipmentOptions.filter((eq) => eq.facility_id === facilityId);
        if (ownFacilityOptions.length > 0) {
            return;
        }

        setEquipmentSourceMode('borrow');
        setSelectedEquipment([]);
        setEquipmentSelectionNotice('No equipment is assigned to this facility. Switched to Borrow Equipment.');

        const slotContext = getActiveSlotContext();
        if (!slotContext) {
            return;
        }

        const normalizedStart = toHHMM(slotContext.timeStart);
        const normalizedEnd = toHHMM(slotContext.timeEnd);
        if (!normalizedStart || !normalizedEnd) {
            return;
        }

        void fetchEquipmentOptions(
            {
                facilityId: slotContext.facilityId,
                date: slotContext.date,
                timeStart: normalizedStart,
                timeEnd: normalizedEnd,
                sourceMode: 'borrow',
            },
            'slot',
        );
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
            /\bi(?:'|â€™)ll add (?:them|it) to the facility request\b/,
            /\bany additional equipment\b/,
            /\bavailable for use\b/,
        ].some((pattern) => pattern.test(text));
    };

    const detectGuidedIntentRoute = (text: string): GuidedIntentRoute => {
        const normalized = text.toLowerCase();
        const equipmentIntent = isEquipmentAvailabilityIntent(normalized) || /\b(borrow equipment|equipment request)\b/i.test(normalized);
        if (equipmentIntent) {
            return 'equipment';
        }

        const availabilityIntent = /\b(check|verify|confirm|is|are)\b.*\b(available|availability|free|vacant)\b/i.test(normalized);
        if (availabilityIntent) {
            return 'availability';
        }

        const bookingIntent = /\b(book|booking|reserve|reservation|create request|submit request|facility request)\b/i.test(normalized);
        if (bookingIntent) {
            return 'booking';
        }

        return null;
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

        return equipmentOptions.length > 0 && (assistantAskedAboutEquipment || userAskedAboutEquipmentAvailability);
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
        const remaining = getEquipmentRemainingQuantity(equipment);
        if (remaining <= 0) {
            setEquipmentSelectionNotice(`"${equipment.name}" is unavailable for the selected slot.`);
            return;
        }

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
        const option = equipmentOptions.find((item) => item.id === equipmentId && item.facility_id === facilityId);
        const remaining = option ? getEquipmentRemainingQuantity(option) : 0;
        if (remaining <= 0) {
            setEquipmentSelectionNotice('Selected equipment is no longer available for this slot.');
            return;
        }

        const bounded = Math.min(Math.max(1, Math.floor(quantity)), remaining);
        setSelectedEquipment((prev) =>
            prev.map((item) =>
                item.equipment_id === equipmentId && item.facility_id === facilityId ? { ...item, quantity_needed: bounded } : item,
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

    const sanitizeEquipmentSelection = (selection: SelectedEquipmentItem[]): SelectedEquipmentItem[] => {
        const optionByKey = new Map<string, Equipment>(
            getFilteredEquipment().map((option) => [`${option.id}-${option.facility_id}`, option]),
        );

        return selection.flatMap((item) => {
            const option = optionByKey.get(`${item.equipment_id}-${item.facility_id}`);
            if (!option) {
                return [];
            }

            const remaining = getEquipmentRemainingQuantity(option);
            if (remaining <= 0) {
                return [];
            }

            return [
                {
                    ...item,
                    quantity_needed: Math.min(Math.max(1, Math.floor(item.quantity_needed)), remaining),
                },
            ];
        });
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
        const selectedFacilityId = guidedFacilityId ?? getCurrentFacilityId();
        const normalizedSelection = sanitizeEquipmentSelection(selection);

        if (normalizedSelection.length !== selection.length) {
            setEquipmentSelectionNotice('Some selected equipment quantities were adjusted or removed based on latest slot availability.');
        }

        setSelectedEquipment(normalizedSelection);

        const message = buildEquipmentSelectionMessage(normalizedSelection);
        const serializedSelection = normalizedSelection.map((equipment) => ({
            equipment_id: equipment.equipment_id,
            facility_id: equipment.facility_id,
            quantity_needed: equipment.quantity_needed,
            is_borrowed: selectedFacilityId ? equipment.facility_id !== selectedFacilityId : false,
            source_facility_id:
                selectedFacilityId && equipment.facility_id !== selectedFacilityId ? equipment.facility_id : null,
        }));
        const equipmentMsg =
            'The user selected equipment using the checkbox list. ' +
            `Use these exact selections when generating or updating the booking JSON payload: ${JSON.stringify(serializedSelection)}. ` +
            'For rows with is_borrowed=true, keep source_facility_id exactly as provided. Do not replace IDs with names.';
        const noEquipmentMsg = 'The user selected no additional equipment. ' + 'Do not ask for equipment again unless it is required later.';
        const context = normalizedSelection.length > 0 ? equipmentMsg : noEquipmentMsg;

        // NEW: Mark this equipment question as answered by storing the message index
        const latest = getLatestAssistantMessage();
        if (latest) {
            setLastEquipmentQuestionIndex(latest.index);
        }

        if (guidedFlow.mode === 'booking' && guidedFlow.step === 'equipment') {
            setGuidedEquipmentSnapshot(normalizedSelection);
            setGuidedFlow((prev) => ({
                ...prev,
                equipmentDecision: normalizedSelection.length > 0 ? 'selected' : 'none',
                step: 'event_type',
            }));
            setSelectedEquipment([]);
            setShowEquipmentSelection(false);
            addMessage({ role: 'user', content: message });
            addMessage({
                role: 'assistant',
                content: 'Equipment saved. Please select your event type.',
            });
            return;
        }

        setSelectedEquipment([]);
        setShowEquipmentSelection(false); // Reset the selection UI
        await processAndSend({ role: 'user', content: message }, context);
    };

    const submitNoEquipmentSelection = async () => {
        await submitEquipmentSelection([]);
    };

    const handleEquipmentSourceModeChange = (nextMode: EquipmentSourceMode) => {
        if (nextMode === equipmentSourceMode) {
            return;
        }

        setEquipmentSourceMode(nextMode);
        setSelectedEquipment([]);
        setEquipmentSelectionNotice(
            nextMode === 'borrow'
                ? 'Borrow mode enabled. Showing slot-aware equipment from other facilities only.'
                : 'Own-facility mode enabled. Showing slot-aware equipment assigned to the selected facility.',
        );

        const slotContext = getActiveSlotContext();
        if (!slotContext) {
            return;
        }

        const normalizedStart = toHHMM(slotContext.timeStart);
        const normalizedEnd = toHHMM(slotContext.timeEnd);
        if (!normalizedStart || !normalizedEnd) {
            return;
        }

        void fetchEquipmentOptions(
            {
                facilityId: slotContext.facilityId,
                date: slotContext.date,
                timeStart: normalizedStart,
                timeEnd: normalizedEnd,
                sourceMode: nextMode,
            },
            'slot',
        );
    };
    const handleSendMessage = async () => {
        const message = input.trim();
        if (!message) return;

        if (mode !== 'ai') {
            addMessage({
                role: 'assistant',
                content:
                    mode === 'idle'
                        ? 'Choose a mode from quick actions first to start chatting.'
                        : 'Chat is available only in AI mode. Finish or cancel the current guided flow first.',
            });
            return;
        }
        setInput('');
        setAvailabilityFollowUp(null);

        if (guidedFlow.mode === 'none') {
            const routedIntent = detectGuidedIntentRoute(message);
            if (routedIntent === 'availability') {
                addMessage({ role: 'user', content: message });
                startGuidedFlow('availability');
                addMessage({
                    role: 'assistant',
                    content: 'I routed your request to Guided Availability so backend checks stay deterministic.',
                });
                return;
            }

            if (routedIntent === 'booking' || routedIntent === 'equipment') {
                addMessage({ role: 'user', content: message });
                startGuidedFlow('booking');
                addMessage({
                    role: 'assistant',
                    content: 'I routed your request to Guided Booking so we can collect details in one controlled flow.',
                });
                return;
            }
        }

        if (mode === 'idle' || mode === 'booking' || mode === 'availability') setMode('ai');

        if (guidedFlow.mode !== 'none' && guidedFlow.mode !== 'faq') {
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
        const faqModeActive = guidedFlow.mode === 'faq';

        if (faqModeActive && /\b(cancel|exit|stop)\b.*\b(faq|mode)\b/i.test(message)) {
            addMessage(userMessage);
            resetGuidedFlow();
            addMessage({
                role: 'assistant',
                content: 'FAQ mode exited. You can continue with normal chat or start another guided flow.',
            });
            return;
        }

        if (isLoading) {
            addMessage(userMessage);
            messageQueueRef.current.push({
                message: userMessage,
                context: faqModeActive ? 'FAQ mode is active.' : undefined,
            });
            return;
        }

        await processAndSend(userMessage, undefined, false, faqModeActive);
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
        setAvailabilityFollowUp(null);

        if (isLoading) {
            addMessage(userMessage);
            messageQueueRef.current.push({ message: userMessage, context });
            return;
        }

        await processAndSend(userMessage, context);
    };

    const handleAvailabilityProceedWithBooking = async () => {
        if (!availabilityFollowUp) {
            return;
        }

        const { source, facility, date, startTime, endTime } = availabilityFollowUp;
        setAvailabilityFollowUp(null);
        setShowEquipmentSelection(false);

        if (source === 'guided') {
            setMode('ai');
            setGuidedFlow({
                ...INITIAL_GUIDED_FLOW,
                mode: 'booking',
                step: 'attachments',
                facilityId: facility.id,
                date,
                timeStart: startTime,
                timeEnd: endTime,
            });
            addMessage({
                role: 'assistant',
                content:
                    `Great, availability is confirmed for ${facility.name} on ${date} from ${startTime} to ${endTime}. ` +
                    'Before we continue, do you have any approval paper or related supporting document to attach?',
            });
            return;
        }

        setMode('booking');
        bookingFlow.update({
            facility_id: facility.id,
            facility_name: facility.name,
            date,
            time_start: startTime,
            time_end: endTime,
        });
        bookingFlow.goToStep('title');
    };

    const handleAvailabilityOtherFacility = () => {
        if (!availabilityFollowUp) {
            return;
        }

        const source = availabilityFollowUp.source;
        setAvailabilityFollowUp(null);

        if (source === 'guided') {
            startGuidedFlow('availability');
            return;
        }

        setMode('availability');
    };

    const handleAvailabilityChangeTimeSlot = () => {
        if (!availabilityFollowUp) {
            return;
        }

        const { source, facility, date } = availabilityFollowUp;
        setAvailabilityFollowUp(null);

        if (source === 'guided') {
            setMode('ai');
            setGuidedFlow({
                ...INITIAL_GUIDED_FLOW,
                mode: 'availability',
                step: 'time_start',
                facilityId: facility.id,
                date,
            });
            addMessage({
                role: 'assistant',
                content: `Okay, letâ€™s change the time slot for ${facility.name} on ${date}. Please choose a new start time.`,
            });
            return;
        }

        setMode('availability');
        addMessage({
            role: 'assistant',
            content: 'Please choose a new time slot for another availability check.',
        });
    };

    const handleAvailabilityCancel = () => {
        setAvailabilityFollowUp(null);
        addMessage({
            role: 'assistant',
            content: 'Availability follow-up cancelled. You can continue chatting anytime.',
        });
    };

    const canUseEquipmentSelector = guidedFlow.mode !== 'booking' || guidedFlow.step === 'equipment';
    const shouldRenderEquipmentPicker = canUseEquipmentSelector && (showEquipmentSelection || shouldShowEquipmentPicker());
    const currentFacilityId = getCurrentFacilityId();

    const buildGuidedQuickReplies = (): GuidedQuickReplyOption[] => {
        const today = new Date();
        const plusTwoDays = new Date();
        plusTwoDays.setDate(today.getDate() + 2);
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

        if (availabilityFollowUp) {
            const sharedReplies: GuidedQuickReplyOption[] = [
                {
                    id: 'availability-other-facility',
                    label: 'Avail Other Facility',
                    onSelect: handleAvailabilityOtherFacility,
                    variant: 'outline',
                },
                {
                    id: 'availability-change-timeslot',
                    label: 'Change Time Slot',
                    onSelect: handleAvailabilityChangeTimeSlot,
                    variant: 'outline',
                },
                {
                    id: 'availability-cancel',
                    label: 'Cancel',
                    onSelect: handleAvailabilityCancel,
                    variant: 'outline',
                },
            ];

            if (availabilityFollowUp.status === 'available') {
                return [
                    {
                        id: 'availability-proceed-booking',
                        label: 'Proceed with Booking',
                        onSelect: () => void handleAvailabilityProceedWithBooking(),
                        variant: 'default',
                    },
                    ...sharedReplies,
                ];
            }

            return sharedReplies;
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
                    id: 'guided-start-faq',
                    label: 'FAQ Mode',
                    onSelect: () => startGuidedFlow('faq'),
                    variant: 'outline',
                },
            ];
        }

        if (guidedFlow.mode === 'faq') {
            return [
                {
                    id: 'faq-exit',
                    label: 'Exit FAQ Mode',
                    onSelect: () => {
                        resetGuidedFlow();
                        addMessage({
                            role: 'assistant',
                            content: 'FAQ mode exited. You can continue with normal chat or start another guided flow.',
                        });
                    },
                    variant: 'outline',
                },
                {
                    id: 'faq-guided-booking',
                    label: 'Switch to Guided Booking',
                    onSelect: () => startGuidedFlow('booking'),
                    variant: 'default',
                },
                {
                    id: 'faq-guided-availability',
                    label: 'Switch to Availability',
                    onSelect: () => startGuidedFlow('availability'),
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
                        id: 'guided-date-plus2',
                        label: `In 2 Days (${formatDateYmd(plusTwoDays)})`,
                        onSelect: () => handleGuidedDateSelection(formatDateYmd(plusTwoDays)),
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
                        onSelect: openEquipmentSelection,
                    },
                    { id: 'guided-equipment-none', label: 'No Equipment Needed', onSelect: handleGuidedNoEquipment, variant: 'outline' },
                    {
                        id: 'guided-equipment-next',
                        label: 'Next: Event Type',
                        onSelect: () => {
                            setShowEquipmentSelection(false);
                            setGuidedFlow((prev) => ({
                                ...prev,
                                equipmentDecision: prev.equipmentDecision === 'unknown' ? 'none' : prev.equipmentDecision,
                                step: 'event_type',
                            }));
                            addMessage({
                                role: 'assistant',
                                content: 'Proceeding without additional equipment. Please select your event type.',
                            });
                        },
                        variant: 'default',
                    },
                    { id: 'guided-back', label: 'Back', onSelect: handleGuidedBack, variant: 'outline' },
                    { id: 'guided-cancel', label: 'Cancel Guided Flow', onSelect: handleGuidedCancel, variant: 'outline' },
                ];
            }

            if (guidedFlow.step === 'event_type') {
                return [
                    ...EVENT_TYPE_OPTIONS.map((eventType) => ({
                        id: `guided-event-type-${eventType.id}`,
                        label: `${eventType.label} Event`,
                        onSelect: () => handleGuidedEventTypeSelection(eventType.id),
                        variant: guidedFlow.eventType === eventType.id ? ('default' as const) : ('outline' as const),
                    })),
                    {
                        id: 'guided-equipment-continue',
                        label: 'Continue to Request Details',
                        onSelect: handleGuidedContinueBooking,
                        variant: 'default',
                        disabled: guidedFlow.eventType === null,
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
                    label: `ID ${facility.id} ${facility.name}${typeof facility.capacity === 'number' ? ` (Capacity: ${facility.capacity})` : ''}`,
                    onSelect: () => handleGuidedFacilitySelection(facility.id),
                    variant: 'outline' as const,
                }));

                return [...facilityReplies, { id: 'guided-cancel', label: 'Cancel Guided Flow', onSelect: handleGuidedCancel, variant: 'outline' }];
            }

            if (guidedFlow.step === 'date') {
                return [
                    {
                        id: 'guided-av-date-plus2',
                        label: `In 2 Days (${formatDateYmd(plusTwoDays)})`,
                        onSelect: () => handleGuidedDateSelection(formatDateYmd(plusTwoDays)),
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
    const equipmentIntentInSession = messages.some(
        (message) => message.role === 'assistant' && isEquipmentAvailabilityIntent(message.content.toLowerCase()),
    );
    const guidedQuickReplyHint = pendingPayload
        ? 'Review action'
        : availabilityFollowUp
          ? availabilityFollowUp.status === 'available'
              ? 'Availability result: slot is available. Choose next action.'
              : 'Availability result: slot has conflict. Choose next action.'
        : guidedFlow.mode === 'booking'
          ? `Guided booking step: ${guidedFlow.step ?? 'none'}`
          : guidedFlow.mode === 'availability'
            ? `Guided availability step: ${guidedFlow.step ?? 'none'}`
            : guidedFlow.mode === 'faq'
              ? 'FAQ mode active: ask your question in chat.'
            : 'Quick actions';

    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm">
            <div className={`flex-1 space-y-3 p-3 sm:space-y-4 sm:p-4 lg:p-6 ${mode === 'idle' ? 'overflow-visible' : 'overflow-y-auto'}`}>
                {/* Idle — show welcome */}
                {mode === 'idle' && <WelcomeMessage />}

                {/* Booking flow â€” fully structured, no AI */}
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
                        {canUseEquipmentSelector && (showEquipmentSelection || equipmentIntentInSession) && (
                            <div className="mb-3 flex justify-end">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={openEquipmentSelection}
                                    disabled={isLoading}
                                >
                                    Select Equipment
                                </Button>
                            </div>
                        )}

                        <MessageList
                            messages={messages}
                            messagesEndRef={messagesEndRef}
                            equipmentSelectorActive={shouldRenderEquipmentPicker}
                        />

                        {shouldRenderEquipmentPicker && (
                            <div className="mb-4 rounded-lg border border-border bg-background p-3 sm:p-4">
                                {!showEquipmentSelection ? (
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold">Equipment Selection</p>
                                            <p className="text-xs text-muted-foreground">
                                                Click the button to select equipment from the available list.
                                            </p>
                                        </div>
                                        <Button size="sm" onClick={openEquipmentSelection} disabled={isLoading}>
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
                                                {currentFacilityId && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Source mode: {equipmentSourceMode === 'borrow' ? 'Borrow Equipment (other facilities)' : 'Own Facility Equipment'}
                                                    </p>
                                                )}
                                                {isSlotScopedEquipmentList && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Slot-aware availability is active for the selected date and time window.
                                                    </p>
                                                )}
                                                {equipmentSelectionNotice && (
                                                    <p className="mt-1 text-xs text-amber-600">{equipmentSelectionNotice}</p>
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
                                                <Button
                                                    size="sm"
                                                    variant={equipmentSourceMode === 'borrow' ? 'default' : 'outline'}
                                                    onClick={() => handleEquipmentSourceModeChange('borrow')}
                                                    disabled={isLoading || !currentFacilityId}
                                                >
                                                    Borrow Equipment
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant={equipmentSourceMode === 'own' ? 'default' : 'outline'}
                                                    onClick={() => handleEquipmentSourceModeChange('own')}
                                                    disabled={isLoading || !currentFacilityId}
                                                >
                                                    Own Facility
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
                                                const remainingQuantity = getEquipmentRemainingQuantity(equipment);
                                                const isUnavailable = remainingQuantity <= 0;
                                                return (
                                                    <div
                                                        key={`${equipment.id}-${equipment.facility_id}`}
                                                        className="rounded-lg border border-border p-3"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <Checkbox
                                                                id={`equipment-${equipment.id}-${equipment.facility_id}`}
                                                                checked={!!selected}
                                                                disabled={isUnavailable}
                                                                onCheckedChange={() => handleEquipmentToggle(equipment)}
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <Label
                                                                    htmlFor={`equipment-${equipment.id}-${equipment.facility_id}`}
                                                                    className={`text-sm font-medium ${isUnavailable ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer'}`}
                                                                >
                                                                    {equipment.name}
                                                                </Label>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Facility: {equipment.facility ?? `Facility #${equipment.facility_id}`} |
                                                                    Total: {equipment.total_quantity ?? equipment.quantity} |
                                                                    Reserved: {equipment.reserved_quantity ?? 0} |
                                                                    Remaining: {remainingQuantity}
                                                                </p>
                                                                {isUnavailable && (
                                                                    <p className="text-xs text-muted-foreground">Unavailable for this selected slot.</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {selected && (
                                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                                                <Label className="text-sm">Quantity</Label>
                                                                <Input
                                                                    type="number"
                                                                    min={1}
                                                                    max={remainingQuantity}
                                                                    value={selected.quantity_needed}
                                                                    onChange={(e) => {
                                                                        const value = Number(e.target.value);
                                                                        const bounded = Math.min(Math.max(1, value), remainingQuantity);
                                                                        updateEquipmentQuantity(equipment.id, equipment.facility_id, bounded);
                                                                    }}
                                                                    className="w-full sm:w-24"
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
                <div className="border-t border-border bg-background px-3 py-3 sm:px-4 lg:px-6">
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
                                    className="w-full sm:w-44"
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
                            <DatePicker onSelect={handleGuidedDateSelection} minAdvanceDays={2} />
                        </div>
                    )}

                    {guidedFlow.mode !== 'none' && guidedFlow.step === 'time_start' && (
                        <div className="mb-3 flex flex-wrap items-end gap-2">
                            <div>
                                <Label className="mb-1 block text-xs text-muted-foreground">Custom start time</Label>
                                <Input type="time" value={customStartTime} onChange={(e) => setCustomStartTime(e.target.value)} className="w-full sm:w-44" />
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
                                <Input type="time" value={customEndTime} onChange={(e) => setCustomEndTime(e.target.value)} className="w-full sm:w-44" />
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
                                className="w-full justify-start max-w-full text-left whitespace-normal sm:w-auto"
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input area */}
            <ChatInput
                value={input}
                onChange={setInput}
                onKeyPress={handleKeyPress}
                onSend={handleSendMessage}
                disabled={uploading || isLoading || mode !== 'ai'}
                autoFocus={mode === 'ai' || guidedFlow.mode === 'faq'}
                placeholder={mode === 'ai' ? 'Type your message...' : 'Choose a mode from quick actions to start chatting...'}
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
