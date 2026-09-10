import { Buffer } from "buffer";
import { Document, Font, Page, Text, View, StyleSheet, pdf, Image } from "@react-pdf/renderer";
import { format } from "date-fns";

// @react-pdf/renderer expects a Node-style global Buffer when fetching and
// embedding images (chart PNGs). Browsers don't provide one, so polyfill it.
if (typeof globalThis !== "undefined" && !(globalThis as unknown as Record<string, unknown>).Buffer) {
  (globalThis as unknown as Record<string, unknown>).Buffer = Buffer;
}
import {
  STATUS_KEYS,
  STATUS_SHORT_LABELS,
  aggregateByCategory,
  categoryColor,
  sortedCategoryNames,
  statusColor,
  statusLabel,
  trimLeadingZeroBuckets,
} from "@/lib/report-palette";

Font.register({
  family: "Manrope",
  fonts: [
    { src: "/fonts/Manrope-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/Manrope-Medium.ttf", fontWeight: 500 },
    { src: "/fonts/Manrope-SemiBold.ttf", fontWeight: 600 },
    { src: "/fonts/Manrope-Bold.ttf", fontWeight: 700 },
    { src: "/fonts/Manrope-ExtraBold.ttf", fontWeight: 800 },
  ],
});

/* ------------------------------------------------------------------ */
/* Design system                                                       */
/* ------------------------------------------------------------------ */

const INK = "#0f172a";
const MUTED = "#64748b";
const FAINT = "#94a3b8";
const LINE = "#e2e8f0";
const PANEL = "#f8fafc";
const GOOD = "#15803d";
const BAD = "#c9372c";

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 44,
    backgroundColor: "#ffffff",
    fontFamily: "Manrope",
  },
  // Cover
  eyebrow: {
    fontSize: 10,
    fontWeight: 700,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    color: INK,
    marginBottom: 6,
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 2,
  },
  meta: {
    fontSize: 9,
    color: FAINT,
    marginBottom: 2,
  },
  headerRule: {
    marginTop: 16,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: INK,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  summaryBox: {
    padding: 14,
    backgroundColor: PANEL,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LINE,
    marginBottom: 20,
  },
  summaryText: {
    fontSize: 10,
    color: "#334155",
    lineHeight: 1.6,
  },
  // KPI cards
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    width: "48%",
    padding: 14,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LINE,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: 800,
    color: INK,
  },
  kpiDeltaGood: {
    fontSize: 8.5,
    fontWeight: 600,
    color: GOOD,
    marginTop: 4,
  },
  kpiDeltaBad: {
    fontSize: 8.5,
    fontWeight: 600,
    color: BAD,
    marginTop: 4,
  },
  kpiDeltaNeutral: {
    fontSize: 8.5,
    color: FAINT,
    marginTop: 4,
  },
  // Filters
  filtersSection: {
    marginBottom: 8,
    padding: 14,
    backgroundColor: PANEL,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LINE,
  },
  filtersTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  filtersList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  filterTag: {
    fontSize: 9,
    fontWeight: 600,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
    color: "#334155",
  },
  // Chart pages
  chartTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: INK,
    marginBottom: 2,
  },
  chartDescription: {
    fontSize: 10,
    color: MUTED,
    marginBottom: 6,
    lineHeight: 1.5,
  },
  chartCaption: {
    fontSize: 8.5,
    color: FAINT,
    marginBottom: 12,
    lineHeight: 1.5,
  },
  chartImage: {
    width: "100%",
    maxHeight: 420,
    marginBottom: 12,
  },
  chartImageHalf: {
    width: "100%",
    maxHeight: 300,
    marginBottom: 8,
  },
  duoRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  duoCol: {
    width: "48%",
  },
  duoTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: INK,
    marginBottom: 6,
  },
  // Legend (native, print-safe: color swatch + text values)
  legendList: {
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  legendSwatch: {
    width: 9,
    height: 9,
    borderRadius: 2,
    marginRight: 6,
  },
  legendLabel: {
    fontSize: 9,
    color: "#334155",
    width: "60%",
  },
  legendValue: {
    fontSize: 9,
    fontWeight: 600,
    color: INK,
    textAlign: "right",
    width: "40%",
  },
  // Tables
  tableContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  tableTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: INK,
    marginBottom: 6,
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  tableCell: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    fontSize: 8.5,
    color: "#334155",
  },
  tableCellHeader: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    fontSize: 8,
    fontWeight: 700,
    color: INK,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableNote: {
    fontSize: 8.5,
    color: FAINT,
    marginTop: 6,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8.5,
    color: FAINT,
  },
  methodologySection: {
    marginTop: 8,
  },
  methodologyTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: INK,
    marginBottom: 4,
  },
  methodologySubtitle: {
    fontSize: 10,
    color: MUTED,
    marginBottom: 14,
  },
  methodologyItem: {
    marginBottom: 10,
    padding: 12,
    backgroundColor: PANEL,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: LINE,
  },
  methodologyItemLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: "#334155",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  methodologyItemValue: {
    fontSize: 9,
    color: "#475569",
    lineHeight: 1.5,
  },
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface KpiData {
  total_requests: number;
  approval_rate: number;
  avg_processing_days: number;
  active_conflicts: number;
}

