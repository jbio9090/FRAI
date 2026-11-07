<?php

namespace App\Http\Controllers;

use App\Services\ReportDocxService;
use App\Services\ReportService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportController extends Controller
{
    public function __construct(protected ReportService $reportService) {}

    public function index(Request $request): Response
    {
        $year = $request->integer('year', now()->year);
        $month = $request->integer('month', now()->month);

        return Inertia::render('reports/index', [
            'year' => $year,
            'month' => $month,
            'report' => $this->reportService->getMonthlyReport($year, $month),
        ]);
    }

    public function getData(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
        ]);

        return response()->json(
            $this->reportService->getMonthlyReport((int) $validated['year'], (int) $validated['month'])
        );
    }

    public function export(Request $request, ReportDocxService $reportDocxService): BinaryFileResponse
    {
        $validated = $request->validate([
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
        ]);

        $year = (int) $validated['year'];
        $month = (int) $validated['month'];

        $path = $reportDocxService->generate($year, $month);
        $filename = 'Facility_Reservation_Activity_Report_'.Carbon::create($year, $month, 1)->format('F_Y').'.docx';

        return response()->download($path, $filename)->deleteFileAfterSend(true);
    }
}
