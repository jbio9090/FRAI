<?php

namespace App\Http\Controllers;

use App\Models\Building;
use App\Models\Campus;
use App\Models\Facility;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Services\FacilityService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\Rule;


class FacilityController extends Controller
{
    public function __construct(
        protected FacilityService $service
    ) {}

    public function index()
    {
        return Inertia::render("facilities/index", [
            "facilities" => Facility::with(['campus', 'buildingRecord'])->get(),
            "campuses" => Campus::orderBy('name')->get(),
            "buildings" => Building::with('campus')->orderBy('name')->get(),
        ]);
    }

    public function detail(int $facility_id)
    {
        $facility = Facility::where("id", $facility_id)
            ->with(["facilityEquipments.equipment", "campus", "buildingRecord"])
            ->firstOrFail();

        $facilities = Facility::with("facilityEquipments")->get();

        $start = now()->startOfMonth()->format('Y-m-d');
        $end = now()->endOfMonth()->format('Y-m-d');

        $initialEvents = $this->service->getSchedule($facility_id, $start, $end);

        return Inertia::render("facilities/detail", [
            "facility" => $facility,
            "initialEvents" => $initialEvents,
            "labeledBreadcrumb" => $facility->name,
            "facilities" => $facilities,
            "campuses" => Campus::orderBy('name')->get(),
            "buildings" => Building::with('campus')->orderBy('name')->get(),
        ]);
    }

    public function getDayScheduleJson(Facility $facility, string $date)
    {
        $eventsThisDay = $this->service->getDaySchedule($facility->id, $date);

        return response()->json([
            'bookings' => $eventsThisDay,
            'date' => $date,
        ]);
    }

    public function getCalendarSchedule(Request $request, $facility_id)
    {
        $start = $request->input('start');
        $end = $request->input('end');

        $events = $this->service->getSchedule($facility_id, $start, $end);

        return response()->json($events);
    }

    public function update(Request $request, Facility $facility): RedirectResponse
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'campus_id'   => 'required|integer|exists:campuses,id',
            'building_id' => [
                'required',
                'integer',
                Rule::exists('buildings', 'id')->where(fn ($query) => $query->where('campus_id', $request->input('campus_id'))),
            ],
            'capacity'    => 'required|integer|min:1',
        ]);

        $validated['building'] = Building::findOrFail($validated['building_id'])->name;
        $facility->update($validated);

        if (!empty($request->input("from"))) {
            if ($request->input("from") == "facilities_page") {
                return redirect()->route('facilities');
            }
        }

        return redirect()->route('facility.detail', $facility->id);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'campus_id'   => 'required|integer|exists:campuses,id',
            'building_id' => [
                'required',
                'integer',
                Rule::exists('buildings', 'id')->where(fn ($query) => $query->where('campus_id', $request->input('campus_id'))),
            ],
            'capacity'    => 'required|integer|min:1',
        ]);

        $validated['building'] = Building::findOrFail($validated['building_id'])->name;
        Facility::create($validated);

        return redirect()->back()->with("success", "$validated[name] has been created");
    }

    public function storeBuilding(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'campus_id' => 'required|integer|exists:campuses,id',
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('buildings', 'name')->where(fn ($query) => $query->where('campus_id', $request->input('campus_id'))),
            ],
        ]);

        Building::create($validated);

        return redirect()->back()->with('success', "$validated[name] has been created");
    }

    public function storeCampus(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:campuses,name',
        ]);

        Campus::create($validated);

        return redirect()->back()->with('success', "$validated[name] has been created");
    }

    public function destroy(Facility $facility): RedirectResponse
    {
        $facility->delete();
        return redirect()->back();
    }
}
