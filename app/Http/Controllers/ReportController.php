<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('reports/index', [
            'labeledBreadcrumb' => 'Reports',
        ]);
    }
}
