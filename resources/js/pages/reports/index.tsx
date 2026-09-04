"use client";

import { usePage } from "@inertiajs/react";
import { format, parseISO } from "date-fns";
import {
  BarChart2,
  Calendar,
  ChevronDown,
  Download,
  Filter,
  Loader2,
  X,
  Building2,
  MapPin,
  User,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { PieChart, Pie, Cell } from "recharts";
import { GroupedBarChart } from "@/components/charts/grouped-bar";
import { LineChart } from "@/components/charts/line";
import { StackedBarChart } from "@/components/charts/stacked-bar";
import { downloadReportsPdf } from "@/components/pdf/reports-pdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DefaultLayout from "@/layout.tsx/default.";
import { cn } from "@/lib/utils";
import type { ReportFilters, ReportMeta, ReportKpis, ReportType, ChartDataPoint, Granularity } from "@/types/reports";
import { FilterPanel } from "@/components/reports/filter-panel";

const REPORT_TABS: { id: ReportType; label: string; description: string }[] = [
  { id: "volume", label: "Request Volume", description: "Total requests created over time" },
  { id: "approval-rate", label: "Status Breakdown", description: "Requests by status over time" },
  { id: "facility-utilization", label: "Facility Usage", description: "Total bookings per facility" },
  { id: "priority-distribution", label: "Event Type Distribution", description: "Requests by event type" },
  { id: "conflict-analysis", label: "Conflict Analysis", description: "Time and equipment conflicts over time" },
  { id: "processing-time", label: "Processing Time", description: "Average days from creation to decision" },
];

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function formatDisplayDate(dateStr: string, granularity: Granularity): string {
  const date = parseISO(dateStr);
  switch (granularity) {
    case "daily":
      return format(date, "MMM d, yyyy");
    case "weekly":
      return format(date, "'Week' w, yyyy");
    case "monthly":
      return format(date, "MMMM yyyy");
    default:
      return format(date, "MMM d, yyyy");
  }
}

function KpiTile({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  iconBg: string;
  iconColor: string;
  trend?: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="ads-eyebrow mb-1">{label}</p>
            <p className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">
              {value}
            </p>
            {trend && (
              <p className="mt-1 text-xs text-muted-foreground">{trend}</p>
            )}
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: iconBg }}>
            <Icon className="h-5 w-5" style={{ color: iconColor }} strokeWidth={2} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage({
  meta,
  defaultFilters,
}: {
  meta: ReportMeta;
  defaultFilters: ReportFilters;
}) {
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
  const [activeTab, setActiveTab] = useState<ReportType>("volume");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [kpis, setKpis] = useState<ReportKpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async (type: ReportType, currentFilters: ReportFilters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type,
        start: currentFilters.start,
        end: currentFilters.end,
        granularity: currentFilters.granularity,
        ...(currentFilters.dateType && { date_type: currentFilters.dateType }),
        ...(currentFilters.facilityIds?.length && { facility_ids: currentFilters.facilityIds.join(",") }),
        ...(currentFilters.buildingIds?.length && { building_ids: currentFilters.buildingIds.join(",") }),
        ...(currentFilters.campusIds?.length && { campus_ids: currentFilters.campusIds.join(",") }),
        ...(currentFilters.statuses?.length && { statuses: currentFilters.statuses.join(",") }),
        ...(currentFilters.priorityLevel !== undefined && { priority_level: String(currentFilters.priorityLevel) }),
        ...(currentFilters.userId !== undefined && { user_id: String(currentFilters.userId) }),
      });

      const res = await fetch(`/reports/data?${params.toString()}`);
      const json = await res.json();
      setChartData(json.data || []);

      // Also fetch pie data for facility usage
      if (type === "facility-utilization") {
        const pieParams = new URLSearchParams({
          type: "facility-usage-pie",
          start: currentFilters.start,
          end: currentFilters.end,
          ...(currentFilters.dateType && { date_type: currentFilters.dateType }),
          ...(currentFilters.facilityIds?.length && { facility_ids: currentFilters.facilityIds.join(",") }),
          ...(currentFilters.buildingIds?.length && { building_ids: currentFilters.buildingIds.join(",") }),
          ...(currentFilters.campusIds?.length && { campus_ids: currentFilters.campusIds.join(",") }),
          ...(currentFilters.statuses?.length && { statuses: currentFilters.statuses.join(",") }),
          ...(currentFilters.priorityLevel !== undefined && { priority_level: String(currentFilters.priorityLevel) }),
          ...(currentFilters.userId !== undefined && { user_id: String(currentFilters.userId) }),
        });
        const pieRes = await fetch(`/reports/data?${pieParams.toString()}`);
        const pieJson = await pieRes.json();
        const pieData = pieJson.data || [];
        setFacilityPieData(pieData);
      }
    } catch (error) {
      console.error("Failed to fetch report data:", error);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const [facilityPieData, setFacilityPieData] = useState<ChartDataPoint[]>([]);

  const fetchKpis = useCallback(async (currentFilters: ReportFilters) => {
    setKpisLoading(true);
    try {
      const params = new URLSearchParams({
        type: "kpis",
        start: currentFilters.start,
        end: currentFilters.end,
        ...(currentFilters.dateType && { date_type: currentFilters.dateType }),
        ...(currentFilters.facilityIds?.length && { facility_ids: currentFilters.facilityIds.join(",") }),
        ...(currentFilters.buildingIds?.length && { building_ids: currentFilters.buildingIds.join(",") }),
        ...(currentFilters.campusIds?.length && { campus_ids: currentFilters.campusIds.join(",") }),
        ...(currentFilters.userId !== undefined && { user_id: String(currentFilters.userId) }),
      });

      const res = await fetch(`/reports/data?${params.toString()}`);
      const json = await res.json();
      setKpis(json.data || null);
    } catch (error) {
      console.error("Failed to fetch KPIs:", error);
      setKpis(null);
    } finally {
      setKpisLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeTab, filters);
    fetchKpis(filters);
  }, [activeTab, filters, fetchData, fetchKpis]);

  const handleFilterChange = (newFilters: Partial<ReportFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const hasActiveFilters = useMemo(() => {
    return (
      filters.facilityIds?.length ||
      filters.buildingIds?.length ||
      filters.campusIds?.length ||
      filters.statuses?.length ||
      filters.priorityLevel !== undefined ||
      filters.userId !== undefined
    );
  }, [filters]);

  const getFacilitiesForBuildings = (buildingIds: number[]) => {
    return meta.facilities.filter((f) => buildingIds.includes(f.building_id));
  };

  const getBuildingsForCampuses = (campusIds: number[]) => {
    return meta.buildings.filter((b) => campusIds.includes(b.campus_id));
  };

  const availableFacilities = useMemo(() => {
    if (filters.buildingIds?.length) {
      return getFacilitiesForBuildings(filters.buildingIds);
    }
    return meta.facilities;
  }, [filters.buildingIds, meta.facilities, meta.buildings]);

  const availableBuildings = useMemo(() => {
    if (filters.campusIds?.length) {
      return getBuildingsForCampuses(filters.campusIds);
    }
    return meta.buildings;
  }, [filters.campusIds, meta.buildings, meta.campuses]);

  const renderChart = () => {
    const dataToCheck = activeTab === "facility-utilization" ? facilityPieData : chartData;
    if (!dataToCheck.length) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
            <BarChart2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No data available</p>
          <p className="text-xs text-muted-foreground mt-1">
            No records match the selected filters.
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case "volume": {
        const config: ChartConfig = {
          value: { label: "Requests", color: "var(--chart-1)" },
        };
        return (
          <LineChart
            data={chartData as ChartDataPoint[]}
            config={config}
            title="Request Volume"
            description="Total requests created over time"
            yAxisLabel="Requests"
            height={350}
            granularity={filters.granularity}
          />
        );
      }
      case "approval-rate": {
        const statuses = [
          { key: "pending", label: "Pending", color: "var(--ads-amber)" },
          { key: "approved", label: "Approved", color: "var(--ads-ok)" },
          { key: "conditionally_approved", label: "Conditionally Approved", color: "var(--chart-5)" },
          { key: "partially_approved", label: "Partially Approved", color: "var(--chart-3)" },
          { key: "denied", label: "Denied", color: "var(--ads-danger)" },
          { key: "on_hold", label: "On Hold", color: "var(--ads-neutral)" },
          { key: "for_reschedule", label: "For Reschedule", color: "var(--chart-2)" },
        ];
        const config: ChartConfig = {};
        const categories: string[] = [];
        statuses.forEach((s) => {
          config[s.key] = { label: s.label, color: s.color };
          categories.push(s.key);
        });
        return (
          <StackedBarChart
            data={chartData as ChartDataPoint[]}
            config={config}
            categories={categories}
            title="Request Status Breakdown"
            description="Requests by status over time"
            yAxisLabel="Requests"
            height={350}
            granularity={filters.granularity}
          />
        );
      }
      case "facility-utilization": {
        const categories = [...new Set((facilityPieData as ChartDataPoint[]).map((d) => d.category).filter(Boolean))];
        const config: ChartConfig = {};
        categories.forEach((cat, i) => {
          config[cat] = { label: cat, color: CHART_COLORS[i % CHART_COLORS.length] };
        });
        return (
          <div className="space-y-4">
            <ChartContainer config={config} className="h-[350px] w-full" initialDimension={{ width: 400, height: 350 }}>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
                <Pie
                  data={facilityPieData as ChartDataPoint[]}
                  dataKey="value"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  label={({ category, value }) => `${category}: ${value}`}
                  labelLine={false}
                >
                  {facilityPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`var(--chart-${(index % 5) + 1})`} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>
        );
      }
      case "priority-distribution": {
        const categories = [...new Set((chartData as ChartDataPoint[]).map((d) => d.category).filter(Boolean))];
        const config: ChartConfig = {};
        categories.forEach((cat, i) => {
          config[cat] = { label: cat, color: CHART_COLORS[i % CHART_COLORS.length] };
        });
        return (
          <GroupedBarChart
            data={chartData as ChartDataPoint[]}
            config={config}
            title="Event Type Distribution"
            description="Requests by event type"
            yAxisLabel="Requests"
            height={350}
            categoryKey="category"
            valueKey="value"
            dateKey="date"
            granularity={filters.granularity}
          />
        );
      }
      case "conflict-analysis": {
        const config: ChartConfig = {
          time_conflicts: { label: "Time Conflicts", color: "var(--chart-1)" },
          equipment_conflicts: { label: "Equipment Conflicts", color: "var(--chart-2)" },
        };
        return (
          <StackedBarChart
            data={chartData as ChartDataPoint[]}
            config={config}
            categories={["time_conflicts", "equipment_conflicts"]}
            title="Conflict Analysis"
            description="Time and equipment conflicts over time"
            yAxisLabel="Conflicts"
            height={350}
            granularity={filters.granularity}
          />
        );
      }
      case "processing-time": {
        const config: ChartConfig = {
          value: { label: "Avg Days", color: "var(--chart-1)" },
        };
        return (
          <LineChart
            data={chartData as ChartDataPoint[]}
            config={config}
            title="Processing Time"
            description="Average days from creation to final decision"
            yAxisLabel="Days"
            showArea={false}
            height={350}
            granularity={filters.granularity}
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
      await downloadReportsPdf(
        {
          filters,
          kpis: kpis || {
            total_requests: 0,
            approval_rate: 0,
            avg_processing_days: 0,
            active_conflicts: 0,
          },
          chartsData: REPORT_TABS.map((tab) => ({
            type: tab.id,
            title: tab.label,
            description: tab.description,
            data: activeTab === tab.id ? chartData : [],
          })),
        },
        meta
      );
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setPdfGenerating(false);
    }
  };

  const dateRangeLabel = `${formatDisplayDate(filters.start, filters.granularity)} – ${formatDisplayDate(filters.end, filters.granularity)}`;

  return (
    <DefaultLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="ads-eyebrow">GSO Reports · {dateRangeLabel}</p>
            <h1 className="font-display text-2xl font-semibold tracking-tight mt-1">Reports</h1>
          </div>
          <Button onClick={handleExportPdf} disabled={pdfGenerating} className="gap-2">
            <Download className="h-4 w-4" />
            {pdfGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Export PDF"
            )}
          </Button>
        </div>

        <FilterPanel
          filters={filters}
          defaultFilters={defaultFilters}
          meta={meta}
          onFiltersChange={handleFilterChange}
          onReset={resetFilters}
        />

        {kpis && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile
              label="Total Requests"
              value={kpis.total_requests.toLocaleString()}
              icon={ClipboardList}
              iconBg="var(--primary)"
              iconColor="hsl(var(--primary-foreground))"
            />
            <KpiTile
              label="Approval Rate"
              value={`${kpis.approval_rate}%`}
              icon={CheckCircle2}
              iconBg="var(--ads-ok-bg)"
              iconColor="var(--ads-ok)"
            />
            <KpiTile
              label="Avg Processing Time"
              value={`${kpis.avg_processing_days} days`}
              icon={Calendar}
              iconBg="var(--ads-amber-bg)"
              iconColor="var(--ads-amber)"
            />
            <KpiTile
              label="Active Conflicts"
              value={kpis.active_conflicts}
              icon={AlertTriangle}
              iconBg="var(--ads-danger-bg)"
              iconColor="var(--ads-danger)"
            />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList variant="line" className="flex gap-1">
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
                <CardContent className="p-4 md:p-5 pt-0">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center h-[350px] gap-3">
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
    </DefaultLayout>
  );
}