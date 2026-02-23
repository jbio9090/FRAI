import axios from 'axios'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import moment from 'moment'
import { useState, useEffect } from 'react'
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

const localizer = momentLocalizer(moment);

interface Event {
    start: Date;
    end: Date;
    title: string;
    id: number;
}

interface CalendarProps {
    facilityId: number;
    initialEvents?: Event[];
}

// Custom Toolbar Component
function CustomToolbar(toolbar: ToolbarProps) {
    const goToBack = () => {
        toolbar.onNavigate('PREV');
    };

    const goToNext = () => {
        toolbar.onNavigate('NEXT');
    };

    const goToToday = () => {
        toolbar.onNavigate('TODAY');
    };

    const label = () => {
        const date = moment(toolbar.date);

        if (toolbar.view === 'day') {
            return (
                <div className="flex flex-col font-light text-sm">
                    <h4>{date.format('YYYY')}</h4>
                    <h3 className="font-bold text-lg">
                        {date.format('MMMM D')}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                        {date.format('dddd')}
                    </span>
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

        // month (default)
        return (
            <div className="flex flex-col font-light text-sm">
                <h4>{date.format('YYYY')}</h4>
                <h3 className="font-bold text-lg">
                    {date.format('MMMM')}
                </h3>
            </div>
        );
    };

    const handleViewChange = (value: string) => {
        toolbar.onView(value as View);
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 p-2 sticky left-0 w-full">
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={goToBack}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    onClick={goToToday}
                >
                    Today
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={goToNext}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 text-center">
                {label()}
            </div>

            <Select value={toolbar.view} onValueChange={handleViewChange}>
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
};

function CustomEvent({ event }: { event: Event }) {
    return (
        <div className='bg-primary-foreground'>
            <span className='px-2 text-xs'>{event.title}</span>
        </div>
    );
}

export default function FacilityCalendar({ facilityId, initialEvents = [] }: CalendarProps) {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const formattedInitialEvents = initialEvents.map((event: Event) => ({
            ...event,
            start: moment(event.start).toDate(),
            end: moment(event.end).toDate(),
        }));
        setEvents(formattedInitialEvents);
    }, [initialEvents]);

    const handleRangeChange = async (range: Date[] | { start: Date; end: Date }) => {
        let start: Date, end: Date;

        if (Array.isArray(range)) {
            start = range[0];
            end = range[range.length - 1];
        } else {
            start = range.start;
            end = range.end;
        }

        setLoading(true);

        try {
            const response = await axios.get(route('facility.schedule.calendar', [facilityId]), {
                params: {
                    start: moment(start).format('YYYY-MM-DD'),
                    end: moment(end).format('YYYY-MM-DD'),
                }
            });

            const formattedEvents = response.data.map((event: Event) => ({
                ...event,
                start: moment(event.start).toDate(),
                end: moment(event.end).toDate(),
            }));

            setEvents(formattedEvents);
        } catch (error) {
            console.error('Failed to fetch events:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-[64rem] relative">
            <Calendar
                views={['month', 'week', 'day']}
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                onRangeChange={handleRangeChange}
                className={'p-0 md:p-8 ' + ((loading) ? " [&>.rbc-month-view]:opacity-50 [&>.rbc-time-view]:opacity-50" : "")}
                components={{
                    toolbar: CustomToolbar,
                    event: CustomEvent,
                }}
                step={60}
                timeslots={1}
            />
        </div>
    )
}