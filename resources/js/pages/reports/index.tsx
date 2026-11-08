import { Download, Funnel } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import PdfIcon from '@/components/pdf-icon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { EventTypesTab } from '@/pages/reports/components/EventTypesTab';
import { FacilityUsageTab } from '@/pages/reports/components/FacilityUsageTab';
import { KpiStrip } from '@/pages/reports/components/KpiStrip';
import { RequestStatusTab } from '@/pages/reports/components/RequestStatusTab';
import { RequestVolumeTab } from '@/pages/reports/components/RequestVolumeTab';
import { formatRange } from '@/pages/reports/format';
import { type ReportData, type ReportTab } from '@/pages/reports/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

function DocxIcon({ className }: { className?: string }) {
    return (
        <svg
            width="800px"
            height="800px"
            viewBox="0 0 548.291 548.291"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            xmlSpace="preserve"
            className={className}
        >
            <g>
                <path
                    d="M486.201,196.121h-13.166v-63.525c0-0.399-0.062-0.795-0.115-1.2c-0.021-2.522-0.825-5-2.552-6.96L364.657,3.675
 		c-0.033-0.031-0.064-0.042-0.085-0.073c-0.63-0.704-1.364-1.292-2.143-1.796c-0.229-0.157-0.461-0.286-0.702-0.419
 		c-0.672-0.365-1.387-0.672-2.121-0.893c-0.2-0.052-0.379-0.134-0.577-0.188C358.23,0.118,357.401,0,356.562,0H96.757
 		C84.894,0,75.256,9.649,75.256,21.502v174.613H62.092c-16.971,0-30.732,13.756-30.732,30.73v159.81
 		c0,16.966,13.761,30.736,30.732,30.736h13.164V526.79c0,11.854,9.638,21.501,21.501,21.501h354.776
 		c11.853,0,21.501-9.647,21.501-21.501V417.392h13.166c16.966,0,30.729-13.764,30.729-30.731v-159.81
 		C516.93,209.877,503.167,196.121,486.201,196.121z M96.757,21.507h249.054v110.006c0,5.94,4.817,10.751,10.751,10.751h94.972
 		v53.861H96.757V21.507z M367.547,335.847c7.843,0,16.547-1.701,21.666-3.759l3.916,20.301c-4.768,2.376-15.509,4.949-29.493,4.949
 		c-39.748,0-60.204-24.73-60.204-57.472c0-39.226,27.969-61.055,62.762-61.055c13.465,0,23.705,2.737,28.31,5.119l-5.285,20.64
 		c-5.287-2.226-12.615-4.263-21.832-4.263c-20.641,0-36.663,12.444-36.663,38.027C330.718,321.337,344.362,335.847,367.547,335.847z
 		 M291.647,296.97c0,37.685-22.854,60.537-56.444,60.537c-34.113,0-54.066-25.759-54.066-58.495
 		c0-34.447,21.995-60.206,55.94-60.206C272.39,238.806,291.647,265.248,291.647,296.97z M67.72,355.124V242.221
 		c9.552-1.532,21.999-2.375,35.13-2.375c21.83,0,35.981,3.916,47.055,12.276c11.945,8.863,19.455,23.021,19.455,43.311
 		c0,21.994-8.017,37.181-19.105,46.556c-12.111,10.058-30.528,14.841-53.045,14.841C83.749,356.825,74.198,355.968,67.72,355.124z
 		 M451.534,520.968H96.757V417.392h354.776V520.968z M471.245,355.627l-10.409-20.804c-4.263-8.012-6.992-13.99-10.231-20.636
 		h-0.342c-2.388,6.656-5.28,12.624-8.861,20.636l-9.552,20.804h-29.675l33.254-58.158l-32.054-56.786h29.849l10.058,20.984
 		c3.413,6.979,5.963,12.614,8.694,19.092h0.335c2.729-7.332,4.955-12.446,7.843-19.092l9.721-20.984h29.683l-32.406,56.103
 		l34.105,58.841H471.245z"
                    fill="#0070C0"
                />
                <path
                    d="M141.729,296.277c0.165-23.869-13.814-36.494-36.15-36.494c-5.807,0-9.552,0.514-11.772,1.027v75.2
 		c2.226,0.509,5.806,0.509,9.047,0.509C126.388,336.698,141.729,323.743,141.729,296.277z"
                    fill="#0070C0"
                />
                <path
                    d="M208.604,298.493c0,22.515,10.575,38.372,27.969,38.372c17.567,0,27.617-16.703,27.617-39.045
 		c0-20.641-9.885-38.377-27.801-38.377C218.827,259.448,208.604,276.162,208.604,298.493z"
                    fill="#0070C0"
                />
            </g>
        </svg>
    );
}

