import type { DraftData, ExistingRequest } from './types';

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

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
