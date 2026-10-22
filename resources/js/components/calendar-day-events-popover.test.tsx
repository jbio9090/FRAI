import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import moment from 'moment';
import { useRef } from 'react';
import type { ComponentProps } from 'react';
import { momentLocalizer } from 'react-big-calendar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventColorSeed, type CalendarEvent } from '@/lib/calendar-events';
import wordToColor from '@/lib/wordToColor';
import { CalendarDayEventsPopover, CalendarShowMoreButton, useCalendarOverflow } from './calendar-day-events-popover';

vi.mock('@inertiajs/react', () => ({
    Link: ({ href, children, ...props }: ComponentProps<'a'>) => (
        <a href={typeof href === 'string' ? href : '#'} {...props}>
            {children}
        </a>
    ),
}));

const localizer = momentLocalizer(moment);
localizer.messages = {
    showMore: (count: number) => `+${count} more`,
};

const date = new Date(2026, 9, 30);

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

function stubRect(element: HTMLElement, rect: Partial<DOMRect>) {
    element.getBoundingClientRect = () =>
        ({
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            right: 0,
            bottom: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
            ...rect,
        }) as DOMRect;
}

function tagHue(seed: string): string {
    return (wordToColor(seed) as unknown as Record<string, string>)['--tag-h'];
}

function OverflowHarness({ events }: { events: CalendarEvent[] }) {
    const overflow = useCalendarOverflow();
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div ref={containerRef} data-testid="calendar-container" className="relative">
            <div className="rbc-month-row">
                <div className="rbc-row-bg">
                    {Array.from({ length: 7 }, (_, index) => (
                        <div key={index} className="rbc-day-bg" />
                    ))}
                </div>
                <div className="rbc-row-content">
                    <CalendarShowMoreButton
                        localizer={localizer}
                        slot={1}
                        slotDate={date}
                        count={events.length}
                        events={events}
                        remainingEvents={events}
                        isOpen={overflow.popover?.date.getTime() === date.getTime()}
                        onOpen={overflow.open}
                    />
                </div>
            </div>
            {overflow.popover && (
                <CalendarDayEventsPopover
                    date={overflow.popover.date}
                    events={overflow.popover.events}
                    containerRef={containerRef}
                    anchor={overflow.popover.cell}
                    trigger={overflow.popover.trigger}
                    focusFirstRow={overflow.popover.focusFirstRow}
                    onClose={overflow.close}
                    onOpenDayView={() => {}}
                />
            )}
        </div>
    );
}

function renderHarness(events: CalendarEvent[] = [calendarEvent()]) {
    const view = render(<OverflowHarness events={events} />);
    const container = screen.getByTestId('calendar-container');

    stubRect(container, { top: 0, left: 0, width: 1200, height: 900, right: 1200, bottom: 900 });

    return { ...view, container };
}

beforeEach(() => {
    vi.stubGlobal('route', (_name: string, params: unknown[]) => `/requests/${params[0]}`);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('CalendarDayEventsPopover content', () => {
    it('lists every event for the day, sorted by start, end, then title', () => {
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
                title: 'Early',
                start: new Date(2026, 9, 30, 6, 0),
                end: new Date(2026, 9, 30, 7, 0),
            }),
        ];

        const { container } = renderHarness(events);
        fireEvent.click(screen.getByRole('button', { name: '+4 more' }));

        const rows = [...container.querySelectorAll('[data-calendar-event-row]')].map((row) => row.textContent ?? '');

        expect(rows).toHaveLength(4);
        expect(rows[0]).toContain('Early');
        expect(rows[1]).toContain('Alpha');
        expect(rows[2]).toContain('Zebra');
        expect(rows[3]).toContain('Late');
    });

    it('shows the event count in the header, using the singular form for one event', () => {
        renderHarness();
        fireEvent.click(screen.getByRole('button', { name: '+1 more' }));

        expect(screen.getByText('1 event')).toBeInTheDocument();
    });
    it('uses the plural form when there are several events', () => {
        renderHarness([calendarEvent({ id: 1, title: 'First event' }), calendarEvent({ id: 2, title: 'Second event' })]);
        fireEvent.click(screen.getByRole('button', { name: '+2 more' }));

        expect(screen.getByText('2 events')).toBeInTheDocument();
    });

    it('renders a link to each event and shows the full location without truncating', () => {
        renderHarness([calendarEvent({ facility_name: 'MPH 6C (CEIT Big room)' })]);
        fireEvent.click(screen.getByRole('button', { name: '+1 more' }));

        expect(screen.getByRole('link', { name: /Testing/ })).toHaveAttribute('href', '/requests/1');
        expect(screen.getByText('MPH 6C (CEIT Big room)')).toBeInTheDocument();
    });
});

