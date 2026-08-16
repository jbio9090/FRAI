import { Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    Activity,
    AlertTriangle,
    ArrowDownUp,
    ArrowUpRight,
    Bell,
    Calendar,
    CheckCircle2,
    CirclePlus,
    ClipboardList,
    ListFilter,
    MailOpen,
} from 'lucide-react';
import moment from 'moment';
import { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Pie, PieChart } from 'recharts';
import { ActivityFeed } from '@/components/activity-feed';
import type { AuditLog } from '@/components/activity-feed';
import FacilityCalendar from '@/components/FacilityCalendar';
import RequestRow from '@/components/request-row';
import SmartPagination from '@/components/SmartPagination';
import StatTile from '@/components/stat-tile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

type Kpis = {
    awaitingDecision: number;
    needsAction: number;
    approvedThisWeek: number;
    eventsToday: number;
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

const TABS = ['overview', 'calendar', 'activity', 'inbox'] as const;
type Tab = (typeof TABS)[number];

const chartConfig = {
    total: {
        label: 'Total Events',
        color: 'var(--primary)',
    },
} satisfies ChartConfig;

const CHART_COLORS = [
    'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
    'var(--chart-4)', 'var(--chart-5)',
];

function greetingFor(name: string): string {
    const hour = new Date().getHours();
    const time = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    return `${time}, ${name.split(' ')[0]}`;
}

function getInitialTab(): Tab {
    const tab = new URLSearchParams(window.location.search).get('tab') as Tab | null;
    return tab && TABS.includes(tab) ? tab : 'overview';
}

export default function Dashboard({
    pending,
    initialEvents,
    buildings,
    auditLogs: auditLogsProp,
    auditEvents,
    breakdown,
    chartData,
    notifications: notificationsProp,
    kpis,
}: {
    pending: { data: FacilityRequest[] };
    initialEvents: Event[];
    buildings: string[];
    auditLogs: { data: AuditLog[]; current_page: number; last_page: number; total: number };
    auditEvents: { value: string; label: string }[];
    breakdown: { event: string; label: string; count: number }[];
    chartData: ChartRow[];
    notifications: InboxNotification[];
    kpis: Kpis;
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
    const [totalLogs, setTotalLogs] = useState(auditLogsProp.total ?? 0);
    const [pieData, setPieData] = useState<{ event: string; label: string; count: number; fill: string }[]>(() =>
        (breakdown ?? []).map((row, i) => ({
            event: row.event,
            label: row.label,
            count: row.count,
            fill: CHART_COLORS[i % CHART_COLORS.length],
        }))
    );
    const [activeTab, setActiveTab] = useState<Tab>(getInitialTab);
    const [notifications, setNotifications] = useState<InboxNotification[]>(notificationsProp ?? []);
    const [unreadCount, setUnreadCount] = useState(Number(auth.user.notification_unread_count ?? 0));
    const [markingNotificationsRead, setMarkingNotificationsRead] = useState(false);

    const fetchAuditLogs = async (page = 1, selectedRange = range, event = logFilter, sort = logSort) => {
        setLogsLoading(true);
        const params = new URLSearchParams({ range: selectedRange, page: String(page), sort });
        if (event !== 'all') params.set('event', event);
        const res = await fetch(`/dashboard/audit-logs?${params.toString()}`);
        const json = await res.json();
        setAuditLogs(json.data);
        setCurrentPage(json.current_page);
        setLastPage(json.last_page);
        setTotalLogs(json.total);
        setPieData(
            (json.breakdown ?? []).map((row: { event: string; label: string; count: number }, i: number) => ({
                event: row.event,
                label: row.label,
                count: row.count,
                fill: CHART_COLORS[i % CHART_COLORS.length],
            }))
        );
        setLogsLoading(false);
    };

    const markInboxRead = async () => {
        if (unreadCount === 0 || markingNotificationsRead) return;

        setMarkingNotificationsRead(true);
        try {
            await axios.post('/dashboard/notifications/mark-read');
            const readAt = new Date().toISOString();
            setNotifications((prev) => prev.map((notification) => ({
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
        setActiveTab(value as Tab);

        if (value === 'inbox') {
            void markInboxRead();
        }
    };

    const [logFilter, setLogFilter] = useState<string>('all');
    const [logSort, setLogSort] = useState<'newest' | 'oldest'>('newest');

    useEffect(() => {
        setLoading(true);

        fetch(`/dashboard/chart-data?range=${range}`)
            .then((r) => r.json())
            .then((chartJson) => setData(fillDateRange(chartJson, range)))
            .finally(() => setLoading(false));

        fetchAuditLogs(1, range, logFilter, logSort);
    }, [range, logFilter, logSort]);

    const isAdmin: boolean = hasRole('admin') || hasRole('Super Admin');

    const rangeOptions = {
        day: 'Today',
        week: 'Last 7 days',
        month: 'This month',
        '3months': 'Last 3 months',
    } as const;

    const rangeLabel = rangeOptions[range];

    const toggleBuilding = (building: string) => {
        setSelectedBuildings((prev) =>
            prev.includes(building)
                ? prev.filter((b) => b !== building)
                : [...prev, building]
        );
    };

    const pendingConflictRequests = pending.data.filter(
        (r) => r.pending_conflicts && r.pending_conflicts.length > 0
    );
    const approvedConflictRequests = pending.data.filter(
        (r) => r.approved_conflicts && r.approved_conflicts.length > 0
    );

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
            const dataMap = new Map(data.map((d) => [d.date, d.total]));
            return Array.from({ length: 24 }, (_, i) => {
                const hour = String(i).padStart(2, '0') + ':00';
                return { date: hour, total: dataMap.get(hour) ?? 0 };
            });
        }

        const days = range === 'week' ? 7 : range === 'month' ? 30 : 90;
        const filled: ChartRow[] = [];
        const dataMap = new Map(data.map((d) => [d.date, d.total]));
        for (let i = days - 1; i >= 0; i--) {
            const date = moment.utc().subtract(i, 'days').format('YYYY-MM-DD');
            filled.push({ date, total: dataMap.get(date) ?? 0 });
        }
        return filled;
    }

    const roles = auth.user.roles?.length ? auth.user.roles : ['Member'];
    const cardClass = 'rounded-lg border-border shadow-none';

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
                                    <span className="absolute -right-2 -top-1 size-2 rounded-full bg-[var(--primary)]" />
                                )}
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Overview ─────────────────────────────────────────── */}
                    <TabsContent value="overview" className="mt-6 flex flex-col gap-6">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div className="flex flex-col gap-1">
                                <p className="ads-eyebrow">
                                    {moment().format('dddd, MMMM D')}
                                </p>
                                <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                                    {greetingFor(auth.user.name)}
                                </h1>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-[4px] bg-[var(--ads-neutral-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--ads-neutral)] capitalize">
                                    {roles.join(', ')}
                                </span>
                                <Button size="sm" asChild>
                                    <Link href={route('request.create')}>
                                        <CirclePlus className="h-4 w-4" />
                                        New request
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        {/* KPI strip */}
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {isAdmin ? (
                                <>
                                    <StatTile
                                        variant="accent"
                                        icon={ClipboardList}
                                        label="Awaiting decision"
                                        value={kpis.awaitingDecision}
                                        sub="pending requests"
                                    />
                                    <StatTile
                                        variant={kpis.needsAction > 0 ? 'warning' : 'default'}
                                        icon={AlertTriangle}
                                        label="Needs action"
                                        value={kpis.needsAction}
                                        sub="conflicts to review"
                                    />
                                    <StatTile
                                        icon={CheckCircle2}
                                        label="Approved this week"
                                        value={kpis.approvedThisWeek}
                                        sub="last 7 days"
                                    />
                                    <StatTile
                                        icon={Calendar}
                                        label="Events today"
                                        value={kpis.eventsToday}
                                        sub={`${buildings.length} buildings`}
                                    />
                                </>
                            ) : (
                                <>
                                    <StatTile
                                        variant="accent"
                                        icon={ClipboardList}
                                        label="My pending"
                                        value={kpis.awaitingDecision}
                                        sub="requests"
                                    />
                                    <StatTile
                                        icon={CheckCircle2}
                                        label="My approved this week"
                                        value={kpis.approvedThisWeek}
                                        sub="last 7 days"
                                    />
                                    <StatTile
                                        icon={Calendar}
                                        label="My events today"
                                        value={kpis.eventsToday}
                                        sub="bookings"
                                    />
                                </>
                            )}
                        </div>

                        {/* Conflict banners */}
                        {(isAdmin && (pendingConflictRequests.length > 0 || approvedConflictRequests.length > 0)) && (
                            <div className="flex flex-col gap-2">
                                {pendingConflictRequests.length > 0 && (
                                    <Link
                                        href={route('requests.index', { status: 'pending', has_pending_conflicts: '1' })}
                                        className="flex items-center gap-3 rounded-lg border border-[var(--ads-amber)]/40 bg-[var(--ads-amber-bg)]/20 px-4 py-3 transition-colors hover:bg-[var(--ads-amber-bg)]/70"
                                    >
                                        <span className="size-2 shrink-0 rounded-full bg-[var(--ads-amber)]" />
                                        <span className="text-sm font-semibold text-[var(--ads-amber)]">
                                            Pending conflicts
                                        </span>
                                        <span className="text-xs text-[var(--ads-amber)]/80">
                                            {pendingConflictRequests.length} request{pendingConflictRequests.length !== 1 ? 's' : ''} need review
                                        </span>
                                        <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-[var(--ads-amber)]" />
                                    </Link>
                                )}
                                {approvedConflictRequests.length > 0 && (
                                    <Link
                                        href={route('requests.index', { status: 'approved', has_approved_conflicts: '1' })}
                                        className="flex items-center gap-3 rounded-lg border border-[var(--ads-danger)]/40 bg-[var(--ads-danger-bg)] px-4 py-3 transition-colors hover:bg-[var(--ads-danger-bg)]/70"
                                    >
                                        <span className="size-2 shrink-0 rounded-full bg-[var(--ads-danger)]" />
                                        <span className="text-sm font-semibold text-[var(--ads-danger)]">
                                            Approved conflicts
                                        </span>
                                        <span className="text-xs text-[var(--ads-danger)]/80">
                                            {approvedConflictRequests.length} request{approvedConflictRequests.length !== 1 ? 's' : ''} need review
                                        </span>
                                        <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-[var(--ads-danger)]" />
                                    </Link>
                                )}
                            </div>
                        )}

                        {/* Queue + live activity */}
                        <div className="grid items-start gap-4 lg:grid-cols-[5fr_3fr]">
                            <Card className={cardClass}>
                                <CardHeader className="flex w-full items-start justify-between space-y-0 border-b border-border">
                                    <div>
                                        <CardTitle className="text-sm font-semibold">
                                            {isAdmin ? 'Pending requests' : 'Your pending requests'}
                                        </CardTitle>
                                        <CardDescription>
                                            {isAdmin ? 'Awaiting a decision' : 'Requests still being processed'}
                                        </CardDescription>
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <Button variant="outline" size="xs" className="w-[5.5rem] justify-center" asChild>
                                            <Link href={route('requests.index', { status: 'pending' })}>
                                                View all
                                                <ArrowUpRight className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                        <span className="text-xs text-muted-foreground">
                                            {pending.data.length} shown
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {pending.data.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                                            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                                                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <p className="text-sm font-semibold">No pending requests</p>
                                                <p className="text-sm text-muted-foreground">
                                                    You're all caught up! Submit a new facility request to get started.
                                                </p>
                                            </div>
                                            <Link href={route('request.create')}>
                                                <Button size="sm" variant="outline" className="mt-1 gap-2">
                                                    <CirclePlus className="h-4 w-4" />
                                                    Create Request
                                                </Button>
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col">
                                            {pending.data.slice(0, 6).map((request) => (
                                                <RequestRow key={request.id} request={request} />
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className={cardClass}>
                                <CardHeader className="flex items-start justify-between space-y-0 border-b border-border">
                                    <div>
                                        <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
                                            <Activity className="h-4 w-4 text-[var(--ads-ok)]" />
                                            Live activity
                                        </CardTitle>
                                        <CardDescription>Latest system events</CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="xs"
                                        className="w-[5.5rem] justify-center"
                                        onClick={() => setActiveTab('activity')}
                                    >
                                        View all
                                        <ArrowUpRight className="h-4 w-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <ActivityFeed auditLogs={auditLogs.slice(0, 6)} />
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* ── Schedule ─────────────────────────────────────────── */}
                    <TabsContent value="calendar">
                        <div className="mt-4">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <h2 className="text-sm font-semibold text-foreground">Facility Calendar Schedule</h2>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                                            <ListFilter className="h-4 w-4" />
                                            <span>Filter Buildings</span>
                                            {selectedBuildings.length < buildings.length && (
                                                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                                                    {selectedBuildings.length}
                                                </span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-3" align="end">
                                        <div className="mb-3 flex items-center justify-between">
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
                                            {buildings.map((building) => (
                                                <div key={building} className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`building-${building}`}
                                                        checked={selectedBuildings.includes(building)}
                                                        onCheckedChange={() => toggleBuilding(building)}
                                                    />
                                                    <label htmlFor={`building-${building}`} className="cursor-pointer text-sm">
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

                    {/* ── Activity ─────────────────────────────────────────── */}
                    <TabsContent value="activity">
                        <div className="mt-6 flex flex-col gap-8">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-col gap-0.5">
                                    <h2 className="text-xl font-bold tracking-tight">Activity Report</h2>
                                    <p className="text-sm text-muted-foreground">{rangeLabel} — system events over time</p>
                                </div>

                                <Select value={range} onValueChange={(val) => setRange(val as typeof range)}>
                                    <SelectTrigger className="h-8 w-38 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(Object.entries(rangeOptions) as [typeof range, string][]).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-2 xl:grid xl:grid-cols-[5fr_3fr]">
                                <Card className={cn(cardClass, 'overflow-hidden')}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-semibold">Events per day</CardTitle>
                                            <div className="flex items-center gap-1.5">
                                                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                                                <span className="text-sm text-muted-foreground">Total events</span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="px-2 pb-4">
                                        {loading ? (
                                            <div className="flex h-[300px] items-center justify-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                    <p className="text-sm text-muted-foreground">Fetching data...</p>
                                                </div>
                                            </div>
                                        ) : data.length === 0 ? (
                                            <div className="flex h-[300px] items-center justify-center">
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
                                                        interval={range === 'day' ? 2 : 'preserveStartEnd'}
                                                        minTickGap={range === 'day' ? 0 : 40}
                                                        tickFormatter={(val) => {
                                                            if (range === 'day') {
                                                                const h = parseInt(val);
                                                                if (h % 4 !== 0 && h !== 23) return '';
                                                                return moment(val, 'HH:mm').format('h A');
                                                            }
                                                            return moment(val).format('MMM D');
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
                                                                labelFormatter={(val) => range === 'day'
                                                                    ? `Today at ${moment(val, 'HH:mm').format('h:mm A')}`
                                                                    : moment(val).format('dddd, MMM D YYYY')
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

                                <Card className={cn(cardClass, 'overflow-hidden')}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-semibold">Activity Breakdown</CardTitle>
                                        <CardDescription>Distribution of activity types in this period</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col items-center gap-4 md:flex-row">
                                            {!logsLoading && pieData.length > 0 && (
                                                <div className="flex flex-col items-center gap-4 px-4 pb-5 md:flex-row">
                                                    <ChartContainer
                                                        config={pieChartConfig}
                                                        className="mx-auto aspect-square max-h-[260px] min-w-[220px] [&_.recharts-pie-label-text]:fill-foreground"
                                                    >
                                                        <PieChart>
                                                            <ChartTooltip
                                                                content={<ChartTooltipContent nameKey="event" hideLabel />}
                                                            />
                                                            <Pie
                                                                data={pieData}
                                                                dataKey="count"
                                                                nameKey="event"
                                                            />
                                                        </PieChart>
                                                    </ChartContainer>

                                                    <div className="flex w-full flex-col gap-2">
                                                        {pieData.map((row, i) => (
                                                            <div key={row.event} className="flex items-center justify-between gap-2 text-xs">
                                                                <div className="flex min-w-0 items-center gap-2">
                                                                    <span
                                                                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                                                                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                                                                    />
                                                                    <span className="truncate text-muted-foreground">{row.label}</span>
                                                                </div>
                                                                <span className="shrink-0 font-semibold tabular-nums">{row.count}</span>
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
                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    Loading activity...
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className={cn(
                                                        'flex items-center gap-2',
                                                        logSort !== 'newest' && 'border-primary bg-primary/5 text-primary'
                                                    )}
                                                >
                                                    <ArrowDownUp size={14} />
                                                    <span>Sort By</span>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-44 p-0" align="start">
                                                <p className="px-3 pb-1 pt-3 text-xs font-semibold text-muted-foreground">Sort By</p>
                                                <div className="flex flex-col p-1">
                                                    {([
                                                        { label: 'Newest first', value: 'newest' },
                                                        { label: 'Oldest first', value: 'oldest' },
                                                    ] as const).map((opt) => (
                                                        <Button
                                                            key={opt.value}
                                                            variant={logSort === opt.value ? 'secondary' : 'ghost'}
                                                            size="sm"
                                                            className="w-full justify-start px-2"
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
                                                        'flex items-center gap-2',
                                                        logFilter !== 'all' && 'border-primary bg-primary/5 text-primary'
                                                    )}
                                                >
                                                    <ListFilter size={14} />
                                                    <span>Filter</span>
                                                    {logFilter !== 'all' && (
                                                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/12 px-1 text-[10px] font-medium text-primary">
                                                            1
                                                        </span>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-52 p-0" align="start">
                                                <div className="flex max-h-72 flex-col gap-1 overflow-y-auto p-3">
                                                    <div className="mb-1 flex items-center justify-between">
                                                        <p className="text-xs font-semibold text-muted-foreground">Event Type</p>
                                                        {logFilter !== 'all' && (
                                                            <button
                                                                className="text-xs text-primary hover:underline"
                                                                onClick={() => setLogFilter('all')}
                                                            >
                                                                Clear
                                                            </button>
                                                        )}
                                                    </div>
                                                    {[{ label: 'All event types', value: 'all' }, ...auditEvents.map((ev) => ({ value: ev.value, label: ev.label }))].map((opt) => (
                                                        <label
                                                            key={opt.value}
                                                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
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
                                            {totalLogs} event{totalLogs !== 1 ? 's' : ''} · page {currentPage} of {lastPage}
                                        </span>
                                    </div>

                                    {totalLogs === 0 ? (
                                        <p className="py-4 text-sm text-muted-foreground">No events match the current filter.</p>
                                    ) : (
                                        <>
                                            <ActivityFeed auditLogs={auditLogs} />
                                            <SmartPagination
                                                currentPage={currentPage}
                                                lastPage={lastPage}
                                                onPageChange={(page) => fetchAuditLogs(page, range, logFilter, logSort)}
                                            />
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* ── Inbox ────────────────────────────────────────────── */}
                    <TabsContent value="inbox">
                        <div className="mt-6 flex flex-col gap-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex flex-col gap-0.5">
                                    <h2 className="text-xl font-bold tracking-tight">Notification Inbox</h2>
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
                                    {notifications.map((notification) => {
                                        const isUnread = !notification.read_at;

                                        return (
                                            <Link
                                                key={notification.id}
                                                href={notification.url}
                                                className={cn(
                                                    'group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/60',
                                                    isUnread && 'border-[var(--ads-ok-bg)] bg-[var(--ads-ok-bg)]/40'
                                                )}
                                            >
                                                <div className={cn(
                                                    'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
                                                    isUnread ? 'bg-[var(--ads-ok)] text-primary-foreground' : 'bg-muted text-muted-foreground'
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
                                                        {isUnread && <span className="size-2 rounded-full bg-[var(--primary)]" />}
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
        </DefaultLayout>
    );
}
