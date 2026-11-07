'use client';

import { format, parseISO } from 'date-fns';
import { toPng } from 'html-to-image';
import { BarChart2, Calendar, Download, Loader2, ClipboardList, AlertTriangle, CheckCircle2, Filter } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { PieChart, Pie, Cell, Legend } from 'recharts';
import { DiscreteBarChart } from '@/components/charts/discrete-bar';
import { PdfVerticalBarChart, PdfHorizontalBarChart, PdfStatusBarChart } from '@/components/charts/pdf-charts';
import { StackedBarChart } from '@/components/charts/stacked-bar';
import { downloadReportsPdf } from '@/components/pdf/reports-pdf';
import { FilterPanel } from '@/components/reports/filter-panel';
import StatTile from '@/components/stat-tile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatRequestStatus } from '@/lib/formatters';
import {
    PROCESSING_BAR_COLOR,
    SLA_LINE_COLOR,
    VOLUME_BAR_COLOR,
    categoryColor,
    sortedCategoryNames,
    STATUS_KEYS,
    TEAL,
    NAVY,
} from '@/lib/report-palette';
import type {
    ReportFilters,
    ReportMeta,
    ReportPeriodMeta,
    ReportKpis,
    ReportType,
    ChartDataPoint,
    UserActivityDataPoint,
    Granularity,
    KpiComparison,
    ReportsPdfData,
    KpiCard,
    StatCell,
    KeyFinding,
    Callout,
    SectionData,
    TableColumn,
    PdfRow,
} from '@/types/reports';

const REPORT_TABS: { id: ReportType; label: string; description: string }[] = [
    { id: 'volume', label: 'Request Volume', description: 'Total requests created over time' },
    { id: 'approval-rate', label: 'Status Breakdown', description: 'Requests by status over time' },
    { id: 'facility-utilization', label: 'Facility Usage', description: 'Total bookings per facility' },
    { id: 'priority-distribution', label: 'Event Types', description: 'Requests by event type' },
    { id: 'processing-time', label: 'Processing Time', description: 'Average days from creation to decision' },
];

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];

function formatDisplayDate(dateStr: string, granularity: Granularity): string {
    const date = parseISO(dateStr);
    if (/^\d{4}-\d{2}$/.test(dateStr)) {
        return format(date, 'MMMM yyyy');
    }
    switch (granularity) {
        case 'daily':
            return format(date, 'MMM d, yyyy');
        case 'weekly':
            return format(date, "'Week' w, yyyy");
        case 'monthly':
            return format(date, 'MMMM yyyy');
        default:
            return format(date, 'MMM d, yyyy');
    }
}

function formatAxisDate(dateStr: string, granularity: Granularity): string {
    const date = parseISO(dateStr);
    switch (granularity) {
        case 'daily':
            return format(date, 'MMM d');
        case 'weekly': {
            const [year, week] = dateStr.split('-W');
            return `Wk ${week}, ${year}`;
        }
        case 'monthly':
            return format(date, 'MMM yyyy');
        default:
            return format(date, 'MMM d');
    }
}

function granularityNoun(granularity: string): string {
    return granularity === 'weekly' ? 'week' : granularity === 'monthly' ? 'month' : 'day';
}

