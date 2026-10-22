import { describe, expect, it } from 'vitest';
import {
    computePopoverPosition,
    formatCalendarEventTime,
    formatEventCount,
    POPOVER_EDGE_MARGIN,
    POPOVER_WIDTH,
    sortCalendarEvents,
    type CalendarEvent,
} from './calendar-events';

function calendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
    return {
        id: 1,
        request_id: 1,
        title: 'Testing',
        start: new Date(2026, 9, 30, 7, 0),
        end: new Date(2026, 9, 30, 10, 30),
        ...overrides,
    };
}

describe('formatCalendarEventTime', () => {
    it('shares the period when start and end are both am', () => {
        expect(formatCalendarEventTime(calendarEvent())).toBe('7:00–10:30am');
    });

    it('prints both periods when they differ', () => {
        expect(
            formatCalendarEventTime(
                calendarEvent({
                    start: new Date(2026, 9, 30, 9, 30),
                    end: new Date(2026, 9, 30, 16, 0),
                }),
            ),
        ).toBe('9:30am–4:00pm');
    });

    it('shares the period when start and end are both pm', () => {
        expect(
            formatCalendarEventTime(
                calendarEvent({
                    start: new Date(2026, 9, 30, 13, 0),
                    end: new Date(2026, 9, 30, 15, 0),
                }),
            ),
        ).toBe('1:00–3:00pm');
    });

    it('uses All day for all-day events', () => {
        expect(formatCalendarEventTime(calendarEvent({ allDay: true }))).toBe('All day');
    });
});

describe('formatEventCount', () => {
    it('uses the plural form for zero and many events', () => {
        expect(formatEventCount(0)).toBe('0 events');
        expect(formatEventCount(6)).toBe('6 events');
    });

    it('uses the singular form for one event', () => {
        expect(formatEventCount(1)).toBe('1 event');
    });
});

describe('sortCalendarEvents', () => {
    it('sorts by start, then end, then title without mutating the input', () => {
        const events = [
            calendarEvent({
                id: 1,
                title: 'Late',
                start: new Date(2026, 9, 30, 9, 0),
                end: new Date(2026, 9, 30, 10, 0),
            }),
            calendarEvent({
                id: 2,
                title: 'Zebra',
                start: new Date(2026, 9, 30, 7, 0),
                end: new Date(2026, 9, 30, 8, 0),
            }),
            calendarEvent({
                id: 3,
                title: 'Alpha',
                start: new Date(2026, 9, 30, 7, 0),
                end: new Date(2026, 9, 30, 8, 0),
            }),
            calendarEvent({
                id: 4,
                title: 'Short',
                start: new Date(2026, 9, 30, 7, 0),
                end: new Date(2026, 9, 30, 7, 30),
            }),
        ];

        expect(sortCalendarEvents(events).map((event) => event.title)).toEqual(['Short', 'Alpha', 'Zebra', 'Late']);
        expect(events.map((event) => event.id)).toEqual([1, 2, 3, 4]);
    });
});

describe('computePopoverPosition', () => {
    const geometry = {
        containerWidth: 1280,
        containerHeight: 800,
        popoverWidth: POPOVER_WIDTH,
        popoverHeight: 400,
    };

    it('anchors 4px above and 12px left of the cell', () => {
        expect(computePopoverPosition({ ...geometry, cell: { top: 200, left: 100 } })).toEqual({ top: 196, left: 88 });
    });

    it('shifts left when the popover would overflow the right edge', () => {
        expect(computePopoverPosition({ ...geometry, cell: { top: 200, left: 1000 } })).toEqual({
            top: 196,
            left: geometry.containerWidth - POPOVER_EDGE_MARGIN - POPOVER_WIDTH,
        });
    });

    it('shifts up when the popover would overflow the bottom edge', () => {
        expect(computePopoverPosition({ ...geometry, cell: { top: 700, left: 100 } })).toEqual({
            top: geometry.containerHeight - POPOVER_EDGE_MARGIN - geometry.popoverHeight,
            left: 88,
        });
    });

    it('keeps the popover inside the 8px margin on every side', () => {
        const position = computePopoverPosition({ ...geometry, cell: { top: 0, left: 0 } });

        expect(position.top).toBe(POPOVER_EDGE_MARGIN);
        expect(position.left).toBe(POPOVER_EDGE_MARGIN);
    });

    it('keeps the popover inside the visible slice of the container', () => {
        const position = computePopoverPosition({
            ...geometry,
            containerHeight: 960,
            cell: { top: 900, left: 100 },
            visibleTop: 100,
            visibleBottom: 500,
        });

        expect(position.top).toBe(100);
    });
});
