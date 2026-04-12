<?php

namespace App\Http\Controllers;

use App\Models\Equipment;
use App\Models\Facility;
use App\Models\FacilityEquipment;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Http\JsonResponse;
use App\Models\Request as FacilityRequest;
use App\RequestStatus;
use Illuminate\Support\Carbon;

class EquipmentController extends Controller
{
    public function index()
    {
        return Inertia::render('equipments/index', [
            'equipments' => Equipment::with('facilities')->orderBy('name')->get(),
            'facilities' => Facility::select('id', 'name')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'quantity' => 'required|integer|min:1',
        ]);

        Equipment::create($validated);

        return redirect()->back()->with('success', 'Equipment created.');
    }

    public function update(Request $request, Equipment $equipment)
    {
        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'quantity' => 'required|integer|min:1',
        ]);

        $equipment->update($validated);

        return redirect()->back()->with('success', 'Equipment updated.');
    }

    public function destroy(Equipment $equipment)
    {
        $equipment->delete();

        return redirect()->back()->with('success', 'Equipment deleted.');
    }

    // Sync all facility assignments for one equipment at once
    public function syncFacilities(Request $request, Equipment $equipment)
    {
        $validated = $request->validate([
            'assignments'                => 'array',
            'assignments.*.facility_id'  => 'required|exists:facilities,id',
            'assignments.*.quantity'     => 'required|integer|min:1',
        ]);

        $sync = collect($validated['assignments'] ?? [])
            ->mapWithKeys(fn($a) => [
                $a['facility_id'] => ['quantity' => $a['quantity']]
            ])->all();

        $equipment->facilities()->sync($sync);

        return redirect()->back()->with('success', 'Facility assignments updated.');
    }

    public function checkConflicts(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'equipment_ids'      => 'required|array',
            'equipment_ids.*'    => 'integer|exists:equipments,id',
            'date'               => 'required|date',
            'time_start'         => 'required|string',
            'time_end'           => 'required|string',
            'exclude_request_id' => 'nullable|integer',
        ]);

        $date      = Carbon::parse($validated['date'])->format('Y-m-d');
        $timeStart = substr($validated['time_start'], 0, 5);
        $timeEnd   = substr($validated['time_end'], 0, 5);

        $conflictingRequests = FacilityRequest::whereIn('status', [RequestStatus::PENDING, RequestStatus::APPROVED])
            ->where('on_hold', false)
            ->when($validated['exclude_request_id'] ?? null, fn($q, $id) => $q->where('id', '!=', $id))
            ->whereHas('equipment', fn($q) => $q->whereIn('equipments.id', $validated['equipment_ids']))
            ->whereHas(
                'requestFacilities',
                fn($q) => $q
                    ->where('date_requested', $date)
                    ->where('time_start', '<', $timeEnd)
                    ->where('time_end', '>', $timeStart)
            )
            ->with(['user', 'equipment'])
            ->get();

        $byEquipment = [];
        foreach ($conflictingRequests as $conflict) {
            $overlapping = $conflict->equipment->pluck('id')->intersect($validated['equipment_ids']);
            foreach ($overlapping as $eqId) {
                $byEquipment[$eqId][] = [
                    'request_id'    => $conflict->id,
                    'request_title' => $conflict->title,
                    'requester'     => $conflict->user->name,
                    'status'        => $conflict->status->value,
                ];
            }
        }

        return response()->json(['conflicts' => $byEquipment]);
    }

    public function getAvailability(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'facility_id' => 'required|integer|exists:facilities,id',
            'date'        => 'required|date',
            'time_start'  => 'required|string',
            'time_end'    => 'required|string',
        ]);

        $date      = Carbon::parse($validated['date'])->format('Y-m-d');
        $timeStart = substr($validated['time_start'], 0, 5);
        $timeEnd   = substr($validated['time_end'], 0, 5);

        $facility = Facility::findOrFail($validated['facility_id']);

        $equipmentAvailability = $facility->equipment
            ->map(function ($equipment) use ($validated['facility_id'], $date, $timeStart, $timeEnd) {
                $totalInFacility = $equipment->quantityInFacility($validated['facility_id']);
                $available = $equipment->quantityAvailableInFacility(
                    $validated['facility_id'],
                    $date,
                    $timeStart,
                    $timeEnd
                );

                return [
                    'equipment_id'      => $equipment->id,
                    'equipment_name'    => $equipment->name,
                    'total_quantity'    => $totalInFacility,
                    'available_quantity' => max(0, $available),
                    'is_limited'        => $available < $totalInFacility,
                ];
            })
            ->values();

        return response()->json(['availability' => $equipmentAvailability]);
    }
}
