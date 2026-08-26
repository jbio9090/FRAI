<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Request;
use App\Models\RequestFacility;
use App\Services\AlternativeRecommendationService;
use App\Services\RequestService;
use App\Enums\RequestStatus;

// Find FOR_RESCHEDULE requests
$requests = Request::where('status', RequestStatus::FOR_RESCHEDULE)
    ->with(['requestFacilities.facility', 'equipment'])
    ->get();

echo "FOR_RESCHEDULE requests found: " . $requests->count() . "\n\n";

foreach ($requests as $req) {
    echo "ID: {$req->id} | Title: {$req->title} | User: {$req->user_id} | Status: {$req->status->value}\n";
    echo "  Facilities:\n";
    foreach ($req->requestFacilities as $rf) {
        echo "    - Facility: {$rf->facility->name} (ID: {$rf->facility_id}) | Date: {$rf->date_requested} | Time: {$rf->time_start}-{$rf->time_end} | Capacity: {$rf->expected_capacity}\n";
    }
    echo "  Equipment IDs: " . $req->equipment->pluck('id')->implode(', ') . "\n\n";
    
    // Test the service
    $service = app(AlternativeRecommendationService::class);
    $result = $service->findAlternatives($req, ['include_equipment' => false, 'max_results' => 5]);
    
    echo "  Alternatives found:\n";
    foreach ($result['alternatives'] as $facilityId => $slots) {
        $fac = $req->facilities->firstWhere('id', $facilityId);
        $facName = $fac ? $fac->name : 'unknown';
        echo "    Facility {$facilityId} ({$facName}): " . count($slots) . " slots\n";
        foreach ($slots as $slot) {
            echo "      - {$slot['date']} {$slot['time_start']}-{$slot['time_end']} | Type: {$slot['type']} | Cap: {$slot['capacity_fit']} | Eq: " . ($slot['equipment_available'] ? 'yes' : 'no') . "\n";
        }
    }
    if (empty($result['alternatives'])) {
        echo "    (none)\n";
    }
    echo "\n";
}