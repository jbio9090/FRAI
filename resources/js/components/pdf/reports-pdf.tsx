import { Buffer } from 'buffer';
import { Document, Font, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import React from 'react';

import { NAVY, INK, MUTED, LINE, SURFACE, TEAL, SUBTITLE_TINT, META_TINT, INK_ON_DARK } from '@/lib/report-palette';

import type { ReportsPdfData, PdfRow, KpiCard, StatCell, KeyFinding, Callout, ChartCard } from '@/types/reports';

if (typeof globalThis !== 'undefined' && !(globalThis as unknown as Record<string, unknown>).Buffer) {
    (globalThis as unknown as Record<string, unknown>).Buffer = Buffer;
}

Font.register({
    family: 'Manrope',
    fonts: [
        { src: '/fonts/Manrope-Regular.ttf', fontWeight: 400 },
        { src: '/fonts/Manrope-Bold.ttf', fontWeight: 700 },
    ],
});

/* ------------------------------------------------------------------ */
/* Page geometry (A4 portrait)                                        */
/* ------------------------------------------------------------------ */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LR = 48;
const MARGIN_TOP_P2 = 60;
const MARGIN_BOTTOM = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LR * 2; // ~499.28

const BAND_HEIGHT = 178;
const TEAL_RULE_WIDTH = 3;
const BAND_GAP = 14;

/* ------------------------------------------------------------------ */
/* Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
    page: {
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        backgroundColor: '#ffffff',
        fontFamily: 'Manrope',
    },
    // Page 1 content (below band + teal rule)
    pageContentP1: {
        paddingHorizontal: MARGIN_LR,
        paddingTop: BAND_HEIGHT + TEAL_RULE_WIDTH + BAND_GAP,
        paddingBottom: MARGIN_BOTTOM,
    },
    // Pages 2+ content (below running header)
    pageContent: {
        paddingHorizontal: MARGIN_LR,
        paddingTop: MARGIN_TOP_P2,
        paddingBottom: MARGIN_BOTTOM,
    },
    // ---- Page 1 band ----
    band: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: BAND_HEIGHT,
        backgroundColor: NAVY,
    },
    bandContent: {
        paddingLeft: MARGIN_LR,
        paddingRight: MARGIN_LR,
        paddingTop: 22,
        paddingBottom: 14,
    },
    coverBrandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    bandLogo: {
        width: 26,
        height: 26,
        marginRight: 8,
    },
    bandEyebrow: {
        fontSize: 9.5,
        fontWeight: 700,
        color: INK_ON_DARK,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    bandTitle: {
        fontSize: 25,
        fontWeight: 700,
        color: INK_ON_DARK,
        marginBottom: 6,
        lineHeight: 1.2,
    },
    bandSubtitle: {
        fontSize: 12,
        color: SUBTITLE_TINT,
        marginBottom: 2,
        lineHeight: 1.4,
    },
    bandMeta: {
        fontSize: 8.5,
        color: META_TINT,
        lineHeight: 1.4,
    },
    tealRule: {
        position: 'absolute',
        top: BAND_HEIGHT,
        left: 0,
        right: 0,
        height: TEAL_RULE_WIDTH,
        backgroundColor: TEAL,
    },
    // ---- Eyebrow labels (page 1 + sections) ----
    eyebrow: {
        fontSize: 8.5,
        fontWeight: 700,
        color: TEAL,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 4,
    },
    // ---- Running header (pages 2+) ----
    runningHeader: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    runningHeaderTitle: {
        fontSize: 7.8,
        color: MUTED,
    },
    runningHeaderRule: {
        height: 0.5,
        backgroundColor: LINE,
        marginBottom: 4,
        width: '100%',
    },
    // ---- Footer (all pages) ----
    footer: {
        position: 'absolute',
        bottom: MARGIN_BOTTOM - 8,
        left: MARGIN_LR,
        right: MARGIN_LR,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        borderTopWidth: 0.5,
        borderTopColor: LINE,
        paddingTop: 6,
    },
    footerLeft: {
        fontSize: 7.6,
        color: MUTED,
        lineHeight: 1.2,
    },
    footerRight: {
        fontSize: 7.6,
        color: MUTED,
    },
    // ---- Section heading ----
    sectionHead: {
        marginBottom: 8,
    },
    sectionHeadRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    sectionChip: {
        width: 24,
        height: 24,
        backgroundColor: TEAL,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        flexShrink: 0,
    },
    sectionChipNumber: {
        fontSize: 12,
        fontWeight: 700,
        color: INK_ON_DARK,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: 700,
        color: NAVY,
        lineHeight: 1.2,
    },
    sectionQuestion: {
        fontSize: 9,
        color: MUTED,
        lineHeight: 1.4,
    },
    sectionRule: {
        height: 0.5,
        backgroundColor: LINE,
        marginTop: 4,
        width: '100%',
    },
    basisLine: {
        fontSize: 7.8,
        color: MUTED,
        marginTop: 4,
        marginBottom: 10,
        lineHeight: 1.4,
    },
    // ---- KPI cards ----
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 10,
    },
    kpiCard: {
        width: (CONTENT_WIDTH - 30) / 4,
        height: 104,
        backgroundColor: '#ffffff',
        borderWidth: 0.9,
        borderColor: LINE,
        borderRadius: 6,
        padding: 8,
    },
    kpiTab: {
        width: 22,
        height: 3,
        marginBottom: 6,
    },
    kpiLabel: {
        fontSize: 6.8,
        fontWeight: 700,
        color: MUTED,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 2,
        lineHeight: 1,
    },
    kpiValue: {
        fontSize: 27,
        fontWeight: 700,
        color: NAVY,
        marginBottom: 4,
        lineHeight: 1,
    },
    kpiValueUnit: {
        fontSize: 14,
        fontWeight: 700,
        color: NAVY,
        marginBottom: 4,
        lineHeight: 1,
    },
    kpiContext: {
        fontSize: 7.4,
        color: MUTED,
        marginBottom: 1,
        lineHeight: 1.2,
    },
    kpiChip: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    kpiChipText: {
        fontSize: 6.2,
        fontWeight: 700,
        color: INK_ON_DARK,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    // ---- Stat strip ----
    statStrip: {
        flexDirection: 'row',
        backgroundColor: SURFACE,
        borderWidth: 0.9,
        borderColor: LINE,
        borderRadius: 6,
        overflow: 'hidden',
        marginBottom: 10,
    },
    statCell: {
        flex: 1,
        paddingTop: 8,
        paddingBottom: 8,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    statDivider: {
        width: 0.5,
        backgroundColor: LINE,
    },
    statValue: {
        fontSize: 14,
        fontWeight: 700,
        color: NAVY,
        marginBottom: 1,
        lineHeight: 1.1,
    },
    statLabel: {
        fontSize: 7.4,
        color: MUTED,
        lineHeight: 1.2,
        textAlign: 'center',
    },
    // ---- Key findings ----
    keyFindings: {
        marginBottom: 10,
    },
    findingItem: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    findingGutter: {
        width: 22,
        flexShrink: 0,
    },
    findingNumber: {
        fontSize: 15,
        fontWeight: 700,
        color: TEAL,
    },
    findingBody: {
        flex: 1,
        paddingLeft: 6,
    },
    findingLead: {
        fontSize: 9.5,
        fontWeight: 700,
        color: INK,
        lineHeight: 1.35,
        marginBottom: 1,
    },
    findingText: {
        fontSize: 9.5,
        color: MUTED,
        lineHeight: 1.35,
    },
    findingDivider: {
        height: 0.4,
        backgroundColor: LINE,
        marginLeft: 28,
        marginBottom: 4,
    },
    // ---- Callout ----
    callout: {
        backgroundColor: SURFACE,
        borderRadius: 6,
        borderWidth: 0.9,
        borderColor: LINE,
        padding: 10,
        marginBottom: 10,
        paddingLeft: 14,
        position: 'relative',
    },
    calloutAccent: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: 4,
        borderTopLeftRadius: 6,
        borderBottomLeftRadius: 6,
    },
    calloutLabel: {
        fontSize: 7.8,
        fontWeight: 700,
        color: NAVY,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 4,
        lineHeight: 1,
    },
    calloutBody: {
        fontSize: 9,
        color: INK,
        lineHeight: 1.35,
    },
    // ---- Chart card ----
    chartRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 10,
    },
    chartCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderWidth: 0.9,
        borderColor: LINE,
        borderRadius: 6,
        padding: 10,
    },
    chartCardTitle: {
        fontSize: 9.6,
        fontWeight: 700,
        color: NAVY,
        marginBottom: 2,
        lineHeight: 1.25,
    },
    chartCardSubtitle: {
        fontSize: 7.8,
        color: MUTED,
        marginBottom: 6,
        lineHeight: 1.3,
    },
    chartImage: {
        width: '100%',
    },
    // ---- Tables ----
    tableContainer: {
        marginBottom: 8,
    },
    tableTitle: {
        fontSize: 9.6,
        fontWeight: 700,
        color: NAVY,
        marginBottom: 4,
    },
    table: {
        width: '100%',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: SURFACE,
        borderBottomWidth: 0.9,
        borderBottomColor: NAVY,
    },
    tableHeaderCell: {
        fontSize: 7.4,
        fontWeight: 700,
        color: NAVY,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        paddingVertical: 6,
        paddingHorizontal: 4.6,
        lineHeight: 1,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 0.4,
        borderBottomColor: LINE,
    },
    tableCell: {
        fontSize: 8.4,
        color: INK,
        paddingVertical: 6,
        paddingHorizontal: 4.6,
        lineHeight: 1.2,
    },
    tableCellRight: {
        textAlign: 'right',
    },
    tableCellBold: {
        fontWeight: 700,
    },
    tableTotalRow: {
        backgroundColor: SURFACE,
    },
    tableNote: {
        fontSize: 7.8,
        color: MUTED,
        marginTop: 4,
        lineHeight: 1.3,
    },
    // ---- Appendix grid ----
    appendixGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    appendixCol: {
        flex: 1,
        minWidth: (CONTENT_WIDTH - 12) / 2,
    },
});

/* ------------------------------------------------------------------ */
/* Small building blocks                                              */
/* ------------------------------------------------------------------ */

function Footer({ page, total, periodMeta }: { page: number; total: number; periodMeta: { dataAsOf: string } }) {
    return (
        <View style={styles.footer}>
            <Text style={styles.footerLeft}>FRAI · GSO Reports · Data as of {periodMeta.dataAsOf}</Text>
            <Text style={styles.footerRight}>
                Page {page} of {total}
            </Text>
        </View>
    );
}

function RunningHeader({ title, period }: { title: string; period: string }) {
    return (
        <View>
            <Text style={styles.runningHeaderTitle}>
                {title} · {period}
            </Text>
            <View style={styles.runningHeaderRule} />
        </View>
    );
}

function KpiCard({ card }: { card: KpiCard }) {
    return (
        <View style={styles.kpiCard}>
            <View style={[styles.kpiTab, { backgroundColor: card.tabColor }]} />
            <Text style={styles.kpiLabel}>{card.label}</Text>
            <Text style={styles.kpiValue}>{card.value}</Text>
            {card.valueUnit && <Text style={styles.kpiValueUnit}>{card.valueUnit}</Text>}
            {card.context1 && <Text style={styles.kpiContext}>{card.context1}</Text>}
            {card.context2 && <Text style={styles.kpiContext}>{card.context2}</Text>}
            <View style={[styles.kpiChip, { backgroundColor: card.chipColor }]}>
                <Text style={styles.kpiChipText}>{card.chipText}</Text>
            </View>
        </View>
    );
}

function StatStrip({ cells }: { cells: StatCell[] }) {
    return (
        <View style={styles.statStrip}>
            {cells.map((cell, i) => (
                <React.Fragment key={i}>
                    <View style={styles.statCell}>
                        <Text style={styles.statValue}>{cell.value}</Text>
                        <Text style={styles.statLabel}>{cell.label}</Text>
                    </View>
                    {i < cells.length - 1 && <View style={styles.statDivider} />}
                </React.Fragment>
            ))}
        </View>
    );
}

function KeyFindings({ findings }: { findings: KeyFinding[] }) {
    return (
        <View style={styles.keyFindings}>
            {findings.map((f, i) => (
                <React.Fragment key={i}>
                    <View style={styles.findingItem}>
                        <View style={styles.findingGutter}>
                            <Text style={styles.findingNumber}>{f.number}</Text>
                        </View>
                        <View style={styles.findingBody}>
                            <Text style={styles.findingLead}>{f.lead}</Text>
                            {f.body && <Text style={styles.findingText}>{f.body}</Text>}
                        </View>
                    </View>
                    {i < findings.length - 1 && <View style={styles.findingDivider} />}
                </React.Fragment>
            ))}
        </View>
    );
}

function Callout({ callout, overrideLabel, overrideAccent }: { callout: Callout; overrideLabel?: string; overrideAccent?: string }) {
    return (
        <View style={styles.callout}>
            <View style={[styles.calloutAccent, { backgroundColor: overrideAccent ?? callout.accentColor }]} />
            <Text style={styles.calloutLabel}>{overrideLabel ?? callout.label}</Text>
            <Text style={styles.calloutBody}>{callout.body}</Text>
        </View>
    );
}

function ChartCard({ card }: { card: ChartCard }) {
    return (
        <View style={styles.chartCard}>
            <Text style={styles.chartCardTitle}>{card.title}</Text>
            <Text style={styles.chartCardSubtitle}>{card.subtitle}</Text>
            {card.imageUrl && <Image src={card.imageUrl} style={styles.chartImage} />}
        </View>
    );
}

/* ------------------------------------------------------------------ */
/* Table                                                              */
/* ------------------------------------------------------------------ */

interface TableColumn {
    key: string;
    header: string;
    align?: 'left' | 'right';
}

interface TableProps {
    title?: string;
    columns: TableColumn[];
    rows: PdfRow[];
    totalRow?: PdfRow;
    note?: string;
}

function Table({ title, columns, rows, totalRow, note }: TableProps) {
    if (title) {
        // rendered by caller
    }

    return (
        <View style={styles.tableContainer}>
            {title && <Text style={styles.tableTitle}>{title}</Text>}
            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    {columns.map((col) => (
                        <Text key={col.key} style={[styles.tableHeaderCell, { textAlign: col.align === 'right' ? 'right' : 'left' }]}>
                            {col.header}
                        </Text>
                    ))}
                </View>
                {rows.map((row, i) => (
                    <View key={i} style={styles.tableRow}>
                        {columns.map((col) => (
                            <Text key={col.key} style={[styles.tableCell, { textAlign: col.align === 'right' ? 'right' : 'left' }]}>
                                {String(row[col.key] ?? '')}
                            </Text>
                        ))}
                    </View>
                ))}
                {totalRow && (
                    <View style={[styles.tableRow, styles.tableTotalRow]}>
                        {columns.map((col) => (
                            <Text
                                key={col.key}
                                style={[styles.tableCell, styles.tableCellBold, { textAlign: col.align === 'right' ? 'right' : 'left' }]}
                            >
                                {String(totalRow[col.key] ?? '')}
                            </Text>
                        ))}
                    </View>
                )}
            </View>
            {note && <Text style={styles.tableNote}>{note}</Text>}
        </View>
    );
}

/* ------------------------------------------------------------------ */
/* Document                                                           */
/* ------------------------------------------------------------------ */

export function ReportsPdfDocument({ data }: { data: ReportsPdfData }) {
    const {
        meta: periodMeta,
        kpiCards,
        statStrip,
        keyFindings,
        decisionsCallout,
        sections,
        appendixATables,
        appendixBMethodology,
        dataNotesCallout,
        methodology,
    } = data;

    const totalPages = 1 + sections.length + 2;
    const summaryParagraph = buildSummary(data);

    return (
        <Document>
            {/* ============ PAGE 1: EXECUTIVE SUMMARY ============ */}
            <Page size="A4" style={styles.page} key="p-cover">
                <View style={styles.band}>
                    <View style={styles.bandContent}>
                        <View style={styles.coverBrandRow}>
                            <Image src="/FRAI.png" style={styles.bandLogo} />
                            <Text style={styles.bandEyebrow}>FRAI · GSO REPORTS</Text>
                        </View>
                        <Text style={styles.bandTitle}>Facility Reservation Activity Report</Text>
                        <Text style={styles.bandSubtitle}>General Services Office · Reporting period: {periodMeta.period}</Text>
                        <Text style={styles.bandMeta}>
                            Data as of {periodMeta.dataAsOf} | Prepared for: {periodMeta.audience} | Comparison: {periodMeta.priorPeriod}
                        </Text>
                    </View>
                </View>
                <View style={styles.tealRule} />

                <View style={styles.pageContentP1}>
                    <Text style={styles.eyebrow}>EXECUTIVE SUMMARY</Text>
                    <Text style={{ ...styles.sectionQuestion, fontSize: 10.2, lineHeight: 1.5 }}>{summaryParagraph}</Text>

                    <View style={styles.kpiGrid}>
                        {kpiCards.map((card, i) => (
                            <KpiCard key={i} card={card} />
                        ))}
                    </View>

                    <StatStrip cells={statStrip} />

                    <KeyFindings findings={keyFindings} />

                    <Callout callout={decisionsCallout} />

                    <Footer page={1} total={totalPages} periodMeta={periodMeta} />
                </View>
            </Page>

            {/* ============ SECTIONS (one per page) ============ */}
            {sections.map((section, i) => {
                const pageNo = i + 2;
                return (
                    <Page key={`p-${i}`} size="A4" style={styles.page}>
                        <View style={styles.pageContent}>
                            <RunningHeader title="Facility Reservation Activity Report" period={periodMeta.period} />

                            <View style={styles.sectionHead}>
                                <View style={styles.sectionHeadRow}>
                                    <View style={styles.sectionChip}>
                                        <Text style={styles.sectionChipNumber}>{section.number}</Text>
                                    </View>
                                    <Text style={styles.sectionTitle}>{section.title}</Text>
                                </View>
                                <Text style={styles.sectionQuestion}>{section.question}</Text>
                                <View style={styles.sectionRule} />
                                <Text style={styles.basisLine}>Basis: {section.basis}</Text>
                            </View>

                            {section.chartCards.length > 0 && (
                                <View style={styles.chartRow}>
                                    {section.chartCards.map((card, j) => (
                                        <ChartCard key={j} card={card} />
                                    ))}
                                </View>
                            )}

                            {section.tableTitle && section.tableRows && (
                                <>
                                    <Text style={styles.tableTitle}>{section.tableTitle}</Text>
                                    <Table
                                        columns={section.tableColumns ?? []}
                                        rows={section.tableRows}
                                        totalRow={section.tableTotalRow}
                                        note={section.tableNote}
                                    />
                                </>
                            )}

                            {section.callout && <Callout callout={section.callout} overrideLabel="WHAT THIS MEANS" overrideAccent={TEAL} />}

                            <Footer page={pageNo} total={totalPages} periodMeta={periodMeta} />
                        </View>
                    </Page>
                );
            })}

            {/* ============ APPENDIX A: SUPPORTING DATA TABLES ============ */}
            <Page key="p-appendix-a" size="A4" style={styles.page}>
                <View style={styles.pageContent}>
                    <RunningHeader title="Facility Reservation Activity Report" period={periodMeta.period} />

                    <View style={styles.sectionHead}>
                        <View style={styles.sectionHeadRow}>
                            <View style={styles.sectionChip}>
                                <Text style={styles.sectionChipNumber}>A</Text>
                            </View>
                            <Text style={styles.sectionTitle}>Supporting Data Tables</Text>
                        </View>
                        <Text style={styles.sectionQuestion}>Raw data behind the charts and figures in this report.</Text>
                        <View style={styles.sectionRule} />
                        <Text style={styles.basisLine}>Basis: All requests in the selected period, unaggregated.</Text>
                    </View>

                    <View style={styles.appendixGrid}>
                        {appendixATables.map((tbl, i) => (
                            <View key={i} style={styles.appendixCol}>
                                <Text style={styles.tableTitle}>{tbl.title}</Text>
                                <Table columns={tbl.columns} rows={tbl.rows} />
                            </View>
                        ))}
                    </View>

                    <Footer page={sections.length + 2} total={totalPages} periodMeta={periodMeta} />
                </View>
            </Page>

            {/* ============ APPENDIX B: METHODOLOGY ============ */}
            <Page key="p-appendix-b" size="A4" style={styles.page}>
                <View style={styles.pageContent}>
                    <RunningHeader title="Facility Reservation Activity Report" period={periodMeta.period} />

                    <View style={styles.sectionHead}>
                        <View style={styles.sectionHeadRow}>
                            <View style={styles.sectionChip}>
                                <Text style={styles.sectionChipNumber}>B</Text>
                            </View>
                            <Text style={styles.sectionTitle}>Methodology & Data Notes</Text>
                        </View>
                        <Text style={styles.sectionQuestion}>How each figure is computed and what the data covers.</Text>
                        <View style={styles.sectionRule} />
                        <Text style={styles.basisLine}>Basis: Definitions as applied by the GSO reporting service.</Text>
                    </View>

                    <Table
                        columns={[
                            { key: 'measure', header: 'Measure', align: 'left' },
                            { key: 'definition', header: 'Definition', align: 'left' },
                        ]}
                        rows={
                            appendixBMethodology?.length
                                ? appendixBMethodology.map((item) => ({ measure: item.label, definition: item.value }))
                                : Object.entries(methodology ?? {}).map(([label, value]) => ({ measure: label, definition: value }))
                        }
                    />

                    {dataNotesCallout && <Callout callout={dataNotesCallout} overrideLabel="DATA NOTES" overrideAccent="#D9890B" />}

                    <Footer page={sections.length + 3} total={totalPages} periodMeta={periodMeta} />
                </View>
            </Page>
        </Document>
    );
}

/* ------------------------------------------------------------------ */
/* Summary builder                                                    */
/* ------------------------------------------------------------------ */

function buildSummary(data: ReportsPdfData): string {
    const first = data.keyFindings[0];
    if (!first) return 'No requests were decided in the selected period.';
    return `${first.lead} ${first.body}`.trim();
}

/* ------------------------------------------------------------------ */
/* Download                                                           */
/* ------------------------------------------------------------------ */

export async function downloadReportsPdf(data: ReportsPdfData) {
    const blob = await pdf(<ReportsPdfDocument data={data} />).toBlob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FRAI_REPORT_${data.meta?.period?.replace(/\s+/g, '_') || 'report'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
}
