/**
 * Single source of truth for report colors.
 *
 * Mirrors the FRAI report visual spec (FRAI_Report_Sample_Layout.pdf). These
 * hex values are used by @react-pdf/renderer, which cannot resolve CSS vars.
 *
 * Rules:
 * - A status key ALWAYS maps to the same fixed color (never by encounter order).
 * - No two statuses share a color.
 * - A category (facility / event type) maps to a color by its position in the
 *   alphabetically sorted category list, so colors are stable across renders
 *   and match between chart image, legend, and table.
 */

export const STATUS_KEYS = ['pending', 'approved', 'conditionally_approved', 'partially_approved', 'denied', 'for_reschedule'] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];

export const STATUS_LABELS: Record<StatusKey, string> = {
    pending: 'Pending',
    approved: 'Approved',
    conditionally_approved: 'Conditionally Approved',
    partially_approved: 'Partially Approved',
    denied: 'Denied',
    for_reschedule: 'For Reschedule',
};

/** Short headers for the dense per-date status table in the PDF. */
export const STATUS_SHORT_LABELS: Record<StatusKey, string> = {
    pending: 'Pending',
    approved: 'Approved',
    conditionally_approved: 'Cond. Appr.',
    partially_approved: 'Partial',
    denied: 'Denied',
    for_reschedule: 'Resched.',
};

/* ------------------------------------------------------------------ */
/* Design tokens (spec)                                               */
/* ------------------------------------------------------------------ */

/** Navy #0B2545 — titles, table header text, emphasis. */
export const NAVY = '#0B2545';

/** Ink #1F2937 — body text. */
export const INK = '#1F2937';

/** Muted #6B7280 — captions. */
export const MUTED = '#6B7280';

/** Line #E3E7ED — borders and row rules. */
export const LINE = '#E3E7ED';

/** Grid #D5DAE1 — chart gridlines. */
export const GRID = '#D5DAE1';

/** Surface #F5F7FA — callouts, table headers, bar tracks. */
export const SURFACE = '#F5F7FA';

/** Teal #1B7F8C — primary data color, accents, section chips. */
export const TEAL = '#1B7F8C';

/** Light teal #A9D3D8 — partial periods. */
export const LIGHT_TEAL = '#A9D3D8';

/* Status colors — fixed in every chart and table, no two share a color. */
export const STATUS_COLORS: Record<StatusKey, string> = {
    pending: '#6B7280',
    approved: '#2F855A',
    conditionally_approved: '#1B7F8C',
    partially_approved: '#5B8DEF',
    denied: '#C0392B',
    for_reschedule: '#D9890B',
};

export function statusColor(key: string): string {
    return (STATUS_COLORS as Record<string, string>)[key] ?? MUTED;
}

export function statusLabel(key: string): string {
    return (STATUS_LABELS as Record<string, string>)[key] ?? key;
}

/* Severity colors (escalating): Good, Warning, Orange, Bad, Neutral. */
export const STATUS_SEVERITY = {
    good: '#2F855A',
    warning: '#D9890B',
    orange: '#D9640B',
    bad: '#C0392B',
    neutral: '#9AA3AF',
};

/** Subtitle tint used on page 1 band. #C9D6E8. */
export const SUBTITLE_TINT = '#C9D6E8';

/** Meta line tint used on page 1 band. #9FB3CF. */
export const META_TINT = '#9FB3CF';

/** White text on band / chips. */
export const INK_ON_DARK = '#FFFFFF';

/* Palette for nominal categories (facilities, event types). Index by sorted
 * position so the same category keeps its color everywhere. */
export const CATEGORY_COLORS = [TEAL, '#5e4db2', '#e56910', '#ae3e86', '#4c6b1f', '#c9372c', '#0c66e4', '#216e4e'];

export function sortedCategoryNames(rows: { category?: string }[]): string[] {
    return [...new Set(rows.map((r) => r.category).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b));
}

export function categoryColor(category: string, sortedCategories: string[]): string {
    const idx = sortedCategories.indexOf(category);
    if (idx < 0) return MUTED;
    return CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
}

/** Bar color for single-series discrete-count charts (matches --chart-1 teal). */
export const VOLUME_BAR_COLOR = TEAL;

/** Bar color for processing-time charts (purple). */
export const PROCESSING_BAR_COLOR = '#5e4db2';

/** SLA / threshold reference line color (red). */
export const SLA_LINE_COLOR = '#C0392B';

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