export interface KpiDeltas {
  total_requests_pct: number | null;
  approval_rate_pct: number | null;
  avg_processing_days_pct: number | null;
  active_conflicts_pct: number | null;
}

interface MethodologyData {
  total_requests: string;
  approval_rate: string;
  avg_processing_days: string;
  active_conflicts: string;
  facility_usage: string;
  event_types: string;
  processing_time: string;
}

interface ChartDataForPdf {
  type: string;
  title: string;
  description: string;
  data: any[];
  imageUrl?: string;
}

/** Loose row shape for chart data passed into the PDF template. */
interface PdfRow {
  date?: string;
  category?: string;
  value?: number;
  total?: number;
  [key: string]: string | number | undefined;
}

export interface ReportsPdfData {
  filters: {
    start: string;
    end: string;
    granularity: string;
    facilityIds?: number[];
    buildingIds?: number[];
    campusIds?: number[];
    statuses?: string[];
    priorityLevel?: number;
    userId?: number;
  };
  kpis: KpiData;
  kpiDeltas?: KpiDeltas;
  chartsData: ChartDataForPdf[];
  methodology?: MethodologyData;
}

function formatFilterValue(key: string, value: any, meta: any): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (key === "facilityIds") {
      return value.map((id) => meta.facilities?.find((f: any) => f.id === id)?.name ?? id).join(", ");
    }
    if (key === "buildingIds") {
      return value.map((id) => meta.buildings?.find((b: any) => b.id === id)?.name ?? id).join(", ");
    }
    if (key === "campusIds") {
      return value.map((id) => meta.campuses?.find((c: any) => c.id === id)?.name ?? id).join(", ");
    }
    if (key === "statuses") {
      return value.join(", ");
    }
    return value.join(", ");
  }
  if (key === "priorityLevel" && value !== undefined) {
    const priorities: Record<number, string> = { 0: "Academic", 1: "Organization", 2: "University", 3: "Government" };
    return priorities[value] ?? String(value);
  }
  if (key === "userId" && value !== undefined) {
    return meta.users?.find((u: any) => u.id === value)?.name ?? String(value);
  }
  if (key === "granularity") {
    const labels: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
    return labels[value] ?? value;
  }
  return String(value);
}

