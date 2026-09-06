<?php

namespace App\Http\Controllers;

use App\Services\PageContextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PageContextController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $context = app(PageContextService::class)->getCurrentPageContext($request->input('page_context'));

        return response()->json([
            'success' => true,
            'context' => $context,
            'generated_at' => now()->toISO8601String(),
        ]);
    }
}
