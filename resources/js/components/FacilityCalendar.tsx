import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import { useState } from 'react'
import axios from 'axios'
import 'react-big-calendar/lib/css/react-big-calendar.css'
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

export default function FacilityCalendar({ facilityId, initialEvents = [] }: CalendarProps) {
    const [events, setEvents] = useState<Event[]>(initialEvents);
    const [loading, setLoading] = useState(false);

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

            const formattedEvents = response.data.map((event: any) => ({
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
        <div style={{ height: '40rem', position: 'relative' }}>
            {loading && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
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
            />
        </div>
    )
}