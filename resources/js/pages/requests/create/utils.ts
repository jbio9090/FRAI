import type { EquipmentConflict } from '@/types/equipment';
import type { BookingSchedule, DraftData, ExistingRequest } from './types';

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

export function maxFileSizeBytes(maxFileSizeMb: number | null): number | null {
    return maxFileSizeMb === null ? null : maxFileSizeMb * 1024 * 1024;
}

export function formatMaxFileSize(maxFileSizeMb: number | null): string {
    if (maxFileSizeMb === null) return 'No limit';
    return maxFileSizeMb % 1 === 0 ? `${maxFileSizeMb}MB` : `${maxFileSizeMb}MB`;
}

export function getTodayStart(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

export function addCalendarDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    next.setHours(0, 0, 0, 0);
    return next;
}

export function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatTime(time: string): string {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

export function timeAgo(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export function getDraftKey(existingId?: number) {
    return existingId ? `request_draft_edit_${existingId}` : 'request_draft_create';
}

export function loadDraft(existingId?: number): DraftData | null {
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

export function saveDraft(data: Omit<DraftData, 'savedAt'>, existingId?: number) {
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

export function clearDraft(existingId?: number) {
    localStorage.removeItem(getDraftKey(existingId));
}

export function draftDiffersFromExisting(draft: DraftData, existing: ExistingRequest): boolean {
    if (draft.title !== existing.title) return true;
    if (draft.description !== existing.description) return true;
    if (draft.priority_level !== existing.priority_level) return true;
    if (draft.priority_reason !== existing.priority_reason) return true;
    if (JSON.stringify(draft.facility_bookings) !== JSON.stringify(existing.facility_bookings)) return true;
    return false;
}

export function doTimeRangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
    return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(endA) > timeToMinutes(startB);
}

export function filterOverlappingSchedules(bookings: BookingSchedule[], startTime: string, endTime: string): BookingSchedule[] {
    return bookings.filter((booking) => {
        if (booking.status !== 'Approved' && booking.status !== 'Conditionally Approved') {
            return false;
        }

        return doTimeRangesOverlap(startTime, endTime, booking.time_start, booking.time_end);
    });
}

function scheduleConflictKey(conflict: BookingSchedule): string {
    if (conflict.request_id !== undefined && conflict.request_id !== null) {
        return `${conflict.request_id}|${conflict.time_start}|${conflict.time_end}`;
    }

    return `${conflict.request_title}|${conflict.time_start}|${conflict.time_end}|${conflict.status}`;
}

export function mergeScheduleConflicts(existing: BookingSchedule[], incoming: BookingSchedule[]): BookingSchedule[] {
    if (incoming.length === 0) return existing;

    const seen = new Set(existing.map(scheduleConflictKey));
    const merged = [...existing];
    let added = false;

    for (const conflict of incoming) {
        const key = scheduleConflictKey(conflict);
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(conflict);
            added = true;
        }
    }

    return added ? merged : existing;
}

export function mergeEquipmentConflicts(
    existing: Record<number, EquipmentConflict[]>,
    incoming: Record<number, EquipmentConflict[]>,
): Record<number, EquipmentConflict[]> {
    const merged: Record<number, EquipmentConflict[]> = { ...existing };
    let changed = false;

    for (const [equipmentIdKey, conflicts] of Object.entries(incoming)) {
        const equipmentId = Number(equipmentIdKey);
        const current = merged[equipmentId] ?? [];
        const seen = new Set(current.map((conflict) => conflict.request_id));
        const next = [...current];

        for (const conflict of conflicts) {
            if (!seen.has(conflict.request_id)) {
                seen.add(conflict.request_id);
                next.push(conflict);
            }
        }

        if (next.length !== current.length) {
            merged[equipmentId] = next;
            changed = true;
        }
    }

    return changed ? merged : existing;
}
