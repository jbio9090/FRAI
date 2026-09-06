"use client";

import { parseISO, format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, Cell } from "recharts";
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

interface GroupedBarChartProps {
  data: { date: string; category: string; value: number; fill?: string }[];
  config: ChartConfig;
  title?: string;
  description?: string;
  dateKey?: string;
  categoryKey?: string;
  valueKey?: string;
  yAxisLabel?: string;
  className?: string;
  height?: number;
  horizontal?: boolean;
  granularity?: Granularity;
}

export function GroupedBarChart({
  data,
  config,
  dateKey = "date",
  categoryKey = "category",
  valueKey = "value",
  yAxisLabel,
  className,
  height = 300,
  horizontal = false,
  granularity = "daily",
}: GroupedBarChartProps) {
  if (!data.length) {
    return (
      <div className={cn("flex items-center justify-center h-[300px]", className)}>
        <p className="text-sm text-muted-foreground">No data available for the selected period.</p>
      </div>
    );
  }

  const categories = [...new Set(data.map((d) => d[categoryKey]))];
  const dates = [...new Set(data.map((d) => d[dateKey]))];

  const chartData = dates.map((date) => {
    const row: Record<string, string | number> = { [dateKey]: date };
    categories.forEach((cat) => {
      const match = data.find((d) => d[dateKey] === date && d[categoryKey] === cat);
      row[cat] = match?.[valueKey] ?? 0;
    });
    return row;
  });

  const chartConfig: ChartConfig = { ...config };

  const getLabel = (key: string) => chartConfig[key]?.label ?? key;

  const barFill = (index: number) => `var(--chart-${(index % 5) + 1})`;

  const tickFormatter = (value: string) => formatAxisDate(value, granularity);

  return (
    <ChartContainer config={chartConfig} className={cn("w-full", className)} initialDimension={{ width: 600, height }}>
      <BarChart data={chartData} margin={{ top: 10, right: 30, left: 40, bottom: 60 }} layout={horizontal ? "vertical" : "horizontal"}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={!horizontal} horizontal={horizontal} />
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
          width={horizontal ? 120 : 80}
          tickFormatter={tickFormatter}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent nameKey={dateKey} labelFormatter={(value) => formatAxisDate(value as string, granularity)} nameFormatter={(key) => getLabel(key)} />}
        />
        <Legend
          verticalAlign="top"
          height={36}
          formatter={(key) => getLabel(key)}
        />
        {categories.map((category, index) => (
          <Bar
            key={category}
            dataKey={category}
            fill={barFill(index)}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={32}
          >
            {chartData.map((_, i) => (
              <Cell key={`cell-${i}-${index}`} fill={barFill(index)} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}