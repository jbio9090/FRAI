import { Document, Font, Page, Text, View, StyleSheet, pdf, Image } from "@react-pdf/renderer";
import { format } from "date-fns";

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

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: "#ffffff",
    fontFamily: "Manrope",
  },
  header: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
  },
  meta: {
    fontSize: 11,
    color: "#94a3b8",
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 30,
  },
  kpiCard: {
    width: "48%",
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 700,
    color: "#0f172a",
  },
  filtersSection: {
    marginBottom: 30,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filtersTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#334155",
    marginBottom: 8,
  },
  filtersList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterTag: {
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#ffffff",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: "#475569",
  },
  chartPage: {
    padding: 40,
    backgroundColor: "#ffffff",
    fontFamily: "Manrope",
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 4,
  },
  chartDescription: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 16,
  },
  chartImage: {
    width: "100%",
    maxHeight: 500,
  },
  tableContainer: {
    marginTop: 16,
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableCell: {
    padding: 8,
    fontSize: 9,
    color: "#334155",
  },
  tableCellHeader: {
    padding: 8,
    fontSize: 9,
    fontWeight: 700,
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    color: "#94a3b8",
  },
});

interface KpiData {
  total_requests: number;
  approval_rate: number;
  avg_processing_days: number;
  active_conflicts: number;
}

interface ChartDataForPdf {
  type: string;
  title: string;
  description: string;
  data: any[];
}

interface ReportsPdfData {
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
  chartsData: ChartDataForPdf[];
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

export function ReportsPdfDocument({ data, meta }: { data: ReportsPdfData; meta: any }) {
  const { filters, kpis, chartsData } = data;

  const filterTags = Object.entries(filters)
    .filter(([key, value]) => {
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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>GSO Facility Requests Report</Text>
          <Text style={styles.subtitle}>
            {format(new Date(filters.start), "MMMM d, yyyy")} – {format(new Date(filters.end), "MMMM d, yyyy")}
          </Text>
          <Text style={styles.meta}>Generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</Text>
          <Text style={styles.meta}>Granularity: {formatFilterValue("granularity", filters.granularity, meta)}</Text>
        </View>

        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Requests</Text>
            <Text style={styles.kpiValue}>{kpis.total_requests.toLocaleString()}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Approval Rate</Text>
            <Text style={styles.kpiValue}>{kpis.approval_rate}%</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg Processing Time</Text>
            <Text style={styles.kpiValue}>{kpis.avg_processing_days} days</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Active Conflicts</Text>
            <Text style={styles.kpiValue}>{kpis.active_conflicts}</Text>
          </View>
        </View>

        <View style={styles.filtersSection}>
          <Text style={styles.filtersTitle}>Applied Filters</Text>
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

        <View style={styles.footer}>
          <Text>GSO Facility Management System</Text>
          <Text>Page 1 of {1 + chartsData.filter((c) => c.data.length > 0).length}</Text>
        </View>
      </Page>

      {chartsData
        .filter((chart) => chart.data.length > 0)
        .map((chart, index) => (
          <Page key={index} size="A4" style={styles.chartPage}>
            <Text style={styles.chartTitle}>{chart.title}</Text>
            <Text style={styles.chartDescription}>{chart.description}</Text>
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>
                Data points: {chart.data.length}
              </Text>
              {chart.type === "user-activity" && chart.data.length > 0 && (
                <View style={styles.tableContainer}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableCellHeader, { width: "40%" }]}>User</Text>
                    <Text style={[styles.tableCellHeader, { width: "20%", textAlign: "right" }]}>Total</Text>
                    <Text style={[styles.tableCellHeader, { width: "20%", textAlign: "right" }]}>Approved</Text>
                    <Text style={[styles.tableCellHeader, { width: "20%", textAlign: "right" }]}>Rate</Text>
                  </View>
                  {chart.data.slice(0, 20).map((row: any, i: number) => (
                    <View key={i} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { width: "40%" }]}>{row.user_name}</Text>
                      <Text style={[styles.tableCell, { width: "20%", textAlign: "right" }]}>{row.total_requests}</Text>
                      <Text style={[styles.tableCell, { width: "20%", textAlign: "right" }]}>{row.approved_requests}</Text>
                      <Text style={[styles.tableCell, { width: "20%", textAlign: "right" }]}>{row.approval_rate}%</Text>
                    </View>
                  ))}
                </View>
              )}
              {chart.type !== "user-activity" && chart.data.length > 0 && (
                <View style={styles.tableContainer}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableCellHeader, { width: "40%" }]}>Date</Text>
                    <Text style={[styles.tableCellHeader, { width: "30%", textAlign: "right" }]}>Value</Text>
                    {chart.data[0]?.category && (
                      <Text style={[styles.tableCellHeader, { width: "30%" }]}>Category</Text>
                    )}
                    {chart.data[0]?.approved !== undefined && (
                      <>
                        <Text style={[styles.tableCellHeader, { width: "30%", textAlign: "right" }]}>Approved</Text>
                        <Text style={[styles.tableCellHeader, { width: "30%", textAlign: "right" }]}>Processed</Text>
                        <Text style={[styles.tableCellHeader, { width: "30%", textAlign: "right" }]}>Rate %</Text>
                      </>
                    )}
                    {chart.data[0]?.time_conflicts !== undefined && (
                      <>
                        <Text style={[styles.tableCellHeader, { width: "30%", textAlign: "right" }]}>Time Conflicts</Text>
                        <Text style={[styles.tableCellHeader, { width: "30%", textAlign: "right" }]}>Equip Conflicts</Text>
                        <Text style={[styles.tableCellHeader, { width: "30%", textAlign: "right" }]}>Total</Text>
                      </>
                    )}
                  </View>
                  {chart.data.slice(0, 30).map((row: any, i: number) => (
                    <View key={i} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { width: "40%" }]}>{row.date}</Text>
                      <Text style={[styles.tableCell, { width: "30%", textAlign: "right" }]}>{row.value ?? row.total_requests ?? "-"}</Text>
                      {row.category && <Text style={[styles.tableCell, { width: "30%" }]}>{row.category}</Text>}
                      {row.approved !== undefined && (
                        <>
                          <Text style={[styles.tableCell, { width: "30%", textAlign: "right" }]}>{row.approved}</Text>
                          <Text style={[styles.tableCell, { width: "30%", textAlign: "right" }]}>{row.processed}</Text>
                          <Text style={[styles.tableCell, { width: "30%", textAlign: "right" }]}>{row.rate}%</Text>
                        </>
                      )}
                      {row.time_conflicts !== undefined && (
                        <>
                          <Text style={[styles.tableCell, { width: "30%", textAlign: "right" }]}>{row.time_conflicts}</Text>
                          <Text style={[styles.tableCell, { width: "30%", textAlign: "right" }]}>{row.equipment_conflicts}</Text>
                          <Text style={[styles.tableCell, { width: "30%", textAlign: "right" }]}>{row.total}</Text>
                        </>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.footer}>
              <Text>GSO Facility Management System</Text>
              <Text>Page {index + 2} of {1 + chartsData.filter((c) => c.data.length > 0).length}</Text>
            </View>
          </Page>
        ))}
    </Document>
  );
}

export async function downloadReportsPdf(data: ReportsPdfData, meta: any) {
  const blob = await pdf(<ReportsPdfDocument data={data} meta={meta} />).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gso-reports-${data.filters.start}_to_${data.filters.end}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}