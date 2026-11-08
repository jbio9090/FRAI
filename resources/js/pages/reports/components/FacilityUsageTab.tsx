import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryPie, Highlight, TabHeader, UsageTable } from '@/pages/reports/components/ReportCharts';
import { formatPercent, leading, share } from '@/pages/reports/format';
import type { ReportData } from '@/pages/reports/types';

export function FacilityUsageTab({ report }: { report: ReportData }) {
    const total = report.facility_usage.reduce((sum, row) => sum + row.amount, 0);
    const top = leading(report.facility_usage, (row) => row.amount);

    const summary = total === 0
        ? 'No bookings in this period.'
        : (
            <>
                <Highlight>{top!.name}</Highlight> is the most booked facility, at {formatPercent(share(top!.amount, total))}% of bookings.
            </>
        );

    return (
        <>
            <TabHeader title="Facility Usage" summary={summary} />
            <div className="grid w-full max-w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
                <Card className="w-full max-w-full min-w-0 overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Facilities</CardTitle>
                        <CardDescription>Bookings per facility.</CardDescription>
                    </CardHeader>
                    <CardContent className="max-w-full min-w-0 overflow-hidden">
                        <CategoryPie
                            points={report.facility_usage.map((row) => ({ label: row.name, value: row.amount }))}
                            nameKey="facility"
                        />
                    </CardContent>
                </Card>
                <Card className="w-full max-w-full min-w-0 overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Facility usage detail</CardTitle>
                        <CardDescription>Share of bookings per facility.</CardDescription>
                    </CardHeader>
                    <CardContent className="max-w-full min-w-0 overflow-hidden p-0">
                        <UsageTable rows={report.facility_usage} showColors />
                    </CardContent>
                </Card>
            </div>
            <Card className="mt-6 w-full max-w-full min-w-0 overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Building usage</CardTitle>
                    <CardDescription>Share of bookings per building.</CardDescription>
                </CardHeader>
                <CardContent className="max-w-full min-w-0 overflow-hidden p-0">
                    <UsageTable rows={report.building_usage} showColors />
                </CardContent>
            </Card>
        </>
    );
}
