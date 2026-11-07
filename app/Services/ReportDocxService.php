<?php

namespace App\Services;

use Carbon\Carbon;
use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use RuntimeException;
use ZipArchive;

class ReportDocxService
{
    private const TEMPLATE = 'templates/Report_Template_v1.docx';

    private const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    private const C_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';

    private const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';

    private const W14_NS = 'http://schemas.microsoft.com/office/word/2010/wordml';

    private const XML_NS = 'http://www.w3.org/XML/1998/namespace';

    /**
     * Status order as laid out in the template.
     *
     * @var array<int, string>
     */
    private const STATUS_ORDER = [
        'Pending',
        'Approved',
        'Conditionally Approved',
        'For Reschedule',
        'Partially Approved',
        'Denied',
    ];

    /**
     * Accent palette used for pie slices, matching the template colours.
     *
     * @var array<int, string>
     */
    private const ACCENTS = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'accent2', 'accent3'];

    public function __construct(protected ReportService $reportService) {}

    /**
     * Build a filled copy of the report template and return its path.
     */
    public function generate(int $year, int $month): string
    {
        $report = $this->reportService->getMonthlyReport($year, $month, true);

        $template = storage_path(self::TEMPLATE);

        if (! File::exists($template)) {
            throw new RuntimeException("Report template not found at [{$template}].");
        }

        $directory = storage_path('app/tmp');
        File::ensureDirectoryExists($directory);

        $path = $directory.'/'.Str::random(24).'.docx';
        File::copy($template, $path);

        $zip = new ZipArchive;

        if ($zip->open($path) !== true) {
            throw new RuntimeException('Unable to open the report template.');
        }

        $document = $zip->getFromName('word/document.xml');

        if ($document !== false) {
            $zip->addFromString('word/document.xml', $this->fillDocument($document, $report));
        }

        foreach ($this->chartPayloads($report) as $chart) {
            $xml = $zip->getFromName($chart['chart']);

            if ($xml !== false) {
                $zip->addFromString($chart['chart'], $this->fillChart($xml, $chart['categories'], $chart['values']));
            }

            $workbook = $zip->getFromName($chart['workbook']);

            if ($workbook !== false) {
                $zip->addFromString(
                    $chart['workbook'],
                    $this->fillWorkbook($workbook, $chart['series'], $chart['categories'], $chart['values'])
                );
            }
        }

        $zip->close();

        return $path;
    }

    /**
     * @return array<int, array{chart: string, workbook: string, series: string, categories: array<int, string>, values: array<int, int>}>
     */
    private function chartPayloads(array $report): array
    {
        $statusCounts = collect($report['status'])->pluck('value', 'status');

        $statusCategories = self::STATUS_ORDER;
        $statusValues = array_map(
            fn (string $status) => (int) ($statusCounts[$status] ?? 0),
            $statusCategories
        );

        $eventCategories = array_column($report['event_types'], 'category');
        $eventValues = array_map('intval', array_column($report['event_types'], 'value'));

        $facilities = $this->topFacilities($report['facility_usage']);
        $facilityCategories = array_column($facilities, 'name');
        $facilityValues = array_map('intval', array_column($facilities, 'amount'));

        return [
            [
                'chart' => 'word/charts/chart1.xml',
                'workbook' => 'word/embeddings/Microsoft_Excel_Worksheet.xlsx',
                'series' => 'Requests',
                'categories' => array_map(
                    fn (array $point) => Carbon::parse($point['date'])->format('F j, Y'),
                    $report['volume']
                ),
                'values' => array_map('intval', array_column($report['volume'], 'value')),
            ],
            [
                'chart' => 'word/charts/chart2.xml',
                'workbook' => 'word/embeddings/Microsoft_Excel_Worksheet1.xlsx',
                'series' => 'Request Status',
                'categories' => $statusCategories,
                'values' => $statusValues,
            ],
            [
                'chart' => 'word/charts/chart3.xml',
                'workbook' => 'word/embeddings/Microsoft_Excel_Worksheet2.xlsx',
                'series' => 'Event Types',
                'categories' => $eventCategories,
                'values' => $eventValues,
            ],
            [
                'chart' => 'word/charts/chart4.xml',
                'workbook' => 'word/embeddings/Microsoft_Excel_Worksheet3.xlsx',
                'series' => 'Facilities',
                'categories' => $facilityCategories,
                'values' => $facilityValues,
            ],
        ];
    }

    /**
     * @param  array<int, array{name: string, amount: int, percentage: float}>  $usage
     * @return array<int, array{name: string, amount: int, percentage: float}>
     */
    private function topFacilities(array $usage): array
    {
        if ($usage === []) {
            return [['name' => 'No data', 'amount' => 0, 'percentage' => 0.0]];
        }

        if (count($usage) <= 6) {
            return $usage;
        }

        $total = (int) array_sum(array_column($usage, 'amount'));
        $top = array_slice($usage, 0, 6);
        $otherAmount = (int) array_sum(array_column(array_slice($usage, 6), 'amount'));

        $top[] = [
            'name' => 'Other',
            'amount' => $otherAmount,
            'percentage' => $total > 0 ? round($otherAmount / $total * 100, 1) : 0.0,
        ];

        return $top;
    }

    private function fillDocument(string $xml, array $report): string
    {
        $dom = $this->loadXml($xml);
        $xpath = $this->xpath($dom);

        $kpis = [
            'Requests Received' => (string) $report['kpis']['requests_received'],
            'Approval Rate' => $this->number($report['kpis']['approval_rate']),
            'Total Requesters' => (string) $report['kpis']['total_requesters'],
            'Average Processing Time' => $this->number($report['kpis']['avg_processing_days']),
        ];

        $narratives = $this->narratives($report);

        $tables = $xpath->query('//w:tbl');

        if ($tables !== false && $tables->length > 0) {
            $kpiRows = $this->childrenByTag($tables->item(0), 'tr');

            if ($kpiRows !== []) {
                foreach ($this->childrenByTag($kpiRows[0], 'tc') as $cell) {
                    $label = $this->nodeText($cell);

                    foreach ($kpis as $key => $value) {
                        if (str_starts_with($label, $key)) {
                            $this->replaceFirstToken($cell, '{}', $value);
                            break;
                        }
                    }
                }
            }
        }

        $analysis = [
            $narratives['volume'],
            $narratives['status'],
            $narratives['event'],
            $narratives['facility'],
        ];
        $analysisIndex = 0;

        foreach ($xpath->query('//w:p') as $paragraph) {
            $text = trim($this->nodeText($paragraph));

            $replacement = match ($text) {
                '{Period Range}' => $narratives['period'],
                '{Text Summary}' => $narratives['summary'],
                '{Include Building Percentage as well}' => $narratives['building'],
                '{Comparison to previous month}' => $narratives['comparison'],
                '{Text analysis regarding the chart above}' => $analysis[$analysisIndex++] ?? '',
                default => null,
            };

            if ($replacement !== null) {
                $this->setText($paragraph, $replacement);
            }
        }

        if ($tables !== false && $tables->length >= 4) {
            $statusCounts = collect($report['status'])->pluck('value', 'status');
            $statusRows = array_map(
                fn (string $status) => [$status, (string) (int) ($statusCounts[$status] ?? 0)],
                self::STATUS_ORDER
            );

            $eventRows = array_map(
                fn (array $row) => [$row['category'], (string) $row['value']],
                $report['event_types']
            );

            $facilityRows = array_map(
                fn (array $row) => [$row['name'], $this->number($row['percentage']).'%', (string) $row['amount']],
                $this->topFacilities($report['facility_usage'])
            );

            $this->fillTable($tables->item(1), $statusRows);
            $this->fillTable($tables->item(2), $eventRows);
            $this->fillTable($tables->item(3), $facilityRows);
        }

        return $this->saveXml($dom);
    }

    /**
     * @return array{period: string, summary: string, volume: string, status: string, event: string, facility: string, building: string}
     */
    private function narratives(array $report): array
    {
        $monthYear = Carbon::parse($report['period']['start'])->format('F Y');

        return [
            'period' => $this->periodLabel($report),
            'summary' => $this->summaryNarrative($report, $monthYear),
            'volume' => $this->volumeNarrative($report['volume']),
            'status' => $this->statusNarrative(
                array_map(fn (array $row) => ['label' => $row['status'], 'value' => (int) $row['value']], $report['status'])
            ),
            'event' => $this->eventNarrative(
                array_map(fn (array $row) => ['label' => $row['category'], 'value' => (int) $row['value']], $report['event_types'])
            ),
            'facility' => $this->facilityNarrative(
                array_map(fn (array $row) => ['label' => $row['name'], 'value' => (int) $row['amount']], $report['facility_usage'])
            ),
            'building' => $this->buildingNarrative(
                array_map(fn (array $row) => ['label' => $row['name'], 'value' => (int) $row['amount']], $report['building_usage'])
            ),
            'comparison' => $this->comparisonNarrative($report),
        ];
    }

    private function periodLabel(array $report): string
    {
        $start = Carbon::parse($report['period']['start']);
        $end = Carbon::parse($report['period']['end']);

        return $start->format('F j').'-'.$end->format('j, Y');
    }

    /**
     * Build a one-line-per-KPI comparison summary vs the previous month.
     * Returns a "no prior data" note when the previous month has no activity.
     */
    private function comparisonNarrative(array $report): string
    {
        $previousKpis = $report['previous_kpis'] ?? [];
        $kpiDeltas = $report['kpi_deltas'] ?? [];

        $hasPreviousData = array_reduce(
            array_values($previousKpis),
            fn (bool $carry, mixed $value) => $carry || (float) $value > 0,
            false
        );

        if (! $hasPreviousData) {
            return 'No previous month data available for comparison.';
        }

        $kpiLabels = [
            'requests_received' => 'Requests received',
            'approval_rate' => 'Approval rate',
            'total_requesters' => 'Total requesters',
            'avg_processing_days' => 'Average processing days',
        ];

        $lines = [];

        foreach ($kpiLabels as $key => $label) {
            $current = (float) ($report['kpis'][$key] ?? 0);
            $previous = (float) ($previousKpis[$key] ?? 0);
            $delta = (float) ($kpiDeltas[$key]['delta'] ?? 0);
            $deltaPercent = $kpiDeltas[$key]['delta_percent'] ?? null;

            $currentText = $key === 'approval_rate' ? $this->number($current).'%' : $this->number($current);
            $previousText = $key === 'approval_rate' ? $this->number($previous).'%' : $this->number($previous);

            if ($deltaPercent === null) {
                $lines[] = sprintf('%s: %s vs %s (no prior data)', $label, $currentText, $previousText);
            } elseif ($delta > 0) {
                $lines[] = sprintf('%s: %s vs %s (%s%%)', $label, $currentText, $previousText, $this->number($deltaPercent));
            } elseif ($delta < 0) {
                $lines[] = sprintf('%s: %s vs %s (%s%%)', $label, $currentText, $previousText, $this->number($deltaPercent));
            } else {
                $lines[] = sprintf('%s: %s vs %s (no change)', $label, $currentText, $previousText);
            }
        }

        return implode(' ', $lines);
    }

    private function summaryNarrative(array $report, string $monthYear): string
    {
        $kpis = $report['kpis'];
        $total = (int) $kpis['requests_received'];

        if ($total === 0) {
            return "No requests were recorded for {$monthYear}.";
        }

        $statusCounts = collect($report['status'])->pluck('value', 'status');
        $approved = (int) ($statusCounts['Approved'] ?? 0) + (int) ($statusCounts['Conditionally Approved'] ?? 0);
        $pending = (int) ($statusCounts['Pending'] ?? 0);
        $denied = (int) ($statusCounts['Denied'] ?? 0);

        $active = array_values(array_filter($report['volume'], fn (array $point) => $point['value'] > 0));
        $peak = $active[0] ?? null;

        foreach ($active as $point) {
            if ($peak !== null && $point['value'] > $peak['value']) {
                $peak = $point;
            }
        }

        $events = $this->rankedRows(
            array_map(fn (array $row) => ['label' => $row['category'], 'value' => (int) $row['value']], $report['event_types'])
        );
        $facilities = $this->rankedRows(
            array_map(fn (array $row) => ['label' => $row['name'], 'value' => (int) $row['amount']], $report['facility_usage'])
        );
        $buildings = $this->rankedRows(
            array_map(fn (array $row) => ['label' => $row['name'], 'value' => (int) $row['amount']], $report['building_usage'])
        );

        $sentences = [];

        $requesters = (int) $kpis['total_requesters'];

        $sentences[] = sprintf(
            'In %s, %d %s %s received from %d %s, and decisions took an average of %s days.',
            $monthYear,
            $total,
            $total === 1 ? 'request' : 'requests',
            $this->wasWere($total),
            $requesters,
            $requesters === 1 ? 'requester' : 'requesters',
            $this->number($kpis['avg_processing_days'])
        );

        $sentences[] = sprintf(
            '%d %s (%s%%) %s approved or conditionally approved, while %d remained pending and %d %s denied.',
            $approved,
            $approved === 1 ? 'request' : 'requests',
            $this->number($kpis['approval_rate']),
            $this->wasWere($approved),
            $pending,
            $denied,
            $this->wasWere($denied)
        );

        if ($peak !== null) {
            $sentences[] = sprintf(
                'Activity was recorded on %d of %d days, peaking on %s with %d requests.',
                count($active),
                count($report['volume']),
                Carbon::parse($peak['date'])->format('F j'),
                (int) $peak['value']
            );
        }

        if ($events !== []) {
            $sentence = sprintf('%s events were the most common (%d requests)', $events[0]['label'], $events[0]['value']);

            if ($facilities !== []) {
                $sentence .= sprintf(', and %s was the most booked facility (%d bookings)', $facilities[0]['label'], $facilities[0]['value']);
            }

            $sentences[] = $sentence.'.';
        } elseif ($facilities !== []) {
            $sentences[] = sprintf('%s was the most booked facility (%d bookings).', $facilities[0]['label'], $facilities[0]['value']);
        }

        if ($buildings !== []) {
            $sentences[] = sprintf(
                '%s accounted for %s%% of all bookings by building.',
                $buildings[0]['label'],
                $this->percentageOf($buildings[0]['value'], (int) array_sum(array_column($buildings, 'value')))
            );
        }

        return implode(' ', $sentences);
    }

    /**
     * @param  array<int, array{date: string, value: int}>  $volume
     */
    private function volumeNarrative(array $volume): string
    {
        $total = (int) array_sum(array_column($volume, 'value'));

        if ($total === 0) {
            return 'No requests were recorded for this period.';
        }

        $active = array_values(array_filter($volume, fn (array $point) => $point['value'] > 0));
        usort($active, fn (array $a, array $b) => $b['value'] <=> $a['value']);

        $text = sprintf(
            'Requests were recorded on %d of %d days. The busiest day was %s with %d requests',
            count($active),
            count($volume),
            Carbon::parse($active[0]['date'])->format('F j'),
            $active[0]['value']
        );

        if (count($active) > 1) {
            $text .= sprintf(', followed by %s with %d requests', Carbon::parse($active[1]['date'])->format('F j'), $active[1]['value']);
        }

        $average = round(array_sum(array_column($active, 'value')) / count($active), 1);

        return $text.sprintf('. On active days, the daily count averaged %s requests.', $this->number($average));
    }

    /**
     * @param  array<int, array{label: string, value: int}>  $rows
     */
    private function statusNarrative(array $rows): string
    {
        $total = (int) array_sum(array_column($rows, 'value'));

        if ($total === 0) {
            return 'No requests were recorded for this period.';
        }

        $ranked = $this->rankedRows($rows);
        $counts = collect($rows)->pluck('value', 'label');

        $text = sprintf(
            '%s was the most common status with %d requests (%s%%)',
            $ranked[0]['label'],
            $ranked[0]['value'],
            $this->percentageOf($ranked[0]['value'], $total)
        );

        if (isset($ranked[1])) {
            $text .= sprintf(', followed by %s (%d)', $ranked[1]['label'], $ranked[1]['value']);
        }

        if (isset($ranked[2])) {
            $text .= sprintf(' and %s (%d)', $ranked[2]['label'], $ranked[2]['value']);
        }

        $approved = (int) ($counts['Approved'] ?? 0) + (int) ($counts['Conditionally Approved'] ?? 0);
        $pending = (int) ($counts['Pending'] ?? 0);
        $denied = (int) ($counts['Denied'] ?? 0);

        return $text.sprintf(
            '. In total, %d %s %s approved or conditionally approved, %d remained pending, and %d %s denied.',
            $approved,
            $approved === 1 ? 'request' : 'requests',
            $this->wasWere($approved),
            $pending,
            $denied,
            $this->wasWere($denied)
        );
    }

    /**
     * @param  array<int, array{label: string, value: int}>  $rows
     */
    private function eventNarrative(array $rows): string
    {
        $total = (int) array_sum(array_column($rows, 'value'));

        if ($total === 0) {
            return 'No requests were recorded for this period.';
        }

        $ranked = $this->rankedRows($rows);

        $text = sprintf(
            '%s events led with %d requests (%s%%)',
            $ranked[0]['label'],
            $ranked[0]['value'],
            $this->percentageOf($ranked[0]['value'], $total)
        );

        if (isset($ranked[1])) {
            $text .= sprintf(', followed by %s (%d)', $ranked[1]['label'], $ranked[1]['value']);
        }

        if (isset($ranked[2])) {
            $text .= sprintf(' and %s (%d)', $ranked[2]['label'], $ranked[2]['value']);
        }

        return $text.sprintf('. Activity spanned %d of the %d event types.', count($ranked), count($rows));
    }

    /**
     * @param  array<int, array{label: string, value: int}>  $rows
     */
    private function facilityNarrative(array $rows): string
    {
        $total = (int) array_sum(array_column($rows, 'value'));

        if ($total === 0) {
            return 'No facility bookings were recorded for this period.';
        }

        $ranked = $this->rankedRows($rows);

        if (count($ranked) === 1) {
            return sprintf('%s was the only facility booked, with %d bookings.', $ranked[0]['label'], $ranked[0]['value']);
        }

        $text = sprintf(
            '%s was the most requested facility with %d bookings (%s%%)',
            $ranked[0]['label'],
            $ranked[0]['value'],
            $this->percentageOf($ranked[0]['value'], $total)
        );

        if (isset($ranked[1])) {
            $text .= sprintf(', followed by %s (%d)', $ranked[1]['label'], $ranked[1]['value']);
        }

        if (isset($ranked[2])) {
            $text .= sprintf(' and %s (%d)', $ranked[2]['label'], $ranked[2]['value']);
        }

        return $text.sprintf('. %d facilities were booked during the period, totalling %d bookings.', count($ranked), $total);
    }

    /**
     * @param  array<int, array{label: string, value: int}>  $rows
     */
    private function buildingNarrative(array $rows): string
    {
        $total = (int) array_sum(array_column($rows, 'value'));

        if ($total === 0) {
            return 'No building data was recorded for this period.';
        }

        $ranked = $this->rankedRows($rows);

        if (count($ranked) === 1) {
            return sprintf('All bookings were in %s.', $ranked[0]['label']);
        }

        $text = sprintf(
            'By building, %s accounted for %s%% of bookings (%d)',
            $ranked[0]['label'],
            $this->percentageOf($ranked[0]['value'], $total),
            $ranked[0]['value']
        );

        if (isset($ranked[1])) {
            $text .= sprintf(', followed by %s (%s%%)', $ranked[1]['label'], $this->percentageOf($ranked[1]['value'], $total));
        }

        if (isset($ranked[2])) {
            $text .= sprintf(' and %s (%s%%)', $ranked[2]['label'], $this->percentageOf($ranked[2]['value'], $total));
        }

        return $text.sprintf('. %d buildings recorded activity.', count($ranked));
    }

    /**
     * @param  array<int, array{label: string, value: int}>  $rows
     * @return array<int, array{label: string, value: int}>
     */
    private function rankedRows(array $rows): array
    {
        $ranked = array_values(array_filter($rows, fn (array $row) => $row['value'] > 0));
        usort($ranked, fn (array $a, array $b) => $b['value'] <=> $a['value']);

        return $ranked;
    }

    private function percentageOf(int $value, int $total): string
    {
        return $total > 0 ? $this->number(round($value / $total * 100, 1)) : '0';
    }

    private function wasWere(int $count): string
    {
        return $count === 1 ? 'was' : 'were';
    }

    private function number(mixed $value): string
    {
        $formatted = number_format((float) $value, 1, '.', '');

        return rtrim(rtrim($formatted, '0'), '.');
    }

    /**
     * @param  array<int, array<int, string>>  $rows
     */
    private function fillTable(DOMElement $table, array $rows): void
    {
        $rowElements = $this->childrenByTag($table, 'tr');

        if (count($rowElements) < 2) {
            return;
        }

        $templateRow = $rowElements[count($rowElements) - 1];

        if ($rows === []) {
            $rows = [['No data', '', '']];
        }

        foreach ($rows as $values) {
            $clone = $templateRow->cloneNode(true);
            $this->scrubIdentifiers($clone);

            foreach ($this->childrenByTag($clone, 'tc') as $index => $cell) {
                $this->setText($cell, (string) ($values[$index] ?? ''));
            }

            $table->insertBefore($clone, $templateRow);
        }

        $table->removeChild($templateRow);
    }

    private function replaceFirstToken(DOMNode $node, string $token, string $replacement): void
    {
        foreach ($this->descendants($node, 't') as $text) {
            if (str_contains($text->nodeValue, $token)) {
                $text->nodeValue = str_replace($token, $replacement, $text->nodeValue);

                return;
            }
        }
    }

    private function setText(DOMNode $node, string $value): void
    {
        $texts = $this->descendants($node, 't');

        if ($texts === []) {
            return;
        }

        $texts[0]->nodeValue = $value;
        $texts[0]->setAttributeNS(self::XML_NS, 'xml:space', 'preserve');

        for ($index = 1; $index < count($texts); $index++) {
            $texts[$index]->nodeValue = '';
        }
    }

    private function nodeText(DOMNode $node): string
    {
        $text = '';

        foreach ($this->descendants($node, 't') as $element) {
            $text .= $element->nodeValue;
        }

        return $text;
    }

    /**
     * @return array<int, DOMElement>
     */
    private function descendants(DOMNode $node, string $localName): array
    {
        $result = [];

        foreach ($node->childNodes as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }

            if ($child->localName === $localName && $child->namespaceURI === self::W_NS) {
                $result[] = $child;
            }

            $result = array_merge($result, $this->descendants($child, $localName));
        }

        return $result;
    }

    /**
     * @return array<int, DOMElement>
     */
    private function childrenByTag(DOMNode $node, string $localName): array
    {
        $result = [];

        foreach ($node->childNodes as $child) {
            if ($child instanceof DOMElement && $child->localName === $localName && $child->namespaceURI === self::W_NS) {
                $result[] = $child;
            }
        }

        return $result;
    }

    private function scrubIdentifiers(DOMNode $node): void
    {
        if ($node instanceof DOMElement) {
            $node->removeAttributeNS(self::W14_NS, 'paraId');
            $node->removeAttributeNS(self::W14_NS, 'textId');
        }

        foreach ($node->childNodes as $child) {
            $this->scrubIdentifiers($child);
        }
    }

    /**
     * @param  array<int, string>  $categories
     * @param  array<int, int>  $values
     */
    private function fillChart(string $xml, array $categories, array $values): string
    {
        $dom = $this->loadXml($xml);
        $xpath = $this->xpath($dom);

        $series = $xpath->query('//c:ser')->item(0);

        if (! $series instanceof DOMElement) {
            return $xml;
        }

        $this->replaceSeriesData($dom, $xpath, $series, $categories, $values);
        $this->syncDataPoints($dom, $xpath, $series, count($categories));

        return $this->saveXml($dom);
    }

    /**
     * @param  array<int, string>  $categories
     * @param  array<int, int>  $values
     */
    private function replaceSeriesData(DOMDocument $dom, DOMXPath $xpath, DOMElement $series, array $categories, array $values): void
    {
        $count = count($categories);
        $lastRow = $count + 1;

        $category = $xpath->query('c:cat', $series)->item(0);

        if ($category instanceof DOMElement) {
            $reference = $xpath->query('c:strRef/c:f', $category)->item(0);

            if ($reference !== null) {
                $reference->nodeValue = 'Sheet1!$A$2:$A$'.$lastRow;
            }

            $cache = $dom->createElementNS(self::C_NS, 'c:strCache');
            $cache->appendChild($this->pointCount($dom, $count));

            foreach ($categories as $index => $label) {
                $cache->appendChild($this->dataPoint($dom, $index, $label));
            }

            $this->replaceCache($xpath, $category, 'c:strRef/c:strCache', $cache);
        }

        $value = $xpath->query('c:val', $series)->item(0);

        if ($value instanceof DOMElement) {
            $reference = $xpath->query('c:numRef/c:f', $value)->item(0);

            if ($reference !== null) {
                $reference->nodeValue = 'Sheet1!$B$2:$B$'.$lastRow;
            }

            $cache = $dom->createElementNS(self::C_NS, 'c:numCache');
            $format = $dom->createElementNS(self::C_NS, 'c:formatCode');
            $format->nodeValue = 'General';
            $cache->appendChild($format);
            $cache->appendChild($this->pointCount($dom, $count));

            foreach ($values as $index => $item) {
                $cache->appendChild($this->dataPoint($dom, $index, (string) (int) $item));
            }

            $this->replaceCache($xpath, $value, 'c:numRef/c:numCache', $cache);
        }
    }

    private function replaceCache(DOMXPath $xpath, DOMElement $parent, string $path, DOMElement $cache): void
    {
        $existing = $xpath->query($path, $parent)->item(0);

        if ($existing !== null && $existing->parentNode !== null) {
            $existing->parentNode->replaceChild($cache, $existing);

            return;
        }

        $reference = $xpath->query(
            str_starts_with($path, 'c:strRef') ? 'c:strRef' : 'c:numRef',
            $parent
        )->item(0);

        if ($reference instanceof DOMElement) {
            $reference->appendChild($cache);
        }
    }

    private function pointCount(DOMDocument $dom, int $count): DOMElement
    {
        $element = $dom->createElementNS(self::C_NS, 'c:ptCount');
        $element->setAttribute('val', (string) $count);

        return $element;
    }

    private function dataPoint(DOMDocument $dom, int $index, string $value): DOMElement
    {
        $point = $dom->createElementNS(self::C_NS, 'c:pt');
        $point->setAttribute('idx', (string) $index);

        $text = $dom->createElementNS(self::C_NS, 'c:v');
        $text->nodeValue = $value;
        $point->appendChild($text);

        return $point;
    }

    private function syncDataPoints(DOMDocument $dom, DOMXPath $xpath, DOMElement $series, int $count): void
    {
        $existing = [];

        foreach (iterator_to_array($xpath->query('c:dPt', $series)) as $point) {
            if (! $point instanceof DOMElement) {
                continue;
            }

            $index = $xpath->query('c:idx', $point)->item(0);

            if ($index === null) {
                continue;
            }

            $position = (int) $index->getAttribute('val');

            if ($position >= $count) {
                $series->removeChild($point);
            } else {
                $existing[$position] = $point;
            }
        }

        if ($existing === []) {
            return;
        }

        ksort($existing);
        $last = end($existing);

        for ($index = 0; $index < $count; $index++) {
            if (isset($existing[$index])) {
                continue;
            }

            $clone = $last->cloneNode(true);

            if (! $clone instanceof DOMElement) {
                continue;
            }

            $extension = $xpath->query('c:extLst', $clone)->item(0);

            if ($extension !== null && $extension->parentNode !== null) {
                $extension->parentNode->removeChild($extension);
            }

            $idxNode = $xpath->query('c:idx', $clone)->item(0);

            if ($idxNode !== null) {
                $idxNode->setAttribute('val', (string) $index);
            }

            $color = $xpath->query('.//a:schemeClr', $clone)->item(0);

            if ($color instanceof DOMElement) {
                $color->setAttribute('val', self::ACCENTS[$index % count(self::ACCENTS)]);
            }

            $series->insertBefore($clone, $last->nextSibling);
            $last = $clone;
        }
    }

    /**
     * @param  array<int, string>  $categories
     * @param  array<int, int>  $values
     */
    private function fillWorkbook(string $bytes, string $series, array $categories, array $values): string
    {
        $path = tempnam(sys_get_temp_dir(), 'gso_xlsx_');

        if ($path === false) {
            return $bytes;
        }

        file_put_contents($path, $bytes);

        $zip = new ZipArchive;

        if ($zip->open($path) !== true) {
            @unlink($path);

            return $bytes;
        }

        $lastRow = count($categories) + 1;

        $sheet = $zip->getFromName('xl/worksheets/sheet1.xml');

        if ($sheet !== false) {
            $sheet = preg_replace('/<dimension ref="[^"]*"\/>/', '<dimension ref="A1:B'.$lastRow.'"/>', $sheet, 1);

            if ($sheet !== null) {
                $sheet = preg_replace('/<sheetData>.*?<\/sheetData>/s', $this->sheetDataXml($categories, $values), $sheet, 1);
            }

            if ($sheet !== null) {
                $zip->addFromString('xl/worksheets/sheet1.xml', $sheet);
            }
        }

        $zip->addFromString('xl/sharedStrings.xml', $this->sharedStringsXml($series, $categories));

        $table = $zip->getFromName('xl/tables/table1.xml');

        if ($table !== false) {
            $table = preg_replace('/ref="A1:B\d+"/', 'ref="A1:B'.$lastRow.'"', $table, 1);

            if ($table !== null) {
                $zip->addFromString('xl/tables/table1.xml', $table);
            }
        }

        $zip->close();

        $result = file_get_contents($path);
        @unlink($path);

        return $result === false ? $bytes : $result;
    }

    /**
     * @param  array<int, string>  $categories
     * @param  array<int, int>  $values
     */
    private function sheetDataXml(array $categories, array $values): string
    {
        $rows = ['<sheetData>'];
        $rows[] = '<row r="1" spans="1:2" x14ac:dyDescent="0.3"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>';

        foreach ($categories as $index => $category) {
            $row = $index + 2;
            $rows[] = '<row r="'.$row.'" spans="1:2" x14ac:dyDescent="0.3">'
                .'<c r="A'.$row.'" s="1" t="s"><v>'.($index + 2).'</v></c>'
                .'<c r="B'.$row.'"><v>'.(int) ($values[$index] ?? 0).'</v></c>'
                .'</row>';
        }

        $rows[] = '</sheetData>';

        return implode('', $rows);
    }

    /**
     * @param  array<int, string>  $categories
     */
    private function sharedStringsXml(string $series, array $categories): string
    {
        $strings = array_merge([' ', $series], $categories);
        $count = count($strings);
        $unique = count(array_unique($strings));

        $body = '';

        foreach ($strings as $string) {
            $body .= '<si><t xml:space="preserve">'.$this->escape((string) $string).'</t></si>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="'.$count.'" uniqueCount="'.$unique.'">'
            .$body
            .'</sst>';
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    private function loadXml(string $xml): DOMDocument
    {
        $dom = new DOMDocument;
        $dom->preserveWhiteSpace = true;
        $dom->formatOutput = false;

        if (! @$dom->loadXML($xml, LIBXML_NONET)) {
            throw new RuntimeException('Unable to parse the report template XML.');
        }

        return $dom;
    }

    private function xpath(DOMDocument $dom): DOMXPath
    {
        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('w', self::W_NS);
        $xpath->registerNamespace('c', self::C_NS);
        $xpath->registerNamespace('a', self::A_NS);

        return $xpath;
    }

    private function saveXml(DOMDocument $dom): string
    {
        $dom->encoding = 'UTF-8';
        $dom->xmlStandalone = true;

        return $dom->saveXML();
    }
}
