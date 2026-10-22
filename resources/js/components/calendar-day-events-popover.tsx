import { Link } from '@inertiajs/react';
import { ArrowRight, MapPin, X } from 'lucide-react';
import moment from 'moment';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import type { ShowMoreProps } from 'react-big-calendar';
import {
    computePopoverPosition,
    eventColorSeed,
    eventLocation,
    eventRequestTitle,
    formatCalendarEventTime,
    formatEventCount,
    formatPopoverAriaLabel,
    formatPopoverTitle,
    POPOVER_EDGE_MARGIN,
    POPOVER_WIDTH,
    sortCalendarEvents,
    type CalendarEvent,
} from '@/lib/calendar-events';
import wordToColor from '@/lib/wordToColor';

export interface OverflowTriggerInfo {
    date: Date;
    events: CalendarEvent[];
    cell: HTMLElement;
    trigger: HTMLButtonElement;
    focusFirstRow: boolean;
}

interface CalendarOverflowState {
    popover: OverflowTriggerInfo | null;
    open: (info: OverflowTriggerInfo) => void;
    close: () => void;
}

export function useCalendarOverflow(): CalendarOverflowState {
    const [popover, setPopover] = useState<OverflowTriggerInfo | null>(null);

    const open = useCallback((info: OverflowTriggerInfo) => {
        setPopover(info);
    }, []);

    const close = useCallback(() => {
        setPopover(null);
    }, []);

    return { popover, open, close };
}

export function findDayCell(trigger: HTMLElement, slot: number): HTMLElement {
    const row = trigger.closest('.rbc-month-row');
    const cells = row?.querySelectorAll<HTMLElement>('.rbc-row-bg .rbc-day-bg');

    if (cells && cells.length >= slot) {
        return cells[slot - 1];
    }

    return trigger.closest<HTMLElement>('.rbc-row-segment') ?? trigger;
}

export interface CalendarShowMoreButtonProps extends ShowMoreProps<CalendarEvent> {
    isOpen: boolean;
    onOpen: (info: OverflowTriggerInfo) => void;
}

export function CalendarShowMoreButton({ localizer, count, events, remainingEvents, slot, slotDate, isOpen, onOpen }: CalendarShowMoreButtonProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);

    const buildTriggerInfo = useCallback(
        (focusFirstRow: boolean): OverflowTriggerInfo | null => {
            const trigger = buttonRef.current;

            if (!trigger) {
                return null;
            }

            return {
                date: slotDate,
                events,
                trigger,
                cell: findDayCell(trigger, slot),
                focusFirstRow,
            };
        },
        [events, slot, slotDate],
    );

    const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        const info = buildTriggerInfo(event.detail === 0);

        if (info) {
            onOpen(info);
        }
    };

    return (
        <button
            ref={buttonRef}
            type="button"
            className="rbc-button-link rbc-show-more rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            onClick={handleClick}
        >
            {localizer.messages.showMore?.(count, remainingEvents, events) ?? `+${count} more`}
        </button>
    );
}

interface CalendarDayEventsPopoverProps {
    date: Date;
    events: CalendarEvent[];
    /** The element the popover is rendered inside; it is also the positioning context. */
    containerRef: RefObject<HTMLElement | null>;
    /** The day cell the popover is anchored to. */
    anchor: HTMLElement;
    trigger?: HTMLButtonElement | null;
    isDashboard?: boolean;
    focusFirstRow?: boolean;
    onClose: () => void;
    onOpenDayView?: (date: Date) => void;
}

function CalendarEventRow({ event, isDashboard }: { event: CalendarEvent; isDashboard: boolean }) {
    const location = eventLocation(event);
    const style = {
        ...wordToColor(eventColorSeed(event, isDashboard)),
    } as CSSProperties;

    return (
        <Link
            href={route('requests.detail', [event.request_id])}
            data-calendar-event-row
            style={style}
            className="grid grid-cols-[1fr_auto] gap-3 rounded-[10px] px-3 py-2.5 text-popover-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover focus-visible:outline-none"
        >
            <span className="min-w-0">
                <span className="flex items-center gap-2">
                    <span
                        aria-hidden="true"
                        data-calendar-event-dot
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: 'oklch(var(--tag-bg-l) var(--tag-c) var(--tag-h))' }}
                    />
                    <span className="text-sm leading-[18px] font-semibold break-words">{eventRequestTitle(event, isDashboard)}</span>
                </span>
                {location && (
                    <span className="mt-0.5 flex items-start gap-1 pl-4 text-xs leading-4 text-muted-foreground">
                        <MapPin aria-hidden="true" className="mt-px h-3 w-3 shrink-0" />
                        <span className="min-w-0 break-words">{location}</span>
                    </span>
                )}
            </span>
            <span className="text-[13px] leading-[18px] font-semibold whitespace-nowrap">{formatCalendarEventTime(event)}</span>
        </Link>
    );
}

