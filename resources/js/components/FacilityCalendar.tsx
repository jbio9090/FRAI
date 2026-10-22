import { Link } from '@inertiajs/react';
import axios from 'axios';
import { toJpeg } from 'html-to-image';
import { ChevronLeft, ChevronRight, Clock, LoaderCircle, Printer, ExternalLink } from 'lucide-react';
import moment from 'moment';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ShowMoreProps, ToolbarProps, View } from 'react-big-calendar';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { toast } from 'sonner';
import { CalendarDayEventsPopover, CalendarShowMoreButton, useCalendarOverflow } from '@/components/calendar-day-events-popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { eventColorSeed, eventFacilityName, eventRequestTitle, type CalendarEvent } from '@/lib/calendar-events';
import { downloadCalendarPdf } from '@/lib/pdf';
import { cn } from '@/lib/utils';
import wordToColor from '@/lib/wordToColor';

const localizer = momentLocalizer(moment);

type Event = CalendarEvent;

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

interface PreviewData {
    id: number;
    title: string;
    status: string;
    requester: string;
    can_view_full: boolean;
    facilities: {
        facility_name: string;
        building: string;
        date: string;
        time_start: string;
        time_end: string;
    }[];
}

function PreviewModal({ isOpen, onClose, data, isLoading }: { isOpen: boolean; onClose: () => void; data: PreviewData | null; isLoading: boolean }) {
    if (!isOpen) return null;

    const formatTime = (time: string) => moment(time, 'HH:mm:ss').format('h:mm A');

    if (isLoading || !data) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="sr-only">Loading request preview</DialogTitle>
                        <DialogDescription className="sr-only">Please wait while the request details are loading.</DialogDescription>
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-32" />
                        <div className="space-y-2 border-t pt-2">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Skeleton className="h-10 w-28" />
                        <Button variant="outline" onClick={onClose} disabled>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{data.title}</DialogTitle>
                    <DialogDescription>Request Preview</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant={data.status === 'Approved' ? 'default' : 'secondary'}>{data.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Requested by</span>
                        <span>{data.requester}</span>
                    </div>
                    <div className="space-y-2 border-t pt-2">
                        {data.facilities.map((f, i) => (
                            <div key={i} className="space-y-1 text-sm">
                                <p className="font-medium">{f.facility_name}</p>
                                <p className="text-muted-foreground">
                                    {f.building} • {moment(f.date).format('MMMM D, YYYY')} • {formatTime(f.time_start)}–{formatTime(f.time_end)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    {data.can_view_full && (
                        <Button asChild>
                            <Link href={route('requests.detail', [data.id])} onClick={onClose}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View Details
                            </Link>
                        </Button>
                    )}
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CustomToolbar(toolbar: ToolbarProps<Event>) {
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

function CustomEvent({
    event,
    isDashboard,
    onEventClick,
}: {
    event: Event;
    isDashboard: boolean;
    onEventClick: (requestId: string | number) => void;
}) {
    // The API sends `request_title` / `facility_name`; the split on the combined
    // dashboard title is only a fallback for payloads that predate those fields.
    const facilityName = eventFacilityName(event, isDashboard);
    const requestTitle = eventRequestTitle(event, isDashboard);
    const style = wordToColor(eventColorSeed(event, isDashboard));

    const timeRange = `${moment(event.start).format('h:mma')}-${moment(event.end).format('h:mma')}`;
    const tooltip = [requestTitle, facilityName, timeRange].filter(Boolean).join('\n');

    return (
        <div
            className="tag frai-cal-event mx-2 flex h-full min-w-0 cursor-pointer flex-row rounded-sm border-1 px-1 lg:flex-col"
            style={style}
            title={tooltip}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEventClick(event.request_id);
            }}
        >
            <span className="min-w-0 truncate text-xs font-bold" title={requestTitle}>
                {requestTitle}
            </span>
            <div className="frai-cal-event-time flex min-w-0 items-center gap-1 text-left">
                <Clock size={12} className="shrink-0" />
                <span className="shrink-0 text-xs whitespace-nowrap">{timeRange}</span>
                {facilityName && (
                    <>
                        <span aria-hidden className="shrink-0 text-xs opacity-60">
                            ·
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs" title={facilityName}>
                            {facilityName}
                        </span>
                    </>
                )}
            </div>
        </div>
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
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const captureRef = useRef<HTMLDivElement>(null);
    const calendarContainerRef = useRef<HTMLDivElement>(null);
    const { popover: overflowPopover, open: openOverflow, close: closeOverflow } = useCalendarOverflow();

    const canExport = !loading && !exporting && rawEvents.length > 0;

    const handleEventClick = async (requestId: string | number) => {
        setPreviewData(null); // Clear previous data
        setPreviewOpen(true); // Open modal IMMEDIATELY
        setPreviewLoading(true);
        try {
            const response = await axios.get(route('requests.preview', [requestId]));
            setPreviewData(response.data);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 403) {
                toast.error('Access restricted');
            } else if (axios.isAxiosError(error) && error.response?.status === 404) {
                toast.error('Request not found or not available for preview');
            } else {
                toast.error('Failed to load preview');
            }
            setPreviewOpen(false); // Close on error
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleOpenDayView = (date: Date) => {
        closeOverflow();
        setCurrentDate(date);
        setCurrentView('day');
    };

    const events = useMemo(
        () => (filterBuildings ? rawEvents.filter((e) => !e.building || filterBuildings.includes(e.building)) : rawEvents),
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

    const handleRangeChange = (range: Date[] | { start: Date; end: Date }) => {
        let start: Date, end: Date;

        if (Array.isArray(range)) {
            start = range[0];
            end = range[range.length - 1];
        } else {
            start = range.start;
            end = range.end;
        }

        void fetchEvents(start, end);
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

    const showMoreComponent = useMemo(() => {
        function ShowMore(props: ShowMoreProps<Event>) {
            return <CalendarShowMoreButton {...props} isOpen={overflowPopover?.date.getTime() === props.slotDate.getTime()} onOpen={openOverflow} />;
        }

        return ShowMore;
    }, [overflowPopover?.date, openOverflow]);

    return (
        <CalendarExportContext.Provider value={{ canExport, exporting, onExport: handleExportPdf }}>
            <div ref={calendarContainerRef} className="relative h-[60rem]">
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
                            event: (props) => <CustomEvent {...props} isDashboard={isDashboard} onEventClick={handleEventClick} />,
                            showMore: showMoreComponent,
                        }}
                        step={60}
                        timeslots={1}
                    />
                </div>
                {overflowPopover && (
                    <div aria-hidden="true" className="absolute inset-0 z-30 bg-background/60 dark:bg-black/50" onClick={closeOverflow} />
                )}
                {overflowPopover && (
                    <CalendarDayEventsPopover
                        date={overflowPopover.date}
                        events={overflowPopover.events}
                        containerRef={calendarContainerRef}
                        anchor={overflowPopover.cell}
                        trigger={overflowPopover.trigger}
                        isDashboard={isDashboard}
                        focusFirstRow={overflowPopover.focusFirstRow}
                        onClose={closeOverflow}
                        onOpenDayView={handleOpenDayView}
                    />
                )}
            </div>
            <PreviewModal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} data={previewData} isLoading={previewLoading} />
        </CalendarExportContext.Provider>
    );
}
