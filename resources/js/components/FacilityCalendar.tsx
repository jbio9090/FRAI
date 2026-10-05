import { Link } from '@inertiajs/react';
import axios from 'axios';
import { toJpeg } from 'html-to-image';
import { ChevronLeft, ChevronRight, Clock, LoaderCircle, Printer } from 'lucide-react';
import moment from 'moment';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ToolbarProps, View } from 'react-big-calendar';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { downloadCalendarPdf } from '@/lib/pdf';
import { cn } from '@/lib/utils';
import wordToColor from '@/lib/wordToColor';

const localizer = momentLocalizer(moment);

interface Event {
    start: Date;
    end: Date;
    title: string;
    id: number;
    request_id: string | number;
    building?: string;
}

interface CalendarProps {
    facilityId: number;
    initialEvents?: Event[];
    calendarRoute?: string;
    filterBuildings?: string[];
    calendarTitle?: string;
}

interface CalendarExportValue {
    canExport: boolean;
    exporting: boolean;
    onExport: () => void;
}

const DEFAULT_CALENDAR_TITLE = 'Facility Schedule';

const CalendarExportContext = createContext<CalendarExportValue>({
    canExport: false,
    exporting: false,
    onExport: () => {},
});

const slugify = (value: string): string =>
    value
        .trim()
        .replace(/[^a-z0-9]+/gi, '_')
        .replace(/^_+|_+$/g, '') || DEFAULT_CALENDAR_TITLE;

function CalendarExportHeader({ title, date }: { title: string; date: Date }) {
    return (
        <div className="mb-3 flex items-end justify-between border-b pb-2">
            <h3 className="text-xl font-bold">{title}</h3>
            <div className="flex flex-col items-end text-right">
                <span className="text-lg font-semibold">{moment(date).format('MMMM YYYY')}</span>
                <span className="text-xs text-muted-foreground">Generated {moment().format('MMMM D, YYYY')}</span>
            </div>
        </div>
    );
}

function CustomToolbar(toolbar: ToolbarProps) {
    const goToBack = () => toolbar.onNavigate('PREV');
    const goToNext = () => toolbar.onNavigate('NEXT');
    const goToToday = () => toolbar.onNavigate('TODAY');

    const { canExport, exporting, onExport } = useContext(CalendarExportContext);
    const isMonthView = toolbar.view === 'month';

    const label = () => {
        const date = moment(toolbar.date);

        if (toolbar.view === 'day') {
            return (
                <div className="flex flex-col text-sm font-light">
                    <h4>{date.format('YYYY')}</h4>
                    <h3 className="text-lg font-bold">{date.format('MMMM D')}</h3>
                    <span className="text-xs text-muted-foreground">{date.format('dddd')}</span>
                </div>
            );
        }

        if (toolbar.view === 'week') {
            const startOfWeek = date.clone().startOf('week');
            const endOfWeek = date.clone().endOf('week');
            return (
                <div className="flex flex-col text-sm font-light">
                    <h4>{date.format('YYYY')}</h4>
                    <h3 className="text-lg font-bold">
                        {startOfWeek.format('MMM D')} – {endOfWeek.format('MMM D')}
                    </h3>
                </div>
            );
        }

        return (
            <div className="flex flex-col text-sm font-light">
                <h4>{date.format('YYYY')}</h4>
                <h3 className="text-lg font-bold">{date.format('MMMM')}</h3>
            </div>
        );
    };

    return (
        <div className="sticky left-0 mb-4 flex w-full flex-wrap items-center justify-between gap-4 p-2">
            <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={goToBack}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={goToToday}>
                    Today
                </Button>
                <Button variant="outline" size="icon" onClick={goToNext}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex-1 text-center">{label()}</div>
            <div className="flex items-center gap-2">
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
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onExport}
                    disabled={!canExport || !isMonthView}
                    aria-label="Print calendar month to PDF"
                    title={isMonthView ? 'Print month to PDF' : 'Switch to Month view to print'}
                >
                    {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    );
}

const FACILITY_SEPARATOR = ' — ';

