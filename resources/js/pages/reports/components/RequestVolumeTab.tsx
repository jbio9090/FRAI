import { DiscreteBarChart } from '@/components/charts/discrete-bar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, TabHeader, Highlight } from '@/pages/reports/components/ReportCharts';
import { formatDay, formatNumber, leading, pluralize } from '@/pages/reports/format';
import type { ReportData } from '@/pages/reports/types';

export function RequestVolumeTab({ report }: { report: ReportData }) {
    const total = report.volume.reduce((sum, point) => sum + point.value, 0);
    const peak = leading(report.volume, (point) => point.value);
    const avg = report.volume.length > 0 ? total / report.volume.length : 0;

    const summary =
        total === 0 ? (
            'No requests were submitted in this period.'
        ) : (
            <>
                Busiest on <Highlight>{formatDay(peak!.date)}</Highlight> with {pluralize(peak!.value, 'request', 'requests')}, averaging{' '}
                {formatNumber(avg)} per day.
            </>
        );

    return (
        <>
            <TabHeader title="Request Volume" summary={summary} />
            <Card className="w-full max-w-full min-w-0 overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Requests per day</CardTitle>
                    <CardDescription>Distinct requests submitted on each date of the selected period.</CardDescription>
                </CardHeader>
                <CardContent className="max-w-full min-w-0 overflow-hidden">
                    {total === 0 ? (
                        <EmptyState className="h-[360px]" />
                    ) : (
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
                    )}
                </CardContent>
            </Card>
        </>
    );
}
