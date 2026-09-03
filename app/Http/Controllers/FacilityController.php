<?php

namespace App\Http\Controllers;

use App\Enums\FacilityStatus;
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
        $showArchived = request()->boolean('show_archived');

        $facilities = Facility::query()
            ->with(['campus', 'buildingRecord'])
            ->when($showArchived, fn ($query) => $query->withTrashed())
            ->orderBy('name')
            ->get();

        $campuses = Campus::query()
            ->when($showArchived, fn ($query) => $query->withTrashed())
            ->orderBy('name')
            ->get();

        $buildings = Building::query()
            ->with('campus')
            ->when($showArchived, fn ($query) => $query->withTrashed())
            ->orderBy('name')
            ->get();

        return Inertia::render("facilities/index", [
            "facilities" => $facilities,
            "campuses" => $campuses,
            "buildings" => $buildings,
            "activeCampuses" => Campus::orderBy('name')->get(),
            "activeBuildings" => Building::with('campus')
                ->whereHas('campus', fn ($query) => $query->whereNull('campuses.deleted_at'))
                ->orderBy('name')
                ->get(),
            "showArchived" => $showArchived,
        ]);
    }

    public function detail(int $facility_id)
    {
        $facility = Facility::withTrashed()
            ->where("id", $facility_id)
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
            "buildings" => Building::with('campus')
                ->whereHas('campus', fn ($query) => $query->whereNull('campuses.deleted_at'))
                ->orderBy('name')
                ->get(),
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
            'campus_id'   => [
                'required',
                'integer',
                Rule::exists('campuses', 'id')->where(fn ($query) => $query->whereNull('deleted_at')),
            ],
            'building_id' => [
                'required',
                'integer',
                Rule::exists('buildings', 'id')->where(fn ($query) => $query
                    ->where('campus_id', $request->input('campus_id'))
                    ->whereNull('deleted_at')),
            ],
            'capacity'    => 'required|integer|min:1',
            'status'      => ['required', Rule::enum(FacilityStatus::class)],
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
            'campus_id'   => [
                'required',
                'integer',
                Rule::exists('campuses', 'id')->where(fn ($query) => $query->whereNull('deleted_at')),
            ],
            'building_id' => [
                'required',
                'integer',
                Rule::exists('buildings', 'id')->where(fn ($query) => $query
                    ->where('campus_id', $request->input('campus_id'))
                    ->whereNull('deleted_at')),
            ],
            'capacity'    => 'required|integer|min:1',
            'status'      => ['required', Rule::enum(FacilityStatus::class)],
        ]);

        $validated['building'] = Building::findOrFail($validated['building_id'])->name;
        Facility::create($validated);

        return redirect()->back()->with("success", "$validated[name] has been created");
    }

    public function storeBuilding(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'campus_id' => [
                'required',
                'integer',
                Rule::exists('campuses', 'id')->where(fn ($query) => $query->whereNull('deleted_at')),
            ],
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

    public function updateBuilding(Request $request, Building $building): RedirectResponse
    {
        $validated = $request->validate([
            'campus_id' => [
                'required',
                'integer',
                Rule::exists('campuses', 'id')->where(fn ($query) => $query->whereNull('deleted_at')),
            ],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('buildings', 'name')
                    ->where(fn ($query) => $query->where('campus_id', $request->input('campus_id')))
                    ->ignore($building->id),
            ],
        ]);

        $building->update($validated);

        Facility::withTrashed()->where('building_id', $building->id)->update([
            'building' => $building->name,
            'campus_id' => $building->campus_id,
        ]);

        return redirect()->back()->with('success', "$validated[name] has been updated");
    }

    public function destroyBuilding(Building $building): RedirectResponse
    {
        $building->delete();

        return redirect()->back()->with('success', "$building->name has been archived");
    }

    public function storeCampus(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:campuses,name',
        ]);

        Campus::create($validated);

        return redirect()->back()->with('success', "$validated[name] has been created");
    }

    public function updateCampus(Request $request, Campus $campus): RedirectResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('campuses', 'name')->ignore($campus->id),
            ],
        ]);

        $campus->update($validated);

        return redirect()->back()->with('success', "$validated[name] has been updated");
    }

    public function destroyCampus(Campus $campus): RedirectResponse
    {
        $campus->delete();

        return redirect()->back()->with('success', "$campus->name has been archived");
    }

    public function destroy(Facility $facility): RedirectResponse
    {
        $facility->delete();
        return redirect()->back();
    }
}
