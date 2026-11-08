import { formatNumber, formatPercent } from '@/pages/reports/format';
import { type ReportKpis } from '@/pages/reports/types';

interface KpiStripProps {
    kpis: ReportKpis;
}

export function KpiStrip({ kpis }: KpiStripProps) {
    const empty = kpis.requests_received === 0;

    const approvalRate = empty
        ? '—'
        : `${formatPercent(kpis.approval_rate)}%`;
    const avgProcessing = empty
        ? '—'
        : `${formatNumber(kpis.avg_processing_days)} days`;

    return (
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-xl border bg-border">
            <div className="bg-card px-5 py-4">
                <dt className="text-sm text-muted-foreground">Requests received</dt>
                <dd className="font-display text-2xl md:text-3xl font-semibold tracking-tight tabular-nums">
                    {formatNumber(kpis.requests_received, 0)}
                </dd>
            </div>
            <div className="bg-card px-5 py-4">
                <dt className="text-sm text-muted-foreground">Approval rate</dt>
                <dd className="font-display text-2xl md:text-3xl font-semibold tracking-tight tabular-nums">
                    {approvalRate}
                </dd>
            </div>
            <div className="bg-card px-5 py-4">
                <dt className="text-sm text-muted-foreground">Total requesters</dt>
                <dd className="font-display text-2xl md:text-3xl font-semibold tracking-tight tabular-nums">
                    {formatNumber(kpis.total_requesters, 0)}
                </dd>
            </div>
            <div className="bg-card px-5 py-4">
                <dt className="text-sm text-muted-foreground">Avg. processing time</dt>
                <dd className="font-display text-2xl md:text-3xl font-semibold tracking-tight tabular-nums">
                    {avgProcessing}
                </dd>
            </div>
        </dl>
    );
}
