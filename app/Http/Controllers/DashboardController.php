<?php

namespace App\Http\Controllers;

use App\RequestStatus;
use App\Services\RequestService;
use Illuminate\Http\Request;
use Inertia\Inertia;


class DashboardController extends Controller
{
    public function __construct(protected RequestService $requestService) {}

    public function index()
    {
        $pending = $this->requestService->get(RequestStatus::PENDING);
        $approved = $this->requestService->get(RequestStatus::APPROVED);
        $denied = $this->requestService->get(RequestStatus::DENIED);

        return Inertia::render("dashboard", [
            'labeledBreadcrumb' => "Dashboard",
            'pending' => $pending,
            'approved' => $approved,
            'denied' => $denied,
        ]);
    }
}