function CustomEvent({ event, isDashboard }: { event: Event; isDashboard: boolean }) {
    const [facilityName, requestTitle] =
        isDashboard && event.title.includes(FACILITY_SEPARATOR) ? event.title.split(FACILITY_SEPARATOR) : [event.title, event.title];

    const colorSeed = isDashboard ? facilityName : event.title + event.start + event.end;
    const style = wordToColor(colorSeed);

    return (
        <Link href={route('requests.detail', [event.request_id])} className="block min-w-full">
            <div
                className="tag frai-cal-event min-w-0 border-1 mx-2 flex h-full flex-row rounded-sm px-1 lg:flex-col"
                style={style}
            >
                <span className="min-w-0 truncate text-xs font-bold" title={requestTitle}>
                    {requestTitle}
                </span>
                <div className="flex min-w-0 items-center gap-1 text-left">
                    <Clock size={12} className="shrink-0" />
                    <span className="min-w-0 truncate whitespace-nowrap text-xs">
                        {moment(event.start).format('h:mma')}-{moment(event.end).format('h:mma')}
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
    filterBuildings,
    calendarTitle = DEFAULT_CALENDAR_TITLE,
}: CalendarProps) {
    const isDashboard = calendarRoute === 'dashboard.calendar';
    const [rawEvents, setRawEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [currentView, setCurrentView] = useState<View>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const captureRef = useRef<HTMLDivElement>(null);

    const canExport = !loading && !exporting && rawEvents.length > 0;

    const events = useMemo(
        () =>
            filterBuildings
                ? rawEvents.filter((e) => !e.building || filterBuildings.includes(e.building))
                : rawEvents,
        [rawEvents, filterBuildings],
    );

    useEffect(() => {
        setRawEvents(
            initialEvents.map((event) => ({
                ...event,
                start: moment(event.start).toDate(),
                end: moment(event.end).toDate(),
            })),
        );
    }, [initialEvents]);

    const fetchEvents = async (start: Date, end: Date) => {
        setLoading(true);
        try {
            const response = await axios.get(isDashboard ? route('dashboard.calendar') : route('facility.schedule.calendar', [facilityId]), {
                params: {
                    start: moment(start).format('YYYY-MM-DD'),
                    end: moment(end).format('YYYY-MM-DD'),
                },
            });

            // Store unfiltered — the filter is applied reactively above
            setRawEvents(
                response.data.map((event: Event) => ({
                    ...event,
                    start: moment(event.start).toDate(),
                    end: moment(event.end).toDate(),
                })),
            );
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

    const handleExportPdf = async () => {
        if (!canExport || !captureRef.current) return;

        setExporting(true);

        try {
            // Let React commit the toolbar removal and the export header, and let
            // react-big-calendar re-measure the grid before it gets rasterised.
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            const dataUrl = await toJpeg(captureRef.current, {
                backgroundColor: '#ffffff',
                quality: 0.95,
                pixelRatio: 2,
                skipFonts: true,
            });

            const slug = slugify(calendarTitle);
            const base = isDashboard ? 'Schedule' : slug.toLowerCase().includes('schedule') ? slug : `${slug}_Schedule`;

            await downloadCalendarPdf(dataUrl, `${base}_${moment(currentDate).format('YYYY-MM')}.pdf`, calendarTitle);
        } catch (error) {
            console.error('Failed to generate calendar PDF:', error);
            toast.error('Failed to generate PDF. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <CalendarExportContext.Provider value={{ canExport, exporting, onExport: handleExportPdf }}>
            <div className="relative h-[57rem]">
                <div ref={captureRef} className="flex h-full flex-col bg-background">
                    {exporting && <CalendarExportHeader title={calendarTitle} date={currentDate} />}
                    <Calendar
                        views={['month', 'week', 'day']}
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        view={currentView}
                        onView={(view) => setCurrentView(view)}
                        date={currentDate}
                        onNavigate={(newDate) => setCurrentDate(newDate)}
                        onRangeChange={handleRangeChange}
                        toolbar={!exporting}
                        className={cn('min-h-0 flex-1', loading && '[&>.rbc-month-view]:opacity-50 [&>.rbc-time-view]:opacity-50')}
                        components={{
                            toolbar: CustomToolbar,
                            event: (props) => <CustomEvent {...props} isDashboard={isDashboard} />,
                        }}
                        popup
                        step={60}
                        timeslots={1}
                    />
                </div>
            </div>
        </CalendarExportContext.Provider>
    );
}