function formatDeltaSub(pct: number | null | undefined): string | undefined {
    if (pct === null || pct === undefined) {
        return undefined;
    }
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}% vs prev period`;
}

export default function ReportsPage({ meta, defaultFilters }: { meta: ReportMeta; defaultFilters: ReportFilters }) {
    const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
    const [activeTab, setActiveTab] = useState<ReportType>('volume');
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [kpis, setKpis] = useState<ReportKpis | null>(null);
    const [kpiComparison, setKpiComparison] = useState<KpiComparison | null>(null);
    const [, setMethodology] = useState<Record<string, string> | null>(null);
    const [loading, setLoading] = useState(false);
    const [pdfGenerating, setPdfGenerating] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [allChartData, setAllChartData] = useState<Record<ReportType, ChartDataPoint[]>>({
        volume: [],
        'approval-rate': [],
        'facility-utilization': [],
        'priority-distribution': [],
        'processing-time': [],
        'user-activity': [],
        'equipment-usage': [],
    });
    const [allFacilityPieData, setAllFacilityPieData] = useState<ChartDataPoint[]>([]);

    const volumeRef = useRef<HTMLDivElement>(null);
    const approvalRateRef = useRef<HTMLDivElement>(null);
    const facilityUtilizationRef = useRef<HTMLDivElement>(null);
    const priorityDistributionRef = useRef<HTMLDivElement>(null);
    const processingTimeRef = useRef<HTMLDivElement>(null);
    const facilityUsageRef = useRef<HTMLDivElement>(null);
    const userActivityRef = useRef<HTMLDivElement>(null);
    const statusBreakdownRef = useRef<HTMLDivElement>(null);
    const conflictsRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async (type: ReportType, currentFilters: ReportFilters) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                type,
                start: currentFilters.start,
                end: currentFilters.end,
                granularity: currentFilters.granularity,
                ...(currentFilters.dateType && { date_type: currentFilters.dateType }),
                ...(currentFilters.facilityIds?.length && { facility_ids: currentFilters.facilityIds.join(',') }),
                ...(currentFilters.buildingIds?.length && { building_ids: currentFilters.buildingIds.join(',') }),
                ...(currentFilters.campusIds?.length && { campus_ids: currentFilters.campusIds.join(',') }),
                ...(currentFilters.statuses?.length && { statuses: currentFilters.statuses.join(',') }),
                ...(currentFilters.priorityLevel !== undefined && { priority_level: String(currentFilters.priorityLevel) }),
                ...(currentFilters.userId !== undefined && { user_id: String(currentFilters.userId) }),
            });

            const res = await fetch(`/reports/data?${params.toString()}`);
            const json = await res.json();
            setChartData(json.data || []);

            // Also fetch pie data for facility usage
            if (type === 'facility-utilization') {
                const pieParams = new URLSearchParams({
                    type: 'facility-usage-pie',
                    start: currentFilters.start,
                    end: currentFilters.end,
                    ...(currentFilters.dateType && { date_type: currentFilters.dateType }),
                    ...(currentFilters.facilityIds?.length && { facility_ids: currentFilters.facilityIds.join(',') }),
                    ...(currentFilters.buildingIds?.length && { building_ids: currentFilters.buildingIds.join(',') }),
                    ...(currentFilters.campusIds?.length && { campus_ids: currentFilters.campusIds.join(',') }),
                    ...(currentFilters.statuses?.length && { statuses: currentFilters.statuses.join(',') }),
                    ...(currentFilters.priorityLevel !== undefined && { priority_level: String(currentFilters.priorityLevel) }),
                    ...(currentFilters.userId !== undefined && { user_id: String(currentFilters.userId) }),
                });
                const pieRes = await fetch(`/reports/data?${pieParams.toString()}`);
                const pieJson = await pieRes.json();
                const pieData = pieJson.data || [];
                setFacilityPieData(pieData);
            }
        } catch (error) {
            console.error('Failed to fetch report data:', error);
            setChartData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const [facilityPieData, setFacilityPieData] = useState<ChartDataPoint[]>([]);

    const fetchKpis = useCallback(async (currentFilters: ReportFilters) => {
        try {
            const params = new URLSearchParams({
                type: 'kpis',
                start: currentFilters.start,
                end: currentFilters.end,
                ...(currentFilters.dateType && { date_type: currentFilters.dateType }),
                ...(currentFilters.facilityIds?.length && { facility_ids: currentFilters.facilityIds.join(',') }),
                ...(currentFilters.buildingIds?.length && { building_ids: currentFilters.buildingIds.join(',') }),
                ...(currentFilters.campusIds?.length && { campus_ids: currentFilters.campusIds.join(',') }),
                ...(currentFilters.userId !== undefined && { user_id: String(currentFilters.userId) }),
            });

            const res = await fetch(`/reports/data?${params.toString()}`);
            const json = await res.json();
            setKpis(json.data || null);
        } catch (error) {
            console.error('Failed to fetch KPIs:', error);
            setKpis(null);
        }
    }, []);

    const fetchKpisComparison = useCallback(async (currentFilters: ReportFilters) => {
        try {
            const params = new URLSearchParams({
                type: 'kpis-comparison',
                start: currentFilters.start,
                end: currentFilters.end,
                ...(currentFilters.dateType && { date_type: currentFilters.dateType }),
                ...(currentFilters.facilityIds?.length && { facility_ids: currentFilters.facilityIds.join(',') }),
                ...(currentFilters.buildingIds?.length && { building_ids: currentFilters.buildingIds.join(',') }),
                ...(currentFilters.campusIds?.length && { campus_ids: currentFilters.campusIds.join(',') }),
                ...(currentFilters.userId !== undefined && { user_id: String(currentFilters.userId) }),
            });

            const res = await fetch(`/reports/data?${params.toString()}`);
            const json = await res.json();
            setKpiComparison(json.data || null);
        } catch (error) {
            console.error('Failed to fetch KPI comparison:', error);
            setKpiComparison(null);
        }
    }, []);

    const fetchMethodology = useCallback(async (currentFilters: ReportFilters) => {
        try {
            const params = new URLSearchParams({
                type: 'methodology',
                start: currentFilters.start,
                end: currentFilters.end,
                ...(currentFilters.dateType && { date_type: currentFilters.dateType }),
                ...(currentFilters.facilityIds?.length && { facility_ids: currentFilters.facilityIds.join(',') }),
                ...(currentFilters.buildingIds?.length && { building_ids: currentFilters.buildingIds.join(',') }),
                ...(currentFilters.campusIds?.length && { campus_ids: currentFilters.campusIds.join(',') }),
                ...(currentFilters.userId !== undefined && { user_id: String(currentFilters.userId) }),
            });

            const res = await fetch(`/reports/data?${params.toString()}`);
            const json = await res.json();
            return json.data || {};
        } catch (error) {
            console.error('Failed to fetch methodology:', error);
            return {};
        }
    }, []);

    const fetchAllChartData = useCallback(async (currentFilters: ReportFilters) => {
        const types: ReportType[] = [
            'volume',
            'approval-rate',
            'facility-utilization',
            'priority-distribution',
            'processing-time',
            'user-activity',
            'equipment-usage',
        ];

        const results: Record<ReportType, ChartDataPoint[]> = {
            volume: [],
            'approval-rate': [],
            'facility-utilization': [],
            'priority-distribution': [],
            'processing-time': [],
            'user-activity': [],
            'equipment-usage': [],
        };

        await Promise.all(
            types.map(async (type) => {
                try {
                    const params = new URLSearchParams({
                        type,
                        start: currentFilters.start,
                        end: currentFilters.end,
                        granularity: currentFilters.granularity,
                        ...(currentFilters.dateType && { date_type: currentFilters.dateType }),
                        ...(currentFilters.facilityIds?.length && { facility_ids: currentFilters.facilityIds.join(',') }),
                        ...(currentFilters.buildingIds?.length && { building_ids: currentFilters.buildingIds.join(',') }),
                        ...(currentFilters.campusIds?.length && { campus_ids: currentFilters.campusIds.join(',') }),
                        ...(currentFilters.statuses?.length && { statuses: currentFilters.statuses.join(',') }),
                        ...(currentFilters.priorityLevel !== undefined && { priority_level: String(currentFilters.priorityLevel) }),
                        ...(currentFilters.userId !== undefined && { user_id: String(currentFilters.userId) }),
                    });

                    const res = await fetch(`/reports/data?${params.toString()}`);
                    const json = await res.json();
                    results[type] = json.data || [];
                } catch (error) {
                    console.error(`Failed to fetch ${type} data:`, error);
                    results[type] = [];
                }
            }),
        );

        // Also fetch facility usage pie data
        let pieData: ChartDataPoint[] = [];
        try {
            const pieParams = new URLSearchParams({
                type: 'facility-usage-pie',
                start: currentFilters.start,
                end: currentFilters.end,
                ...(currentFilters.dateType && { date_type: currentFilters.dateType }),
                ...(currentFilters.facilityIds?.length && { facility_ids: currentFilters.facilityIds.join(',') }),
                ...(currentFilters.buildingIds?.length && { building_ids: currentFilters.buildingIds.join(',') }),
                ...(currentFilters.campusIds?.length && { campus_ids: currentFilters.campusIds.join(',') }),
                ...(currentFilters.statuses?.length && { statuses: currentFilters.statuses.join(',') }),
                ...(currentFilters.priorityLevel !== undefined && { priority_level: String(currentFilters.priorityLevel) }),
                ...(currentFilters.userId !== undefined && { user_id: String(currentFilters.userId) }),
            });
            const pieRes = await fetch(`/reports/data?${pieParams.toString()}`);
            const pieJson = await pieRes.json();
            pieData = pieJson.data || [];
            setAllFacilityPieData(pieData);
        } catch (error) {
            console.error('Failed to fetch facility-usage-pie data:', error);
            pieData = [];
            setAllFacilityPieData([]);
        }

        flushSync(() => {
            setAllChartData(results);
        });

        // Return fresh data so callers don't read stale React state
        // (the closure's `allChartData` is still empty on first export).
        return { results, pieData };
    }, []);

    const waitForOffscreenCharts = async (freshData: Record<ReportType, ChartDataPoint[]>, freshPieData: ChartDataPoint[], timeoutMs = 8000) => {
        const start = Date.now();
        const refsByType: Partial<Record<ReportType, React.RefObject<HTMLDivElement | null>>> = {
            volume: volumeRef,
            'approval-rate': approvalRateRef,
            'facility-utilization': facilityUtilizationRef,
            'priority-distribution': priorityDistributionRef,
            'processing-time': processingTimeRef,
            'user-activity': userActivityRef,
            'equipment-usage': conflictsRef,
        };
        const hasData = (type: ReportType) => (type === 'facility-utilization' ? freshPieData : (freshData[type] ?? [])).length > 0;

        // Poll until every chart with data has rendered an <svg>, so html-to-image
        // captures real content instead of an empty container on first export.
        for (;;) {
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const pending = (Object.keys(refsByType) as ReportType[]).filter((type) => {
                if (!hasData(type)) return false;
                const el = refsByType[type]?.current;
                if (!el) return true;
                return !el.querySelector('svg');
            });
            if (pending.length === 0) return;
            if (Date.now() - start > timeoutMs) {
                console.warn(`Timed out waiting for off-screen charts: ${pending.join(', ')}`);
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    };

    const captureChartImages = async (freshData?: Record<ReportType, ChartDataPoint[]>, freshPieData?: ChartDataPoint[]) => {
        const images: Record<ReportType, string> = {
            volume: '',
            'approval-rate': '',
            'facility-utilization': '',
            'equipment-usage': '',
            'priority-distribution': '',
            'user-activity': '',
            'processing-time': '',
        };

        // Prefer explicitly passed fresh data; fall back to state for other callers.
        // Reading `allChartData` directly here would use a stale closure on the
        // first export (state hasn't re-rendered yet when this runs).
        const source = freshData ?? allChartData;
        const pieSource = freshPieData ?? allFacilityPieData;

        const chartConfigs: { type: ReportType; ref: React.RefObject<HTMLDivElement | null>; data: ChartDataPoint[] }[] = [
            { type: 'volume', ref: volumeRef, data: source.volume },
            { type: 'approval-rate', ref: approvalRateRef, data: source['approval-rate'] },
            { type: 'facility-utilization', ref: facilityUtilizationRef, data: pieSource },
            { type: 'priority-distribution', ref: priorityDistributionRef, data: source['priority-distribution'] },
            { type: 'processing-time', ref: processingTimeRef, data: source['processing-time'] },
            { type: 'user-activity', ref: userActivityRef, data: source['user-activity'] },
            { type: 'equipment-usage', ref: conflictsRef, data: source['equipment-usage'] },
        ];

        for (const { type, ref, data } of chartConfigs) {
            // Check if ref is attached
            if (!ref.current) {
                console.warn(`Ref not attached for ${type} chart`);
                images[type] = '';
                continue;
            }

            if (data.length > 0) {
                try {
                    // Delay to ensure Recharts is fully rendered
                    await new Promise((resolve) => setTimeout(resolve, 300));
                    const pngDataUrl = await toPng(ref.current!, {
                        backgroundColor: '#ffffff',
                        pixelRatio: 2,
                        skipFonts: true,
                    });
                    images[type] = pngDataUrl;
                } catch (error) {
                    console.error(`Failed to capture ${type} chart:`, error);
                    images[type] = '';
                }
            } else {
                images[type] = '';
            }
        }

        return images;
    };

    useEffect(() => {
        fetchData(activeTab, filters);
        fetchKpis(filters);
        fetchKpisComparison(filters);
    }, [activeTab, filters, fetchData, fetchKpis, fetchKpisComparison]);

    const handleFilterChange = (newFilters: Partial<ReportFilters>) => {
        setFilters((prev) => ({ ...prev, ...newFilters }));
    };

    const resetFilters = () => {
        setFilters(defaultFilters);
    };

    const renderChart = () => {
        const dataToCheck = activeTab === 'facility-utilization' ? facilityPieData : chartData;
        if (!dataToCheck.length) {
            return (
                <div className="flex h-[400px] flex-col items-center justify-center text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <BarChart2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No data available</p>
                    <p className="mt-1 text-xs text-muted-foreground">No records match the selected filters.</p>
                </div>
            );
        }

        switch (activeTab) {
            case 'volume': {
                const config: ChartConfig = {
                    value: { label: 'Requests', color: VOLUME_BAR_COLOR },
                };
                return (
                    <DiscreteBarChart
                        data={chartData as ChartDataPoint[]}
                        config={config}
                        yAxisLabel="Requests"
                        height={350}
                        granularity={filters.granularity}
                        barColor={VOLUME_BAR_COLOR}
                    />
                );
            }
            case 'approval-rate': {
                const statusKeys = ['pending', 'approved', 'conditionally_approved', 'partially_approved', 'denied', 'for_reschedule'] as const;
                const config: ChartConfig = {};
                const categories: string[] = [];
                statusKeys.forEach((key, i) => {
                    config[key] = { label: formatRequestStatus(key), color: CHART_COLORS[i % CHART_COLORS.length] };
                    categories.push(key);
                });
                return (
                    <StackedBarChart
                        data={chartData as ChartDataPoint[]}
                        config={config}
                        categories={categories}
                        yAxisLabel="Requests"
                        height={350}
                        granularity={filters.granularity}
                    />
                );
            }
            case 'facility-utilization': {
                const categories = sortedCategoryNames(facilityPieData as ChartDataPoint[]);
                const config: ChartConfig = {};
                categories.forEach((cat) => {
                    config[cat] = { label: cat, color: categoryColor(cat, categories) };
                });
                return (
                    <div className="space-y-4">
                        <ChartContainer config={config} className="h-[350px] w-full" initialDimension={{ width: 400, height: 350 }}>
                            <PieChart>
                                <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
                                <Legend verticalAlign="bottom" height={36} />
                                <Pie
                                    data={facilityPieData as ChartDataPoint[]}
                                    dataKey="value"
                                    nameKey="category"
                                    cx="50%"
                                    cy="42%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    label={({ category, value }) => `${category}: ${value}`}
                                    labelLine={false}
                                >
                                    {facilityPieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={categoryColor(entry.category ?? '', categories)} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ChartContainer>
                    </div>
                );
            }
            case 'priority-distribution': {
                // Aggregate data across all dates to get total per category
                const aggregated = (chartData as ChartDataPoint[]).reduce(
                    (acc, d) => {
                        if (d.category) {
                            acc[d.category] = (acc[d.category] || 0) + d.value;
                        }
                        return acc;
                    },
                    {} as Record<string, number>,
                );
                const pieData = Object.entries(aggregated).map(([category, value]) => ({ category, value }));
                const categories = sortedCategoryNames(pieData);
                const config: ChartConfig = {};
                categories.forEach((cat) => {
                    config[cat] = { label: cat, color: categoryColor(cat, categories) };
                });
                return (
                    <div className="space-y-4">
                        <ChartContainer config={config} className="h-[350px] w-full" initialDimension={{ width: 400, height: 350 }}>
                            <PieChart>
                                <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
                                <Legend verticalAlign="bottom" height={36} />
                                <Pie
                                    data={pieData}
                                    dataKey="value"
                                    nameKey="category"
                                    cx="50%"
                                    cy="42%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    label={({ category, value }) => `${category}: ${value}`}
                                    labelLine={false}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={categoryColor(entry.category ?? '', categories)} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ChartContainer>
                    </div>
                );
            }
            case 'processing-time': {
                const config: ChartConfig = {
                    value: { label: 'Avg Days', color: PROCESSING_BAR_COLOR },
                };
                return (
                    <DiscreteBarChart
                        data={chartData as ChartDataPoint[]}
                        config={config}
                        yAxisLabel="Days"
                        height={350}
                        granularity={filters.granularity}
                        barColor={PROCESSING_BAR_COLOR}
                        referenceLine={{ y: 2, label: 'SLA Target (2 days)', stroke: SLA_LINE_COLOR, strokeDasharray: '5 5' }}
                    />
                );
            }
            default:
                return null;
        }
    };

    const handleExportPdf = async () => {
        setPdfGenerating(true);
        try {
            // Fetch all chart data first. Use the RETURNED data directly instead of
            // `allChartData` state, which is still stale (empty) on first export.
            const { results: freshCharts, pieData: freshPie } = await fetchAllChartData(filters);
            // Fetch methodology
            const methodologyData = await fetchMethodology(filters);
            setMethodology(methodologyData);

            // Wait for off-screen charts to re-render with the fresh data, then
            // capture images. Polls for <svg> so first export isn't blank.
            await waitForOffscreenCharts(freshCharts, freshPie);
            // Extra delay for Recharts internal rendering
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Capture chart images from off-screen render
            const images = await captureChartImages(freshCharts, freshPie);

            // ---- Build report meta ----
            const periodStart = /^\d{4}-\d{2}$/.test(filters.start)
                ? format(parseISO(filters.start), 'MMMM yyyy')
                : format(parseISO(filters.start), 'MMM d, yyyy');
            const periodEnd = /^\d{4}-\d{2}$/.test(filters.end)
                ? format(parseISO(filters.end), 'MMMM yyyy')
                : format(parseISO(filters.end), 'MMM d, yyyy');
            const periodLabel = `${periodStart} – ${periodEnd}`;
            const dataAsOf = format(new Date(), 'MMM d, yyyy');
            const generatedAt = format(new Date(), "MMM d, yyyy 'at' h:mm a");
            const priorPeriodLabel = `Prior period (same length, ending ${periodStart})`;

            const reportMeta: ReportPeriodMeta = {
                period: periodLabel,
                audience: 'GSO Administrators',
                dataAsOf,
                priorPeriod: priorPeriodLabel,
                generatedAt,
            };

            // ---- KPI cards ----
            const k = kpis ?? { total_requests: 0, approval_rate: 0, avg_processing_days: 0, active_conflicts: 0 };
            const d = kpiComparison?.deltas ?? {
                total_requests_pct: null,
                approval_rate_pct: null,
                avg_processing_days_pct: null,
                active_conflicts_pct: null,
            };

            const fmtPct = (p: number | null) => (p === null ? 'No prior-period data' : `${p >= 0 ? '+' : ''}${p.toFixed(1)}% vs prior`);
            const chip = (pct: number | null, invert = false): { text: string; color: string } => {
                if (pct === null) return { text: 'NO TARGET', color: '#9AA3AF' };
                const good = invert ? pct <= 0 : pct >= 0;
                return good ? { text: 'ON TRACK', color: '#2F855A' } : { text: 'ACTION NEEDED', color: '#C0392B' };
            };

            const kpiCards: KpiCard[] = [
                {
                    tabColor: TEAL,
                    label: 'Decided requests',
                    value: k.total_requests.toLocaleString(),
                    context1: fmtPct(d.total_requests_pct),
                    context2: 'Target: —',
                    chipText: chip(d.total_requests_pct).text,
                    chipColor: chip(d.total_requests_pct).color,
                },
                {
                    tabColor: TEAL,
                    label: 'Approval rate',
                    value: `${k.approval_rate}%`,
                    context1: fmtPct(d.approval_rate_pct),
                    context2: 'Target: —',
                    chipText: chip(d.approval_rate_pct).text,
                    chipColor: chip(d.approval_rate_pct).color,
                },
                {
                    tabColor: TEAL,
                    label: 'Avg processing time',
                    value: String(k.avg_processing_days),
                    valueUnit: 'days',
                    context1: fmtPct(d.avg_processing_days_pct),
                    context2: 'Target: 2.0 days',
                    chipText: chip(d.avg_processing_days_pct, true).text,
                    chipColor: chip(d.avg_processing_days_pct, true).color,
                },
                {
                    tabColor: '#D9890B',
                    label: 'Active conflicts',
                    value: String(k.active_conflicts),
                    context1: fmtPct(d.active_conflicts_pct),
                    context2: 'Target: 0',
                    chipText: chip(d.active_conflicts_pct, true).text,
                    chipColor: chip(d.active_conflicts_pct, true).color,
                },
            ];

            // ---- Stat strip ----
            const statStrip: StatCell[] = [
                { value: k.total_requests.toLocaleString(), label: 'Decided requests' },
                { value: `${k.approval_rate}%`, label: 'Approval rate' },
                { value: `${k.avg_processing_days} days`, label: 'Avg processing time' },
                { value: String(k.active_conflicts), label: 'Active conflicts' },
            ];

            // ---- Key findings (from data) ----
            const volumeData = freshCharts.volume as { date: string; value: number }[];
            const totalVolume = volumeData.reduce((s, r) => s + r.value, 0);
            const peakDay = volumeData.length > 0 ? volumeData.reduce((a, b) => (b.value > a.value ? b : a)) : null;

            const facilityData = (freshCharts['facility-utilization'] as { category: string; value: number }[]).reduce(
                (acc: Record<string, number>, r) => {
                    acc[r.category] = (acc[r.category] ?? 0) + r.value;
                    return acc;
                },
                {},
            );
            const topFacility = Object.entries(facilityData).sort((a, b) => b[1] - a[1])[0];

            const keyFindings: KeyFinding[] = [];
            if (peakDay) {
                keyFindings.push({
                    number: 1,
                    lead: `${totalVolume.toLocaleString()} requests were decided in ${periodLabel}.`,
                    body: `The busiest day was ${format(parseISO(peakDay.date), 'MMM d')} with ${peakDay.value.toLocaleString()} requests.`,
                });
            }
            if (topFacility) {
                keyFindings.push({
                    number: 2,
                    lead: `${topFacility[0]} led facility usage with ${topFacility[1].toLocaleString()} bookings.`,
                    body: `It accounted for ${Math.round((topFacility[1] / totalVolume) * 100)}% of decided volume.`,
                });
            }
            if (k.approval_rate > 0) {
                keyFindings.push({
                    number: 3,
                    lead: `Approval rate was ${k.approval_rate}% for the period.`,
                    body: `${k.total_requests.toLocaleString()} requests received a decision; ${Math.round(k.total_requests * (k.approval_rate / 100))} were approved or conditionally approved.`,
                });
            }
            if (k.active_conflicts > 0) {
                keyFindings.push({
                    number: 4,
                    lead: `${k.active_conflicts} conflict(s) remain active.`,
                    body: 'Review overlapping bookings and reschedule where facilities or equipment are double-booked.',
                });
            }

            // ---- Decisions requested callout ----
            const decisionsCallout: Callout = {
                label: 'DECISIONS REQUESTED',
                body:
                    'GSO staff to review active conflicts and confirm rescheduling for affected bookings. ' +
                    'Administrators to confirm whether processing-time SLA of 2 days is being met consistently.',
                accentColor: NAVY,
            };

            // ---- Sections ----
            const bucketNoun = granularityNoun(filters.granularity);

            const sections: SectionData[] = [
                {
                    number: '1',
                    title: 'Turnaround & backlog',
                    question: 'How quickly are requests decided, and which are waiting longest?',
                    basis: `Requests with processed_at in ${periodLabel}, counted by processing date. Processing time = calendar days from created_at to processed_at.`,
                    chartCards: [
                        {
                            title: `Volume peaked at ${peakDay?.value.toLocaleString() ?? 0} requests in a single ${bucketNoun}`,
                            subtitle: `Decided requests per ${bucketNoun}, ${periodLabel}. n = ${totalVolume.toLocaleString()}`,
                            imageUrl: images.volume,
                        },
                        {
                            title: `Average processing time: ${k.avg_processing_days} days`,
                            subtitle: `Calendar days from submission to decision per ${bucketNoun}. SLA target: 2.0 days.`,
                            imageUrl: images['processing-time'],
                        },
                    ],
                    tableTitle: 'Requests by status and date',
                    tableColumns: [
                        { key: 'date', header: 'Date', align: 'left' as const },
                        ...STATUS_KEYS.map((key): TableColumn => ({
                            key,
                            header: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                            align: 'right' as const,
                        })),
                        { key: 'total', header: 'Total', align: 'right' as const },
                    ],
                    tableRows: (freshCharts['approval-rate'] as unknown as { date: string; [key: string]: string | number }[]).map((row) => ({
                        date: formatAxisDate(row.date, filters.granularity),
                        ...STATUS_KEYS.reduce(
                            (acc, key) => {
                                acc[key] = Number(row[key] ?? 0) as number;
                                return acc;
                            },
                            {} as Record<string, number>,
                        ),
                        total: row.total ?? 0,
                    })),
                    tableTotalRow: {
                        date: 'Total',
                        ...STATUS_KEYS.reduce(
                            (acc, key) => {
                                acc[key] = (freshCharts['approval-rate'] as unknown as { [key: string]: string | number }[]).reduce(
                                    (s, r) => s + (Number(r[key] ?? 0) as number),
                                    0,
                                );
                                return acc;
                            },
                            {} as Record<string, number>,
                        ),
                        total: totalVolume,
                    },
                    tableNote: 'Status counts use the fixed request-status color map; totals match the right-hand column.',
                    callout: {
                        label: 'WHAT THIS MEANS',
                        body: `Requests averaged ${k.avg_processing_days} days to decision against a 2.0-day SLA. ${k.active_conflicts} conflict(s) remain active and should be cleared first.`,
                        accentColor: TEAL,
                    },
                },
                {
                    number: '2',
                    title: 'Demand & utilization',
                    question: 'Which facilities and users carry the most demand?',
                    basis: `Approved and conditionally approved bookings by facility and user, ${periodLabel}.`,
                    chartCards: [
                        {
                            title: `${topFacility?.[0] ?? '—'} led with ${topFacility?.[1]?.toLocaleString() ?? 0} bookings`,
                            subtitle: `Bookings per facility, sorted descending. n = ${totalVolume.toLocaleString()}`,
                            imageUrl: images['facility-utilization'],
                        },
                        {
                            title: 'Top users by request volume',
                            subtitle: `Users with the most requests in the period.`,
                            imageUrl: images['user-activity'],
                        },
                    ],
                    tableTitle: 'Facility usage detail',
                    tableColumns: [
                        { key: 'facility', header: 'Facility', align: 'left' },
                        { key: 'bookings', header: 'Bookings', align: 'right' },
                        { key: 'share', header: 'Share', align: 'right' },
                    ],
                    tableRows: Object.entries(facilityData)
                        .sort((a, b) => b[1] - a[1])
                        .map(([name, value]) => ({
                            facility: name,
                            bookings: value,
                            share: totalVolume > 0 ? `${Math.round((value / totalVolume) * 100)}%` : '0%',
                        })),
                    callout: {
                        label: 'WHAT THIS MEANS',
                        body: 'Demand is concentrated in a few facilities. Consider rebalancing capacity or adding slots at high-utilization sites.',
                        accentColor: TEAL,
                    },
                },
                {
                    number: '3',
                    title: 'Conflicts & risks',
                    question: 'Where are facilities and equipment double-booked?',
                    basis: `Conflicting bookings (overlapping time on the same facility or equipment) in ${periodLabel}.`,
                    chartCards: [
                        {
                            title: 'Conflict activity over time',
                            subtitle: `Equipment conflicts per ${bucketNoun}. n = ${k.active_conflicts} active`,
                            imageUrl: images['equipment-usage'],
                        },
                    ],
                    tableTitle: 'Active conflicts',
                    tableColumns: [
                        { key: 'date', header: 'Date', align: 'left' },
                        { key: 'value', header: 'Conflicts', align: 'right' },
                    ],
                    tableRows: (freshCharts['equipment-usage'] as { date: string; value: number }[]).map((row) => ({
                        date: formatAxisDate(row.date, filters.granularity),
                        value: row.value,
                    })),
                    callout: {
                        label: 'WHAT THIS MEANS',
                        body: `${k.active_conflicts} request(s) currently have unresolved conflicts. Prioritize rescheduling to avoid service disruption.`,
                        accentColor: '#D9890B',
                    },
                },
            ];

            // ---- Appendix A tables ----
            const appendixATables: { title: string; columns: TableColumn[]; rows: PdfRow[] }[] = [
                {
                    title: 'Requests by status (daily)',
                    columns: [
                        { key: 'date', header: 'Date', align: 'left' as const },
                        ...STATUS_KEYS.map((key): TableColumn => ({ key, header: key, align: 'right' as const })),
                        { key: 'total', header: 'Total', align: 'right' as const },
                    ],
                    rows: (freshCharts['approval-rate'] as unknown as { date: string; [key: string]: string | number }[]).map((row) => ({
                        date: row.date,
                        ...STATUS_KEYS.reduce(
                            (acc, key) => {
                                acc[key] = Number(row[key] ?? 0) as number;
                                return acc;
                            },
                            {} as Record<string, number>,
                        ),
                        total: row.total ?? 0,
                    })),
                },
                {
                    title: 'Facility usage totals',
                    columns: [
                        { key: 'facility', header: 'Facility', align: 'left' },
                        { key: 'bookings', header: 'Bookings', align: 'right' },
                        { key: 'share', header: 'Share', align: 'right' },
                    ],
                    rows: Object.entries(facilityData)
                        .sort((a, b) => b[1] - a[1])
                        .map(([name, value]) => ({
                            facility: name,
                            bookings: value,
                            share: totalVolume > 0 ? `${Math.round((value / totalVolume) * 100)}%` : '0%',
                        })),
                },
            ];

            // ---- Appendix B ----
            const appendixBMethodology: { label: string; value: string }[] = Object.entries(methodologyData ?? {}).map(([label, value]) => ({
                label: String(label),
                value: String(value),
            }));

            const dataNotesCallout: Callout = {
                label: 'DATA NOTES',
                body: 'Partial periods are shown in light teal with a “(partial)” label. Figures reflect data as of the timestamp on page 1. No targets or medians are stored by the reporting service; chips default to gray when no target exists.',
                accentColor: '#D9890B',
            };

            const pdfData: ReportsPdfData = {
                meta: reportMeta,
                kpiCards,
                statStrip,
                keyFindings,
                decisionsCallout,
                sections,
                appendixATables,
                appendixBMethodology,
                dataNotesCallout,
                methodology: methodologyData ?? {},
            };

            await downloadReportsPdf(pdfData);
        } catch (error) {
            console.error('Failed to generate PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setPdfGenerating(false);
        }
    };

    const dateRangeLabel = `${formatDisplayDate(filters.start, filters.granularity)} – ${formatDisplayDate(filters.end, filters.granularity)}`;

    // Off-screen chart rendering for PDF export
    const offScreenCharts = (
        <div
            style={{
                position: 'fixed',
                left: -9999,
                top: -9999,
                width: 800,
                height: 600,
                opacity: 0,
                pointerEvents: 'none',
                zIndex: -1,
            }}
            aria-hidden="true"
        >
            <div ref={volumeRef} style={{ width: 800, height: 400 }}>
                {allChartData.volume.length > 0 && (
                    <DiscreteBarChart
                        data={allChartData.volume as ChartDataPoint[]}
                        config={{ value: { label: 'Requests', color: VOLUME_BAR_COLOR } }}
                        yAxisLabel="Requests"
                        height={350}
                        granularity={filters.granularity}
                        barColor={VOLUME_BAR_COLOR}
                    />
                )}
            </div>
            <div ref={approvalRateRef} style={{ width: 800, height: 400 }}>
                {allChartData['approval-rate'].length > 0 &&
                    (() => {
                        const statusKeys = [
                            'pending',
                            'approved',
                            'conditionally_approved',
                            'partially_approved',
                            'denied',
                            'for_reschedule',
                        ] as const;
                        const config: ChartConfig = {};
                        const categories: string[] = [];
                        statusKeys.forEach((key, i) => {
                            config[key] = { label: formatRequestStatus(key), color: CHART_COLORS[i % CHART_COLORS.length] };
                            categories.push(key);
                        });
                        return (
                            <StackedBarChart
                                data={allChartData['approval-rate'] as ChartDataPoint[]}
                                config={config}
                                categories={categories}
                                yAxisLabel="Requests"
                                height={350}
                                granularity={filters.granularity}
                            />
                        );
                    })()}
            </div>
            <div ref={facilityUtilizationRef} style={{ width: 400, height: 350 }}>
                {allFacilityPieData.length > 0 &&
                    (() => {
                        const categories = sortedCategoryNames(allFacilityPieData);
                        const config: ChartConfig = {};
                        categories.forEach((cat) => {
                            config[cat] = { label: cat, color: categoryColor(cat, categories) };
                        });
                        return (
                            <ChartContainer config={config} className="h-[350px] w-full" initialDimension={{ width: 400, height: 350 }}>
                                <PieChart>
                                    <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
                                    <Legend verticalAlign="bottom" height={36} />
                                    <Pie
                                        data={allFacilityPieData as ChartDataPoint[]}
                                        dataKey="value"
                                        nameKey="category"
                                        cx="50%"
                                        cy="42%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        label={({ category, value }) => `${category}: ${value}`}
                                        labelLine={false}
                                    >
                                        {allFacilityPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={categoryColor(entry.category ?? '', categories)} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ChartContainer>
                        );
                    })()}
            </div>
            <div ref={priorityDistributionRef} style={{ width: 400, height: 350 }}>
                {allChartData['priority-distribution'].length > 0 &&
                    (() => {
                        const aggregated = (allChartData['priority-distribution'] as ChartDataPoint[]).reduce(
                            (acc, d) => {
                                if (d.category) {
                                    acc[d.category] = (acc[d.category] || 0) + d.value;
                                }
                                return acc;
                            },
                            {} as Record<string, number>,
                        );
                        const pieData = Object.entries(aggregated).map(([category, value]) => ({ category, value }));
                        const categories = sortedCategoryNames(pieData);
                        const config: ChartConfig = {};
                        categories.forEach((cat) => {
                            config[cat] = { label: cat, color: categoryColor(cat, categories) };
                        });
                        return (
                            <ChartContainer config={config} className="h-[350px] w-full" initialDimension={{ width: 400, height: 350 }}>
                                <PieChart>
                                    <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
                                    <Legend verticalAlign="bottom" height={36} />
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="category"
                                        cx="50%"
                                        cy="42%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        label={({ category, value }) => `${category}: ${value}`}
                                        labelLine={false}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={categoryColor(entry.category ?? '', categories)} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ChartContainer>
                        );
                    })()}
            </div>
            <div ref={processingTimeRef} style={{ width: 600, height: 300 }}>
                {allChartData['processing-time'].length > 0 && (
                    <PdfVerticalBarChart
                        data={allChartData['processing-time'] as { date: string; value: number }[]}
                        barColor="#5e4db2"
                        referenceLine={{ y: 2, label: 'SLA Target (2 days)' }}
                    />
                )}
            </div>
            <div ref={facilityUsageRef} style={{ width: 600, height: 300 }}>
                {allFacilityPieData.length > 0 && <PdfHorizontalBarChart data={allFacilityPieData as { category: string; value: number }[]} />}
            </div>
            <div ref={userActivityRef} style={{ width: 600, height: 300 }}>
                {allChartData['user-activity'].length > 0 && (
                    <PdfHorizontalBarChart
                        data={(allChartData['user-activity'] as unknown as UserActivityDataPoint[]).map((d) => ({
                            category: d.user_name,
                            value: d.total_requests,
                        }))}
                    />
                )}
            </div>
            <div ref={statusBreakdownRef} style={{ width: 600, height: 300 }}>
                {allChartData['approval-rate'].length > 0 && (
                    <PdfStatusBarChart data={allChartData['approval-rate'] as unknown as { date: string; [key: string]: string | number }[]} />
                )}
            </div>
            <div ref={conflictsRef} style={{ width: 600, height: 300 }}>
                {allChartData['equipment-usage'].length > 0 && (
                    <PdfVerticalBarChart data={allChartData['equipment-usage'] as { date: string; value: number }[]} barColor="#D9890B" />
                )}
            </div>
        </div>
    );

    return (
        <>
            {offScreenCharts}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="frai-eyebrow">GSO Reports · {dateRangeLabel}</p>
                        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Reports</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2">
                            <Filter className="h-4 w-4" />
                            {showFilters ? 'Hide Filters' : 'Show Filters'}
                        </Button>
                        <Button onClick={handleExportPdf} disabled={pdfGenerating || loading} className="gap-2">
                            <Download className="h-4 w-4" />
                            {pdfGenerating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generating...
                                </>
                            ) : loading ? (
                                'Preparing data...'
                            ) : (
                                'Export PDF'
                            )}
                        </Button>
                    </div>
                </div>

                {showFilters && (
                    <FilterPanel
                        filters={filters}
                        defaultFilters={defaultFilters}
                        meta={meta}
                        onFiltersChange={handleFilterChange}
                        onReset={resetFilters}
                    />
                )}

                {kpis && (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {(() => {
                            const deltas = kpiComparison?.deltas ?? {
                                total_requests_pct: null,
                                approval_rate_pct: null,
                                avg_processing_days_pct: null,
                                active_conflicts_pct: null,
                            };
                            return (
                                <>
                                    <StatTile
                                        icon={ClipboardList}
                                        label="Total Requests"
                                        value={kpis.total_requests.toLocaleString()}
                                        sub={formatDeltaSub(deltas.total_requests_pct)}
                                    />
                                    <StatTile
                                        icon={CheckCircle2}
                                        label="Approval Rate"
                                        value={`${kpis.approval_rate}%`}
                                        sub={formatDeltaSub(deltas.approval_rate_pct)}
                                    />
                                    <StatTile
                                        icon={Calendar}
                                        label="Avg Processing Time"
                                        value={`${kpis.avg_processing_days} days`}
                                        sub={formatDeltaSub(deltas.avg_processing_days_pct)}
                                    />
                                    <StatTile
                                        icon={AlertTriangle}
                                        label="Active Conflicts"
                                        value={kpis.active_conflicts}
                                        sub={formatDeltaSub(deltas.active_conflicts_pct)}
                                        variant={kpis.active_conflicts > 0 ? 'warning' : 'default'}
                                    />
                                </>
                            );
                        })()}
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList variant="line" scrollable className="flex gap-1">
                        {REPORT_TABS.map((tab) => (
                            <TabsTrigger key={tab.id} value={tab.id} className="px-3 py-1.5 text-sm font-medium">
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {REPORT_TABS.map((tab) => (
                        <TabsContent key={tab.id} value={tab.id} className="mt-6">
                            <Card className="border-border">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-sm font-semibold">{tab.label}</CardTitle>
                                            <CardDescription className="mt-1">{tab.description}</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 pt-0 md:p-5">
                                    {loading ? (
                                        <div className="flex h-[350px] flex-col items-center justify-center gap-3">
                                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                            <p className="text-sm text-muted-foreground">Loading chart data...</p>
                                        </div>
                                    ) : (
                                        renderChart()
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </>
    );
}
