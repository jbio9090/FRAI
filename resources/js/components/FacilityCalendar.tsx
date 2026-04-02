import { Link } from '@inertiajs/react';
import axios from 'axios'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import moment from 'moment'
import { useState, useEffect, useCallback } from 'react'
import type { ToolbarProps, View } from 'react-big-calendar';
import { Calendar, momentLocalizer } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import wordToColor from '@/lib/wordToColor';

const localizer = momentLocalizer(moment);

interface Event {
    start: Date;
    end: Date;
    title: string;
    id: number;
    request_id: string | number;
}

interface CalendarProps {
    facilityId: number;
    initialEvents?: Event[];
    calendarRoute?: string;
}

function CustomToolbar(toolbar: ToolbarProps) {
    const goToBack = () => toolbar.onNavigate('PREV');
    const goToNext = () => toolbar.onNavigate('NEXT');
    const goToToday = () => toolbar.onNavigate('TODAY');

    const label = () => {
        const date = moment(toolbar.date);

        if (toolbar.view === 'day') {
            return (
                <div className="flex flex-col font-light text-sm">
                    <h4>{date.format('YYYY')}</h4>
                    <h3 className="font-bold text-lg">{date.format('MMMM D')}</h3>
                    <span className="text-xs text-muted-foreground">{date.format('dddd')}</span>
                </div>
            );
        }

        if (toolbar.view === 'week') {
            const startOfWeek = date.clone().startOf('week');
            const endOfWeek = date.clone().endOf('week');
            return (
                <div className="flex flex-col font-light text-sm">
                    <h4>{date.format('YYYY')}</h4>
                    <h3 className="font-bold text-lg">
                        {startOfWeek.format('MMM D')} – {endOfWeek.format('MMM D')}
                    </h3>
                </div>
            );
        }

        return (
            <div className="flex flex-col font-light text-sm">
                <h4>{date.format('YYYY')}</h4>
                <h3 className="font-bold text-lg">{date.format('MMMM')}</h3>
            </div>
        );
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 p-2 sticky left-0 w-full">
            <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={goToBack}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={goToToday}>Today</Button>
                <Button variant="outline" size="icon" onClick={goToNext}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex-1 text-center">{label()}</div>
            <Select value={toolbar.view} onValueChange={(v) => toolbar.onView(v as View)}>
                <SelectTrigger>
                    <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="day">Day</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}

const FACILITY_SEPARATOR = ' — ';

function CustomEvent({ event, isDashboard }: { event: Event; isDashboard: boolean }) {
    const [facilityName, requestTitle] = isDashboard && event.title.includes(FACILITY_SEPARATOR)
        ? event.title.split(FACILITY_SEPARATOR)
        : [event.title, event.title];

    const colorSeed = isDashboard ? facilityName : event.title + event.start + event.end;
    const { text, background } = wordToColor(colorSeed);

    return (
        <Link href={route("requests.detail", [event.request_id])}>
            <div
                className='h-full flex flex-row lg:flex-col flex-wrap rounded-sm border-1 px-1 mx-2'
                style={{ backgroundColor: background, color: text, borderColor: text }}
            >
                <span className='font-bold text-xs truncate'>{requestTitle}</span>
                <div className="flex text-left items-center gap-1">
                    <Clock size={12} />
                    <span className='text-xs'>
                        {moment(event.start).format("h:mma")}-{moment(event.end).format("h:mma")}
                    </span>
                </div>
            </div>
        </Link>
    );
}

export default function FacilityCalendar({
    facilityId,
    initialEvents = [],
    calendarRoute = 'facility.schedule.calendar',
}: CalendarProps) {
    const isDashboard = calendarRoute === 'dashboard.calendar';
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentView, setCurrentView] = useState<View>('month');

    useEffect(() => {
        setEvents(initialEvents.map((event) => ({
            ...event,
            start: moment(event.start).toDate(),
            end: moment(event.end).toDate(),
        })));
    }, [initialEvents]);

    const fetchEvents = async (start: Date, end: Date) => {
        setLoading(true);
        try {
            const response = await axios.get(
                isDashboard
                    ? route('dashboard.calendar')
                    : route('facility.schedule.calendar', [facilityId]),
                {
                    params: {
                        start: moment(start).format('YYYY-MM-DD'),
                        end: moment(end).format('YYYY-MM-DD'),
                    }
                }
            );

            setEvents(response.data.map((event: Event) => ({
                ...event,
                start: moment(event.start).toDate(),
                end: moment(event.end).toDate(),
            })));
        } catch (error) {
            console.error('Failed to fetch events:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRangeChange = async (range: Date[] | { start: Date; end: Date }) => {
        let start: Date, end: Date;

        if (Array.isArray(range)) {
            start = range[0];
            end = range[range.length - 1];
        } else {
            start = range.start;
            end = range.end;
        }

        await fetchEvents(start, end);
    };

    return (
        <div className="h-[57rem] relative">
            <Calendar
                views={['month', 'week', 'day']}
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                view={currentView}
                onView={(view) => setCurrentView(view)}
                onRangeChange={handleRangeChange}
                className={(loading ? '[&>.rbc-month-view]:opacity-50 [&>.rbc-time-view]:opacity-50' : '')}
                components={{
                    toolbar: CustomToolbar,
                    event: (props) => <CustomEvent {...props} isDashboard={isDashboard} />,
                }}
                step={60}
                timeslots={1}
            />
        </div>
    );
}