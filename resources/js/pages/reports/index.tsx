"use client";

import { format, parseISO } from "date-fns";
import { toPng } from "html-to-image";
import {
  BarChart2,
  Calendar,
  Download,
  Loader2,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { PieChart, Pie, Cell } from "recharts";
import { LineChart } from "@/components/charts/line";
import { StackedBarChart } from "@/components/charts/stacked-bar";
import { downloadReportsPdf } from "@/components/pdf/reports-pdf";
import { FilterPanel } from "@/components/reports/filter-panel";
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
import { formatRequestStatus } from "@/lib/formatters";
import type { ReportFilters, ReportMeta, ReportKpis, ReportType, ChartDataPoint, Granularity, KpiComparison } from "@/types/reports";

const REPORT_TABS: { id: ReportType; label: string; description: string }[] = [
  { id: "volume", label: "Request Volume", description: "Total requests created over time" },
  { id: "approval-rate", label: "Status Breakdown", description: "Requests by status over time" },
  { id: "facility-utilization", label: "Facility Usage", description: "Total bookings per facility" },
  { id: "priority-distribution", label: "Event Types", description: "Requests by event type" },
  { id: "processing-time", label: "Processing Time", description: "Average days from creation to decision" },
];

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
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
  delta,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  iconBg: string;
  iconColor: string;
  delta?: { value: number; label: string; positive: boolean } | null;
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
            {delta && (
              <p className="mt-1 text-xs flex items-center gap-1" style={{ color: delta.positive ? "var(--ads-ok)" : "var(--ads-danger)" }}>
                <span className="font-medium">{delta.value > 0 ? "+" : ""}{delta.value.toFixed(1)}%</span>
                <span className="text-muted-foreground">vs. previous period</span>
              </p>
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
  const [kpiComparison, setKpiComparison] = useState<KpiComparison | null>(null);
  const [methodology, setMethodology] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [allChartData, setAllChartData] = useState<Record<ReportType, ChartDataPoint[]>>({
    volume: [],
    "approval-rate": [],
    "facility-utilization": [],
    "priority-distribution": [],
    "processing-time": [],
    "user-activity": [],
    "equipment-usage": [],
  });
  const [allFacilityPieData, setAllFacilityPieData] = useState<ChartDataPoint[]>([]);

  const volumeRef = useRef<HTMLDivElement>(null);
  const approvalRateRef = useRef<HTMLDivElement>(null);
  const facilityUtilizationRef = useRef<HTMLDivElement>(null);
  const priorityDistributionRef = useRef<HTMLDivElement>(null);
  const processingTimeRef = useRef<HTMLDivElement>(null);
  const userActivityRef = useRef<HTMLDivElement>(null);
  const equipmentUsageRef = useRef<HTMLDivElement>(null);

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
    }
  }, []);

  const fetchKpisComparison = useCallback(async (currentFilters: ReportFilters) => {
    try {
      const params = new URLSearchParams({
        type: "kpis-comparison",
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
      setKpiComparison(json.data || null);
    } catch (error) {
      console.error("Failed to fetch KPI comparison:", error);
      setKpiComparison(null);
    }
  }, []);

  const fetchMethodology = useCallback(async (currentFilters: ReportFilters) => {
    try {
      const params = new URLSearchParams({
        type: "methodology",
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
      return json.data || {};
    } catch (error) {
      console.error("Failed to fetch methodology:", error);
      return {};
    }
  }, []);

  const fetchAllChartData = useCallback(async (currentFilters: ReportFilters) => {
    const types: ReportType[] = [
      "volume",
      "approval-rate",
      "facility-utilization",
      "priority-distribution",
      "processing-time",
      "user-activity",
      "equipment-usage",
    ];

    const results: Record<ReportType, ChartDataPoint[]> = {
      volume: [],
      "approval-rate": [],
      "facility-utilization": [],
      "priority-distribution": [],
      "processing-time": [],
      "user-activity": [],
      "equipment-usage": [],
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
            ...(currentFilters.facilityIds?.length && { facility_ids: currentFilters.facilityIds.join(",") }),
            ...(currentFilters.buildingIds?.length && { building_ids: currentFilters.buildingIds.join(",") }),
            ...(currentFilters.campusIds?.length && { campus_ids: currentFilters.campusIds.join(",") }),
            ...(currentFilters.statuses?.length && { statuses: currentFilters.statuses.join(",") }),
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
      })
    );

    // Also fetch facility usage pie data
    try {
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
      setAllFacilityPieData(pieJson.data || []);
    } catch (error) {
      console.error("Failed to fetch facility-usage-pie data:", error);
      setAllFacilityPieData([]);
    }

    flushSync(() => {
      setAllChartData(results);
    });
  }, []);

  const captureChartImages = async () => {
    const images: Record<ReportType, string> = {
      volume: "",
      "approval-rate": "",
      "facility-utilization": "",
      "equipment-usage": "",
      "priority-distribution": "",
      "user-activity": "",
      "processing-time": "",
    };

    const chartConfigs: { type: ReportType; ref: React.RefObject<HTMLDivElement | null>; data: ChartDataPoint[] }[] = [
      { type: "volume", ref: volumeRef, data: allChartData.volume },
      { type: "approval-rate", ref: approvalRateRef, data: allChartData["approval-rate"] },
      { type: "facility-utilization", ref: facilityUtilizationRef, data: allFacilityPieData },
      { type: "priority-distribution", ref: priorityDistributionRef, data: allChartData["priority-distribution"] },
      { type: "processing-time", ref: processingTimeRef, data: allChartData["processing-time"] },
    ];

    for (const { type, ref, data } of chartConfigs) {
      // Check if ref is attached
      if (!ref.current) {
        console.warn(`Ref not attached for ${type} chart`);
        images[type] = "";
        continue;
      }
      
      if (data.length > 0) {
        try {
          // Delay to ensure Recharts is fully rendered
          await new Promise((resolve) => setTimeout(resolve, 300));
          const pngDataUrl = await toPng(ref.current!, {
            backgroundColor: "#ffffff",
            pixelRatio: 2,
            quality: 0.95,
            skipFonts: true,
            skipAutoDetect: true,
          });
          images[type] = pngDataUrl;
        } catch (error) {
          console.error(`Failed to capture ${type} chart:`, error);
          images[type] = "";
        }
      } else {
        images[type] = "";
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
        const statusKeys = [
          "pending",
          "approved",
          "conditionally_approved",
          "partially_approved",
          "denied",
          "for_reschedule",
        ] as const;
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
        // Aggregate data across all dates to get total per category
        const aggregated = (chartData as ChartDataPoint[]).reduce((acc, d) => {
          if (d.category) {
            acc[d.category] = (acc[d.category] || 0) + d.value;
          }
          return acc;
        }, {} as Record<string, number>);
        const pieData = Object.entries(aggregated).map(([category, value]) => ({ category, value }));
        const categories = [...new Set(pieData.map((d) => d.category).filter(Boolean))];
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
                  data={pieData}
                  dataKey="value"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  label={({ category, value }) => `${category}: ${value}`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`var(--chart-${(index % 5) + 1})`} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>
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
            referenceLine={{ y: 2, label: "SLA Target (2 days)", stroke: "var(--ads-danger)", strokeDasharray: "5 5" }}
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
      // Fetch all chart data first
      await fetchAllChartData(filters);
      // Fetch methodology
      const methodologyData = await fetchMethodology(filters);
      setMethodology(methodologyData);

      // Wait for state to update and component to re-render with charts
      await new Promise((resolve) => setTimeout(resolve, 1500));
      // Force multiple frames for refs to attach and Recharts to render
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      // Extra delay for Recharts internal rendering
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Capture chart images from off-screen render
      const images = await captureChartImages();

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
            data: allChartData[tab.id] || [],
            imageUrl: images[tab.id],
          })),
          methodology: methodologyData,
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

  // Off-screen chart rendering for PDF export
  const offScreenCharts = (
    <div
      style={{
        position: "fixed",
        left: -9999,
        top: -9999,
        width: 800,
        height: 600,
        opacity: 0,
        pointerEvents: "none",
        zIndex: -1,
      }}
      aria-hidden="true"
    >
      <div ref={volumeRef} style={{ width: 800, height: 400 }}>
        {allChartData.volume.length > 0 && (
          <LineChart
            data={allChartData.volume as ChartDataPoint[]}
            config={{ value: { label: "Requests", color: "var(--chart-1)" } }}
            title="Request Volume"
            description="Total requests created over time"
            yAxisLabel="Requests"
            height={350}
            granularity={filters.granularity}
          />
        )}
      </div>
      <div ref={approvalRateRef} style={{ width: 800, height: 400 }}>
        {allChartData["approval-rate"].length > 0 && (() => {
          const statusKeys = [
            "pending", "approved", "conditionally_approved", "partially_approved", "denied", "for_reschedule",
          ] as const;
          const config: ChartConfig = {};
          const categories: string[] = [];
          statusKeys.forEach((key, i) => {
            config[key] = { label: formatRequestStatus(key), color: CHART_COLORS[i % CHART_COLORS.length] };
            categories.push(key);
          });
          return (
            <StackedBarChart
              data={allChartData["approval-rate"] as ChartDataPoint[]}
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
        {allFacilityPieData.length > 0 && (() => {
          const categories = [...new Set(allFacilityPieData.map((d) => d.category).filter(Boolean))];
          const config: ChartConfig = {};
          categories.forEach((cat, i) => {
            config[cat] = { label: cat, color: CHART_COLORS[i % CHART_COLORS.length] };
          });
          return (
            <ChartContainer config={config} className="h-[350px] w-full" initialDimension={{ width: 400, height: 350 }}>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
                <Pie
                  data={allFacilityPieData as ChartDataPoint[]}
                  dataKey="value"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  label={({ category, value }) => `${category}: ${value}`}
                  labelLine={false}
                >
                  {allFacilityPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`var(--chart-${(index % 5) + 1})`} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          );
        })()}
      </div>
      <div ref={priorityDistributionRef} style={{ width: 400, height: 350 }}>
        {allChartData["priority-distribution"].length > 0 && (() => {
          const aggregated = (allChartData["priority-distribution"] as ChartDataPoint[]).reduce((acc, d) => {
            if (d.category) {
              acc[d.category] = (acc[d.category] || 0) + d.value;
            }
            return acc;
          }, {} as Record<string, number>);
          const pieData = Object.entries(aggregated).map(([category, value]) => ({ category, value }));
          const categories = [...new Set(pieData.map((d) => d.category).filter(Boolean))];
          const config: ChartConfig = {};
          categories.forEach((cat, i) => {
            config[cat] = { label: cat, color: CHART_COLORS[i % CHART_COLORS.length] };
          });
          return (
            <ChartContainer config={config} className="h-[350px] w-full" initialDimension={{ width: 400, height: 350 }}>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  label={({ category, value }) => `${category}: ${value}`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`var(--chart-${(index % 5) + 1})`} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          );
        })()}
      </div>
      <div ref={processingTimeRef} style={{ width: 800, height: 400 }}>
        {allChartData["processing-time"].length > 0 && (
          <LineChart
            data={allChartData["processing-time"] as ChartDataPoint[]}
            config={{ value: { label: "Avg Days", color: "var(--chart-1)" } }}
            title="Processing Time"
            description="Average days from creation to final decision"
            yAxisLabel="Days"
            showArea={false}
            height={350}
            granularity={filters.granularity}
            referenceLine={{ y: 2, label: "SLA Target (2 days)", stroke: "var(--ads-danger)", strokeDasharray: "5 5" }}
          />
        )}
      </div>
    </div>
  );

  return (
    <DefaultLayout>
      {offScreenCharts}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="ads-eyebrow">GSO Reports · {dateRangeLabel}</p>
            <h1 className="font-display text-2xl font-semibold tracking-tight mt-1">Reports</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </Button>
            <Button
              onClick={handleExportPdf}
              disabled={pdfGenerating || loading}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {pdfGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : loading ? (
                "Preparing data..."
              ) : (
                "Export PDF"
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(() => {
                const deltas = kpiComparison?.deltas ?? {
                  total_requests_pct: null,
                  approval_rate_pct: null,
                  avg_processing_days_pct: null,
                  active_conflicts_pct: null,
                };
                return (
                  <>
                    <KpiTile
                      label="Total Requests"
                      value={kpis.total_requests.toLocaleString()}
                      icon={ClipboardList}
                      iconBg="var(--primary)"
                      iconColor="hsl(var(--primary-foreground))"
                      delta={deltas.total_requests_pct !== null ? {
                        value: deltas.total_requests_pct,
                        label: "vs. previous period",
                        positive: deltas.total_requests_pct >= 0
                      } : null}
                    />
                    <KpiTile
                      label="Approval Rate"
                      value={`${kpis.approval_rate}%`}
                      icon={CheckCircle2}
                      iconBg="var(--ads-ok-bg)"
                      iconColor="var(--ads-ok)"
                      delta={deltas.approval_rate_pct !== null ? {
                        value: deltas.approval_rate_pct,
                        label: "vs. previous period",
                        positive: deltas.approval_rate_pct >= 0
                      } : null}
                    />
                    <KpiTile
                      label="Avg Processing Time"
                      value={`${kpis.avg_processing_days} days`}
                      icon={Calendar}
                      iconBg="var(--ads-amber-bg)"
                      iconColor="var(--ads-amber)"
                      delta={deltas.avg_processing_days_pct !== null ? {
                        value: deltas.avg_processing_days_pct,
                        label: "vs. previous period",
                        positive: deltas.avg_processing_days_pct <= 0
                      } : null}
                    />
                    <KpiTile
                      label="Active Conflicts"
                      value={kpis.active_conflicts}
                      icon={AlertTriangle}
                      iconBg="var(--ads-danger-bg)"
                      iconColor="var(--ads-danger)"
                      delta={deltas.active_conflicts_pct !== null ? {
                        value: deltas.active_conflicts_pct,
                        label: "vs. previous period",
                        positive: deltas.active_conflicts_pct <= 0
                      } : null}
                    />
                  </>
                );
              })()}
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