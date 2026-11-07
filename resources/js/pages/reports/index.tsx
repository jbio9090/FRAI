import { Download, Funnel } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Cell, Pie, PieChart } from 'recharts';
import { DiscreteBarChart } from '@/components/charts/discrete-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

const TEMPLATE_COLORS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];

interface ReportPeriod {
    start: string;
    end: string;
    label: string;
}

interface ReportKpis {
    requests_received: number;
    approval_rate: number;
    total_requesters: number;
    avg_processing_days: number;
}

interface VolumePoint {
    date: string;
    value: number;
}

interface CategoryPoint {
    category: string;
    value: number;
}

interface StatusPoint {
    status: string;
    value: number;
}

interface UsagePoint {
    name: string;
    amount: number;
    percentage: number;
}

interface ReportData {
    period: ReportPeriod;
    kpis: ReportKpis;
    volume: VolumePoint[];
    status: StatusPoint[];
    event_types: CategoryPoint[];
    facility_usage: UsagePoint[];
    building_usage: UsagePoint[];
}

interface ReportsPageProps {
    year: number;
    month: number;
    report: ReportData;
}

type ReportTab = 'request-volume' | 'request-status' | 'event-types' | 'facility-usage';

function monthOptions(year: number) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    return MONTHS.map((month, index) => {
        const value = String(index + 1).padStart(2, '0');
        const disabled = year === currentYear && index + 1 > currentMonth;

        return { value, label: month, disabled };
    });
}

function yearOptions(currentYear: number) {
    return Array.from({ length: 6 }, (_, i) => currentYear - 5 + i).map((year) => ({
        value: String(year),
        label: String(year),
    }));
}

function CategoryPie({ points, nameKey }: { points: { label: string; value: number }[]; nameKey: string }) {
    const total = points.reduce((sum, point) => sum + point.value, 0);
    const config: ChartConfig = {};
    const data = points.map((point, index) => {
        const color = TEMPLATE_COLORS[index % TEMPLATE_COLORS.length];
        config[point.label] = { label: point.label, color };
        return { [nameKey]: point.label, value: point.value, fill: color };
    });

    if (total === 0) {
        return (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">No data available for the selected period.</div>
        );
    }

    return (
        <ChartContainer config={config} className="mx-auto h-[300px] w-full max-w-[340px]">
            <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey={nameKey} hideLabel />} />
                <Pie data={data} dataKey="value" nameKey={nameKey} innerRadius={0} outerRadius="70%" stroke="#ffffff" strokeWidth={2}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={String(entry.fill)} />
                    ))}
                </Pie>
            </PieChart>
        </ChartContainer>
    );
}

