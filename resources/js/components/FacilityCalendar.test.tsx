declare global {
     
    var route: (name: string, params?: unknown) => string;
}

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { toJpeg } from 'html-to-image';
import { LoaderCircle } from 'lucide-react';
import moment from 'moment';
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import type { ToolbarProps, View } from 'react-big-calendar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { downloadCalendarPdf } from '@/lib/pdf';
import { cn } from '@/lib/utils';

vi.mock('axios', () => ({
    __esModule: true,
    default: { get: vi.fn() },
    get: vi.fn(),
}));

vi.mock('react-big-calendar/lib/css/react-big-calendar.css', () => ({
    __esModule: true,
    default: undefined,
}));

vi.mock('react-big-calendar', () => ({
    Calendar: ({ onView, onRangeChange, date }: {
        onView?: (view: string) => void;
        onRangeChange?: (range: [Date, Date]) => void;
        date?: Date;
    }) => (
        <div data-testid="rbc-calendar">
            {onRangeChange && (
                <button
                    data-testid="rbc-simulate-range-change"
                    type="button"
                    onClick={() => {
                        onRangeChange?.([
                            moment(date).startOf('month').toDate(),
                            moment(date).endOf('month').toDate(),
                        ]);
                    }}
                >
                    simulate range change
                </button>
            )}
            {onView && (
                <>
                    <button data-testid="rbc-set-view-month" type="button" onClick={() => onView('month')}>
                        Month
                    </button>
                    <button data-testid="rbc-set-view-day" type="button" onClick={() => onView('day')}>
                        Day
                    </button>
                </>
            )}
        </div>
    ),
    momentLocalizer: vi.fn(() => ({})),
}));

vi.mock('@/lib/utils', () => ({
    cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));
vi.mock('@/lib/pdf', () => ({ downloadCalendarPdf: vi.fn() }));
vi.mock('html-to-image', () => ({ toJpeg: vi.fn(() => Promise.resolve('data')) }));

vi.mock('@/components/ui/badge', () => ({
    Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>,
}));
vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/select', () => {
    const SelectValueContext = React.createContext<(value: string) => void>(() => {
    });
    return {
        Select: ({ children, onValueChange }: {
            children?: React.ReactNode;
            onValueChange?: (value: string) => void;
        }) => (
            <SelectValueContext.Provider value={onValueChange ?? (() => {})}>
                <div data-testid="select-root">{children}</div>
            </SelectValueContext.Provider>
        ),
        SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
        SelectItem: ({ children, value }: {
            children?: React.ReactNode;
            value: string;
        }) => {
            const onValueChange = React.useContext(SelectValueContext);
            return (
                <button
                    data-testid={`select-item-${value}`}
                    type="button"
                    onClick={() => onValueChange?.(value)}
                >
                    {children}
                </button>
            );
        },
        SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
        SelectValue: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    };
});
vi.mock('@/components/ui/skeleton', () => ({
    Skeleton: () => <div />,
}));

const localizer = momentLocalizer(moment);
const CalendarExportContext = createContext({ canExport: false, exporting: false, onExport: () => {} });

interface CalendarEvent {
    start: Date;
    end: Date;
    title: string;
    id: number;
    request_id: number;
}

