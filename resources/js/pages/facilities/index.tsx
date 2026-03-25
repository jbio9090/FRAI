import { useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { Building2, Trash2 } from "lucide-react";
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

export default function Facilities({ facilities }: FacilityProps) {
    const { auth, errors } = usePage<PageProps>().props;
    const isAdmin = auth.user?.roles?.includes("admin") ?? false;

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addForm, setAddForm] = useState<FacilityForm>(emptyForm);

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
            // Keep dialog open on error so user can fix the fields
            onError: () => setIsAddOpen(true),
        });
    };

    const handleDelete = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        router.delete(route("facility.destroy", id), {
            preserveScroll: true,
        });
    };

    const FormFields = ({
        form,
        onChange,
    }: {
        form: FacilityForm;
        onChange: (f: FacilityForm) => void;
    }) => (
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
                {errors.name && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                )}
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
                {errors.building && (
                    <p className="text-sm text-destructive">{errors.building}</p>
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
                {errors.capacity && (
                    <p className="text-sm text-destructive">{errors.capacity}</p>
                )}
            </div>
        </>
    );

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
                        <Building2 className="h-4 w-4" />
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
                            <Building2 />
                            Add Facility
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAdd} className="flex flex-col gap-4 mb-8">
                        <FormFields form={addForm} onChange={setAddForm} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Save Facility</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Facilities Table */}
            <div className="mt-6">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="font-bold">Name</TableHead>
                            <TableHead className="font-bold">Building</TableHead>
                            <TableHead className="font-bold">Capacity</TableHead>
                            {isAdmin && <TableHead className="w-[60px]" />}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {facilities.map((facility) => (
                            <TableRow
                                key={facility.id}
                                className="cursor-pointer"
                                onClick={() => router.visit(route("facility.detail", [facility.id]))}
                            >
                                <TableCell>{facility.name}</TableCell>
                                <TableCell>{facility.building}</TableCell>
                                <TableCell>{facility.capacity}</TableCell>
                                {isAdmin && (
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => handleDelete(e, facility.id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </DefaultLayout>
    );
}