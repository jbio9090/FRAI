export type Granularity = 'daily' | 'weekly' | 'monthly';

export type ReportType =
  | 'volume'
  | 'approval-rate'
  | 'facility-utilization'
  | 'equipment-usage'
  | 'priority-distribution'
  | 'user-activity'
  | 'processing-time';

export interface ReportFilters {
  start: string;
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