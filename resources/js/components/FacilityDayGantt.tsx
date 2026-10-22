import { Clock } from 'lucide-react';
import moment from 'moment';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type {
    CalendarEvent} from '@/lib/calendar-events';
import {
    eventColorSeed,
    eventLocation,
    eventRequestTitle,
    formatCalendarEventTime,
} from '@/lib/calendar-events';
import wordToColor from '@/lib/wordToColor';
import { Skeleton } from '@/components/ui/skeleton';

interface FacilityDayGanttProps {
    events: CalendarEvent[];
    date: Date;
    calendarTitle?: string;
    onEventClick: (requestId: string | number) => void;
    isDashboard?: boolean;
    loading?: boolean;
}

const DEFAULT_START_MIN = 7 * 60;
const DEFAULT_END_MIN = 18 * 60;

function toMinutes(d: Date): number {
    return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export default function FacilityDayGantt({
    events,
    date,
    calendarTitle,
    onEventClick,
    isDashboard = false,
    loading = false,
}: FacilityDayGanttProps) {
    const { domainStart, domainEnd, hours } = useMemo(() => {
        if (events.length === 0) {
            const hs = Array.from(
                { length: DEFAULT_END_MIN / 60 - DEFAULT_START_MIN / 60 },
                (_, i) => DEFAULT_START_MIN / 60 + i,
            );
            return { domainStart: DEFAULT_START_MIN, domainEnd: DEFAULT_END_MIN, hours: hs };
        }
        const starts = events.map((e) => toMinutes(e.start));
        const ends = events.map((e) => toMinutes(e.end));
        const minStart = Math.min(...starts);
        const maxEnd = Math.max(...ends);
        const ds = Math.floor(minStart / 60) * 60;
        const de = Math.ceil(maxEnd / 60) * 60;
        const span = Math.max(de - ds, 60);
        const finalDe = ds + span;
        const hs = Array.from({ length: Math.ceil((finalDe - ds) / 60) }, (_, i) => ds / 60 + i);
        return { domainStart: ds, domainEnd: finalDe, hours: hs };
    }, [events]);

    const total = domainEnd - domainStart;

    return (
        <div className="flex flex-col gap-3 overflow-hidden p-4">
            <div className="flex-1 overflow-auto rounded-lg border border-border bg-card">
                <div className="min-w-[720px]">
                    <div className="flex border-b border-border bg-muted/40">
                        <div className="w-56 shrink-0 border-r border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                            Booking
                        </div>
                        <div className="relative flex-1">
                            <div className="flex">
                                {hours.map((h) => (
                                    <div
                                        key={h}
                                        className="flex-1 border-r border-border/40 px-1 py-2 text-xs text-muted-foreground"
                                        style={{ minWidth: 60 }}
                                    >
                                        {moment().startOf('day').add(h, 'hours').format('h A')}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {loading ? (
                        <div className="flex flex-col gap-1 p-2 py-4">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="flex border-b border-border/40 last:border-b-0">
                                    <div className="w-56 shrink-0 border-r border-border px-3 py-3 text-xs">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2 mt-1" />
                                    </div>
                                    <div className="relative flex-1 py-3">
                                        <Skeleton className="absolute top-1 bottom-1 left-1 w-1/3 rounded-md h-6" />
                                        <Skeleton className="absolute top-1 bottom-1 right-1/4 w-1/6 rounded-md h-6" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : events.length === 0 ? (
                        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                            No bookings for this day.
                        </div>
                    ) : (
                        events.map((event) => {
                            const startMin = toMinutes(event.start);
                            const endMin = toMinutes(event.end);
                            const left = ((startMin - domainStart) / total) * 100;
                            const width = ((endMin - startMin) / total) * 100;
                            const style = wordToColor(eventColorSeed(event, isDashboard));
                            return (
                                <div key={event.id} className="flex border-b border-border/40 last:border-b-0">
                                    <div className="w-56 shrink-0 border-r border-border px-3 py-3 text-sm">
                                        <div className="truncate font-semibold">
                                            {eventRequestTitle(event, isDashboard)}
                                        </div>
                                        <div className="truncate text-muted-foreground">{eventLocation(event)}</div>
                                    </div>
                                    <div className="relative flex-1 py-3">
                                        {hours.map((h) => (
                                            <div
                                                key={h}
                                                className="absolute top-0 bottom-0 border-l border-border/30"
                                                style={{ left: `${((h * 60 - domainStart) / total) * 100}%` }}
                                            />
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => onEventClick(event.request_id)}
                                            className="tag absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md border px-2 text-left text-sm font-medium transition-opacity hover:opacity-90 flex flex-col justify-center"
                                            style={{
                                                left: `${left}%`,
                                                width: `${Math.max(width, 2)}%`,
                                                ...style,
                                            }}
                                            title={`${eventRequestTitle(event, isDashboard)} · ${formatCalendarEventTime(event)}`}
                                        >
                                            <span className="truncate text-left ml-0 mr-auto font-bold">{eventRequestTitle(event, isDashboard)}</span>
                                            <span className="shrink-0 opacity-80 text-left mr-auto flex justify-center gap-1">
                                                <Clock size={12} className='my-auto' />
                                                {formatCalendarEventTime(event)}
                                                </span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