function granularityNoun(granularity: string): string {
  return granularity === "weekly" ? "week" : granularity === "monthly" ? "month" : "day";
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Footer({ page, total }: { page: number; total: number }) {
  return (
    <View style={styles.footer} fixed>
      <Text>FRAI</Text>
      <Text>
        Page {page} of {total}
      </Text>
    </View>
  );
}

function TableNote({ shown, total, unit }: { shown: number; total: number; unit: string }) {
  if (total <= shown) return null;
  return (
    <Text style={styles.tableNote}>
      Showing {shown} of {total} {unit} — full history available in the app.
    </Text>
  );
}

function TrendText({ pct, invert }: { pct: number | null | undefined; invert?: boolean }) {
  if (pct === null || pct === undefined) {
    return <Text style={styles.kpiDeltaNeutral}>No prior-period data</Text>;
  }
  const good = invert ? pct <= 0 : pct >= 0;
  const sign = pct > 0 ? "+" : "";
  return (
    <Text style={good ? styles.kpiDeltaGood : styles.kpiDeltaBad}>
      {sign}
      {pct.toFixed(1)}% vs. prior period
    </Text>
  );
}

function KpiCard({
  label,
  value,
  delta,
  invert,
}: {
  label: string;
  value: string;
  delta?: number | null;
  invert?: boolean;
}) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <TrendText pct={delta} invert={invert} />
    </View>
  );
}

/** Print-safe legend: color swatch + label + value (readable in grayscale). */
function LegendList({ items }: { items: { label: string; color: string; detail: string }[] }) {
  return (
    <View style={styles.legendList}>
      {items.map((item, i) => (
        <View key={i} style={styles.legendRow}>
          <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
          <Text style={styles.legendLabel}>{item.label}</Text>
          <Text style={styles.legendValue}>{item.detail}</Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Per-chart tables                                                    */
/* ------------------------------------------------------------------ */

const VOLUME_TABLE_CAP = 12;

function VolumeTable({ rows }: { rows: { date: string; value: number }[] }) {
  const trimmed = trimLeadingZeroBuckets(rows);
  const omittedLeading = rows.length - trimmed.length;
  const shown = trimmed.slice(0, VOLUME_TABLE_CAP);
  return (
    <View style={styles.tableContainer}>
      <Text style={styles.tableTitle}>Requests per bucket — data</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellHeader, { width: "50%" }]}>Date</Text>
          <Text style={[styles.tableCellHeader, { width: "50%", textAlign: "right" }]}>Requests</Text>
        </View>
        {shown.map((row, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "50%" }]}>{row.date}</Text>
            <Text style={[styles.tableCell, { width: "50%", textAlign: "right" }]}>{row.value}</Text>
          </View>
        ))}
      </View>
      {omittedLeading > 0 && (
        <Text style={styles.tableNote}>
          {omittedLeading} leading empty {omittedLeading === 1 ? "bucket" : "buckets"} with zero requests omitted.
        </Text>
      )}
      <TableNote shown={shown.length} total={trimmed.length} unit="buckets" />
    </View>
  );
}

const STATUS_TABLE_CAP = 10;

function statusRowTotal(row: PdfRow): number {
  if (typeof row.total === "number") return row.total;
  return STATUS_KEYS.reduce((sum, key) => sum + Number(row[key] ?? 0), 0);
}

function StatusTable({ rows }: { rows: PdfRow[] }) {
  const shown = rows.slice(0, STATUS_TABLE_CAP);
  return (
    <View style={styles.tableContainer}>
      <Text style={styles.tableTitle}>Requests by status — data</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellHeader, { width: "20%" }]}>Date</Text>
          {STATUS_KEYS.map((key) => (
            <Text key={key} style={[styles.tableCellHeader, { width: "10%", textAlign: "right" }]}>
              {STATUS_SHORT_LABELS[key]}
            </Text>
          ))}
          <Text style={[styles.tableCellHeader, { width: "12%", textAlign: "right" }]}>Total</Text>
        </View>
        {shown.map((row, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "20%" }]}>{row.date ?? ""}</Text>
            {STATUS_KEYS.map((key) => (
              <Text key={key} style={[styles.tableCell, { width: "10%", textAlign: "right" }]}>
                {Number(row[key] ?? 0)}
              </Text>
            ))}
            <Text style={[styles.tableCell, { width: "12%", textAlign: "right" }]}>{statusRowTotal(row)}</Text>
          </View>
        ))}
      </View>
      <TableNote shown={shown.length} total={rows.length} unit="buckets" />
    </View>
  );
}

