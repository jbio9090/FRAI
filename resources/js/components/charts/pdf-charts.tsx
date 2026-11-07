'use client';

import { format, parseISO } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts';

import { TEAL, NAVY, MUTED, GRID, SLA_LINE_COLOR, LIGHT_TEAL, STATUS_COLORS, STATUS_KEYS } from '@/lib/report-palette';

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

/* ------------------------------------------------------------------ */
/* Vertical bar chart (time / ordered buckets)                        */
/* ------------------------------------------------------------------ */

interface PdfVerticalBarProps {
    data: { date: string; value: number }[];
    barColor?: string;
    height?: number;
    granularity?: Granularity;
    referenceLine?: { y: number; label: string };
    highlightMax?: boolean;
    partialPeriod?: boolean;
}

export function PdfVerticalBarChart({
    data,
    barColor = TEAL,
    height = 260,
    granularity = 'daily',
    referenceLine,
    highlightMax = true,
    partialPeriod = false,
}: PdfVerticalBarProps) {
    if (!data.length) return null;

    const maxVal = Math.max(...data.map((d) => d.value));
    const tickFormatter = (value: string) => formatAxisDate(value, granularity);

    const barFill = (idx: number) => {
        if (partialPeriod) return LIGHT_TEAL;
        if (highlightMax && data[idx].value === maxVal && maxVal > 0) return NAVY;
        return barColor;
    };

    return (
        <div style={{ width: 600, height, fontFamily: 'Manrope' }}>
            <BarChart data={data} margin={{ top: 8, right: 24, left: 44, bottom: 44 }} barCategoryGap={6}>
                <CartesianGrid strokeDasharray="2 2" stroke={GRID} vertical={false} />
                <ReferenceLine y={0} stroke={NAVY} strokeWidth={1} />
                {referenceLine && (
                    <ReferenceLine
                        y={referenceLine.y}
                        label={{
                            value: referenceLine.label,
                            position: 'insideStart',
                            offset: 4,
                            fill: SLA_LINE_COLOR,
                            fontSize: 8,
                            fontWeight: 700,
                        }}
                        stroke={SLA_LINE_COLOR}
                        strokeDasharray="4 4"
                        strokeWidth={1}
                    />
                )}
                <XAxis
                    dataKey="date"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 7.5, fill: MUTED }}
                    tickMargin={6}
                    interval="preserveStartEnd"
                    minTickGap={30}
                    tickFormatter={tickFormatter}
                />
                <YAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 7.5, fill: MUTED }}
                    tickMargin={4}
                    width={32}
                    allowDecimals={false}
                    tickCount={4}
                />
                <LabelList
                    dataKey="value"
                    position="top"
                    offset={2}
                    fontSize={7.5}
                    fontWeight="bold"
                    fill={NAVY}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => (v === 0 || v === null ? '0' : String(v))}
                />
                <Bar dataKey="value" radius={[0, 0, 0, 0]} maxBarSize={24}>
                    {data.map((_, i) => (
                        <Cell key={`vb-${i}`} fill={barFill(i)} />
                    ))}
                </Bar>
            </BarChart>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Horizontal bar chart (categories with long names)                  */
/* ------------------------------------------------------------------ */

interface PdfHorizontalBarProps {
    data: { category: string; value: number; fill?: string }[];
    height?: number;
    defaultColor?: string;
}

export function PdfHorizontalBarChart({ data, height = 260, defaultColor = TEAL }: PdfHorizontalBarProps) {
    if (!data.length) return null;

    const sorted = [...data].sort((a, b) => b.value - a.value);
    const maxVal = Math.max(...sorted.map((d) => d.value));

    const barFill = (value: number): string => {
        if (value === maxVal && maxVal > 0) return NAVY;
        if (value === 0) return MUTED;
        return defaultColor;
    };

    return (
        <div style={{ width: 600, height, fontFamily: 'Manrope' }}>
            <BarChart data={sorted} margin={{ top: 8, right: 24, left: 96, bottom: 24 }} layout="vertical" barCategoryGap={8}>
                <CartesianGrid strokeDasharray="2 2" stroke={GRID} horizontal={false} />
                <ReferenceLine x={0} stroke={NAVY} strokeWidth={1} />
                <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 7.5, fill: MUTED }}
                    tickMargin={4}
                    width={32}
                    allowDecimals={false}
                    tickCount={4}
                />
                <YAxis
                    dataKey="category"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 8, fill: MUTED }}
                    tickMargin={4}
                    width={96}
                />
                <LabelList
                    dataKey="value"
                    position="right"
                    offset={4}
                    fontSize={7.5}
                    fontWeight="bold"
                    fill={NAVY}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => (v === 0 || v === null ? '0' : String(v))}
                />
                <Bar dataKey="value" radius={[0, 0, 0, 0]} maxBarSize={20}>
                    {sorted.map((d, i) => (
                        <Cell key={`hb-${i}`} fill={d.fill ?? barFill(d.value)} />
                    ))}
                </Bar>
            </BarChart>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Status breakdown bars (one bar per date, segmented by status)      */
/* ------------------------------------------------------------------ */

interface PdfStatusBarProps {
    data: { date: string; [key: string]: string | number }[];
    height?: number;
    granularity?: Granularity;
}

export function PdfStatusBarChart({ data, height = 260, granularity = 'daily' }: PdfStatusBarProps) {
    if (!data.length) return null;

    const tickFormatter = (value: string) => formatAxisDate(value, granularity);

    return (
        <div style={{ width: 600, height, fontFamily: 'Manrope' }}>
            <BarChart data={data} margin={{ top: 8, right: 24, left: 44, bottom: 44 }} barCategoryGap={4}>
                <CartesianGrid strokeDasharray="2 2" stroke={GRID} vertical={false} />
                <ReferenceLine y={0} stroke={NAVY} strokeWidth={1} />
                <XAxis
                    dataKey="date"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 7.5, fill: MUTED }}
                    tickMargin={6}
                    interval="preserveStartEnd"
                    minTickGap={30}
                    tickFormatter={tickFormatter}
                />
                <YAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 7.5, fill: MUTED }}
                    tickMargin={4}
                    width={32}
                    allowDecimals={false}
                    tickCount={4}
                />
                {STATUS_KEYS.map((key, idx) => (
                    <Bar key={key} dataKey={key} stackId="statuses" radius={[0, 0, 0, 0]} maxBarSize={20}>
                        {data.map((_, i) => (
                            <Cell key={`sb-${i}-${idx}`} fill={STATUS_COLORS[key]} />
                        ))}
                    </Bar>
                ))}
            </BarChart>
        </div>
    );
}
