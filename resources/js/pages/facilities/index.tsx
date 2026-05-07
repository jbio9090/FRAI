import { router, usePage } from "@inertiajs/react";
import { ArrowDownUp, ArrowUp, Check, ChevronDown, HousePlus, Map, MapPinned, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import DefaultLayout from "@/layout.tsx/default.";

interface Campus {
    id: number;
    name: string;
}

interface Building {
    id: number;
    campus_id: number;
    name: string;
    campus?: Campus;
}

interface Facility {
    id: number;
    name: string;
    building: string;
    capacity: number;
    campus_id: number | null;
    building_id: number | null;
    campus?: Campus | null;
    building_record?: Building | null;
}

interface FacilityProps {
    facilities: Facility[];
    campuses: Campus[];
    buildings: Building[];
}

interface FacilityForm {
    name: string;
    campus_id: string;
    building_id: string;
    capacity: string;
}

interface BuildingForm {
    name: string;
    campus_id: string;
}

interface CampusForm {
    name: string;
}

interface PageProps {
    auth: {
        user: {
            id: number;
            name: string;
            email: string;
            roles: string[];
            permissions: string[];
        } | null;
    };
    errors: Partial<Record<keyof FacilityForm | keyof BuildingForm | keyof CampusForm, string>>;
    [key: string]: unknown;
}

const emptyFacilityForm: FacilityForm = { name: "", campus_id: "", building_id: "", capacity: "" };
const emptyBuildingForm: BuildingForm = { name: "", campus_id: "" };
const emptyCampusForm: CampusForm = { name: "" };

type SortKey = "name" | "campus" | "building" | "capacity";
type SortDir = "asc" | "desc";
type SortValue = `${SortKey}-${"asc" | "desc"}`;

const SORT_OPTIONS: { label: string; value: SortValue | "" }[] = [
    { label: "None", value: "" },
    { label: "Name (A-Z)", value: "name-asc" },
    { label: "Name (Z-A)", value: "name-desc" },
    { label: "Campus (A-Z)", value: "campus-asc" },
    { label: "Campus (Z-A)", value: "campus-desc" },
    { label: "Building (A-Z)", value: "building-asc" },
    { label: "Building (Z-A)", value: "building-desc" },
    { label: "Capacity (Low)", value: "capacity-asc" },
    { label: "Capacity (High)", value: "capacity-desc" },
];

interface FacilityFormFieldsProps {
    form: FacilityForm;
    campuses: Campus[];
    buildings: Building[];
    onChange: (f: FacilityForm) => void;
    errors: Partial<Record<keyof FacilityForm, string>>;
}

const isFacilityFormValid = (form: FacilityForm) => {
    const capacity = Number(form.capacity);
    return form.name.trim() !== ""
        && form.campus_id !== ""
        && form.building_id !== ""
        && Number.isInteger(capacity)
        && capacity >= 1;
};

const getFacilitySortValue = (facility: Facility, sortKey: SortKey) => {
    if (sortKey === "campus") return facility.campus?.name ?? "";
    return facility[sortKey];
};

const FacilityFormFields = ({ form, campuses, buildings, onChange, errors }: FacilityFormFieldsProps) => {
    const filteredBuildings = buildings.filter((building) => String(building.campus_id) === form.campus_id);

    const updateCampus = (campusId: string) => {
        onChange({ ...form, campus_id: campusId, building_id: "" });
    };

    return (
        <>
            <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input
                    type="text"
                    placeholder="Enter facility name"
                    value={form.name}
                    className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                    onChange={(e) => onChange({ ...form, name: e.target.value })}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>Campus</Label>
                <Select value={form.campus_id} onValueChange={updateCampus}>
                    <SelectTrigger className={errors.campus_id ? "w-full border-destructive focus-visible:ring-destructive" : "w-full"}>
                        <SelectValue placeholder="Select campus" />
                    </SelectTrigger>
                    <SelectContent>
                        {campuses.map((campus) => (
                            <SelectItem key={campus.id} value={String(campus.id)}>
                                {campus.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors.campus_id && <p className="text-sm text-destructive">{errors.campus_id}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>Building</Label>
                <Select
                    value={form.building_id}
                    onValueChange={(buildingId) => onChange({ ...form, building_id: buildingId })}
                    disabled={!form.campus_id || filteredBuildings.length === 0}
                >
                    <SelectTrigger className={errors.building_id ? "w-full border-destructive focus-visible:ring-destructive" : "w-full"}>
                        <SelectValue placeholder={form.campus_id ? "Select building" : "Select campus first"} />
                    </SelectTrigger>
                    <SelectContent>
                        {filteredBuildings.map((building) => (
                            <SelectItem key={building.id} value={String(building.id)}>
                                {building.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors.building_id && <p className="text-sm text-destructive">{errors.building_id}</p>}
                {form.campus_id && filteredBuildings.length === 0 && (
                    <p className="text-sm text-muted-foreground">No buildings have been added for this campus yet.</p>
                )}
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>Capacity</Label>
                <Input
                    type="number"
                    placeholder="Enter capacity"
                    min={1}
                    value={form.capacity}
                    className={errors.capacity ? "border-destructive focus-visible:ring-destructive" : ""}
                    onChange={(e) => onChange({ ...form, capacity: e.target.value })}
                />
                {errors.capacity && <p className="text-sm text-destructive">{errors.capacity}</p>}
            </div>
        </>
    );
};

export default function Facilities({ facilities, campuses, buildings }: FacilityProps) {
    const { auth, errors } = usePage<PageProps>().props;
    const isAdmin = auth.user?.roles?.includes("admin") ?? false;

    const [sortValue, setSortValue] = useState<SortValue | "">("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addForm, setAddForm] = useState<FacilityForm>(emptyFacilityForm);
    const [isAddBuildingOpen, setIsAddBuildingOpen] = useState(false);
    const [buildingForm, setBuildingForm] = useState<BuildingForm>(emptyBuildingForm);
    const [isAddCampusOpen, setIsAddCampusOpen] = useState(false);
    const [campusForm, setCampusForm] = useState<CampusForm>(emptyCampusForm);
    const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
    const [editForm, setEditForm] = useState<FacilityForm>(emptyFacilityForm);

    const [sortKey, sortDir] = sortValue
        ? (sortValue.split("-") as [SortKey, SortDir])
        : [null, null];

    const sortedFacilities = useMemo(() => {
        return [...facilities].sort((a, b) => {
            if (!sortKey) return 0;

            const aVal = getFacilitySortValue(a, sortKey);
            const bVal = getFacilitySortValue(b, sortKey);
            const cmp =
                typeof aVal === "number" && typeof bVal === "number"
                    ? aVal - bVal
                    : String(aVal).localeCompare(String(bVal));

            return sortDir === "asc" ? cmp : -cmp;
        });
    }, [facilities, sortDir, sortKey]);

    const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortValue)?.label;
    const canAddFacility = isFacilityFormValid(addForm);
    const canEditFacility = isFacilityFormValid(editForm);
    const canAddBuilding = buildingForm.name.trim() !== "" && buildingForm.campus_id !== "";
    const canAddCampus = campusForm.name.trim() !== "";

    const handleAdd = (e: FormEvent) => {
        e.preventDefault();
        if (!canAddFacility) return;

        router.post(route("facility.store"), {
            name: addForm.name,
            campus_id: Number(addForm.campus_id),
            building_id: Number(addForm.building_id),
            capacity: Number(addForm.capacity),
        }, {
            onSuccess: () => { setIsAddOpen(false); setAddForm(emptyFacilityForm); },
            onError: () => setIsAddOpen(true),
        });
    };

    const handleAddBuilding = (e: FormEvent) => {
        e.preventDefault();
        if (!canAddBuilding) return;

        router.post(route("buildings.store"), {
            name: buildingForm.name,
            campus_id: Number(buildingForm.campus_id),
        }, {
            preserveScroll: true,
            onSuccess: () => { setIsAddBuildingOpen(false); setBuildingForm(emptyBuildingForm); },
            onError: () => setIsAddBuildingOpen(true),
        });
    };

    const handleAddCampus = (e: FormEvent) => {
        e.preventDefault();
        if (!canAddCampus) return;

        router.post(route("campuses.store"), {
            name: campusForm.name,
        }, {
            preserveScroll: true,
            onSuccess: () => { setIsAddCampusOpen(false); setCampusForm(emptyCampusForm); },
            onError: () => setIsAddCampusOpen(true),
        });
    };

    const handleEdit = (e: FormEvent) => {
        e.preventDefault();
        if (!editingFacility || !canEditFacility) return;

        router.put(route("facility.update", editingFacility.id), {
            name: editForm.name,
            campus_id: Number(editForm.campus_id),
            building_id: Number(editForm.building_id),
            capacity: Number(editForm.capacity),
            from: "facilities_page",
        }, {
            onSuccess: () => { setEditingFacility(null); setEditForm(emptyFacilityForm); },
            onError: () => { },
        });
    };

    const openEditDialog = (e: MouseEvent, facility: Facility) => {
        e.stopPropagation();
        setEditingFacility(facility);
        setEditForm({
            name: facility.name,
            campus_id: facility.campus_id ? String(facility.campus_id) : "",
            building_id: facility.building_id ? String(facility.building_id) : "",
            capacity: String(facility.capacity),
        });
    };

    const handleDelete = (e: MouseEvent, id: number) => {
        e.stopPropagation();
        router.delete(route("facility.destroy", id), { preserveScroll: true });
    };

    return (
        <DefaultLayout>
            <h1 className="font-bold text-xl">Facilities</h1>

            <div className="mt-6 flex flex-wrap items-center gap-3">
                {isAdmin && (
                    <>
                        <Button variant="outline" className="flex items-center gap-2" onClick={() => setIsAddOpen(true)}>
                            <HousePlus className="h-4 w-4" />
                            Add Facility
                        </Button>
                        <Button variant="outline" className="flex items-center gap-2" onClick={() => setIsAddBuildingOpen(true)}>
                            <MapPinned className="h-4 w-4" />
                            Add Building
                        </Button>
                        <Button variant="outline" className="flex items-center gap-2" onClick={() => setIsAddCampusOpen(true)}>
                            <Map className="h-4 w-4" />
                            Add Campus
                        </Button>
                    </>
                )}

                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline">
                            <ArrowDownUp className="h-4 w-4" />
                            <span>{currentSortLabel && currentSortLabel !== "None" ? currentSortLabel : "Sort By"}</span>
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-52">
                        <p className="px-3 py-1 pt-4 text-xs text-muted-foreground font-semibold">
                            Sort By
                        </p>
                        <div className="flex flex-col p-1">
                            {SORT_OPTIONS.map((opt) => (
                                <Button
                                    key={opt.value || "none"}
                                    onClick={() => setSortValue(opt.value)}
                                    variant={sortValue === opt.value ? "secondary" : "ghost"}
                                    className="justify-between w-full px-2"
                                    size="sm"
                                >
                                    <span>{opt.label}</span>
                                    {opt.value === "" ? (
                                        sortValue === opt.value ? <Check size={14} /> : <Check size={14} className="opacity-0" />
                                    ) : (
                                        sortValue === opt.value
                                            ? sortDir === "asc"
                                                ? <ArrowUp size={14} className="rotate-180" />
                                                : <ArrowUp size={14} />
                                            : <ArrowUp size={14} className="opacity-0" />
                                    )}
                                </Button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setAddForm(emptyFacilityForm); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><HousePlus />Add Facility</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAdd} className="flex flex-col gap-4 mb-8">
                        <FacilityFormFields form={addForm} campuses={campuses} buildings={buildings} onChange={setAddForm} errors={errors} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={!canAddFacility}>Save Facility</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddCampusOpen} onOpenChange={(open) => { setIsAddCampusOpen(open); if (!open) setCampusForm(emptyCampusForm); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Map />Add Campus</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddCampus} className="flex flex-col gap-4 mb-8">
                        <div className="flex flex-col gap-1.5">
                            <Label>Campus</Label>
                            <Input
                                type="text"
                                placeholder="Enter campus name"
                                value={campusForm.name}
                                className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                                onChange={(e) => setCampusForm({ name: e.target.value })}
                            />
                            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddCampusOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={!canAddCampus}>Save Campus</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddBuildingOpen} onOpenChange={(open) => { setIsAddBuildingOpen(open); if (!open) setBuildingForm(emptyBuildingForm); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><MapPinned />Add Building</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddBuilding} className="flex flex-col gap-4 mb-8">
                        <div className="flex flex-col gap-1.5">
                            <Label>Campus</Label>
                            <Select value={buildingForm.campus_id} onValueChange={(campusId) => setBuildingForm({ ...buildingForm, campus_id: campusId })}>
                                <SelectTrigger className={errors.campus_id ? "w-full border-destructive focus-visible:ring-destructive" : "w-full"}>
                                    <SelectValue placeholder="Select campus" />
                                </SelectTrigger>
                                <SelectContent>
                                    {campuses.map((campus) => (
                                        <SelectItem key={campus.id} value={String(campus.id)}>
                                            {campus.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.campus_id && <p className="text-sm text-destructive">{errors.campus_id}</p>}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Building</Label>
                            <Input
                                type="text"
                                placeholder="Enter building name"
                                value={buildingForm.name}
                                className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                                onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
                            />
                            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddBuildingOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={!canAddBuilding}>Save Building</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingFacility} onOpenChange={(open) => { if (!open) { setEditingFacility(null); setEditForm(emptyFacilityForm); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Pencil />Edit Facility</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="flex flex-col gap-4 mb-8">
                        <FacilityFormFields form={editForm} campuses={campuses} buildings={buildings} onChange={setEditForm} errors={errors} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingFacility(null)}>Cancel</Button>
                            <Button type="submit" disabled={!canEditFacility}>Save Changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-bold">Name</TableHead>
                        <TableHead className="font-bold">Campus</TableHead>
                        <TableHead className="font-bold">Building</TableHead>
                        <TableHead className="font-bold">Capacity</TableHead>
                        {isAdmin && <TableHead />}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedFacilities.length ? (
                        sortedFacilities.map((facility) => (
                            <TableRow
                                key={facility.id}
                                className="cursor-pointer"
                                onClick={() => router.visit(route("facility.detail", [facility.id]))}
                            >
                                <TableCell>{facility.name}</TableCell>
                                <TableCell>{facility.campus?.name ?? "Main"}</TableCell>
                                <TableCell>{facility.building_record?.name ?? facility.building}</TableCell>
                                <TableCell>{facility.capacity}</TableCell>
                                {isAdmin && (
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={(e) => openEditDialog(e, facility)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, facility.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={isAdmin ? 5 : 4} className="h-24 text-center text-muted-foreground">
                                No facilities found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </DefaultLayout>
    );
}
