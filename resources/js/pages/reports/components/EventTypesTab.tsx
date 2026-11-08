import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryPie, CountTable, LeaderSummary, TabHeader } from '@/pages/reports/components/ReportCharts';
import type { ReportData } from '@/pages/reports/types';

export function EventTypesTab({ report }: { report: ReportData }) {
    return (
        <>
            <TabHeader
                title="Event Types"
                summary={
                    <LeaderSummary rows={report.event_types.map((row) => ({ label: row.category, value: row.value }))} kind="event type" unit="request" />
                }
            />
            <div className="grid w-full max-w-full min-w-0 grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
                <Card className="w-full max-w-full min-w-0 overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Event Types</CardTitle>
                        <CardDescription>Requests by event type.</CardDescription>
                    </CardHeader>
                    <CardContent className="max-w-full min-w-0 overflow-hidden">
                        <CategoryPie
                            points={report.event_types.map((row) => ({ label: row.category, value: row.value }))}
                            nameKey="category"
                        />
                    </CardContent>
                </Card>
                <Card className="w-full max-w-full min-w-0 overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Event type breakdown</CardTitle>
                        <CardDescription>Counts per event type.</CardDescription>
                    </CardHeader>
                    <CardContent className="max-w-full min-w-0 overflow-hidden p-0">
                        <CountTable rows={report.event_types.map((row) => ({ label: row.category, value: row.value }))} labelHeader="Event Type" />
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
