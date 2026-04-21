import { Button } from '@/components/ui/button';
import DefaultLayout from '@/layout.tsx/default.';
import { Link, usePage } from '@inertiajs/react';
import { ArrowUpRight } from 'lucide-react';
import moment from 'moment';
import FacilityCalendar from '@/components/FacilityCalendar';
import { Request as FacilityRequest } from '@/types/request';
import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ListFilter } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityFeed, AuditLog } from '@/components/activity-feed';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AvatarWithInitials from '@/components/avatar-with-initials';
import RequestCard from '@/components/request-card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { usePermission } from '@/hooks/use-permission';
import SmallRequestCard from '@/components/small-request-card';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
    CarouselApi,
} from "@/components/ui/carousel";
import { cn } from '@/lib/utils';

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

const chartConfig = {
    total: {
        label: 'Total Events',
        color: 'var(--primary)',
    },
} satisfies ChartConfig;

export default function Dashboard({
    pending,
    initialEvents,
    buildings,
    auditLogs: auditLogsProp,
    chartData,
}: {
    pending: { data: FacilityRequest[] };
    approved: FacilityRequest[];
    denied: FacilityRequest[];
    initialEvents: Event[];
    buildings: string[];
    auditLogs: AuditLog[];
    chartData: ChartRow[];
}) {
    const [selectedBuildings, setSelectedBuildings] = useState<string[]>(buildings);
    const [range, setRange] = useState<'week' | 'month' | '3months'>('week');
    const [data, setData] = useState<ChartRow[]>(chartData);
    const [loading, setLoading] = useState(false);
    const auth = usePage().props.auth;
    const { hasRole } = usePermission();
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>(auditLogsProp);
    const [logsLoading, setLogsLoading] = useState(false);

    const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
    const [canScrollNext, setCanScrollNext] = useState(false);
    const [canScrollPrev, setCanScrollPrev] = useState(false);

    const [pendingConflictApi, setPendingConflictApi] = useState<CarouselApi | null>(null);
    const [pendingConflictCanScrollNext, setPendingConflictCanScrollNext] = useState(false);
    const [pendingConflictCanScrollPrev, setPendingConflictCanScrollPrev] = useState(false);

    const [approvedConflictApi, setApprovedConflictApi] = useState<CarouselApi | null>(null);
    const [approvedConflictCanScrollNext, setApprovedConflictCanScrollNext] = useState(false);
    const [approvedConflictCanScrollPrev, setApprovedConflictCanScrollPrev] = useState(false);

    useEffect(() => {
        setLoading(true);
        setLogsLoading(true);

        Promise.all([
            fetch(`/dashboard/chart-data?range=${range}`).then(r => r.json()),
            fetch(`/dashboard/audit-logs?range=${range}`).then(r => r.json()),
        ]).then(([chartJson, logsJson]) => {
            setData(chartJson);
            setAuditLogs(logsJson);
        }).finally(() => {
            setLoading(false);
            setLogsLoading(false);
        });
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

    const isAdmin: boolean = hasRole("admin");

    const rangeOptions = {
        day: "Today",
        week: 'Last 7 days',
        month: 'This month',
        '3months': 'Last 3 months',
    } as const;

    const rangeLabel = rangeOptions[range];

    useEffect(() => {
        setLoading(true);
        fetch(`/dashboard/chart-data?range=${range}`)
            .then(res => res.json())
            .then(json => setData(json))
            .finally(() => setLoading(false));
    }, [range]);

    const toggleBuilding = (building: string) => {
        setSelectedBuildings(prev =>
            prev.includes(building)
                ? prev.filter(b => b !== building)
                : [...prev, building]
        );
    };

    const filteredEvents = initialEvents.filter(e =>
        selectedBuildings.includes(e.building)
    );

    const pendingConflictRequests = pending.data.filter(
        r => r.pending_conflicts && r.pending_conflicts.length > 0
    );
    const approvedConflictRequests = pending.data.filter(
        r => r.approved_conflicts && r.approved_conflicts.length > 0
    );

    return (
        <DefaultLayout hasPadding={false}>
            <div className="flex flex-col p-6 md:p-8">
                <Tabs defaultValue="overview">
                    <TabsList variant="line">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="calendar">Schedule</TabsTrigger>
                        <TabsTrigger value="reports">Reports</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
                        <div className="flex w-full">
                            <div className="flex gap-4">
                                <AvatarWithInitials className='border' username={auth.user.name} avatarSrc={auth.user.profile} />
                                <h1 className='text-4xl font-black tracking-tighter'>Hi {auth.user.name}!</h1>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Carousel
                                opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }}
                                className="w-full"
                                setApi={setCarouselApi}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <h2 className='text-lg font-bold tracking-tight'>
                                        {isAdmin ? "Pending Requests" : "Your Pending Requests"}
                                    </h2>
                                    <div className="flex items-center gap-1">
                                        <CarouselPrevious className="static translate-y-0" />
                                        <CarouselNext className="static translate-y-0" />
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
                            </Carousel>
                        </div>

                        {(pendingConflictRequests.length > 0 || approvedConflictRequests.length > 0) && (
                            <div className="flex flex-col gap-6">
                                <h2 className="text-lg font-bold tracking-tighter">Requests with Conflicts</h2>

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
                                                    <CarouselPrevious className="static translate-y-0" />
                                                    <CarouselNext className="static translate-y-0" />
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
                                                    <CarouselPrevious className="static translate-y-0" />
                                                    <CarouselNext className="static translate-y-0" />
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
                                initialEvents={filteredEvents}
                                calendarRoute="dashboard.calendar"
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="reports">
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

                            {/* Stat cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'Total Events', value: data.reduce((s, r) => s + r.total, 0) },
                                    { label: 'Peak Day', value: data.length ? Math.max(...data.map(r => r.total)) : 0 },
                                    { label: 'Avg / Day', value: data.length ? (data.reduce((s, r) => s + r.total, 0) / data.length).toFixed(1) : '—' },
                                    { label: 'Active Days', value: data.filter(r => r.total > 0).length },
                                ].map(stat => (
                                    <div
                                        key={stat.label}
                                        className="flex flex-col gap-1 rounded-xl border border-border bg-muted/30 p-4"
                                    >
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
                                        <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Chart */}
                            <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                                <div className="px-5 pt-5 pb-2 flex items-center justify-between">
                                    <p className="text-sm font-semibold">Events per day</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                                        <span className="text-xs text-muted-foreground">Total events</span>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="h-[300px] flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                            <p className="text-xs text-muted-foreground">Fetching data...</p>
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
                                            <CartesianGrid
                                                vertical={false}
                                                stroke="var(--border)"
                                                strokeDasharray="4 4"
                                                strokeOpacity={0.6}
                                            />
                                            <XAxis
                                                dataKey="date"
                                                tickLine={false}
                                                axisLine={false}
                                                tickMargin={10}
                                                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                                tickFormatter={val => moment(val).format("MMM D")}
                                            />
                                            <YAxis
                                                tickLine={false}
                                                axisLine={false}
                                                tickMargin={8}
                                                allowDecimals={false}
                                                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                                width={32}
                                            />
                                            <ChartTooltip
                                                cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.5 }}
                                                content={
                                                    <ChartTooltipContent
                                                        labelFormatter={val => moment(val).format("dddd, MMM D YYYY")}
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
                            </div>

                            {logsLoading ? (
                                <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                    Loading activity...
                                </div>
                            ) : (
                                <ActivityFeed auditLogs={auditLogs} />
                            )}

                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </DefaultLayout >
    );
}