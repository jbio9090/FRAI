export interface ReportPeriod {
    start: string;
    end: string;
    label: string;
}

export interface ReportKpis {
    requests_received: number;
    approval_rate: number;
    total_requesters: number;
    avg_processing_days: number;
}

export interface VolumePoint {
    date: string;
    value: number;
}

export interface CategoryPoint {
    category: string;
    value: number;
}

export interface StatusPoint {
    status: string;
    value: number;
}

export interface UsagePoint {
    name: string;
    amount: number;
    percentage: number;
}

export interface ReportData {
    period: ReportPeriod;
    kpis: ReportKpis;
    volume: VolumePoint[];
    status: StatusPoint[];
    event_types: CategoryPoint[];
    facility_usage: UsagePoint[];
    building_usage: UsagePoint[];
}

export type ReportTab = 'request-volume' | 'request-status' | 'event-types' | 'facility-usage';

export const TEMPLATE_COLORS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