const FACILITY_TABLE_CAP = 8;

function FacilityTable({ rows }: { rows: { category: string; value: number }[] }) {
  const total = rows.reduce((sum, r) => sum + (r.value ?? 0), 0);
  const shown = rows.slice(0, FACILITY_TABLE_CAP);
  return (
    <View style={styles.tableContainer}>
      <Text style={styles.tableTitle}>Bookings by facility — data</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellHeader, { width: "55%" }]}>Facility</Text>
          <Text style={[styles.tableCellHeader, { width: "22%", textAlign: "right" }]}>Bookings</Text>
          <Text style={[styles.tableCellHeader, { width: "23%", textAlign: "right" }]}>Share</Text>
        </View>
        {shown.map((row, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "55%" }]}>{row.category}</Text>
            <Text style={[styles.tableCell, { width: "22%", textAlign: "right" }]}>{row.value}</Text>
            <Text style={[styles.tableCell, { width: "23%", textAlign: "right" }]}>
              {total > 0 ? ((row.value / total) * 100).toFixed(1) : "0.0"}%
            </Text>
          </View>
        ))}
      </View>
      <TableNote shown={shown.length} total={rows.length} unit="facilities" />
    </View>
  );
}

function EventTypesTable({ rows }: { rows: { category?: string; value?: number }[] }) {
  const aggregated = aggregateByCategory(rows);
  const grand = aggregated.reduce((sum, r) => sum + r.total, 0);
  return (
    <View style={styles.tableContainer}>
      <Text style={styles.tableTitle}>Requests by event type (period totals) — data</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellHeader, { width: "55%" }]}>Event type</Text>
          <Text style={[styles.tableCellHeader, { width: "22%", textAlign: "right" }]}>Requests</Text>
          <Text style={[styles.tableCellHeader, { width: "23%", textAlign: "right" }]}>Share</Text>
        </View>
        {aggregated.map((row, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "55%" }]}>{row.category}</Text>
            <Text style={[styles.tableCell, { width: "22%", textAlign: "right" }]}>{row.total}</Text>
            <Text style={[styles.tableCell, { width: "23%", textAlign: "right" }]}>
              {grand > 0 ? ((row.total / grand) * 100).toFixed(1) : "0.0"}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const PROCESSING_TABLE_CAP = 12;

function ProcessingTable({ rows }: { rows: { date: string; value: number }[] }) {
  const shown = rows.slice(0, PROCESSING_TABLE_CAP);
  return (
    <View style={styles.tableContainer}>
      <Text style={styles.tableTitle}>Average decision time — data</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellHeader, { width: "50%" }]}>Date</Text>
          <Text style={[styles.tableCellHeader, { width: "50%", textAlign: "right" }]}>Avg days</Text>
        </View>
        {shown.map((row, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "50%" }]}>{row.date}</Text>
            <Text style={[styles.tableCell, { width: "50%", textAlign: "right" }]}>{row.value}</Text>
          </View>
        ))}
      </View>
      <TableNote shown={shown.length} total={rows.length} unit="buckets" />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Executive summary                                                   */
/* ------------------------------------------------------------------ */

