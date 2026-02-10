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
import { Skeleton } from '@/components/ui/skeleton'

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
const CustomToolbar = (toolbar: ToolbarProps) => {
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
        return (
            <div className="flex flex-col wrap font-light text-sm">
                <h4 className='block'>
                    {date.format('YYYY')}
                </h4>
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
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 p-2 sticky left-0 z-10 w-full ">
            {/* Navigation */}
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

            {/* Label */}
            <div className="flex-1 text-center">
                {label()}
            </div>

            {/* View Selector ARFARFRAFRAF*/}
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
        <div className="h-[42rem] relative">
            {loading && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center w-full justify-center z-10 rounded-lg">
                    <div className="space-y-4 w-full max-w-4xl p-4">
                        <Skeleton className="h-12 w-full" />
                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: 35 }).map((_, i) => (
                                <Skeleton key={i} className="h-24" />
                            ))}
                        </div>
                    </div>
                </div>
            )}
            <Calendar
                views={['month', 'week', 'day']}
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                onRangeChange={handleRangeChange}
                className='p-0 md:p-8'
                components={{
                    toolbar: CustomToolbar,
                }}
            />
        </div>
    )
}