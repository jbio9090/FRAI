import { Button } from '@/components/ui/button';
import DefaultLayout from '@/layout.tsx/default.';
import { Link } from '@inertiajs/react';
import { Calendar as CalendarIcon } from 'lucide-react';
import moment from 'moment';
import FacilityCalendar from '@/components/FacilityCalendar';
import { Request as FacilityRequest } from '@/types/request';
import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ListFilter } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuditLog } from '@/components/activity-feed';
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
    approved,
    denied,
    initialEvents,
    buildings,
    auditLogs,
    chartData,
}: {
    pending: FacilityRequest[];
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

    const rangeLabel = {
        week: 'Last 7 days',
        month: 'This month',
        '3months': 'Last 3 months',
    }[range];

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

    console.log(auditLogs);

    return (
        <DefaultLayout hasPadding={false}>
            <div className="flex flex-col p-6 md:p-8">
                <div className="flex text-sm gap-2 items-center">
                    <CalendarIcon size={16} />
                    <p>{moment().format("MMM Do, YYYY")}</p>
                </div>

                <Tabs defaultValue="overview" className="mt-6">
                    <TabsList variant="line">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="calendar">Schedule</TabsTrigger>
                        <TabsTrigger value="reports">Reports</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview">
                        <div className="flex flex-wrap gap-2 mt-4 md:grid grid-cols-[1fr_1fr_1fr]">
                            <div className="flex flex-col p-4 w-full border-1 border-border rounded">
                                <p className='text-sm'>Pending Requests</p>
                                <p className='text-4xl font-bold'>{pending.data.length}</p>
                                <Link href={route("requests.index", ['pending'])}>
                                    <Button variant={"link"} className='px-0 mt-2'>See all</Button>
                                </Link>
                            </div>

                            <div className="flex flex-col p-4 w-full border-1 border-border rounded">
                                <p className='text-sm'>Approved Requests you made</p>
                                <p className='text-4xl font-bold'>{approved.data.length}</p>
                                <Link href={route("requests.index", ['approved'])}>
                                    <Button variant={"link"} className='px-0 mt-2'>See all</Button>
                                </Link>
                            </div>

                            <div className="flex flex-col p-4 w-full border-1 border-border rounded">
                                <p className='text-sm'>Denied Requests you made</p>
                                <p className='text-4xl font-bold'>{denied.data.length}</p>
                                <Link href={route("requests.index", ['denied'])}>
                                    <Button variant={"link"} className='px-0 mt-2'>See all</Button>
                                </Link>
                            </div>
                        </div>
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
                                        <SelectItem value="week">Last 7 days</SelectItem>
                                        <SelectItem value="month">This month</SelectItem>
                                        <SelectItem value="3months">Last 3 months</SelectItem>
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

                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </DefaultLayout>
    );
}