function UsageTable({ rows, showColors }: { rows: UsagePoint[]; showColors?: boolean }) {
    if (rows.length === 0) {
        return <p className="p-4 text-sm text-muted-foreground">No data available for the selected period.</p>;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row, index) => (
                    <TableRow key={row.name}>
                        <TableCell>
                            {showColors ? (
                                <div className="flex items-center gap-2">
                                    <span
                                        className="inline-block size-2.5 shrink-0 rounded-sm"
                                        style={{ background: TEMPLATE_COLORS[index % TEMPLATE_COLORS.length] }}
                                    />
                                    <span>{row.name}</span>
                                </div>
                            ) : (
                                row.name
                            )}
                        </TableCell>
                        <TableCell className="text-right">{row.percentage}%</TableCell>
                        <TableCell className="text-right">{row.amount}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

export default function ReportsPage({ year: initialYear, month: initialMonth, report: initialReport }: ReportsPageProps) {
    const [month, setMonth] = useState(String(initialMonth).padStart(2, '0'));
    const [year, setYear] = useState(String(initialYear));
    const [report, setReport] = useState<ReportData>(initialReport);
    const [loading, setLoading] = useState(false);
    const firstRender = useRef(true);
    const [activeTab, setActiveTab] = useState<ReportTab>('request-volume');
    const [dateRangeOpen, setDateRangeOpen] = useState(false);
    const [workingMonth, setWorkingMonth] = useState(month);
    const [workingYear, setWorkingYear] = useState(year);

    function openDateRange() {
        setWorkingMonth(month);
        setWorkingYear(year);
        setDateRangeOpen(true);
    }

    function saveDateRange() {
        setMonth(workingMonth);
        setYear(workingYear);
        setDateRangeOpen(false);
    }

    function cancelDateRange() {
        setDateRangeOpen(false);
    }

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/reports/data?year=${year}&month=${parseInt(month, 10)}`, {
                    headers: { Accept: 'application/json' },
                });

                if (!res.ok) {
                    throw new Error(`Request failed: ${res.status}`);
                }

                const json = (await res.json()) as ReportData;
                if (!cancelled) {
                    setReport(json);
                }
            } catch (error) {
                console.error('Failed to load report data:', error);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [year, month]);

    const { period } = report;
    const exportUrl = `/reports/export?year=${year}&month=${parseInt(month, 10)}`;

    return (
        <div className="flex w-full max-w-full min-w-0 flex-col overflow-x-clip">
            {/* ── Header ── */}
            <div className="mb-6 flex w-full max-w-full min-w-0 flex-wrap items-end justify-between gap-4">
                <div className="flex max-w-full min-w-0 flex-col gap-1">
                    <p className="frai-eyebrow">Facility Reservation Activity Report</p>
                    <div className="flex items-center gap-2">
                        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{period.label}</h1>
                        {loading && <Spinner className="size-4" />}
                    </div>
                </div>
                <div className="flex max-w-full min-w-0 flex-wrap items-center gap-3">
                    <Dialog open={dateRangeOpen} onOpenChange={(open) => {
                        if (!open) {
                            setWorkingMonth(month);
                            setWorkingYear(year);
                        }
                        setDateRangeOpen(open);
                    }}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-2" disabled={loading} onClick={openDateRange}>
                                <Funnel className="size-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Filter by date range</DialogTitle>
                            </DialogHeader>
                            <div className="grid w-full gap-4 p-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm text-muted-foreground">Month</label>
                                    <Select value={workingMonth} onValueChange={setWorkingMonth} disabled={loading}>
                                        <SelectTrigger className="h-8 w-full text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {monthOptions(parseInt(workingYear, 10)).map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm text-muted-foreground">Year</label>
                                    <Select value={workingYear} onValueChange={setWorkingYear} disabled={loading}>
                                        <SelectTrigger className="h-8 w-full text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {yearOptions(parseInt(workingYear, 10)).map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" size="sm" onClick={cancelDateRange}>
                                    Cancel
                                </Button>
                                <Button variant="default" size="sm" onClick={saveDateRange} disabled={loading}>
                                    Save
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2" disabled={loading}>
                                <Download className="size-4" />
                                Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => window.location.assign(exportUrl)}>Export DOCX</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReportTab)} className="w-full max-w-full min-w-0 overflow-x-clip">
                <TabsList variant="line" className="flex h-auto min-h-9 w-full justify-start border-b *:flex-none">
                    <TabsTrigger value="request-volume">Request Volume</TabsTrigger>
                    <TabsTrigger value="request-status">Request Status</TabsTrigger>
                    <TabsTrigger value="event-types">Event Types</TabsTrigger>
                    <TabsTrigger value="facility-usage">Facility Usage</TabsTrigger>
                </TabsList>

                {/* ── Request Volume ── */}
                <TabsContent value="request-volume" className="mt-6">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <h2 className="text-lg font-semibold tracking-tight">Request Volume</h2>
                    </div>
                    <Card className="px-6 md:px-8 w-full max-w-full min-w-0 overflow-hidden">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold">Requests per day</CardTitle>
                            <CardDescription>Distinct requests submitted on each date of the selected period.</CardDescription>
                        </CardHeader>
                        <CardContent className="max-w-full min-w-0 overflow-hidden">
                            <DiscreteBarChart
                                data={report.volume}
                                config={{ value: { label: 'Requests', color: '#4472C4' } }}
                                height={360}
                                granularity="daily"
                                barColor="#4472C4"
                                barRadius={[0, 0, 0, 0]}
                                barCategoryGap="62%"
                                maxBarSize={40}
                                gridStroke="var(--border)"
                                gridDasharray="none"
                                xAxisAngle={-60}
                                xAxisInterval={1}
                                xAxisLineStroke="var(--border)"
                                tickFontSize={11}
                                tickColor="var(--muted-foreground)"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Request Status ── */}
                <TabsContent value="request-status" className="mt-6">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <h2 className="text-lg font-semibold tracking-tight">Request Status</h2>
                    </div>
                    <div className="grid w-full max-w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr] px-6 md:px-8">
                        <Card className="w-full max-w-full min-w-0 overflow-hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold">Request Status</CardTitle>
                                <CardDescription>Distribution of requests by status.</CardDescription>
                            </CardHeader>
                            <CardContent className="max-w-full min-w-0 overflow-hidden">
                                <CategoryPie points={report.status.map((row) => ({ label: row.status, value: row.value }))} nameKey="status" />
                            </CardContent>
                        </Card>
                        <Card className="w-full max-w-full min-w-0 overflow-hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold">Status breakdown</CardTitle>
                                <CardDescription>Counts per request status.</CardDescription>
                            </CardHeader>
                            <CardContent className="max-w-full min-w-0 overflow-hidden p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Request Status</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.status.map((row, index) => (
                                            <TableRow key={row.status}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="inline-block size-2.5 shrink-0 rounded-sm"
                                                            style={{ background: TEMPLATE_COLORS[index % TEMPLATE_COLORS.length] }}
                                                        />
                                                        <span>{row.status}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">{row.value}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ── Event Types ── */}
                <TabsContent value="event-types" className="mt-6">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <h2 className="text-lg font-semibold tracking-tight">Event Types</h2>
                    </div>
                    <div className="grid w-full max-w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr] px-6 md:px-8">
                        <Card className="w-full max-w-full min-w-0 overflow-hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold">Event Types</CardTitle>
                                <CardDescription>Requests by event type.</CardDescription>
                            </CardHeader>
                            <CardContent className="max-w-full min-w-0 overflow-hidden">
                                <CategoryPie
                                    points={report.event_types.map((row) => ({ label: row.category, value: row.value }))}
                                    nameKey="category"
                                />
                            </CardContent>
                        </Card>
                        <Card className="w-full max-w-full min-w-0 overflow-hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold">Event type breakdown</CardTitle>
                                <CardDescription>Counts per event type.</CardDescription>
                            </CardHeader>
                            <CardContent className="max-w-full min-w-0 overflow-hidden p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Event Type</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.event_types.map((row, index) => (
                                            <TableRow key={row.category}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="inline-block size-2.5 shrink-0 rounded-sm"
                                                            style={{ background: TEMPLATE_COLORS[index % TEMPLATE_COLORS.length] }}
                                                        />
                                                        <span>{row.category}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">{row.value}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ── Facility Usage ── */}
                <TabsContent value="facility-usage" className="mt-6">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <h2 className="text-lg font-semibold tracking-tight">Facility Usage</h2>
                    </div>
                    <div className="grid w-full max-w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr] px-6 md:px-8">
                        <Card className="w-full max-w-full min-w-0 overflow-hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold">Facilities</CardTitle>
                                <CardDescription>Bookings per facility.</CardDescription>
                            </CardHeader>
                            <CardContent className="max-w-full min-w-0 overflow-hidden">
                                <CategoryPie
                                    points={report.facility_usage.map((row) => ({ label: row.name, value: row.amount }))}
                                    nameKey="facility"
                                />
                            </CardContent>
                        </Card>
                        <Card className="w-full max-w-full min-w-0 overflow-hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold">Facility usage detail</CardTitle>
                                <CardDescription>Share of bookings per facility.</CardDescription>
                            </CardHeader>
                            <CardContent className="max-w-full min-w-0 overflow-hidden p-0">
                                <UsageTable rows={report.facility_usage} showColors />
                            </CardContent>
                        </Card>
                    </div>
                    <Card className="mt-6 px-6 md:px-8 w-full max-w-full min-w-0 overflow-hidden">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold">Building usage</CardTitle>
                            <CardDescription>Share of bookings per building.</CardDescription>
                        </CardHeader>
                        <CardContent className="max-w-full min-w-0 overflow-hidden p-0">
                            <UsageTable rows={report.building_usage} showColors />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
