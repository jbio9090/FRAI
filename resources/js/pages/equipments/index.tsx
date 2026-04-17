import { useState, useEffect, useMemo } from "react";
import { router } from "@inertiajs/react";
import DefaultLayout from "@/layout.tsx/default.";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Plus,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    ArrowLeftRight,
    Package,
    Building2,
    Hash,
    AlertCircle,
    ArrowDownUp,
    ArrowUp,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import wordToColor from "@/lib/wordToColor";
import useDarkMode from "@/hooks/use-darkMode";

interface FacilityPivot {
    equipment_id: number;
    facility_id: number;
    quantity: number;
}

interface Facility {
    id: number;
    name: string;
    building?: string;
    capacity?: number;
    pivot?: FacilityPivot;
}

interface Equipment {
    id: number;
    name: string;
    quantity: number;
    facilities: Facility[];
}

interface Assignment {
    facility_id: number;
    quantity: number;
}


function EquipmentDialog({
    open,
    equipment,
    onClose,
}: {
    open: boolean;
    equipment?: Equipment;
    onClose: () => void;
}) {
    const isEdit = !!equipment;
    const [name, setName] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [errors, setErrors] = useState<{ name?: string; quantity?: string }>({});
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (open) {
            setName(equipment?.name ?? "");
            setQuantity(equipment?.quantity ?? 1);
            setErrors({});
        }
    }, [equipment, open]);

    const submit = () => {
        setProcessing(true);
        const data = { name, quantity };
        if (isEdit) {
            router.put(`/equipments/${equipment!.id}`, data, {
                onSuccess: () => { setProcessing(false); onClose(); },
                onError: (e) => { setErrors(e as any); setProcessing(false); },
            });
        } else {
            router.post("/equipments", data, {
                onSuccess: () => { setProcessing(false); onClose(); },
                onError: (e) => { setErrors(e as any); setProcessing(false); },
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the equipment details below."
                            : "Fill in the details for the new equipment."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="eq-name">Equipment Name</Label>
                        <Input
                            id="eq-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Wireless Microphone"
                        />
                        {errors.name && (
                            <p className="text-sm text-destructive flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {errors.name}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="eq-qty">Total Quantity</Label>
                        <Input
                            id="eq-qty"
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                        />
                        {errors.quantity && (
                            <p className="text-sm text-destructive flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {errors.quantity}
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={processing}>
                        {processing ? "Saving…" : isEdit ? "Save Changes" : "Add Equipment"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function AssignDialog({
    open,
    equipment,
    facilities,
    onClose,
}: {
    open: boolean;
    equipment: Equipment | null;
    facilities: Facility[];
    onClose: () => void;
}) {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open && equipment) {
            const initialAssignments = equipment.facilities.map((f) => ({
                facility_id: f.id,
                quantity: f.pivot?.quantity ?? 1,
            }));
            setAssignments(initialAssignments);
        }
    }, [equipment, open]);

    const { totalAssigned, remaining, overAllocated, pct } = useMemo(() => {
        if (!equipment) return { totalAssigned: 0, remaining: 0, overAllocated: false, pct: 0 };
        const totalAssigned = assignments.reduce((s, a) => s + a.quantity, 0);
        const remaining = equipment.quantity - totalAssigned;
        const overAllocated = remaining < 0;
        const pct = equipment.quantity > 0
            ? Math.min(100, Math.round((totalAssigned / equipment.quantity) * 100))
            : 0;
        return { totalAssigned, remaining, overAllocated, pct };
    }, [assignments, equipment]);

    if (!equipment) return null;

    const toggle = (fid: number, checked: boolean) => {
        setAssignments((prev) =>
            checked
                ? [...prev, { facility_id: fid, quantity: 1 }]
                : prev.filter((a) => a.facility_id !== fid)
        );
    };

    const setQty = (fid: number, qty: number) => {
        setAssignments((prev) =>
            prev.map((a) => (a.facility_id === fid ? { ...a, quantity: qty } : a))
        );
    };

    const submit = () => {
        setSaving(true);
        router.post(
            `/equipments/${equipment.id}/sync-facilities`,
            { assignments },
            {
                onSuccess: () => { setSaving(false); onClose(); },
                onError: () => setSaving(false),
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Assign to Facilities</DialogTitle>
                    <DialogDescription>{equipment.name}</DialogDescription>
                </DialogHeader>

                <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Assigned</span>
                        <span className={overAllocated ? "text-destructive font-semibold" : "font-medium"}>
                            {totalAssigned} / {equipment.quantity}
                        </span>
                    </div>
                    <Progress
                        value={pct}
                        className={overAllocated ? "[&>div]:bg-destructive" : ""}
                    />
                    {overAllocated && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Over-allocated by {Math.abs(remaining)} unit{Math.abs(remaining) !== 1 ? "s" : ""}
                        </p>
                    )}
                </div>

                <Separator />

                <ScrollArea className="h-64 pr-3 -mr-3">
                    <div className="space-y-2">
                        {facilities.map((f) => {
                            const a = assignments.find((x) => x.facility_id === f.id);
                            const checked = !!a;
                            return (
                                <div
                                    key={f.id}
                                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors
                                        ${checked
                                            ? "border-primary/40 bg-primary/5"
                                            : "border-border bg-background"
                                        }`}
                                >
                                    <Checkbox
                                        id={`fac-${f.id}`}
                                        checked={checked}
                                        onCheckedChange={(v) => toggle(f.id, !!v)}
                                    />
                                    <Label
                                        htmlFor={`fac-${f.id}`}
                                        className="flex-1 cursor-pointer font-normal text-sm"
                                    >
                                        {f.name}
                                    </Label>
                                    {checked && (
                                        <Input
                                            type="number"
                                            min={1}
                                            value={a!.quantity}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => setQty(f.id, Number(e.target.value))}
                                            className="w-20 h-8 text-center text-sm"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={saving || overAllocated}>
                        {saving ? "Saving…" : "Save Assignments"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type SortValue = "name-asc" | "name-desc" | "quantity-asc" | "quantity-desc" | "assigned-asc" | "assigned-desc";

const SORT_OPTIONS: { label: string; value: SortValue | "" }[] = [
    { label: "None", value: "" },
    { label: "Name (A–Z)", value: "name-asc" },
    { label: "Name (Z–A)", value: "name-desc" },
    { label: "Quantity (Low)", value: "quantity-asc" },
    { label: "Quantity (High)", value: "quantity-desc" },
    { label: "Assigned (Low)", value: "assigned-asc" },
    { label: "Assigned (High)", value: "assigned-desc" },
];

export default function EquipmentsPage({
    equipments,
    facilities,
}: {
    equipments: Equipment[];
    facilities: Facility[];
}) {
    const [search, setSearch] = useState("");
    const [addOpen, setAddOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Equipment | null>(null);
    const [assignTarget, setAssignTarget] = useState<Equipment | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [sortValue, setSortValue] = useState<SortValue | "">("");
    const isDark = useDarkMode();

    const totalUnits = useMemo(
        () => equipments.reduce((s, e) => s + e.quantity, 0),
        [equipments]
    );

    const filtered = useMemo(
        () => equipments.filter((e) =>
            e.name.toLowerCase().includes(search.toLowerCase())
        ),
        [equipments, search]
    );

    const sorted = useMemo(() => {
        if (!sortValue) return filtered;
        const [key, dir] = sortValue.split("-") as [string, "asc" | "desc"];
        return [...filtered].sort((a, b) => {
            let cmp = 0;
            if (key === "name") {
                cmp = a.name.localeCompare(b.name);
            } else if (key === "quantity") {
                cmp = a.quantity - b.quantity;
            } else if (key === "assigned") {
                const aAssigned = a.facilities.reduce((s, f) => s + (f.pivot?.quantity ?? 0), 0);
                const bAssigned = b.facilities.reduce((s, f) => s + (f.pivot?.quantity ?? 0), 0);
                cmp = aAssigned - bAssigned;
            }
            return dir === "asc" ? cmp : -cmp;
        });
    }, [filtered, sortValue]);

    const confirmDelete = () => {
        if (!deleteTarget) return;
        setDeleting(true);
        router.delete(`/equipments/${deleteTarget.id}`, {
            onSuccess: () => { setDeleting(false); setDeleteTarget(null); },
            onError: () => setDeleting(false),
        });
    };

    return (
        <DefaultLayout>
            <EquipmentDialog open={addOpen} onClose={() => setAddOpen(false)} />
            <EquipmentDialog
                open={!!editTarget}
                equipment={editTarget ?? undefined}
                onClose={() => setEditTarget(null)}
            />
            <AssignDialog
                open={!!assignTarget}
                equipment={assignTarget}
                facilities={facilities}
                onClose={() => setAssignTarget(null)}
            />

            <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Equipment</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete{" "}
                            <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="mb-4">
                <h1 className="text-xl font-bold">Equipments</h1>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Items
                        </CardTitle>
                        <Package className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{equipments.length}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Units
                        </CardTitle>
                        <Hash className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{totalUnits}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Facilities
                        </CardTitle>
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{facilities.length}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search equipment…"
                        className="pl-9"
                    />
                </div>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline">
                            <ArrowDownUp className="h-4 w-4" />
                            <span>Sort By</span>
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
                                            ? sortValue.endsWith("asc")
                                                ? <ArrowUp size={14} className="rotate-180" />
                                                : <ArrowUp size={14} />
                                            : <ArrowUp size={14} className="opacity-0" />
                                    )}
                                </Button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                <Button onClick={() => setAddOpen(true)}>
                    <Plus size={16} />
                    Add Equipment
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow className="text-sm">
                        <TableHead className="w-10 px-4"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-36">Total Qty</TableHead>
                        <TableHead className="w-36">Assigned</TableHead>
                        <TableHead>Assigned To Facility</TableHead>
                        <TableHead className="w-12" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="py-16 text-center text-muted-foreground">
                                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                No equipment found
                            </TableCell>
                        </TableRow>
                    ) : (
                        sorted.map((eq, i) => {
                            const assigned = eq.facilities.reduce(
                                (s, f) => s + (f.pivot?.quantity ?? 0),
                                0
                            );
                            const pct =
                                eq.quantity > 0
                                    ? Math.min(100, Math.round((assigned / eq.quantity) * 100))
                                    : 0;

                            return (
                                <TableRow key={eq.id}>
                                    <TableCell className="text-muted-foreground text-sm px-4">
                                        {i}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium">{eq.name}</TableCell>
                                    <TableCell>
                                        <span className="text-sm font-medium text-right">{eq.quantity}</span>
                                    </TableCell>
                                    <TableCell>
                                        {(() => {
                                            const assigned = eq.facilities.reduce((s, f) => s + (f.pivot?.quantity ?? 0), 0);
                                            const over = assigned > eq.quantity;
                                            const empty = assigned === 0;
                                            return (
                                                <div className={`inline-flex items-center gap-0.5 rounded-md border px-2.5 py-1 text-sm
                ${over ? "border-destructive/30" : "border-border bg-muted/40"}`}
                                                >
                                                    <span className={`font-medium ${over ? "text-destructive" : empty ? "text-muted-foreground" : "text-green-700"
                                                        }`}>
                                                        {assigned}
                                                    </span>
                                                    <span className="text-sm text-muted-foreground/50 mx-0.5">/</span>
                                                    <span className="text-sm text-muted-foreground">{eq.quantity}</span>
                                                </div>
                                            );
                                        })()}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {eq.facilities.length === 0 ? (
                                                <span className="text-xs text-muted-foreground italic">
                                                    Unassigned
                                                </span>
                                            ) : (
                                                eq.facilities.map((f) => {
                                                    const { text, background } = wordToColor(f.name, isDark);
                                                    return (
                                                        <Badge
                                                            key={f.id}
                                                            variant="secondary"
                                                            className="text-xs flex items-center"
                                                            style={{ background, color: text }}
                                                        >
                                                            {(f.pivot?.quantity && f.pivot.quantity > 1)
                                                                ? (<span className="font-extrabold">{`${f.pivot.quantity} -`}</span>)
                                                                : ""}
                                                            <span>{f.name}</span>
                                                        </Badge>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-4 hidden md:block">
                                            <Button onClick={() => setAssignTarget(eq)} variant="ghost">
                                                <ArrowLeftRight className="w-4 h-4 mr-2" />
                                            </Button>
                                            <Button onClick={() => setEditTarget(eq)} variant="ghost">
                                                <Pencil className="w-4 h-4 mr-2" />
                                            </Button>
                                            <Button
                                                onClick={() => setDeleteTarget(eq)}
                                                variant="ghost"
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                            </Button>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 block md:hidden"
                                                >
                                                    <MoreHorizontal className="w-4 h-4" />
                                                    <span className="sr-only">Open menu</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setAssignTarget(eq)}>
                                                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                                                    Assign Facilities
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setEditTarget(eq)}>
                                                    <Pencil className="w-4 h-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => setDeleteTarget(eq)}
                                                    className="text-destructive focus:text-destructive"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </DefaultLayout>
    );
}