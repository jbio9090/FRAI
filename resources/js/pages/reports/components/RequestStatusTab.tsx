import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryPie, CountTable, LeaderSummary, TabHeader } from '@/pages/reports/components/ReportCharts';
import type { ReportData } from '@/pages/reports/types';

export function RequestStatusTab({ report }: { report: ReportData }) {
    return (
        <>
            <TabHeader
                title="Request Status"
                summary={
                    <LeaderSummary rows={report.status.map((row) => ({ label: row.status, value: row.value }))} kind="status" unit="request" />
                }
            />
            <div className="grid w-full max-w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
                <Card className="w-full max-w-full min-w-0 overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Request Status</CardTitle>
                        <CardDescription>Distribution of requests by status.</CardDescription>
                    </CardHeader>
                    <CardContent className="max-w-full min-w-0 overflow-hidden">
                        <CategoryPie
                            points={report.status.map((row) => ({ label: row.status, value: row.value }))}
                            nameKey="status"
                        />
                    </CardContent>
                </Card>
                <Card className="w-full max-w-full min-w-0 overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Status breakdown</CardTitle>
                        <CardDescription>Counts per request status.</CardDescription>
                    </CardHeader>
                    <CardContent className="max-w-full min-w-0 overflow-hidden p-0">
                        <CountTable rows={report.status.map((row) => ({ label: row.status, value: row.value }))} labelHeader="Request Status" />
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
