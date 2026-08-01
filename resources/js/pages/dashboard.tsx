import { Link, router, usePage } from '@inertiajs/react';
import axios from "axios";
import { ArrowUpRight, ArrowLeft, ArrowRight, Bell, ClipboardList, CirclePlus, MailOpen } from 'lucide-react';
import { ListFilter } from 'lucide-react';
import { ArrowDownUp } from 'lucide-react';
import moment from 'moment';
import { useState, useEffect, useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    Pie,
    PieChart,
} from 'recharts';
import { ActivityFeed } from '@/components/activity-feed';
import type { AuditLog } from '@/components/activity-feed';
import AvatarWithInitials from '@/components/avatar-with-initials';
import FacilityCalendar from '@/components/FacilityCalendar';
import RequestCard from '@/components/request-card';
import SmallRequestCard from '@/components/small-request-card';
import SmartPagination from "@/components/SmartPagination";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type {
    CarouselApi} from "@/components/ui/carousel";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious
} from "@/components/ui/carousel";
import type {
    ChartConfig} from '@/components/ui/chart';
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import { cn } from '@/lib/utils';
import type { Request as FacilityRequest } from '@/types/request';

interface Event {
    start: Date;
    end: Date;
    title: string;
    id: number;
    request_id: string | number;
    building: string;
}

type ChartRow = {
    date: string;
    total: number;
};

type InboxNotification = {
    id: string;
    title: string;
    body: string;
    url: string;
    category?: string | null;
    status?: string | null;
    created_at: string | null;
    read_at: string | null;
};

const chartConfig = {
    total: {
        label: 'Total Events',
        color: 'var(--primary)',
    },
} satisfies ChartConfig;

const eventLabels: Record<string, string> = {
    'auth.login': 'Login',
    'auth.login_failed': 'Failed Login',
    'auth.logout': 'Logout',
    'auth.password_reset_initiated': 'Password Reset by Admin',
    'auth.password_self_updated': 'Password Updated',
    'request.created': 'Request Created',
    'request.updated': 'Request Updated',
    'request.approved': 'Request Approved',
    'request.denied': 'Request Denied',
    'request.conditionally_approved': 'Cond. Approved',
    'request.held': 'Request Held',
    'request.comment_added': 'Comment Added',
    'request.marked_for_reschedule': 'Marked Reschedule',
    'request.file_uploaded': 'File Uploaded',
    'request.file_removed': 'File Removed',
};

