export type RequestStatusValue = 'Pending' | 'Approved' | 'Denied' | 'Conditionally Approved' | 'On Hold' | 'For Reschedule' | 'Partially Approved';

export type RequestStatusKey = 'pending' | 'approved' | 'denied' | 'conditionally_approved' | 'on_hold' | 'for_reschedule' | 'partially_approved';

export function formatRequestStatus(status: string): string {
    const statusMap: Record<RequestStatusKey, string> = {
        pending: 'Pending',
        approved: 'Approved',
        denied: 'Denied',
        conditionally_approved: 'Conditionally Approved',
        on_hold: 'On Hold',
        for_reschedule: 'For Reschedule',
        partially_approved: 'Partially Approved',
    };

    return statusMap[status as RequestStatusKey] ?? formatRequestStatusKey(status);
}

export function formatRequestStatusKey(status: string): string {
    return status
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

const UNKNOWN_LABEL = '—';

function parseClockTime(time?: string): Date | null {
    if (!time) return null;

    // Midnight is stored as 24:00 in some rows, which is not a valid ISO time
    const normalized = time === '24:00' || time === '24:00:00' ? '23:59:00' : time;
    const parsed = new Date(`2000-01-01T${normalized}`);

    return isNaN(parsed.getTime()) ? null : parsed;
}

function formatClockHour(date: Date): string {
    const hours = date.getHours() % 12;

    return hours === 0 ? '12' : String(hours);
}

function formatClockMeridiem(date: Date): string {
    return date.getHours() < 12 ? 'AM' : 'PM';
}

export function formatBookingDate(date?: string): string {
    if (!date) return UNKNOWN_LABEL;

    // Pin the time to local midnight so a bare YYYY-MM-DD is not read as UTC
    const parsed = new Date(`${date}T00:00:00`);
    if (isNaN(parsed.getTime())) return UNKNOWN_LABEL;

    return parsed.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatBookingTimeRange(start?: string, end?: string): string {
    const from = parseClockTime(start);
    const to = parseClockTime(end);

    if (!from || !to) return UNKNOWN_LABEL;

    const startHour = formatClockHour(from);
    const endHour = formatClockHour(to);
    const startMeridiem = formatClockMeridiem(from);
    const endMeridiem = formatClockMeridiem(to);

    if (startHour === endHour && startMeridiem === endMeridiem) {
        return `${startHour}${startMeridiem}`;
    }

    return startMeridiem === endMeridiem ? `${startHour}–${endHour} ${endMeridiem}` : `${startHour} ${startMeridiem}–${endHour} ${endMeridiem}`;
}
