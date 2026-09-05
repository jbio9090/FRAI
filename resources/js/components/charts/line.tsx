"use client";

import { parseISO, format } from "date-fns";
import {
  AreaChart,
  Area,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type Granularity = "daily" | "weekly" | "monthly";

function formatAxisDate(dateStr: string, granularity: Granularity): string {
  try {
    if (granularity === "daily") {
      return format(parseISO(dateStr), "MMM d");
    }
    if (granularity === "weekly") {
      const [year, week] = dateStr.split("-W");
      return `Wk ${week}, ${year}`;
    }
    if (granularity === "monthly") {
      return format(parseISO(`${dateStr}-01`), "MMM yyyy");
    }
  } catch {
    return dateStr;
  }
  return dateStr;
}

interface LineChartProps {
  data: { date: string; value: number; label?: string }[];
  config: ChartConfig;
  title?: string;
  description?: string;
  showArea?: boolean;
  yAxisLabel?: string;
  dateKey?: string;
  valueKey?: string;
  className?: string;
  height?: number;
  granularity?: Granularity;
  referenceLine?: { y: number; label: string; stroke?: string; strokeDasharray?: string };
}

export function LineChart({
  data,
  config,
  title,
  description,
  showArea = true,
  yAxisLabel,
  dateKey = "date",
  valueKey = "value",
  className,
  height = 300,
  granularity = "daily",
  referenceLine,
}: LineChartProps) {
  if (!data.length) {
    return (
      <div className={cn("flex items-center justify-center h-[300px]", className)}>
        <p className="text-sm text-muted-foreground">No data available for the selected period.</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    [dateKey]: d[dateKey],
    [valueKey]: d[valueKey],
    ...(d.label && { label: d.label }),
  }));

  const tickFormatter = (value: string) => formatAxisDate(value, granularity);

  return (
    <ChartContainer config={config} className={cn("w-full", className)} initialDimension={{ width: 600, height }}>
      {showArea ? (
        <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 40, bottom: 60 }}>
          <defs>
            <linearGradient id="fill-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey={dateKey}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            interval="preserveStartEnd"
            minTickGap={40}
            tickFormatter={tickFormatter}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft", offset: 10, fill: "var(--muted-foreground)", fontSize: 11 } : undefined}
          />
          {referenceLine && (
            <ReferenceLine
              y={referenceLine.y}
              label={{
                value: referenceLine.label,
                position: "insideStart",
                offset: 5,
                fill: referenceLine.stroke ?? "var(--ads-danger)",
                fontSize: 10,
                fontWeight: 600,
              }}
              stroke={referenceLine.stroke ?? "var(--ads-danger)"}
              strokeDasharray={referenceLine.strokeDasharray ?? "5 5"}
              strokeWidth={1.5}
            />
          )}
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent labelFormatter={(value) => formatAxisDate(value as string, granularity)} />}
          />
          <Area
            type="monotoneX"
            dataKey={valueKey}
            stroke="var(--primary)"
            fill="url(#fill-area)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--background)", strokeWidth: 2 }}
          />
        </AreaChart>
      ) : (
        <RechartsLineChart data={chartData} margin={{ top: 10, right: 16, left: 40, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey={dateKey}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            interval="preserveStartEnd"
            minTickGap={40}
            tickFormatter={tickFormatter}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          {referenceLine && (
            <ReferenceLine
              y={referenceLine.y}
              label={{
                value: referenceLine.label,
                position: "insideStart",
                offset: 5,
                fill: referenceLine.stroke ?? "var(--ads-danger)",
                fontSize: 10,
                fontWeight: 600,
              }}
              stroke={referenceLine.stroke ?? "var(--ads-danger)"}
              strokeDasharray={referenceLine.strokeDasharray ?? "5 5"}
              strokeWidth={1.5}
            />
          )}
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent labelFormatter={(value) => formatAxisDate(value as string, granularity)} />}
          />
          <Line
            type="monotoneX"
            dataKey={valueKey}
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--background)", strokeWidth: 2 }}
          />
        </RechartsLineChart>
      )}
    </ChartContainer>
  );
}