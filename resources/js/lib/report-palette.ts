/**
 * Single source of truth for report colors.
 *
 * The dashboard renders charts with CSS variables (`var(--chart-N)`), which
 * `@react-pdf/renderer` cannot resolve. These hex values mirror the light
 * theme (`resources/css/app.css`) so the PDF, its native legends/tables, and
 * the screenshotted chart PNGs all use the same colors.
 *
 * Rules:
 * - A status key ALWAYS maps to the same color (by fixed order, never by
 *   encounter order).
 * - A category (facility / event type) maps to a color by its position in the
 *   alphabetically sorted category list, so colors are stable across renders
 *   and match between chart image, legend, and table.
 */

export const STATUS_KEYS = [
  "pending",
  "approved",
  "conditionally_approved",
  "partially_approved",
  "denied",
  "for_reschedule",
] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];

export const STATUS_LABELS: Record<StatusKey, string> = {
  pending: "Pending",
  approved: "Approved",
  conditionally_approved: "Conditionally Approved",
  partially_approved: "Partially Approved",
  denied: "Denied",
  for_reschedule: "For Reschedule",
};

/** Short headers for the dense per-date status table in the PDF. */
export const STATUS_SHORT_LABELS: Record<StatusKey, string> = {
  pending: "Pending",
  approved: "Approved",
  conditionally_approved: "Cond. Appr.",
  partially_approved: "Partial",
  denied: "Denied",
  for_reschedule: "Resched.",
};

/** Mirrors light-theme --chart-1..6 in STATUS_KEYS order. */
export const STATUS_COLORS: Record<StatusKey, string> = {
  pending: "#1d7f8c",
  approved: "#5e4db2",
  conditionally_approved: "#e56910",
  partially_approved: "#ae3e86",
  denied: "#4c6b1f",
  for_reschedule: "#c9372c",
};

export function statusColor(key: string): string {
  return (STATUS_COLORS as Record<string, string>)[key] ?? "#44546f";
}

export function statusLabel(key: string): string {
  return (STATUS_LABELS as Record<string, string>)[key] ?? key;
}

/**
 * Palette for nominal categories (facilities, event types). Index by sorted
 * position so the same category keeps its color everywhere.
 */
export const CATEGORY_COLORS = [
  "#1d7f8c",
  "#5e4db2",
  "#e56910",
  "#ae3e86",
  "#4c6b1f",
  "#c9372c",
  "#0c66e4",
  "#216e4e",
];

export function sortedCategoryNames(rows: { category?: string }[]): string[] {
  return [...new Set(rows.map((r) => r.category).filter((c): c is string => Boolean(c)))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function categoryColor(category: string, sortedCategories: string[]): string {
  const idx = sortedCategories.indexOf(category);
  if (idx < 0) return "#44546f";
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
}

/** Bar color for single-series discrete-count charts (matches --chart-1). */
export const VOLUME_BAR_COLOR = "#1d7f8c";
/** Bar color for processing-time charts (matches --chart-2). */
export const PROCESSING_BAR_COLOR = "#5e4db2";
/** SLA reference line color. */
export const SLA_LINE_COLOR = "#c9372c";

export interface CategoryShare {
  category: string;
  total: number;
  share: number;
}

/** Aggregate date-level `{ category, value }` rows into one row per category. */
export function aggregateByCategory(rows: { category?: string; value?: number }[]): CategoryShare[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.category) continue;
    totals.set(row.category, (totals.get(row.category) ?? 0) + (row.value ?? 0));
  }
  const grand = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([category, total]) => ({
      category,
      total,
      share: grand > 0 ? (total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Drop leading buckets whose value is zero (e.g. weeks of "0" before the
 * first real request). Trailing/inner zeros are kept — they are information.
 */
export function trimLeadingZeroBuckets<T extends { value?: number }>(rows: T[]): T[] {
  const firstNonZero = rows.findIndex((r) => (r.value ?? 0) !== 0);
  if (firstNonZero <= 0) return rows;
  return rows.slice(firstNonZero);
}