export function CalendarDayEventsPopover({
    date,
    events,
    containerRef,
    anchor,
    trigger = null,
    isDashboard = false,
    focusFirstRow = false,
    onClose,
    onOpenDayView,
}: CalendarDayEventsPopoverProps) {
    const popoverRef = useRef<HTMLDivElement>(null);
    const sortedEvents = useMemo(() => sortCalendarEvents(events, isDashboard), [events, isDashboard]);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
    const [positioned, setPositioned] = useState(false);

    const closeAndRestoreFocus = useCallback(() => {
        trigger?.focus();
        onClose();
    }, [onClose, trigger]);

    useLayoutEffect(() => {
        const updatePosition = () => {
            const popover = popoverRef.current;
            const container = containerRef.current;

            if (!popover || !container) {
                return;
            }

            const containerRect = container.getBoundingClientRect();
            const cellRect = anchor.getBoundingClientRect();
            const popoverRect = popover.getBoundingClientRect();

            // The container can be taller than the viewport, so the popover is
            // additionally kept inside the part of the container that is
            // actually on screen.
            const visibleTop = Math.max(0, -containerRect.top + POPOVER_EDGE_MARGIN);
            const visibleBottom = Math.min(containerRect.height, window.innerHeight - containerRect.top - POPOVER_EDGE_MARGIN);
            const available = Math.max(0, Math.min(containerRect.height - POPOVER_EDGE_MARGIN * 2, visibleBottom - visibleTop));
            const popoverWidth = popoverRect.width || Math.min(POPOVER_WIDTH, containerRect.width - POPOVER_EDGE_MARGIN * 2);
            const popoverHeight = Math.min(popoverRect.height, available);

            setMaxHeight(available || undefined);
            setPosition(
                computePopoverPosition({
                    cell: {
                        top: cellRect.top - containerRect.top,
                        left: cellRect.left - containerRect.left,
                    },
                    containerWidth: containerRect.width,
                    containerHeight: containerRect.height,
                    popoverWidth,
                    popoverHeight,
                    visibleTop,
                    visibleBottom: Math.max(visibleTop, visibleBottom),
                }),
            );
            setPositioned(true);
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [anchor, containerRef, events]);

    useLayoutEffect(() => {
        if (!focusFirstRow) {
            return;
        }

        const firstRow = popoverRef.current?.querySelector<HTMLElement>('[data-calendar-event-row]');

        if (firstRow) {
            firstRow.focus();
        } else {
            popoverRef.current?.querySelector<HTMLElement>('[data-calendar-popover-close]')?.focus();
        }
    }, [focusFirstRow]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeAndRestoreFocus();
                return;
            }

            if (event.key !== 'Tab' || !popoverRef.current) {
                return;
            }

            const focusable = popoverRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');

            if (focusable.length === 0) {
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [closeAndRestoreFocus]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;

            if (!(target instanceof Node)) {
                return;
            }

            if (popoverRef.current?.contains(target) || trigger?.contains(target)) {
                return;
            }

            onClose();
        };

        document.addEventListener('pointerdown', handlePointerDown, true);

        return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, [onClose, trigger]);

    return (
        <div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-label={formatPopoverAriaLabel(date)}
            style={{
                top: position.top,
                left: position.left,
                maxHeight,
                visibility: positioned ? undefined : 'hidden',
            }}
            className="absolute z-40 flex w-[348px] max-w-[calc(100%-16px)] origin-top-left flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[0_18px_40px_rgba(20,24,40,0.16),0_2px_6px_rgba(20,24,40,0.08)] motion-safe:animate-in motion-safe:duration-100 motion-safe:fade-in-0 motion-safe:zoom-in-95 dark:shadow-[0_18px_40px_rgba(0,0,0,0.5),0_2px_6px_rgba(0,0,0,0.4)]"
        >
            <div className="flex shrink-0 items-center gap-3 pt-[14px] pr-2 pb-[10px] pl-4">
                <div
                    aria-hidden="true"
                    className="relative h-11 w-11 shrink-0 rounded-[10px] border-[1.5px] border-foreground bg-transparent overflow-hidden"
                >
                    <div className="absolute inset-x-0 top-0 h-[10px] border-b-[1.5px] border-b-foreground" />
                    <span
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[19px] font-bold leading-none text-foreground"
                    >
                        {moment(date).format('D')}
                    </span>
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] leading-5 font-semibold text-popover-foreground">{formatPopoverTitle(date)}</h2>
                    <p className="text-xs leading-4 text-muted-foreground">{formatEventCount(sortedEvents.length)}</p>
                </div>
                <button
                    type="button"
                    data-calendar-popover-close
                    aria-label="Close"
                    onClick={closeAndRestoreFocus}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover focus-visible:outline-none"
                >
                    <X aria-hidden="true" size={16} />
                </button>
            </div>

            <div className="max-h-[336px] min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                {sortedEvents.map((event) => (
                    <CalendarEventRow key={event.id} event={event} isDashboard={isDashboard} />
                ))}
            </div>

            <div className="shrink-0 border-t border-border px-3 py-2.5">
                <button
                    type="button"
                    onClick={() => onOpenDayView?.(date)}
                    className="flex h-11 items-center gap-2 rounded-md px-1 text-[13px] font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover focus-visible:outline-none dark:text-[var(--ads-av-ink-1)] dark:hover:text-[var(--ads-av-ink-1)]"
                >
                    Open day view
                    <ArrowRight aria-hidden="true" size={14} />
                </button>
            </div>
        </div>
    );
}
