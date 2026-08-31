<?php

namespace App\Http\Controllers;

use App\Services\PageContextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Session;

class PageContextController extends Controller
{
    public function index(): JsonResponse
    {
        $service = new PageContextService();
        $context = $service->getCurrentPageContext();

        return response()->json([
            'success' => true,
            'context' => $context,
            'generated_at' => now()->toISO8601String(),
        ]);
    }
}