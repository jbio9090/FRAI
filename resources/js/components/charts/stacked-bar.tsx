"use client";

import { parseISO, format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
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

interface StackedBarChartProps {
  data: { date: string; [key: string]: number | string }[];
  config: ChartConfig;
  categories: string[];
  title?: string;
  description?: string;
  dateKey?: string;
  yAxisLabel?: string;
  className?: string;
  height?: number;
  stacked?: boolean;
  granularity?: Granularity;
}

export function StackedBarChart({
  data,
  config,
  categories,
  title,
  description,
  dateKey = "date",
  yAxisLabel,
  className,
  height = 300,
  stacked = true,
  granularity = "daily",
}: StackedBarChartProps) {
  if (!data.length) {
    return (
      <div className={cn("flex items-center justify-center h-[300px]", className)}>
        <p className="text-sm text-muted-foreground">No data available for the selected period.</p>
      </div>
    );
  }

  const chartConfig: ChartConfig = { ...config };
  categories.forEach((cat, i) => {
    chartConfig[cat] = {
      label: cat,
      color: `var(--chart-${(i % 5) + 1})`,
    };
  });

  const barFill = (index: number) => `var(--chart-${(index % 5) + 1})`;

  const tickFormatter = (value: string) => formatAxisDate(value, granularity);

  return (
    <ChartContainer config={chartConfig} className={cn("w-full", className)} initialDimension={{ width: 600, height }}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 40, bottom: 0 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickMargin={10}
          label={yAxisLabel ? { value: yAxisLabel, position: "insideTop", offset: -10, fill: "var(--muted-foreground)", fontSize: 11 } : undefined}
        />
        <YAxis
          type="category"
          dataKey={dateKey}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          width={100}
          tickFormatter={tickFormatter}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent nameKey={dateKey} labelFormatter={(value) => formatAxisDate(value as string, granularity)} />}
        />
        <Legend verticalAlign="top" height={36} />
        {categories.map((category, index) => (
          <Bar
            key={category}
            dataKey={category}
            stackId="a"
            fill={barFill(index)}
            radius={[0, 0, 0, 0]}
            maxBarSize={32}
          >
            {data.map((_, i) => (
              <Cell key={`cell-${i}-${index}`} fill={barFill(index)} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}