function buildSummary(data: ReportsPdfData): string {
  const { kpis, kpiDeltas, chartsData, filters } = data;
  const parts: string[] = [];

  const range = `${format(new Date(filters.start), "MMMM d, yyyy")} – ${format(
    new Date(filters.end),
    "MMMM d, yyyy"
  )}`;
  parts.push(
    `Between ${range}, ${kpis.total_requests.toLocaleString()} requests received a decision, ` +
      `with an approval rate of ${kpis.approval_rate}% and an average processing time of ${kpis.avg_processing_days} days. ` +
      `${kpis.active_conflicts} conflicting bookings remain active.`
  );

  const facilityChart = chartsData.find((c) => c.type === "facility-utilization");
  if (facilityChart && facilityChart.data.length > 0) {
    const facilityRows = facilityChart.data as PdfRow[];
    const top = [...facilityRows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
    const total = facilityRows.reduce((s: number, r: PdfRow) => s + (r.value ?? 0), 0);
    if (top?.category && total > 0) {
      const topValue = top.value ?? 0;
      parts.push(
        `${top.category} handled the most bookings (${topValue}, ${((topValue / total) * 100).toFixed(0)}% of the total).`
      );
    }
  }

  const eventChart = chartsData.find((c) => c.type === "priority-distribution");
  if (eventChart && eventChart.data.length > 0) {
    const agg = aggregateByCategory(eventChart.data);
    if (agg.length > 0) {
      const grand = agg.reduce((s, r) => s + r.total, 0);
      parts.push(
        `${agg[0].category} was the most common event type (${agg[0].total} requests, ` +
          `${grand > 0 ? ((agg[0].total / grand) * 100).toFixed(0) : "0"}% of classified requests).`
      );
    }
  }

  if (kpiDeltas?.total_requests_pct !== null && kpiDeltas?.total_requests_pct !== undefined) {
    const dir = kpiDeltas.total_requests_pct >= 0 ? "up" : "down";
    parts.push(
      `Decided volume is ${dir} ${Math.abs(kpiDeltas.total_requests_pct).toFixed(1)}% versus the prior period.`
    );
  }

  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

type ChartPage =
  | { kind: "volume"; chart: ChartDataForPdf }
  | { kind: "status"; chart: ChartDataForPdf }
  | { kind: "donuts"; facility?: ChartDataForPdf; events?: ChartDataForPdf }
  | { kind: "processing"; chart: ChartDataForPdf };

export function ReportsPdfDocument({ data, meta }: { data: ReportsPdfData; meta: any }) {
  const { filters, kpis, kpiDeltas, chartsData, methodology } = data;

  const filterTags = Object.entries(filters)
    .filter(([key, value]) => {
      if (key === "granularity") return false;
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== "";
    })
    .map(([key, value]) => ({
      label: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .replace("Ids", "")
        .replace("Level", " Level"),
      value: formatFilterValue(key, value, meta),
    }))
    .filter((f) => f.value);

  const visible = chartsData.filter((c) => c.data.length > 0);
  const byType = (type: string) => visible.find((c) => c.type === type);

  // Group the two donuts onto one shared page when both have data.
  const pages: ChartPage[] = [];
  const volume = byType("volume");
  const status = byType("approval-rate");
  const facility = byType("facility-utilization");
  const events = byType("priority-distribution");
  const processing = byType("processing-time");
  if (volume) pages.push({ kind: "volume", chart: volume });
  if (status) pages.push({ kind: "status", chart: status });
  if (facility || events) pages.push({ kind: "donuts", facility, events });
  if (processing) pages.push({ kind: "processing", chart: processing });

  // Computed ONCE so every footer agrees.
  const totalPages = 1 + pages.length + (methodology ? 1 : 0);

  const bucketNoun = granularityNoun(filters.granularity);
  const summary = buildSummary({ ...data, chartsData: visible });

  const facilityCategories = facility ? sortedCategoryNames(facility.data) : [];
  const facilityTotal = facility
    ? (facility.data as PdfRow[]).reduce((s: number, r: PdfRow) => s + (r.value ?? 0), 0)
    : 0;
  const eventAgg = events ? aggregateByCategory(events.data) : [];
  const eventTotal = eventAgg.reduce((s, r) => s + r.total, 0);
  const eventCategories = events ? sortedCategoryNames(events.data) : [];

  let pageNo = 1;

  return (
    <Document>
      {/* Cover: summary + KPIs + filters */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          {format(new Date(filters.start), "MMMM d, yyyy")} – {format(new Date(filters.end), "MMMM d, yyyy")}
        </Text>
        <Text style={styles.meta}>Generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</Text>
        <Text style={styles.meta}>Granularity: {formatFilterValue("granularity", filters.granularity, meta)}</Text>
        <View style={styles.headerRule} />

        <Text style={styles.sectionTitle}>Executive summary</Text>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>

        <Text style={styles.sectionTitle}>Key figures</Text>
        <View style={styles.kpiGrid}>
          <KpiCard
            label="Decided requests"
            value={kpis.total_requests.toLocaleString()}
            delta={kpiDeltas?.total_requests_pct}
          />
          <KpiCard label="Approval rate" value={`${kpis.approval_rate}%`} delta={kpiDeltas?.approval_rate_pct} />
          <KpiCard
            label="Avg processing time"
            value={`${kpis.avg_processing_days} days`}
            delta={kpiDeltas?.avg_processing_days_pct}
            invert
          />
          <KpiCard
            label="Active conflicts"
            value={String(kpis.active_conflicts)}
            delta={kpiDeltas?.active_conflicts_pct}
            invert
          />
        </View>

        <View style={styles.filtersSection}>
          <Text style={styles.filtersTitle}>Applied filters</Text>
          <View style={styles.filtersList}>
            {filterTags.length > 0 ? (
              filterTags.map((tag, i) => (
                <Text key={i} style={styles.filterTag}>
                  {tag.label}: {tag.value}
                </Text>
              ))
            ) : (
              <Text style={styles.filterTag}>No filters applied</Text>
            )}
          </View>
        </View>

        <Footer page={pageNo} total={totalPages} />
      </Page>

      {pages.map((page, i) => {
        pageNo = i + 2;
        if (page.kind === "volume") {
          return (
            <Page key={`p-${i}`} size="A4" style={styles.page}>
              <Text style={styles.chartTitle}>{page.chart.title}</Text>
              <Text style={styles.chartDescription}>{page.chart.description}</Text>
              <Text style={styles.chartCaption}>
                Each bar is one {bucketNoun} bucket. Bars are discrete counts and are not interpolated — a jump
                between adjacent bars is a real change, not a gradual trend.
              </Text>
              {page.chart.imageUrl && (
                <View>
                  <Image src={page.chart.imageUrl} style={styles.chartImage} />
                </View>
              )}
              <VolumeTable rows={page.chart.data} />
              <Footer page={pageNo} total={totalPages} />
            </Page>
          );
        }
        if (page.kind === "status") {
          return (
            <Page key={`p-${i}`} size="A4" style={styles.page}>
              <Text style={styles.chartTitle}>{page.chart.title}</Text>
              <Text style={styles.chartDescription}>{page.chart.description}</Text>
              <Text style={styles.chartCaption}>
                Stacked bars show the request count per status in each {bucketNoun} bucket. Totals match the
                right-hand column of the table below.
              </Text>
              {page.chart.imageUrl && (
                <View>
                  <Image src={page.chart.imageUrl} style={styles.chartImage} />
                </View>
              )}
              <LegendList
                items={STATUS_KEYS.map((key) => ({
                  label: statusLabel(key),
                  color: statusColor(key),
                  detail: `${(page.chart.data as PdfRow[]).reduce((s: number, r: PdfRow) => s + Number(r[key] ?? 0), 0)} requests`,
                }))}
              />
              <StatusTable rows={page.chart.data} />
              <Footer page={pageNo} total={totalPages} />
            </Page>
          );
        }
        if (page.kind === "donuts") {
          return (
            <Page key={`p-${i}`} size="A4" style={styles.page}>
              <Text style={styles.chartTitle}>Usage breakdown</Text>
              <Text style={styles.chartDescription}>
                Where approved bookings happened and what they were for, over the full selected period.
              </Text>
              <View style={styles.duoRow}>
                {page.facility && (
                  <View style={styles.duoCol}>
                    <Text style={styles.duoTitle}>{page.facility.title}</Text>
                    {page.facility.imageUrl && <Image src={page.facility.imageUrl} style={styles.chartImageHalf} />}
                    <LegendList
                      items={facilityCategories.map((cat) => {
                        const row = (page.facility!.data as PdfRow[]).find((r: PdfRow) => r.category === cat);
                        const value = row?.value ?? 0;
                        return {
                          label: cat,
                          color: categoryColor(cat, facilityCategories),
                          detail: `${value} (${facilityTotal > 0 ? ((value / facilityTotal) * 100).toFixed(1) : "0.0"}%)`,
                        };
                      })}
                    />
                  </View>
                )}
                {page.events && (
                  <View style={styles.duoCol}>
                    <Text style={styles.duoTitle}>{page.events.title}</Text>
                    {page.events.imageUrl && <Image src={page.events.imageUrl} style={styles.chartImageHalf} />}
                    <LegendList
                      items={eventAgg.map((row) => ({
                        label: row.category,
                        color: categoryColor(row.category, eventCategories),
                        detail: `${row.total} (${eventTotal > 0 ? ((row.total / eventTotal) * 100).toFixed(1) : "0.0"}%)`,
                      }))}
                    />
                  </View>
                )}
              </View>
              {page.facility && <FacilityTable rows={page.facility.data} />}
              {page.events && <EventTypesTable rows={page.events.data} />}
              <Footer page={pageNo} total={totalPages} />
            </Page>
          );
        }
        return (
          <Page key={`p-${i}`} size="A4" style={styles.page}>
            <Text style={styles.chartTitle}>{page.chart.title}</Text>
            <Text style={styles.chartDescription}>{page.chart.description}</Text>
            <Text style={styles.chartCaption}>
              Each bar is the average decision time for requests decided in that {bucketNoun} bucket. Buckets with
              no decisions are omitted (not zero-filled), and bars are not interpolated. The dashed line marks the
              2-day SLA target.
            </Text>
            {page.chart.imageUrl && (
              <View>
                <Image src={page.chart.imageUrl} style={styles.chartImage} />
              </View>
            )}
            <ProcessingTable rows={page.chart.data} />
            <Footer page={pageNo} total={totalPages} />
          </Page>
        );
      })}

      {methodology && (
        <Page size="A4" style={styles.page}>
          <View style={styles.methodologySection}>
            <Text style={styles.methodologyTitle}>Methodology &amp; definitions</Text>
            <Text style={styles.methodologySubtitle}>How each figure in this report is computed.</Text>
            <View style={styles.methodologyItem}>
              <Text style={styles.methodologyItemLabel}>Decided requests</Text>
              <Text style={styles.methodologyItemValue}>{methodology.total_requests}</Text>
            </View>
            <View style={styles.methodologyItem}>
              <Text style={styles.methodologyItemLabel}>Approval rate</Text>
              <Text style={styles.methodologyItemValue}>{methodology.approval_rate}</Text>
            </View>
            <View style={styles.methodologyItem}>
              <Text style={styles.methodologyItemLabel}>Avg processing time</Text>
              <Text style={styles.methodologyItemValue}>{methodology.avg_processing_days}</Text>
            </View>
            <View style={styles.methodologyItem}>
              <Text style={styles.methodologyItemLabel}>Active conflicts</Text>
              <Text style={styles.methodologyItemValue}>{methodology.active_conflicts}</Text>
            </View>
            <View style={styles.methodologyItem}>
              <Text style={styles.methodologyItemLabel}>Facility usage</Text>
              <Text style={styles.methodologyItemValue}>{methodology.facility_usage}</Text>
            </View>
            <View style={styles.methodologyItem}>
              <Text style={styles.methodologyItemLabel}>Event types</Text>
              <Text style={styles.methodologyItemValue}>{methodology.event_types}</Text>
            </View>
            <View style={styles.methodologyItem}>
              <Text style={styles.methodologyItemLabel}>Processing time</Text>
              <Text style={styles.methodologyItemValue}>{methodology.processing_time}</Text>
            </View>
          </View>
          <Footer page={totalPages} total={totalPages} />
        </Page>
      )}
    </Document>
  );
}

export async function downloadReportsPdf(data: ReportsPdfData, meta: any) {
  const blob = await pdf(<ReportsPdfDocument data={data} meta={meta} />).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `FRAI_REPORT_${data.filters.start}_to_${data.filters.end}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
