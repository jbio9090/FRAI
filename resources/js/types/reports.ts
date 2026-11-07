export type Granularity = 'daily' | 'weekly' | 'monthly';

export type ReportType =
    'volume' | 'approval-rate' | 'facility-utilization' | 'equipment-usage' | 'priority-distribution' | 'user-activity' | 'processing-time';

export interface ReportFilters {
    /** Start month as YYYY-MM (frontend month-only dropdown contract). */
    start: string;
    /** End month as YYYY-MM (frontend month-only dropdown contract). */
    end: string;
    facilityIds?: number[];
    buildingIds?: number[];
    campusIds?: number[];
    statuses?: string[];
    priorityLevel?: number;
    userId?: number;
    granularity: Granularity;
    dateType?: 'event_date' | 'approval_date' | 'submission_date';
}

export interface ChartDataPoint {
    date: string;
    value: number;
    label?: string;
    category?: string;
    fill?: string;
    approved?: number;
    processed?: number;
    rate?: number;
    time_conflicts?: number;
    equipment_conflicts?: number;
    total?: number;
}

export interface UserActivityDataPoint {
    user_id: number;
    user_name: string;
    total_requests: number;
    approved_requests: number;
    approval_rate: number;
}

export interface ReportKpis {
    total_requests: number;
    approval_rate: number;
    avg_processing_days: number;
    active_conflicts: number;
}

export interface KpiComparison {
    current: ReportKpis;
    previous: ReportKpis;
    deltas: {
        total_requests_pct: number | null;
        approval_rate_pct: number | null;
        avg_processing_days_pct: number | null;
        active_conflicts_pct: number | null;
    };
}

export interface ReportMeta {
    facilities: { id: number; name: string; building_id: number }[];
    buildings: { id: number; name: string; campus_id: number }[];
    campuses: { id: number; name: string }[];
    users: { id: number; name: string }[];
    statuses: { value: string; label: string }[];
    priorities: { value: number; label: string }[];
}

export interface ReportResponse {
    data: ChartDataPoint[] | UserActivityDataPoint[];
    filters: ReportFilters;
}

export interface ReportTab {
    id: ReportType;
    label: string;
    description: string;
}

/* ------------------------------------------------------------------ */
/* New: PDF report component data shapes (spec)                       */
/* ------------------------------------------------------------------ */

/** Meta shown on page 1 band and footer. */
export interface ReportPeriodMeta {
    period: string; // e.g. "Nov 1 – Nov 30, 2025"
    audience: string; // e.g. "GSO Administrators"
    dataAsOf: string; // e.g. "Nov 30, 2025"
    priorPeriod: string; // e.g. "Oct 1 – Oct 31, 2025"
    generatedAt: string; // e.g. "Nov 30, 2025 · 4:12 PM"
}

/** One KPI card (4 across). */
export interface KpiCard {
    tabColor: string; // 22x3 colored tab (teal by default)
    label: string; // 6.8pt bold caps muted
    value: string; // 27pt bold navy (main number)
    valueUnit?: string; // smaller unit line below value (e.g. "days")
    context1: string; // 7.4pt muted (change vs prior period)
    context2: string; // 7.4pt muted (target)
    chipText: string; // 6.2pt bold white caps (e.g. "BELOW TARGET")
    chipColor: string; // status color; gray (#9AA3AF) when no target
}

/** One cell of the secondary stat strip (4 cells). */
export interface StatCell {
    value: string; // 14pt bold navy
    label: string; // 7.4pt muted
}

/** One key finding item (max 4). */
export interface KeyFinding {
    number: number; // 15pt bold teal in 22pt gutter
    lead: string; // bold lead sentence
    body: string; // one or two sentences
}

/** One callout box. */
export interface Callout {
    label: string; // 7.8pt bold caps ("WHAT THIS MEANS" / "DECISIONS REQUESTED" / data note)
    body: string; // 9/13pt body
    accentColor: string; // teal / navy / amber (4pt left bar)
}

/** One chart card. */
export interface ChartCard {
    title: string; // action title stating the finding (9.6pt bold navy)
    subtitle: string; // muted (what is plotted, units, n)
    imageUrl?: string; // captured chart PNG
    data?: ChartDataPoint[]; // raw data for fallback table
}

/** One table column. */
export interface TableColumn {
    key: string;
    header: string;
    align?: 'left' | 'right';
}

/** One row of a table (loose shape). */
export interface PdfRow {
    [key: string]: string | number | undefined;
}

/** One main section (one per page). */
export interface SectionData {
    number: string; // digit or letter (appendix)
    title: string; // 17pt bold navy
    question: string; // 9pt muted one-liner
    basis: string; // basis line
    chartCards: ChartCard[];
    tableTitle?: string;
    tableColumns?: TableColumn[];
    tableRows?: PdfRow[];
    tableTotalRow?: PdfRow;
    tableNote?: string;
    callout?: Callout;
}

/** Full data assembled for the PDF document. */
export interface ReportsPdfData {
    meta: ReportPeriodMeta;
    kpiCards: KpiCard[];
    statStrip: StatCell[];
    keyFindings: KeyFinding[];
    decisionsCallout: Callout;
    sections: SectionData[];
    methodology: Record<string, string>;
    appendixATables: { title: string; columns: TableColumn[]; rows: PdfRow[] }[];
    appendixBMethodology: { label: string; value: string }[];
    dataNotesCallout?: Callout;
}