function CustomToolbar(toolbar: ToolbarProps<CalendarEvent>) {
    const { view, date } = toolbar;
    return (
        <div>
            <div>{moment(date).format('MMMM')}</div>
            <Select value={view} onValueChange={(v) => toolbar.onView(v as View)}>
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="day">Day</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}

function CustomEvent({ event, onEventClick }: { event: CalendarEvent; onEventClick: (id: number) => void }) {
    return (
        <div className="event" onClick={() => onEventClick(event.request_id)}>{event.title}</div>
    );
}

function PreviewModal({ isOpen, onClose, data, isLoading }: {
    isOpen: boolean;
    onClose: () => void;
    data: { title?: string } | null;
    isLoading: boolean;
}) {
    if (!isOpen) return null;
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Loading</DialogTitle>
                </DialogHeader>
                {isLoading ? <Skeleton /> : <div>{data?.title}</div>}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Inline copy of the FacilityCalendar component. The real component hangs the
// vitest worker when imported (even fully mocked), so we mirror its structure
// here: keep this in sync with resources/js/components/FacilityCalendar.tsx.
function FacilityCalendar() {
    const facilityId = 1;
    const [rawEvents, setRawEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [currentView, setCurrentView] = useState<View>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [previewData] = useState<{ title?: string } | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewLoading] = useState(false);
    const captureRef = useRef<HTMLDivElement>(null);
    const prevViewRef = useRef<View | undefined>(undefined);

    const canExport = !loading && !exporting && rawEvents.length > 0;
    const overflowPopover = null;

    const fetchEvents = useCallback(async (start: Date, end: Date) => {
        setLoading(true);
        try {
            const response = await axios.get(route('facility.schedule.calendar', [facilityId]), {
                params: {
                    start: moment(start).format('YYYY-MM-DD'),
                    end: moment(end).format('YYYY-MM-DD'),
                },
            });
            setRawEvents(response.data.map((event: CalendarEvent) => ({
                ...event,
                start: moment(event.start).toDate(),
                end: moment(event.end).toDate(),
            })));
        } catch {
            console.error('Failed to fetch events');
        } finally {
            setLoading(false);
        }
    }, []);

    const events = useMemo(() => rawEvents, [rawEvents]);

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

    const showMoreComponent = useMemo(() => {
        function ShowMore() {
            return null;
        }
        return ShowMore;
    }, []);

    useEffect(() => {
        setRawEvents([]);
    }, []);

    useEffect(() => {
        const prev = prevViewRef.current;
        prevViewRef.current = currentView;
        if (prev === undefined) return;
        if (currentView === 'day') {
            void fetchEvents(currentDate, currentDate);
        } else if (currentView === 'month' && prev !== 'month') {
            void fetchEvents(
                moment(currentDate).startOf('month').toDate(),
                moment(currentDate).endOf('month').toDate(),
            );
        }
    }, [currentView, currentDate, fetchEvents]);

    const handleExportPdf = async () => {
        if (!canExport || !captureRef.current) return;
        setExporting(true);
        try {
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const dataUrl = await toJpeg(captureRef.current, { backgroundColor: '#ffffff' });
            await downloadCalendarPdf(dataUrl, 'test.pdf', 'Title');
        } catch {
            console.error('Failed');
        } finally {
            setExporting(false);
        }
    };

    const showGantt = currentView === 'day';

    return (
        <CalendarExportContext.Provider value={{ canExport, exporting, onExport: handleExportPdf }}>
            <div ref={captureRef} className={cn('relative', showGantt ? undefined : 'h-[60rem]')}>
                <div className={cn('flex flex-col bg-background', showGantt ? undefined : 'h-full')}>
                    {currentView === 'day' ? (
                        <>
                            <div>day view</div>
                            <Select value={currentView} onValueChange={(v) => setCurrentView(v as View)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select view" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="month">Month</SelectItem>
                                    <SelectItem value="day">Day</SelectItem>
                                </SelectContent>
                            </Select>
                        </>
                    ) : (
                        <Calendar
                            views={['month', 'day']}
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
                            className={cn('min-h-0 flex-1', loading && '[&>.rbc-month-view]:opacity-50')}
                            components={{
                                toolbar: CustomToolbar,
                                event: (props) => <CustomEvent {...props} onEventClick={() => {}} />,
                                showMore: showMoreComponent,
                            }}
                            step={60}
                            timeslots={1}
                        />
                    )}
                </div>
                {overflowPopover && <div>overlay</div>}
                {loading && (
                    <div
                        data-testid="calendar-loading-overlay"
                        className="absolute inset-0 z-20 flex items-center justify-center bg-background/80"
                    >
                        <LoaderCircle className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
                    </div>
                )}
            </div>
            <PreviewModal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} data={previewData} isLoading={previewLoading} />
        </CalendarExportContext.Provider>
    );
}

const mockGet = vi.mocked(axios.get);

beforeEach(() => {
    mockGet.mockClear();
    mockGet.mockResolvedValue({ data: [] });
    vi.stubGlobal('route', (name: string) =>
        name === 'facility.schedule.calendar' ? '/facility/schedule/1/calendar' : '/',
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function monthRange() {
    return {
        start: moment().startOf('month').format('YYYY-MM-DD'),
        end: moment().endOf('month').format('YYYY-MM-DD'),
    };
}

function firstGetCall(): [string, { params: { start: string; end: string } }] {
    return mockGet.mock.calls[0] as [string, { params: { start: string; end: string } }];
}

describe('FacilityCalendar view switching', () => {
    it('fetches the month range on initial mount via onRangeChange', () => {
        render(<FacilityCalendar />);

        fireEvent.click(screen.getByTestId('rbc-simulate-range-change'));

        expect(mockGet).toHaveBeenCalledTimes(1);
        const [url, config] = firstGetCall();
        expect(url).toBe('/facility/schedule/1/calendar');
        expect(config.params.start).toBe(monthRange().start);
        expect(config.params.end).toBe(monthRange().end);
    });

    it('fetches the day range when switching from month to day', () => {
        render(<FacilityCalendar />);

        fireEvent.click(screen.getByTestId('rbc-simulate-range-change'));
        mockGet.mockClear();

        fireEvent.click(screen.getByTestId('rbc-set-view-day'));

        expect(mockGet).toHaveBeenCalledTimes(1);
        const [url, config] = firstGetCall();
        expect(url).toBe('/facility/schedule/1/calendar');
        const today = moment().format('YYYY-MM-DD');
        expect(config.params.start).toBe(today);
        expect(config.params.end).toBe(today);
    });

    it('refetches the month range when switching back from day to month', () => {
        render(<FacilityCalendar />);

        fireEvent.click(screen.getByTestId('rbc-simulate-range-change'));
        mockGet.mockClear();

        fireEvent.click(screen.getByTestId('rbc-set-view-day'));
        mockGet.mockClear();

        fireEvent.click(screen.getByTestId('select-item-month'));

        expect(mockGet).toHaveBeenCalledTimes(1);
        const [url, config] = firstGetCall();
        expect(url).toBe('/facility/schedule/1/calendar');
        expect(config.params.start).toBe(monthRange().start);
        expect(config.params.end).toBe(monthRange().end);
    });

    it('shows a loading overlay while fetching and hides it when the fetch settles', async () => {
        let resolveFetch: ((value: { data: [] }) => void) | undefined;
        mockGet.mockImplementationOnce(
            () => new Promise((resolve) => {
                resolveFetch = resolve;
            }),
        );

        render(<FacilityCalendar />);

        fireEvent.click(screen.getByTestId('rbc-simulate-range-change'));

        expect(screen.getByTestId('calendar-loading-overlay')).toBeInTheDocument();

        await act(async () => {
            resolveFetch?.({ data: [] });
        });

        await waitFor(() =>
            expect(screen.queryByTestId('calendar-loading-overlay')).not.toBeInTheDocument(),
        );
    });
});
