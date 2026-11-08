import { Cell, Pie, PieChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, leading, pluralize, share } from '@/pages/reports/format';
import { TEMPLATE_COLORS, type UsagePoint } from '@/pages/reports/types';

export function EmptyState({ className }: { className?: string }) {
    return (
        <div className={cn('flex h-[300px] items-center justify-center text-sm text-muted-foreground', className)}>
            No data for this period. Choose a different date range.
        </div>
    );
}

export function TabHeader({ title, summary }: { title: string; summary?: React.ReactNode }) {
    return (
        <div className="mb-4 flex items-center justify-between gap-2">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {summary && <div className="mt-1 text-sm text-muted-foreground">{summary}</div>}
            </div>
        </div>
    );
}

export function Highlight({ children }: { children: React.ReactNode }) {
    return <span className="font-medium text-foreground">{children}</span>;
}

export function LeaderSummary({ rows, kind, unit }: { rows: { label: string; value: number }[]; kind: string; unit: string }) {
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    const top = leading(rows, (row) => row.value);

    if (!top || total === 0) {
        return <p className="text-sm text-muted-foreground">No {pluralize(total, unit)} in this period.</p>;
    }

    const pct = share(top.value, total);

    return (
        <p className="text-sm text-muted-foreground">
            <Highlight>{top.label}</Highlight> is the most common {kind}, with {top.value} of {total} {pluralize(total, unit)} ({formatPercent(pct)}%).
        </p>
    );
}

interface BreakdownTableRow {
    label: string;
    value: number;
    percentage?: number;
    color?: string;
}

interface BreakdownTableProps {
    rows: BreakdownTableRow[];
    showColors?: boolean;
    totalRow?: { label: string; value: number; percentage?: number };
    nameHeader?: string;
}

function BreakdownTable({ rows, showColors, totalRow, nameHeader = 'Name' }: BreakdownTableProps) {
    if (rows.length === 0) {
        return <EmptyState />;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="pl-6">{nameHeader}</TableHead>
                    <TableHead className="sr-only hidden text-left sm:table-cell">Share</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                    <TableHead className="pr-6 text-right">Amount</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row, index) => {
                    const color = row.color ?? TEMPLATE_COLORS[index % TEMPLATE_COLORS.length];
                    const pct = row.percentage ?? 0;

                    return (
                        <TableRow key={row.label}>
                            <TableCell className="pl-6">
                                {showColors ? (
                                    <div className="flex items-center gap-2">
                                        <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                                        <span>{row.label}</span>
                                    </div>
                                ) : (
                                    row.label
                                )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                                <div className="h-1.5 rounded-full bg-muted">
                                    <div className="h-full rounded-full" style={{ background: color, width: `${pct}%` }} />
                                </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatPercent(pct)}%</TableCell>
                            <TableCell className="pr-6 text-right tabular-nums">{formatNumber(row.value, 0)}</TableCell>
                        </TableRow>
                    );
                })}
                {totalRow && (
                    <TableRow className="bg-muted/40 font-medium hover:bg-muted/40">
                        <TableCell className="pl-6">{totalRow.label}</TableCell>
                        <TableCell className="hidden sm:table-cell" />
                        <TableCell className="text-right tabular-nums">{formatPercent(totalRow.percentage ?? 0)}%</TableCell>
                        <TableCell className="pr-6 text-right tabular-nums">{formatNumber(totalRow.value, 0)}</TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}

interface CountTableProps {
    rows: { label: string; value: number }[];
    labelHeader: string;
}

export function CountTable({ rows, labelHeader }: CountTableProps) {
    const total = rows.reduce((sum, row) => sum + row.value, 0);

    const breakdownRows = rows.map((row, index) => ({
        label: row.label,
        value: row.value,
        percentage: share(row.value, total),
        color: TEMPLATE_COLORS[index % TEMPLATE_COLORS.length],
    }));

    const totalRow =
        rows.length > 0
            ? {
                  label: 'Total',
                  value: total,
                  percentage: total > 0 ? 100 : 0,
              }
            : undefined;

    return <BreakdownTable rows={breakdownRows} showColors totalRow={totalRow} nameHeader={labelHeader} />;
}

export function UsageTable({ rows, showColors }: { rows: UsagePoint[]; showColors?: boolean }) {
    const breakdownRows = rows.map((row, index) => ({
        label: row.name,
        value: row.amount,
        percentage: row.percentage,
        color: TEMPLATE_COLORS[index % TEMPLATE_COLORS.length],
    }));

    return <BreakdownTable rows={breakdownRows} showColors={showColors} />;
}

export function CategoryPie({ points, nameKey }: { points: { label: string; value: number }[]; nameKey: string }) {
    const total = points.reduce((sum, point) => sum + point.value, 0);
    const config: ChartConfig = {};
    const data = points.map((point, index) => {
        const color = TEMPLATE_COLORS[index % TEMPLATE_COLORS.length];
        config[point.label] = { label: point.label, color };
        return { [nameKey]: point.label, value: point.value, fill: color };
    });

    if (total === 0) {
        return <EmptyState className="h-[300px]" />;
    }

    return (
        <div className="relative mx-auto h-[300px] w-full max-w-[340px]">
            <ChartContainer config={config} className="aspect-auto h-full w-full">
                <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey={nameKey} hideLabel />} />
                    <Pie data={data} dataKey="value" nameKey={nameKey} innerRadius={0} outerRadius="70%" stroke="#ffffff" strokeWidth={2}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={String(entry.fill)} />
                        ))}
                    </Pie>
                </PieChart>
            </ChartContainer>
        </div>
    );
}
