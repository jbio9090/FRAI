<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Request;
use App\Models\RequestFacility;
use App\Services\AlternativeRecommendationService;
use App\Services\RequestService;
use App\Enums\RequestStatus;

// Test with request 42
$req = Request::with(['requestFacilities.facility', 'equipment', 'user'])->find(42);

echo "Request ID: {$req->id}\n";
echo "Title: {$req->title}\n";
echo "User ID: {$req->user_id}\n";
echo "Status: {$req->status->value}\n";
echo "Owned by current user (1): " . ($req->user_id == 1 ? 'YES' : 'NO') . "\n\n";

foreach ($req->requestFacilities as $rf) {
    echo "RequestFacility ID: {$rf->id}\n";
    echo "  Facility: {$rf->facility->name} (ID: {$rf->facility_id})\n";
    echo "  Date: {$rf->date_requested}\n";
    echo "  Time: {$rf->time_start} - {$rf->time_end}\n";
    echo "  Expected Capacity: " . ($rf->expected_capacity ?? 'NULL') . "\n";
    echo "  Status: " . ($rf->status?->value ?? 'NULL') . "\n";
}

echo "\n--- Testing API endpoint logic ---\n";
$service = app(AlternativeRecommendationService::class);
$result = $service->findAlternatives($req, ['include_equipment' => false, 'max_results' => 5]);

echo "Alternatives:\n";
foreach ($result['alternatives'] as $facilityId => $slots) {
    $fac = $req->facilities->firstWhere('id', $facilityId);
    $facName = $fac ? $fac->name : 'unknown';
    echo "  Facility {$facilityId} ({$facName}): " . count($slots) . " slots\n";
    foreach ($slots as $slot) {
        echo "    {$slot['date']} {$slot['time_start']}-{$slot['time_end']} | {$slot['type']} | {$slot['capacity_fit']} | Eq: " . ($slot['equipment_available'] ? 'yes' : 'no') . "\n";
    }
}