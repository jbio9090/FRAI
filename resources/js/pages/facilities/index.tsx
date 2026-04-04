import { useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { HousePlus, Trash2, Pencil, ChevronDown, Check } from "lucide-react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowDownUp, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DefaultLayout from "@/layout.tsx/default.";

interface Facility {
    id: number;
    name: string;
    building: string;
    capacity: number;
}

interface FacilityProps {
    facilities: Facility[];
}

interface FacilityForm {
    name: string;
    building: string;
    capacity: string;
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
    errors: Partial<Record<keyof FacilityForm, string>>;
    [key: string]: unknown;
}

const emptyForm: FacilityForm = { name: "", building: "", capacity: "" };

type SortKey = keyof Pick<Facility, "name" | "building" | "capacity">;
type SortDir = "asc" | "desc";
type SortValue = `${SortKey}-${"asc" | "desc"}`;

const SORT_OPTIONS: { label: string; value: SortValue | "" }[] = [
    { label: "None", value: "" },
    { label: "Name (A–Z)", value: "name-asc" },
    { label: "Name (Z–A)", value: "name-desc" },
    { label: "Building (A–Z)", value: "building-asc" },
    { label: "Building (Z–A)", value: "building-desc" },
    { label: "Capacity (Low)", value: "capacity-asc" },
    { label: "Capacity (High)", value: "capacity-desc" },
];

interface FormFieldsProps {
    form: FacilityForm;
    onChange: (f: FacilityForm) => void;
    errors: Partial<Record<keyof FacilityForm, string>>;
}

const FormFields = ({ form, onChange, errors }: FormFieldsProps) => (
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
            <Label>Building</Label>
            <Input
                type="text"
                placeholder="Enter building"
                value={form.building}
                className={errors.building ? "border-destructive focus-visible:ring-destructive" : ""}
                onChange={(e) => onChange({ ...form, building: e.target.value })}
            />
            {errors.building && <p className="text-sm text-destructive">{errors.building}</p>}
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

export default function Facilities({ facilities }: FacilityProps) {
    const { auth, errors } = usePage<PageProps>().props;
    const isAdmin = auth.user?.roles?.includes("admin") ?? false;

    const [sortValue, setSortValue] = useState<SortValue | "">("");

    const [sortKey, sortDir] = sortValue
        ? (sortValue.split("-") as [SortKey, SortDir])
        : [null, null];

    const sortedFacilities = [...facilities].sort((a, b) => {
        if (!sortKey) return 0;
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        const cmp =
            typeof aVal === "number" && typeof bVal === "number"
                ? aVal - bVal
                : String(aVal).localeCompare(String(bVal));
        return sortDir === "asc" ? cmp : -cmp;
    });

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addForm, setAddForm] = useState<FacilityForm>(emptyForm);

    const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
    const [editForm, setEditForm] = useState<FacilityForm>(emptyForm);


    const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortValue)?.label;

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(route("facility.store"), {
            name: addForm.name,
            building: addForm.building,
            capacity: Number(addForm.capacity),
        }, {
            onSuccess: () => { setIsAddOpen(false); setAddForm(emptyForm); },
            onError: () => setIsAddOpen(true),
        });
    };

    const handleEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingFacility) return;
        router.put(route("facility.update", editingFacility.id), {
            name: editForm.name,
            building: editForm.building,
            capacity: Number(editForm.capacity),
            from: "facilities_page",
        }, {
            onSuccess: () => { setEditingFacility(null); setEditForm(emptyForm); },
            onError: () => { },
        });
    };

    const openEditDialog = (e: React.MouseEvent, facility: Facility) => {
        e.stopPropagation();
        setEditingFacility(facility);
        setEditForm({ name: facility.name, building: facility.building, capacity: String(facility.capacity) });
    };

    const handleDelete = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        router.delete(route("facility.destroy", id), { preserveScroll: true });
    };

    return (
        <DefaultLayout>
            <h1 className="font-bold text-xl">Facilities</h1>

            <div className="mt-6 flex items-center gap-3">
                {isAdmin && (
                    <Button variant="outline" className="flex items-center gap-2" onClick={() => setIsAddOpen(true)}>
                        <HousePlus className="h-4 w-4" />
                        Add Facility
                    </Button>
                )}

                {/* Sort Dropdown */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="icon">
                            <ArrowDownUp className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-48">
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
                                    {opt.value !== "" && (
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

            {/* Add Dialog */}
            <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setAddForm(emptyForm); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><HousePlus />Add Facility</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAdd} className="flex flex-col gap-4 mb-8">
                        <FormFields form={addForm} onChange={setAddForm} errors={errors} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                            <Button type="submit">Save Facility</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={!!editingFacility} onOpenChange={(open) => { if (!open) { setEditingFacility(null); setEditForm(emptyForm); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Pencil />Edit Facility</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="flex flex-col gap-4 mb-8">
                        <FormFields form={editForm} onChange={setEditForm} errors={errors} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingFacility(null)}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Data Table */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-bold">Name</TableHead>
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
                                <TableCell>{facility.building}</TableCell>
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
                            <TableCell colSpan={isAdmin ? 4 : 3} className="h-24 text-center text-muted-foreground">
                                No facilities found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

        </DefaultLayout>
    );
}