import moment from 'moment';

export interface CalendarEvent {
    start: Date;
    end: Date;
    title: string;
    id: number;
    request_id: string | number;
    building?: string;
    request_title?: string;
    facility_name?: string;
    location?: string;
    allDay?: boolean;
}

export const FACILITY_SEPARATOR = ' — ';

export const POPOVER_WIDTH = 348;
export const POPOVER_EDGE_MARGIN = 8;
export const POPOVER_TOP_OFFSET = -4;
export const POPOVER_LEFT_OFFSET = -12;

export function eventFacilityName(event: CalendarEvent, isDashboard: boolean): string {
    if (event.facility_name) {
        return event.facility_name;
    }

    if (isDashboard && event.title.includes(FACILITY_SEPARATOR)) {
        return event.title.split(FACILITY_SEPARATOR)[0] ?? '';
    }

    return '';
}

export function eventRequestTitle(event: CalendarEvent, isDashboard: boolean): string {
    if (event.request_title) {
        return event.request_title;
    }

    if (isDashboard && event.title.includes(FACILITY_SEPARATOR)) {
        return event.title.split(FACILITY_SEPARATOR)[1] ?? event.title;
    }

    return event.title;
}

export function eventColorSeed(event: CalendarEvent, isDashboard: boolean): string {
    return isDashboard ? eventFacilityName(event, true) : event.title + event.start + event.end;
}

export function eventLocation(event: CalendarEvent): string | undefined {
    const location = event.location ?? event.facility_name;
    const trimmed = location?.trim();

    return trimmed ? trimmed : undefined;
}

export function sortCalendarEvents(events: CalendarEvent[], isDashboard = false): CalendarEvent[] {
    return [...events].sort((a, b) => {
        const startDifference = a.start.getTime() - b.start.getTime();

        if (startDifference !== 0) {
            return startDifference;
        }

        const endDifference = a.end.getTime() - b.end.getTime();

        if (endDifference !== 0) {
            return endDifference;
        }

        return eventRequestTitle(a, isDashboard).localeCompare(eventRequestTitle(b, isDashboard));
    });
}

export function formatCalendarEventTime(event: CalendarEvent): string {
    if (event.allDay) {
        return 'All day';
    }

    const start = moment(event.start);
    const end = moment(event.end);
    const startPeriod = start.format('a');
    const endPeriod = end.format('a');
    const startTime = start.format('h:mm');
    const endTime = end.format('h:mm');

    if (startPeriod === endPeriod) {
        return `${startTime}–${endTime}${startPeriod}`;
    }

    return `${startTime}${startPeriod}–${endTime}${endPeriod}`;
}

export function formatEventCount(count: number): string {
    return `${count} ${count === 1 ? 'event' : 'events'}`;
}

export function formatPopoverTitle(date: Date): string {
    return moment(date).format('dddd, MMM D');
}

export function formatPopoverAriaLabel(date: Date): string {
    return `Events for ${moment(date).format('dddd, MMMM D')}`;
}

interface CellRect {
    top: number;
    left: number;
}

export interface PopoverPositionInput {
    /** Cell position, relative to the container the popover lives in. */
    cell: CellRect;
    containerWidth: number;
    containerHeight: number;
    popoverWidth: number;
    popoverHeight: number;
    margin?: number;
    /** Visible slice of the container (container-relative coordinates). */
    visibleTop?: number;
    visibleBottom?: number;
}

export interface PopoverPosition {
    top: number;
    left: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export function computePopoverPosition({
    cell,
    containerWidth,
    containerHeight,
    popoverWidth,
    popoverHeight,
    margin = POPOVER_EDGE_MARGIN,
    visibleTop,
    visibleBottom,
}: PopoverPositionInput): PopoverPosition {
    const maxLeft = Math.max(margin, containerWidth - margin - popoverWidth);
    const maxTop = Math.max(margin, containerHeight - margin - popoverHeight);

    let left = cell.left + POPOVER_LEFT_OFFSET;
    let top = cell.top + POPOVER_TOP_OFFSET;

    if (left + popoverWidth > containerWidth - margin) {
        left = maxLeft;
    }

    if (top + popoverHeight > containerHeight - margin) {
        top = maxTop;
    }

    top = clamp(top, margin, maxTop);
    left = clamp(left, margin, maxLeft);

    if (visibleTop !== undefined && visibleBottom !== undefined) {
        const minTop = Math.max(margin, visibleTop);
        const maxVisibleTop = Math.max(minTop, visibleBottom - popoverHeight);

        top = clamp(top, minTop, maxVisibleTop);
    }

    return { top, left };
}