interface ReportsPageProps {
    year: number;
    month: number;
    report: ReportData;
}

type ExportKind = 'docx' | 'pdf';

function filenameFromContentDisposition(header: string | null): string | null {
    if (!header) {
        return null;
    }

    const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) {
        return decodeURIComponent(utf8Match[1]);
    }

    const match = header.match(/filename="?([^";]+)"?/i);

    return match ? match[1] : null;
}

function monthOptions(year: number) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    return MONTHS.map((month, index) => {
        const value = String(index + 1).padStart(2, '0');
        const disabled = year === currentYear && index + 1 > currentMonth;

        return { value, label: month, disabled };
    });
}

function yearOptions(currentYear: number) {
    return Array.from({ length: 6 }, (_, i) => currentYear - 5 + i).map((year) => ({
        value: String(year),
        label: String(year),
    }));
}

export default function ReportsPage({ year: initialYear, month: initialMonth, report: initialReport }: ReportsPageProps) {
    const [month, setMonth] = useState(String(initialMonth).padStart(2, '0'));
    const [year, setYear] = useState(String(initialYear));
    const [report, setReport] = useState<ReportData>(initialReport);
    const [loading, setLoading] = useState(false);
    const [exportingKind, setExportingKind] = useState<ExportKind | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const firstRender = useRef(true);
    const [activeTab, setActiveTab] = useState<ReportTab>('request-volume');
    const [dateRangeOpen, setDateRangeOpen] = useState(false);
    const [workingMonth, setWorkingMonth] = useState(month);
    const [workingYear, setWorkingYear] = useState(year);

    const isExporting = exportingKind !== null;

    const handleExport = async (kind: ExportKind, url: string) => {
        if (exportingKind !== null) {
            return;
        }

        setNotice(null);
        setExportingKind(kind);

        try {
            const res = await fetch(url);

            if (!res.ok) {
                throw new Error(`Export failed: ${res.status}`);
            }

            const blob = await res.blob();
            const fallbackName = `Facility_Reservation_Activity_Report_${year}_${month}.${kind}`;
            const filename = filenameFromContentDisposition(res.headers.get('Content-Disposition')) ?? fallbackName;

            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error('Failed to export report:', error);
            setNotice('The report could not be exported. Try again.');
        } finally {
            setExportingKind(null);
        }
    };

    function openDateRange() {
        setWorkingMonth(month);
        setWorkingYear(year);
        setDateRangeOpen(true);
    }

    function saveDateRange() {
        setMonth(workingMonth);
        setYear(workingYear);
        setDateRangeOpen(false);
    }

    function cancelDateRange() {
        setDateRangeOpen(false);
    }

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }

        let cancelled = false;

        const load = async () => {
            setNotice(null);
            setLoading(true);
            try {
                const res = await fetch(`/reports/data?year=${year}&month=${parseInt(month, 10)}`, {
                    headers: { Accept: 'application/json' },
                });

                if (!res.ok) {
                    throw new Error(`Request failed: ${res.status}`);
                }

                const json = (await res.json()) as ReportData;
                if (!cancelled) {
                    setReport(json);
                }
            } catch (error) {
                console.error('Failed to load report data:', error);
                if (!cancelled) {
                    setNotice('The report for that period could not be loaded. The data below is from the previous period.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [year, month]);

    const { period } = report;
    const rangeLabel = formatRange(period.start, period.end);
    const exportUrl = `/reports/export?year=${year}&month=${parseInt(month, 10)}`;
    const exportPdfUrl = `/reports/export-pdf?year=${year}&month=${parseInt(month, 10)}`;

    return (
        <div className="flex w-full max-w-full min-w-0 flex-col overflow-x-clip">
            {/* ── Header ── */}
            <div className="mb-6 flex w-full max-w-full min-w-0 flex-wrap items-end justify-between gap-4">
                <div className="flex max-w-full min-w-0 flex-col gap-1">
                    <p className="frai-eyebrow">Reports</p>
                    <div className="flex items-center gap-2">
                        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{period.label}</h1>
                        {loading && <Spinner className="size-4" />}
                    </div>
                    {rangeLabel && <p className="text-sm text-muted-foreground">{rangeLabel}</p>}
                </div>
                <div className="flex max-w-full min-w-0 flex-wrap items-center gap-3">
                    <Dialog
                        open={dateRangeOpen}
                        onOpenChange={(open) => {
                            if (!open) {
                                setWorkingMonth(month);
                                setWorkingYear(year);
                            }
                            setDateRangeOpen(open);
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-2" disabled={loading} onClick={openDateRange}>
                                <Funnel className="size-4 shrink-0" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Filter by date range</DialogTitle>
                            </DialogHeader>
                            <div className="grid w-full gap-4">
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="report-month" className="text-sm font-medium">
                                        Month
                                    </label>
                                    <Select value={workingMonth} onValueChange={setWorkingMonth} disabled={loading}>
                                        <SelectTrigger id="report-month" className="h-9 w-full text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {monthOptions(parseInt(workingYear, 10)).map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="report-year" className="text-sm font-medium">
                                        Year
                                    </label>
                                    <Select value={workingYear} onValueChange={setWorkingYear} disabled={loading}>
                                        <SelectTrigger id="report-year" className="h-9 w-full text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {yearOptions(parseInt(workingYear, 10)).map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" size="sm" onClick={cancelDateRange}>
                                    Cancel
                                </Button>
                                <Button variant="default" size="sm" onClick={saveDateRange} disabled={loading}>
                                    Save
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-2" disabled={loading || isExporting}>
                                {isExporting ? <Spinner className="size-4" /> : <Download className="size-4 shrink-0" />}
                                Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => void handleExport('docx', exportUrl)} disabled={loading || isExporting} className="w-full justify-start">
                                {exportingKind === 'docx' ? <Spinner className="mr-2 size-4" /> : <DocxIcon className="mr-2 size-4 shrink-0" />}
                                Export as Word (.docx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void handleExport('pdf', exportPdfUrl)} disabled={loading || isExporting} className="w-full justify-start">
                                {exportingKind === 'pdf' ? <Spinner className="mr-2 size-4" /> : <PdfIcon className="mr-2 size-4 shrink-0" />}
                                Export as PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {notice && (
                <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {notice}
                </div>
            )}

            <div aria-busy={loading} className={cn('transition-opacity', loading && 'opacity-60')}>
                <KpiStrip kpis={report.kpis} />

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReportTab)} className="w-full max-w-full min-w-0 overflow-x-clip">
                    <TabsList variant="line" className="flex h-auto min-h-9 w-full justify-start border-b *:flex-none my-4">
                        <TabsTrigger value="request-volume">
                            <span className="sm:hidden">Volume</span>
                            <span className="hidden sm:inline">Request Volume</span>
                        </TabsTrigger>
                        <TabsTrigger value="request-status">
                            <span className="sm:hidden">Status</span>
                            <span className="hidden sm:inline">Request Status</span>
                        </TabsTrigger>
                        <TabsTrigger value="event-types">
                            Event Types
                        </TabsTrigger>
                        <TabsTrigger value="facility-usage">
                            <span className="sm:hidden">Facilities</span>
                            <span className="hidden sm:inline">Facility Usage</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="request-volume" className="mt-6">
                        <RequestVolumeTab report={report} />
                    </TabsContent>

                    <TabsContent value="request-status" className="mt-6">
                        <RequestStatusTab report={report} />
                    </TabsContent>

                    <TabsContent value="event-types" className="mt-6">
                        <EventTypesTab report={report} />
                    </TabsContent>

                    <TabsContent value="facility-usage" className="mt-6">
                        <FacilityUsageTab report={report} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
