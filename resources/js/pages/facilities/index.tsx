import { useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { HousePlus, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Pencil } from "lucide-react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
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

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
    if (sorted === "asc") return <ArrowUp className="ml-2 h-4 w-4" />;
    if (sorted === "desc") return <ArrowDown className="ml-2 h-4 w-4" />;
    return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
}

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
                // Now uses the prop 'errors'
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

    const [sorting, setSorting] = useState<SortingState>([]);

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addForm, setAddForm] = useState<FacilityForm>(emptyForm);

    const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
    const [editForm, setEditForm] = useState<FacilityForm>(emptyForm);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        router.post(route("facility.store"), {
            name: addForm.name,
            building: addForm.building,
            capacity: Number(addForm.capacity),
        }, {
            onSuccess: () => {
                setIsAddOpen(false);
                setAddForm(emptyForm);
            },
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
            onSuccess: () => {
                setEditingFacility(null);
                setEditForm(emptyForm);
            },
            onError: () => { },
        });
    };

    const openEditDialog = (e: React.MouseEvent, facility: Facility) => {
        e.stopPropagation();
        setEditingFacility(facility);
        setEditForm({
            name: facility.name,
            building: facility.building,
            capacity: String(facility.capacity),
        });
    };

    const handleDelete = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        router.delete(route("facility.destroy", id), { preserveScroll: true });
    };

    const columns: ColumnDef<Facility>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-4 font-bold"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Name
                    <SortIcon sorted={column.getIsSorted()} />
                </Button>
            ),
        },
        {
            accessorKey: "building",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-4 font-bold"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Building
                    <SortIcon sorted={column.getIsSorted()} />
                </Button>
            ),
        },
        {
            accessorKey: "capacity",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-4 font-bold"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Capacity
                    <SortIcon sorted={column.getIsSorted()} />
                </Button>
            ),
        },
        ...(isAdmin
            ? [
                {
                    id: "actions",
                    cell: ({ row }: { row: { original: Facility } }) => (
                        <div className="flex items-center justify-end gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => openEditDialog(e, row.original)}
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleDelete(e, row.original.id)}
                            >
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ),
                } satisfies ColumnDef<Facility>,
            ]
            : []),
    ];

    const table = useReactTable({
        data: facilities,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <DefaultLayout>
            <h1 className="font-bold text-xl">Facilities</h1>

            {isAdmin && (
                <div className="mt-6">
                    <Button
                        variant="outline"
                        className="flex items-center gap-2"
                        onClick={() => setIsAddOpen(true)}
                    >
                        <HousePlus className="h-4 w-4" />
                        Add Facility
                    </Button>
                </div>
            )}

            {/* Add Dialog */}
            <Dialog open={isAddOpen} onOpenChange={(open) => {
                setIsAddOpen(open);
                if (!open) setAddForm(emptyForm);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <HousePlus />
                            Add Facility
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAdd} className="flex flex-col gap-4 mb-8">
                        <FormFields form={addForm} onChange={setAddForm} errors={errors} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save Facility</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={!!editingFacility} onOpenChange={(open) => {
                if (!open) {
                    setEditingFacility(null);
                    setEditForm(emptyForm);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil />
                            Edit Facility
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="flex flex-col gap-4 mb-8">
                        <FormFields form={editForm} onChange={setEditForm} errors={errors} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingFacility(null)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save Changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Data Table */}
            <div className="mt-6 rounded-md border">
                <Table>
                    <TableHeader className="px-4">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className="cursor-pointer"
                                    onClick={() => router.visit(route("facility.detail", [row.original.id]))}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                    No facilities found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </DefaultLayout>
    );
}