function formatEventLabel(event: string): string {
    return eventLabels[event] ?? event
        .replace(/^[^.]+\./, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

const CHART_COLORS = [
    'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
    'var(--chart-4)', 'var(--chart-5)',
];

export default function Dashboard({
    pending,
    initialEvents,
    buildings,
    auditLogs: auditLogsProp,
    chartData,
    notifications: notificationsProp,
}: {
    pending: { data: FacilityRequest[] };
    approved: FacilityRequest[];
    denied: FacilityRequest[];
    initialEvents: Event[];
    buildings: string[];
    auditLogs: { data: AuditLog[]; current_page: number; last_page: number };
    chartData: ChartRow[];
    notifications: InboxNotification[];
}) {
    const [selectedBuildings, setSelectedBuildings] = useState<string[]>(buildings);
    const [range, setRange] = useState<'day' | 'week' | 'month' | '3months'>('week');
    const [data, setData] = useState<ChartRow[]>(chartData);
    const [loading, setLoading] = useState(false);
    const auth = usePage().props.auth;
    const { hasRole } = usePermission();
    const [logsLoading, setLogsLoading] = useState(false);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>(auditLogsProp.data ?? []);
    const [currentPage, setCurrentPage] = useState(auditLogsProp.current_page ?? 1);
    const [lastPage, setLastPage] = useState(auditLogsProp.last_page ?? 1);
    const [activeTab, setActiveTab] = useState('overview');
    const [notifications, setNotifications] = useState<InboxNotification[]>(notificationsProp ?? []);
    const [unreadCount, setUnreadCount] = useState(Number(auth.user.notification_unread_count ?? 0));
    const [markingNotificationsRead, setMarkingNotificationsRead] = useState(false);

    const fetchAuditLogs = async (page = 1, selectedRange = range) => {
        setLogsLoading(true);
        const res = await fetch(`/dashboard/audit-logs?range=${selectedRange}&page=${page}`);
        const json = await res.json();
        setAuditLogs(json.data);
        setCurrentPage(json.current_page);
        setLastPage(json.last_page);
        setLogsLoading(false);
    };

    const markInboxRead = async () => {
        if (unreadCount === 0 || markingNotificationsRead) return;

        setMarkingNotificationsRead(true);
        try {
            await axios.post('/dashboard/notifications/mark-read');
            const readAt = new Date().toISOString();
            setNotifications(prev => prev.map(notification => ({
                ...notification,
                read_at: notification.read_at ?? readAt,
            })));
            setUnreadCount(0);
            router.reload({ only: ['auth'] });
        } finally {
            setMarkingNotificationsRead(false);
        }
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);

        if (value === 'inbox') {
            void markInboxRead();
        }
    };

    const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
    const [canScrollNext, setCanScrollNext] = useState(false);
    const [canScrollPrev, setCanScrollPrev] = useState(false);

    const [pendingConflictApi, setPendingConflictApi] = useState<CarouselApi | null>(null);
    const [pendingConflictCanScrollNext, setPendingConflictCanScrollNext] = useState(false);
    const [pendingConflictCanScrollPrev, setPendingConflictCanScrollPrev] = useState(false);

    const [approvedConflictApi, setApprovedConflictApi] = useState<CarouselApi | null>(null);
    const [approvedConflictCanScrollNext, setApprovedConflictCanScrollNext] = useState(false);
    const [approvedConflictCanScrollPrev, setApprovedConflictCanScrollPrev] = useState(false);

    const [logFilter, setLogFilter] = useState<string>('all');
    const [logSort, setLogSort] = useState<'newest' | 'oldest'>('newest');

    const filteredLogs = useMemo(() => {
        let logs = [...auditLogs];
        if (logFilter !== 'all') {
            logs = logs.filter(log => log.event === logFilter);
        }
        logs.sort((a, b) => {
            const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            return logSort === 'newest' ? -diff : diff;
        });
        return logs;
    }, [auditLogs, logFilter, logSort]);

    useEffect(() => {
        setLoading(true);

        fetch(`/dashboard/chart-data?range=${range}`)
            .then(r => r.json())
            .then(chartJson => setData(fillDateRange(chartJson, range)))
            .finally(() => setLoading(false));

        fetchAuditLogs(1, range);
    }, [range]);

    useEffect(() => {
        if (!carouselApi) return;
        const update = () => {
            setCanScrollNext(carouselApi.canScrollNext());
            setCanScrollPrev(carouselApi.canScrollPrev());
        };
        update();
        carouselApi.on("select", update);
        carouselApi.on("reInit", update);
        return () => { carouselApi.off("select", update); };
    }, [carouselApi]);

    useEffect(() => {
        if (!pendingConflictApi) return;
        const update = () => {
            setPendingConflictCanScrollNext(pendingConflictApi.canScrollNext());
            setPendingConflictCanScrollPrev(pendingConflictApi.canScrollPrev());
        };
        update();
        pendingConflictApi.on("select", update);
        pendingConflictApi.on("reInit", update);
        return () => { pendingConflictApi.off("select", update); };
    }, [pendingConflictApi]);

    useEffect(() => {
        if (!approvedConflictApi) return;
        const update = () => {
            setApprovedConflictCanScrollNext(approvedConflictApi.canScrollNext());
            setApprovedConflictCanScrollPrev(approvedConflictApi.canScrollPrev());
        };
        update();
        approvedConflictApi.on("select", update);
        approvedConflictApi.on("reInit", update);
        return () => { approvedConflictApi.off("select", update); };
    }, [approvedConflictApi]);

    const isAdmin: boolean = hasRole("admin") || hasRole("Super Admin");

    const rangeOptions = {
        day: "Today",
        week: 'Last 7 days',
        month: 'This month',
        '3months': 'Last 3 months',
    } as const;

    const rangeLabel = rangeOptions[range];

    const toggleBuilding = (building: string) => {
        setSelectedBuildings(prev =>
            prev.includes(building)
                ? prev.filter(b => b !== building)
                : [...prev, building]
        );
    };

    const filteredEvents = useMemo(() => {
        return initialEvents.filter(e =>
            !e.building || selectedBuildings.includes(e.building)
        );
    }, [initialEvents, selectedBuildings]);

    const pendingConflictRequests = pending.data.filter(
        r => r.pending_conflicts && r.pending_conflicts.length > 0
    );
    const approvedConflictRequests = pending.data.filter(
        r => r.approved_conflicts && r.approved_conflicts.length > 0
    );

    const pieData = useMemo(() => {
        const counts: Record<string, number> = {};
        auditLogs.forEach(log => {
            const key = typeof log.event === 'object' ? (log.event as any).value ?? String(log.event) : String(log.event);
            counts[key] = (counts[key] ?? 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([event, count], i) => ({
                event,
                label: formatEventLabel(event),
                count,
                fill: CHART_COLORS[i % CHART_COLORS.length],
            }));
    }, [auditLogs]);

    const pieChartConfig = useMemo(() => {
        const config: ChartConfig = { count: { label: 'Events' } };
        pieData.forEach((row, i) => {
            config[row.event] = {
                label: row.label,
                color: CHART_COLORS[i % CHART_COLORS.length],
            };
        });
        return config;
    }, [pieData]);

    function fillDateRange(data: ChartRow[], range: 'day' | 'week' | 'month' | '3months'): ChartRow[] {
        if (range === 'day') {
            const dataMap = new Map(data.map(d => [d.date, d.total]));
            return Array.from({ length: 24 }, (_, i) => {
                const hour = String(i).padStart(2, '0') + ':00';
                return { date: hour, total: dataMap.get(hour) ?? 0 };
            });
        }

        const days = range === 'week' ? 7 : range === 'month' ? 30 : 90;
        const filled: ChartRow[] = [];
        const dataMap = new Map(data.map(d => [d.date, d.total]));
        for (let i = days - 1; i >= 0; i--) {
            const date = moment.utc().subtract(i, 'days').format('YYYY-MM-DD');
            filled.push({ date, total: dataMap.get(date) ?? 0 });
        }
        return filled;
    }


    return (
        <DefaultLayout hasPadding={false}>
            <div className="flex flex-col p-6 md:p-8">
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsList variant="line">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="calendar">Schedule</TabsTrigger>
                        <TabsTrigger value="activity">Activity</TabsTrigger>
                        <TabsTrigger value="inbox">
                            <span className="relative">
                                Inbox
                                {unreadCount > 0 && (
                                    <span className="absolute -right-2 -top-1 size-2 rounded-full bg-red-500" />
                                )}
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-4 flex flex-col gap-10">
                        <div className="flex gap-4 items-center">
                            <AvatarWithInitials className='border' username={auth.user.name} avatarSrc={auth.user.profile} />
                            <div className="flex flex-col gap-0.5">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Welcome back</p>
                                <h1 className='text-3xl font-bold tracking-tight'>{auth.user.name}</h1>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Carousel
                                opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }}
                                className="w-full"
                                setApi={setCarouselApi}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex flex-col gap-0.5">
                                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                            {isAdmin ? "Queue" : "Your Queue"}
                                        </p>
                                        <h2 className='text-base font-semibold tracking-tight'>
                                            {isAdmin ? "Pending Requests" : "Your Pending Requests"}
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="size-8 rounded-full"
                                            onClick={() => carouselApi?.scrollPrev()}
                                            disabled={!canScrollPrev}
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="size-8 rounded-full"
                                            onClick={() => carouselApi?.scrollNext()}
                                            disabled={!canScrollNext}
                                        >
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="relative">
                                    {/* Left fade */}
                                    <div className={cn(
                                        "pointer-events-none absolute left-0 top-0 h-full w-16 z-10 bg-gradient-to-r from-background to-transparent transition-opacity duration-300",
                                        canScrollPrev ? "opacity-100" : "opacity-0"
                                    )} />
                                    {/* Right fade */}
                                    <div className={cn(
                                        "pointer-events-none absolute right-0 top-0 h-full w-16 z-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-300",
                                        canScrollNext ? "opacity-100" : "opacity-0"
                                    )} />

                                    {pending.data.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center gap-3 py-10 border rounded-lg border-dashed text-center">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                                                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <p className="text-sm font-semibold">No pending requests</p>
                                                <p className="text-sm text-muted-foreground">You're all caught up! Submit a new facility request to get started.</p>
                                            </div>
                                            <Link href={route("request.create")}>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="mt-1 gap-2 relative isolate overflow-hidden border-primary text-primary bg-transparent hover:bg-transparent hover:text-primary-foreground before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:bg-primary before:transition-transform before:duration-300 before:ease-out hover:before:scale-x-100"
                                                >
                                                    <CirclePlus className="h-4 w-4 z-10" />
                                                    <span className="z-10">Create Request</span>
                                                </Button>
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <div className={cn(
                                                "pointer-events-none absolute left-0 top-0 h-full w-16 z-10 bg-gradient-to-r from-background to-transparent transition-opacity duration-300",
                                                canScrollPrev ? "opacity-100" : "opacity-0"
                                            )} />
                                            <div className={cn(
                                                "pointer-events-none absolute right-0 top-0 h-full w-16 z-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-300",
                                                canScrollNext ? "opacity-100" : "opacity-0"
                                            )} />
                                            <CarouselContent className="-ml-4">
                                                {pending.data.map(request => (
                                                    <CarouselItem key={request.id} className="pl-4 basis-auto">
                                                        <SmallRequestCard request={request} className='min-w-[400px] max-w-[400px]' />
                                                    </CarouselItem>
                                                ))}
                                                <CarouselItem className="pl-4 basis-auto">
                                                    <Link href={route("requests.index", { status: "pending" })}>
                                                        <div className="min-w-[160px] max-w-[160px] h-full min-h-[160px] border rounded-lg flex flex-col items-center justify-center gap-2 text-sm font-semibold hover:bg-muted transition-colors cursor-pointer">
                                                            <ArrowUpRight size={20} />
                                                            <span>See All</span>
                                                        </div>
                                                    </Link>
                                                </CarouselItem>
                                            </CarouselContent>
                                        </div>
                                    )}
                                </div>
                            </Carousel>
                        </div>

                        {(pendingConflictRequests.length > 0 || approvedConflictRequests.length > 0) && (
                            <div className="flex flex-col gap-6">
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Attention needed</p>
                                    <h2 className="text-base font-semibold tracking-tight">Requests with Conflicts</h2>
                                </div>

                                {pendingConflictRequests.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        <Carousel
                                            opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }}
                                            className="w-full"
                                            setApi={setPendingConflictApi}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                                                        Pending Conflicts
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {pendingConflictRequests.length} request{pendingConflictRequests.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="size-8 rounded-full"
                                                        onClick={() => carouselApi?.scrollPrev()}
                                                        disabled={!canScrollPrev}
                                                    >
                                                        <ArrowLeft className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="size-8 rounded-full"
                                                        onClick={() => carouselApi?.scrollNext()}
                                                        disabled={!canScrollNext}
                                                    >
                                                        <ArrowRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="relative">
                                                <div className={cn(
                                                    "pointer-events-none absolute left-0 top-0 h-full w-16 z-10 bg-gradient-to-r from-background to-transparent transition-opacity duration-300",
                                                    pendingConflictCanScrollPrev ? "opacity-100" : "opacity-0"
                                                )} />
                                                <div className={cn(
                                                    "pointer-events-none absolute right-0 top-0 h-full w-16 z-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-300",
                                                    pendingConflictCanScrollNext ? "opacity-100" : "opacity-0"
                                                )} />

                                                <CarouselContent className="-ml-4">
                                                    {pendingConflictRequests.map(request => (
                                                        <CarouselItem key={request.id} className="pl-4 basis-auto">
                                                            <SmallRequestCard
                                                                request={request}
                                                                className="min-w-[400px] max-w-[400px] border-yellow-300 dark:border-yellow-700"
                                                            />
                                                        </CarouselItem>
                                                    ))}
                                                </CarouselContent>
                                            </div>
                                        </Carousel>
                                    </div>
                                )}

                                {approvedConflictRequests.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        <Carousel
                                            opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }}
                                            className="w-full"
                                            setApi={setApprovedConflictApi}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                        Approved Conflicts
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {approvedConflictRequests.length} request{approvedConflictRequests.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="size-8 rounded-full"
                                                        onClick={() => carouselApi?.scrollPrev()}
                                                        disabled={!canScrollPrev}
                                                    >
                                                        <ArrowLeft className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="size-8 rounded-full"
                                                        onClick={() => carouselApi?.scrollNext()}
                                                        disabled={!canScrollNext}
                                                    >
                                                        <ArrowRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="relative">
                                                <div className={cn(
                                                    "pointer-events-none absolute left-0 top-0 h-full w-16 z-10 bg-gradient-to-r from-background to-transparent transition-opacity duration-300",
                                                    approvedConflictCanScrollPrev ? "opacity-100" : "opacity-0"
                                                )} />
                                                <div className={cn(
                                                    "pointer-events-none absolute right-0 top-0 h-full w-16 z-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-300",
                                                    approvedConflictCanScrollNext ? "opacity-100" : "opacity-0"
                                                )} />

                                                <CarouselContent className="-ml-4">
                                                    {approvedConflictRequests.map(request => (
                                                        <CarouselItem key={request.id} className="pl-4 basis-auto">
                                                            <SmallRequestCard
                                                                request={request}
                                                                className="min-w-[400px] max-w-[400px] border-red-300 dark:border-red-700"
                                                            />
                                                        </CarouselItem>
                                                    ))}
                                                </CarouselContent>
                                            </div>
                                        </Carousel>
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="calendar">
                        <div className="mt-4">
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                                <h2 className="font-semibold text-sm text-foreground">Facility Calendar Schedule</h2>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                                            <ListFilter className="h-4 w-4" />
                                            <span>Filter Buildings</span>
                                            {selectedBuildings.length < buildings.length && (
                                                <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs w-4 h-4 flex items-center justify-center">
                                                    {selectedBuildings.length}
                                                </span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-3" align="end">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-sm font-semibold">Buildings</p>
                                            <button
                                                className="text-xs text-muted-foreground hover:text-foreground"
                                                onClick={() =>
                                                    selectedBuildings.length === buildings.length
                                                        ? setSelectedBuildings([])
                                                        : setSelectedBuildings(buildings)
                                                }
                                            >
                                                {selectedBuildings.length === buildings.length ? 'Deselect all' : 'Select all'}
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {buildings.map(building => (
                                                <div key={building} className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`building-${building}`}
                                                        checked={selectedBuildings.includes(building)}
                                                        onCheckedChange={() => toggleBuilding(building)}
                                                    />
                                                    <label
                                                        htmlFor={`building-${building}`}
                                                        className="text-sm cursor-pointer"
                                                    >
                                                        {building}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <FacilityCalendar
                                facilityId={0}
                                initialEvents={initialEvents}
                                calendarRoute="dashboard.calendar"
                                filterBuildings={selectedBuildings}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="activity">
                        <div className="flex flex-col gap-8 mt-6">
                            {/* Header row */}
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div className="flex flex-col gap-0.5">
                                    <h2 className="font-bold text-xl tracking-tight">Activity Report</h2>
                                    <p className="text-sm text-muted-foreground">{rangeLabel} — system events over time</p>
                                </div>

                                <Select value={range} onValueChange={val => setRange(val as typeof range)}>
                                    <SelectTrigger className="w-38 h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(Object.entries(rangeOptions) as [typeof range, string][]).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-2 xl:grid grid-cols-[5fr_3fr]">

                                {/* Chart */}
                                <Card className="overflow-hidden">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-semibold">Events per day</CardTitle>
                                            <div className="flex items-center gap-1.5">
                                                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                                                <span className="text-sm text-muted-foreground">Total events</span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="px-2 pb-4">

                                        {loading ? (
                                            <div className="h-[300px] flex items-center justify-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                                    <p className="text-sm text-muted-foreground">Fetching data...</p>
                                                </div>
                                            </div>
                                        ) : data.length === 0 ? (
                                            <div className="h-[300px] flex items-center justify-center">
                                                <p className="text-sm text-muted-foreground">No activity in this period.</p>
                                            </div>
                                        ) : (
                                            <ChartContainer config={chartConfig} className="h-[300px] w-full px-2 pb-4">
                                                <AreaChart
                                                    data={data}
                                                    margin={{ top: 10, right: 16, left: -10, bottom: 0 }}
                                                >
                                                    <defs>
                                                        <linearGradient id="fill-total" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                                                            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <XAxis
                                                        dataKey="date"
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickMargin={10}
                                                        interval={range === 'day' ? 2 : "preserveStartEnd"}
                                                        minTickGap={range === 'day' ? 0 : 40}
                                                        tickFormatter={(val) => {
                                                            if (range === 'day') {
                                                                const h = parseInt(val);
                                                                if (h % 4 !== 0 && h !== 23) return '';
                                                                return moment(val, "HH:mm").format("h A");
                                                            }
                                                            return moment(val).format("MMM D");
                                                        }}
                                                    />
                                                    <YAxis
                                                        tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                                                        dataKey="total"
                                                        tickLine={false}
                                                        tickMargin={10}
                                                    />
                                                    <ChartTooltip
                                                        cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.5 }}
                                                        content={
                                                            <ChartTooltipContent
                                                                labelFormatter={val => range === 'day'
                                                                    ? `Today at ${moment(val, "HH:mm").format("h:mm A")}`
                                                                    : moment(val).format("dddd, MMM D YYYY")
                                                                }
                                                            />
                                                        }
                                                    />
                                                    <Area
                                                        type="monotoneX"
                                                        dataKey="total"
                                                        stroke="var(--primary)"
                                                        fill="url(#fill-total)"
                                                        strokeWidth={2}
                                                        dot={false}
                                                        activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--background)', strokeWidth: 2 }}
                                                    />
                                                </AreaChart>
                                            </ChartContainer>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="overflow-hidden">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-semibold">Activity Breakdown</CardTitle>
                                        <CardDescription>Distribution of activity types in this period</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col md:flex-row items-center gap-4">
                                            {!logsLoading && pieData.length > 0 && (
                                                <div className="flex flex-col md:flex-row items-center gap-4 px-4 pb-5">
                                                    <ChartContainer
                                                        config={pieChartConfig}
                                                        className="mx-auto aspect-square max-h-[260px] min-w-[220px] [&_.recharts-pie-label-text]:fill-foreground"
                                                    >
                                                        <PieChart>
                                                            <ChartTooltip
                                                                content={
                                                                    <ChartTooltipContent
                                                                        nameKey="event"
                                                                        hideLabel
                                                                    />
                                                                }
                                                            />
                                                            <Pie
                                                                data={pieData}
                                                                dataKey="count"
                                                                nameKey="event"
                                                            />
                                                        </PieChart>
                                                    </ChartContainer>

                                                    {/* Legend */}
                                                    <div className="flex flex-col gap-2 w-full">
                                                        {pieData.map((row, i) => (
                                                            <div key={row.event} className="flex items-center justify-between gap-2 text-xs">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span
                                                                        className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                                                                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                                                                    />
                                                                    <span className="truncate text-muted-foreground">{row.label}</span>
                                                                </div>
                                                                <span className="font-semibold tabular-nums shrink-0">{row.count}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>


                            {logsLoading ? (
                                <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                    Loading activity...
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {/* Filter + Sort bar */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className={cn(
                                                        "flex items-center gap-2",
                                                        logSort !== 'newest' && "border-primary text-primary bg-primary/5"
                                                    )}
                                                >
                                                    <ArrowDownUp size={14} />
                                                    <span>Sort By</span>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="p-0 w-44" align="start">
                                                <p className="px-3 pt-3 pb-1 text-xs text-muted-foreground font-semibold">Sort By</p>
                                                <div className="flex flex-col p-1">
                                                    {([
                                                        { label: 'Newest first', value: 'newest' },
                                                        { label: 'Oldest first', value: 'oldest' },
                                                    ] as const).map(opt => (
                                                        <Button
                                                            key={opt.value}
                                                            variant={logSort === opt.value ? 'secondary' : 'ghost'}
                                                            size="sm"
                                                            className="justify-start w-full px-2"
                                                            onClick={() => setLogSort(opt.value)}
                                                        >
                                                            {opt.label}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>

                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className={cn(
                                                        "flex items-center gap-2",
                                                        logFilter !== 'all' && "border-primary text-primary bg-primary/5"
                                                    )}
                                                >
                                                    <ListFilter size={14} />
                                                    <span>Filter</span>
                                                    {logFilter !== 'all' && (
                                                        <span className="flex items-center justify-center bg-primary/12 text-primary h-4 min-w-[16px] px-1 rounded-full text-[10px] font-medium">
                                                            1
                                                        </span>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="p-0 w-52" align="start">
                                                <div className="flex flex-col gap-1 p-3 max-h-72 overflow-y-auto">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <p className="text-xs text-muted-foreground font-semibold">Event Type</p>
                                                        {logFilter !== 'all' && (
                                                            <button
                                                                className="text-xs text-primary hover:underline"
                                                                onClick={() => setLogFilter('all')}
                                                            >
                                                                Clear
                                                            </button>
                                                        )}
                                                    </div>
                                                    {[{ label: 'All event types', value: 'all' }, ...Object.keys(eventLabels).map((value) => ({ value, label: formatEventLabel(value) }))].map(opt => (
                                                        <label
                                                            key={opt.value}
                                                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                                                        >
                                                            <input
                                                                type="radio"
                                                                name="log-filter"
                                                                className="accent-primary"
                                                                checked={logFilter === opt.value}
                                                                onChange={() => setLogFilter(opt.value)}
                                                            />
                                                            {opt.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>

                                        <span className="ml-auto text-xs text-muted-foreground">
                                            {filteredLogs.length} event{filteredLogs.length !== 1 ? 's' : ''} · page {currentPage} of {lastPage}
                                        </span>
                                    </div>

                                    {filteredLogs.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-4">No events match the current filter.</p>
                                    ) : (
                                        <>
                                            <ActivityFeed auditLogs={filteredLogs} />
                                            <SmartPagination
                                                currentPage={currentPage}
                                                lastPage={lastPage}
                                                onPageChange={(page) => fetchAuditLogs(page, range)}
                                            />
                                        </>
                                    )}
                                </div>
                            )}

                        </div>
                    </TabsContent>

                    <TabsContent value="inbox">
                        <div className="mt-6 flex flex-col gap-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex flex-col gap-0.5">
                                    <h2 className="font-bold text-xl tracking-tight">Notification Inbox</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Recent request notifications sent to your account.
                                    </p>
                                </div>
                                {markingNotificationsRead && (
                                    <span className="text-xs text-muted-foreground">Marking as seen...</span>
                                )}
                            </div>

                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
                                    <div className="flex size-11 items-center justify-center rounded-full bg-muted">
                                        <MailOpen className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm font-semibold">No notifications yet</p>
                                        <p className="text-sm text-muted-foreground">New request updates will appear here.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {notifications.map(notification => {
                                        const isUnread = !notification.read_at;

                                        return (
                                            <Link
                                                key={notification.id}
                                                href={notification.url}
                                                className={cn(
                                                    "group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/60",
                                                    isUnread && "border-primary/40 bg-primary/5"
                                                )}
                                            >
                                                <div className={cn(
                                                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                                                    isUnread ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                )}>
                                                    <Bell className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold">{notification.title}</p>
                                                            <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                                                        </div>
                                                        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                                                    </div>
                                                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                                                        {isUnread && <span className="size-2 rounded-full bg-red-500" />}
                                                        <span>
                                                            {notification.created_at
                                                                ? moment(notification.created_at).fromNow()
                                                                : 'Recently'}
                                                        </span>
                                                        {notification.status && <span>- {notification.status}</span>}
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </DefaultLayout >
    );
}
