'use client';

import { parseISO, format } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

type Granularity = 'daily' | 'weekly' | 'monthly';

function formatAxisDate(dateStr: string, granularity: Granularity): string {
    try {
        if (granularity === 'daily') {
            return format(parseISO(dateStr), 'MMM d');
        }
        if (granularity === 'weekly') {
            const [year, week] = dateStr.split('-W');
            return `Wk ${week}, ${year}`;
        }
        if (granularity === 'monthly') {
            return format(parseISO(`${dateStr}-01`), 'MMM yyyy');
        }
    } catch {
        return dateStr;
    }
    return dateStr;
}

interface DiscreteBarChartProps {
    data: { date: string; value: number; label?: string }[];
    config?: ChartConfig;
    yAxisLabel?: string;
    dateKey?: string;
    valueKey?: string;
    className?: string;
    height?: number;
    granularity?: Granularity;
    barColor?: string;
    barRadius?: [number, number, number, number];
    maxBarSize?: number;
    barCategoryGap?: number | string;
    gridStroke?: string;
    gridDasharray?: string;
    xAxisAngle?: number;
    xAxisInterval?: number | 'preserveStartEnd';
    xAxisLineStroke?: string;
    showLegend?: boolean;
    tickFontSize?: number;
    tickColor?: string;
    referenceLine?: { y: number; label: string; stroke?: string; strokeDasharray?: string };
}

/**
 * Bar chart for discrete per-bucket counts (request volume, avg processing
 * days). Each bucket renders as its own categorical bar — nothing is
 * interpolated between buckets, so a jump from 0 to 9 reads as a jump, not a
 * smooth ramp. Buckets with no data are omitted rather than connected over.
 */
export function DiscreteBarChart({
    data,
    config,
    yAxisLabel,
    dateKey = 'date',
    valueKey = 'value',
    className,
    height = 300,
    granularity = 'daily',
    barColor = '#1d7f8c',
    barRadius = [4, 4, 0, 0],
    maxBarSize = 36,
    barCategoryGap,
    gridStroke = 'var(--border)',
    gridDasharray = '3 3',
    xAxisAngle = 0,
    xAxisInterval = 'preserveStartEnd',
    xAxisLineStroke,
    showLegend = false,
    tickFontSize = 12,
    tickColor = 'var(--muted-foreground)',
    referenceLine,
}: DiscreteBarChartProps) {
    if (!data.length) {
        return (
            <div className={cn('flex h-[300px] items-center justify-center', className)}>
                <p className="text-sm text-muted-foreground">No data available for the selected period.</p>
            </div>
        );
    }

    const chartConfig: ChartConfig = config ?? {
        [valueKey]: { label: yAxisLabel ?? 'Value', color: barColor },
    };

    const tickFormatter = (value: string) => formatAxisDate(value, granularity);
    const rotatedLabels = xAxisAngle !== 0;
    const gridStrokeDasharray = gridDasharray === 'none' ? undefined : gridDasharray;

    return (
        <ChartContainer config={chartConfig} className={cn('w-full', className)} initialDimension={{ width: 600, height }}>
            <BarChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: rotatedLabels ? 80 : 60 }} barCategoryGap={barCategoryGap}>
                <CartesianGrid strokeDasharray={gridStrokeDasharray} stroke={gridStroke} vertical={false} />
                <XAxis
                    dataKey={dateKey}
                    type="category"
                    tickLine={false}
                    axisLine={xAxisLineStroke ? { stroke: xAxisLineStroke } : false}
                    tickMargin={10}
                    tick={{ fontSize: tickFontSize, fill: tickColor }}
                    interval={xAxisInterval}
                    minTickGap={typeof xAxisInterval === 'number' ? 0 : 40}
                    angle={xAxisAngle}
                    textAnchor={rotatedLabels ? 'end' : 'middle'}
                    height={rotatedLabels ? 60 : 30}
                    tickFormatter={tickFormatter}
                />
                <YAxis
                    tick={{ fontSize: tickFontSize, fill: tickColor }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    allowDecimals={false}
                    width={44}
                    label={
                        yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', offset: 10, fill: tickColor, fontSize: 11 } : undefined
                    }
                />
                {referenceLine && (
                    <ReferenceLine
                        y={referenceLine.y}
                        label={{
                            value: referenceLine.label,
                            position: 'insideStart',
                            offset: 5,
                            fill: referenceLine.stroke ?? '#c9372c',
                            fontSize: 10,
                            fontWeight: 600,
                        }}
                        stroke={referenceLine.stroke ?? '#c9372c'}
                        strokeDasharray={referenceLine.strokeDasharray ?? '5 5'}
                        strokeWidth={1.5}
                    />
                )}
                <ChartTooltip
                    cursor={{ fill: 'var(--muted)' }}
                    content={<ChartTooltipContent labelFormatter={(value) => formatAxisDate(value as string, granularity)} />}
                />
                <Bar dataKey={valueKey} fill={barColor} radius={barRadius} maxBarSize={maxBarSize}>
                    {data.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={barColor} />
                    ))}
                </Bar>
                {showLegend && <ChartLegend content={<ChartLegendContent className="text-[11px] text-muted-foreground" />} />}
            </BarChart>
        </ChartContainer>
    );
}
