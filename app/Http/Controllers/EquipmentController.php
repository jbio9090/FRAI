<?php

namespace App\Http\Controllers;

use App\Enums\RequestStatus;
use App\Models\Equipment;
use App\Models\Facility;
use App\Models\Request as FacilityRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class EquipmentController extends Controller
{
    public function index(Request $request)
    {
        $search = trim($request->input('search', ''));
        $sort = $request->input('sort', '');

        $query = Equipment::with('facilities');

        if ($search) {
            $query->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($search).'%']);
        }

        switch ($sort) {
            case 'name-asc':
                $query->orderBy('name', 'asc');
                break;
            case 'name-desc':
                $query->orderBy('name', 'desc');
                break;
            case 'quantity-asc':
                $query->orderBy('quantity', 'asc');
                break;
            case 'quantity-desc':
                $query->orderBy('quantity', 'desc');
                break;
            default:
                $query->orderBy('name', 'asc');
                break;
        }

        if (in_array($sort, ['assigned-asc', 'assigned-desc'])) {
            $direction = str_ends_with($sort, 'asc') ? 'asc' : 'desc';
            $query->withCount([
                'facilities as assigned_quantity' => fn ($q) => $q->selectRaw('COALESCE(SUM(facility_equipment.quantity), 0)'),
            ])->orderBy('assigned_quantity', $direction);
        }

        $equipments = $query->paginate(20)->withQueryString();

        return Inertia::render('equipments/index', [
            'equipments' => $equipments,
            'facilities' => Facility::select('id', 'name')->orderBy('name')->get(),
            'filters' => [
                'search' => $search,
                'sort' => $sort,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'quantity' => 'required|integer|min:1',
        ]);

        Equipment::create($validated);

        return redirect()->back()->with('success', 'Equipment created.');
    }

    public function update(Request $request, Equipment $equipment)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
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
            'assignments' => 'array',
            'assignments.*.facility_id' => [
                'required',
                Rule::exists('facilities', 'id')->where(fn ($query) => $query->whereNull('deleted_at')),
            ],
            'assignments.*.quantity' => 'required|integer|min:1',
        ]);

        $sync = collect($validated['assignments'] ?? [])
            ->mapWithKeys(fn ($a) => [
                $a['facility_id'] => ['quantity' => $a['quantity']],
            ])->all();

        $equipment->facilities()->sync($sync);

        return redirect()->back()->with('success', 'Facility assignments updated.');
    }

    public function checkConflicts(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'equipment_ids' => 'required|array',
            'equipment_ids.*' => 'integer|exists:equipments,id',
            'date' => 'required|date',
            'time_start' => 'required|string',
            'time_end' => 'required|string',
            'exclude_request_id' => 'nullable|integer',
        ]);

        $date = Carbon::parse($validated['date'])->format('Y-m-d');
        $timeStart = substr($validated['time_start'], 0, 5);
        $timeEnd = substr($validated['time_end'], 0, 5);

        $conflictingRequests = FacilityRequest::whereIn('status', [RequestStatus::PENDING, RequestStatus::APPROVED])
            ->where('on_hold', false)
            ->when($validated['exclude_request_id'] ?? null, fn ($q, $id) => $q->where('id', '!=', $id))
            ->whereHas('equipment', fn ($q) => $q->whereIn('equipments.id', $validated['equipment_ids']))
            ->whereHas(
                'requestFacilities',
                fn ($q) => $q
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
                    'request_id' => $conflict->id,
                    'request_title' => $conflict->title,
                    'requester' => $conflict->user->name,
                    'status' => $conflict->status->value,
                ];
            }
        }

        return response()->json(['conflicts' => $byEquipment]);
    }

    public function getAvailability(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'facility_id' => [
                'required',
                'integer',
                Rule::exists('facilities', 'id')->where(fn ($query) => $query->whereNull('deleted_at')),
            ],
            'date' => 'required|date',
            'time_start' => 'required|string',
            'time_end' => 'required|string',
        ]);

        $date = Carbon::parse($validated['date'])->format('Y-m-d');
        $timeStart = substr($validated['time_start'], 0, 5);
        $timeEnd = substr($validated['time_end'], 0, 5);
        $facilityId = (int) $validated['facility_id'];

        $facility = Facility::findOrFail($facilityId);

        $equipmentAvailability = $facility->equipment
            ->map(function ($equipment) use ($facilityId, $date, $timeStart, $timeEnd) {
                $totalInFacility = $equipment->quantityInFacility($facilityId);
                $available = $equipment->quantityAvailableInFacility(
                    $facilityId,
                    $date,
                    $timeStart,
                    $timeEnd
                );

                return [
                    'equipment_id' => $equipment->id,
                    'equipment_name' => $equipment->name,
                    'total_quantity' => $totalInFacility,
                    'available_quantity' => max(0, $available),
                    'is_limited' => $available < $totalInFacility,
                ];
            })
            ->values();

        return response()->json(['availability' => $equipmentAvailability]);
    }
}
