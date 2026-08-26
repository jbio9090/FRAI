<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Request;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

// Login as user 1 (owner of request 42)
$user = User::find(1);
Auth::login($user);

$request = Request::with([
    'requestFacilities.facility',
    'equipment',
    'requestFacilities.externalEquipments',
])->find(42);

echo "Testing getAlternatives for request 42 as user 1\n";
echo "Request user_id: {$request->user_id}\n";
echo "Auth user_id: " . Auth::id() . "\n";
echo "Can access: " . ($request->user_id === Auth::id() ? 'YES' : 'NO') . "\n";
echo "Status: {$request->status->value}\n";
echo "Is FOR_RESCHEDULE: " . ($request->status === \App\Enums\RequestStatus::FOR_RESCHEDULE ? 'YES' : 'NO') . "\n\n";

// Simulate the controller logic
if ($request->user_id !== Auth::id() && !Auth::user()->can('approve requests')) {
    echo "ERROR: 403 Forbidden\n";
    exit;
}

if ($request->status !== \App\Enums\RequestStatus::FOR_RESCHEDULE) {
    echo "ERROR: 400 Not FOR_RESCHEDULE\n";
    exit;
}

$service = app(\App\Services\AlternativeRecommendationService::class);
$result = $service->findAlternatives($request, ['include_equipment' => false, 'max_results' => 5]);

echo "SUCCESS! Alternatives:\n";
foreach ($result['alternatives'] as $facilityId => $slots) {
    $fac = $request->facilities->firstWhere('id', $facilityId);
    $facName = $fac ? $fac->name : 'unknown';
    echo "  Facility {$facilityId} ({$facName}): " . count($slots) . " slots\n";
    foreach ($slots as $slot) {
        echo "    {$slot['date']} {$slot['time_start']}-{$slot['time_end']} | {$slot['type']} | {$slot['capacity_fit']} | Eq: " . ($slot['equipment_available'] ? 'yes' : 'no') . "\n";
    }
}