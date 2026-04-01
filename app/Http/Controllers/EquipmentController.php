<?php

namespace App\Http\Controllers;

use App\Models\Equipment;
use App\Models\Facility;
use App\Models\FacilityEquipment;
use Illuminate\Http\Request;
use Inertia\Inertia;

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
}