describe('CalendarDayEventsPopover placement', () => {
    it('renders inside the calendar container instead of at the end of the page', () => {
        const { container } = renderHarness();
        fireEvent.click(screen.getByRole('button', { name: '+1 more' }));

        const dialog = screen.getByRole('dialog');

        expect(container.contains(dialog)).toBe(true);
        expect(dialog.parentElement).toBe(container);
    });

    it('positions itself inside the container, away from the edges', () => {
        renderHarness();
        fireEvent.click(screen.getByRole('button', { name: '+1 more' }));

        const dialog = screen.getByRole('dialog');
        const top = Number.parseFloat(dialog.style.top);
        const left = Number.parseFloat(dialog.style.left);

        expect(top).toBeGreaterThanOrEqual(8);
        expect(left).toBeGreaterThanOrEqual(8);
        expect(left).toBeLessThanOrEqual(1200 - 8);
    });
});

describe('CalendarDayEventsPopover colours', () => {
    it('gives every bullet the colour of its own event, without tinting the row', () => {
        const events = [
            calendarEvent({ id: 1, title: 'First', start: new Date(2026, 9, 30, 7, 0), end: new Date(2026, 9, 30, 8, 0) }),
            calendarEvent({ id: 2, title: 'Second', start: new Date(2026, 9, 30, 9, 0), end: new Date(2026, 9, 30, 10, 0) }),
        ];

        const { container } = renderHarness(events);
        fireEvent.click(screen.getByRole('button', { name: '+2 more' }));

        const rows = [...container.querySelectorAll<HTMLElement>('[data-calendar-event-row]')];
        const dots = [...container.querySelectorAll<HTMLElement>('[data-calendar-event-dot]')];
        const expected = events.map((event) => tagHue(eventColorSeed(event, false)));

        expect(rows).toHaveLength(2);
        expect(dots).toHaveLength(2);
        expect(rows[0].style.getPropertyValue('--tag-h')).toBe(expected[0]);
        expect(rows[1].style.getPropertyValue('--tag-h')).toBe(expected[1]);
        expect(dots[0].style.backgroundColor).toContain('var(--tag-h)');
        expect(dots[1].style.backgroundColor).toContain('var(--tag-h)');
    });

    it('keeps the popover surface neutral', () => {
        const events = [
            calendarEvent({ id: 1, title: 'Later', start: new Date(2026, 9, 30, 9, 0), end: new Date(2026, 9, 30, 10, 0) }),
            calendarEvent({ id: 2, title: 'Earlier', start: new Date(2026, 9, 30, 7, 0), end: new Date(2026, 9, 30, 8, 0) }),
        ];

        renderHarness(events);
        fireEvent.click(screen.getByRole('button', { name: '+2 more' }));

        const dialog = screen.getByRole('dialog');

        expect(dialog.style.getPropertyValue('--tag-h')).toBe('');
        expect(dialog.style.background).toBe('');
    });
});

describe('CalendarShowMoreButton interactions', () => {
    it('opens the popover when the trigger is clicked', () => {
        renderHarness();
        const trigger = screen.getByRole('button', { name: '+1 more' });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        fireEvent.click(trigger);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not open the popover on hover', () => {
        renderHarness();
        const trigger = screen.getByRole('button', { name: '+1 more' });

        fireEvent.mouseOver(trigger);
        fireEvent.mouseEnter(trigger);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes when the pointer goes down outside the popover and trigger', () => {
        renderHarness();
        fireEvent.click(screen.getByRole('button', { name: '+1 more' }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes on Escape and returns focus to the trigger', async () => {
        renderHarness();
        const trigger = screen.getByRole('button', { name: '+1 more' });
        fireEvent.click(trigger);

        const firstRow = document.querySelector<HTMLElement>('[data-calendar-event-row]');

        await waitFor(() => expect(firstRow).toHaveFocus());

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });
});
