import { router } from "@inertiajs/react";
import {
    Plus,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    ArrowLeftRight,
    Package,
    AlertCircle,
    ArrowDownUp,
    ArrowUp,
    Check,
    ChevronDown,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import SmartPagination from "@/components/SmartPagination";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { usePermission } from "@/hooks/use-permission";
import DefaultLayout from "@/layout.tsx/default.";
import { cn } from "@/lib/utils";
import wordToColor from "@/lib/wordToColor";

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

interface PaginatedEquipments {
    data: Equipment[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface Filters {
    search: string;
    sort: string;
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
                onError: (e) => { setErrors(e as Record<string, string>); setProcessing(false); },
            });
        } else {
            router.post("/equipments", data, {
                onSuccess: () => { setProcessing(false); onClose(); },
                onError: (e) => { setErrors(e as Record<string, string>); setProcessing(false); },
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {isEdit ? "Edit Equipment" : "Add Equipment"}
                    </DialogTitle>
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

    const assignmentMap = useMemo(
        () => new Map(assignments.map((a) => [a.facility_id, a])),
        [assignments]
    );

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
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4" />
                        {equipment.name}
                    </DialogTitle>
                    <DialogDescription>Assign to Facilities</DialogDescription>
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
                    {facilities.map((f) => {
                        const a = assignmentMap.get(f.id);
                        const checked = !!a;
                        return (
                            <div
                                key={f.id}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                                    checked
                                        ? "border-primary/40 bg-primary/5"
                                        : "border-border bg-background"
                                )}
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
    equipments = { data: [], current_page: 1, last_page: 1, per_page: 20, total: 0, from: null, to: null },
    facilities = [],
    filters = { search: '', sort: '' },
}: {
    equipments?: PaginatedEquipments;
    facilities?: Facility[];
    filters?: Filters;
}) {
    const [search, setSearch] = useState(filters?.search ?? "");
    const [sortValue, setSortValue] = useState<SortValue | "">((filters?.sort as SortValue | "") ?? "");
    const [addOpen, setAddOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Equipment | null>(null);
    const [assignTarget, setAssignTarget] = useState<Equipment | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);
    const [deleting, setDeleting] = useState(false);
    const { hasRole } = usePermission();
    const reduceMotion = useReducedMotion();

    const motionProps = {
        initial: reduceMotion ? false : { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.25, ease: "easeOut" as const },
    };

    const latestParams = useRef({ search, sortValue });
    useEffect(() => {
        latestParams.current = { search, sortValue };
    }, [search, sortValue]);

    const applyFilters = useCallback(
        (params: { search?: string; sort?: string; page?: number }) => {
            router.get(
                "/equipments",
                {
                    search: params.search ?? latestParams.current.search,
                    sort: params.sort !== undefined ? params.sort : latestParams.current.sortValue,
                    page: params.page ?? 1,
                },
                { preserveState: true, replace: true }
            );
        },
        []
    );

    useEffect(() => {
        const timeout = setTimeout(() => {
            applyFilters({ search, page: 1 });
        }, 350);
        return () => clearTimeout(timeout);
    }, [search, applyFilters]);

    const handleSortChange = (value: SortValue | "") => {
        setSortValue(value);
        applyFilters({ sort: value, page: 1 });
    };

    const handlePageChange = (page: number) => {
        applyFilters({ page });
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        setDeleting(true);
        router.delete(`/equipments/${deleteTarget.id}`, {
            onSuccess: () => { setDeleting(false); setDeleteTarget(null); },
            onError: () => setDeleting(false),
        });
    };

    const enrichedEquipments = useMemo(
        () =>
            (equipments?.data ?? []).map((eq) => {
                const assigned = (eq.facilities ?? []).reduce((s, f) => s + (f.pivot?.quantity ?? 0), 0);
                const over = assigned > eq.quantity;
                const empty = assigned === 0;
                return { ...eq, assigned, over, empty };
            }),
        [equipments?.data]
    );

    const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortValue)?.label;

    const paginationLabel = useMemo(
        () =>
            `Showing ${equipments?.from ?? 0}–${equipments?.to ?? 0} of ${equipments?.total ?? 0} equipment`,
        [equipments?.from, equipments?.to, equipments?.total]
    );

    return (
        <DefaultLayout>
            {(hasRole("admin") || hasRole("Super Admin")) && (
                <>
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
                </>
            )}

            <div className="flex flex-col gap-6">
                <motion.div {...motionProps}>
                    <div className="flex flex-col gap-1">
                        <p className="ads-eyebrow">Equipment inventory</p>
                        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                            Equipments
                        </h1>
                    </div>
                </motion.div>

                <motion.div {...motionProps} className="flex flex-wrap items-center gap-2">
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
                                <span>{currentSortLabel && currentSortLabel !== "None" ? currentSortLabel : "Sort By"}</span>
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-0">
                            <PopoverHeader>
                                <PopoverTitle className="px-3 py-1 pt-4 text-xs font-semibold text-muted-foreground">
                                    Sort By
                                </PopoverTitle>
                            </PopoverHeader>
                            <div className="flex flex-col p-1">
                                {SORT_OPTIONS.map((opt) => (
                                    <Button
                                        key={opt.value || "none"}
                                        onClick={() => handleSortChange(opt.value)}
                                        variant={sortValue === opt.value ? "secondary" : "ghost"}
                                        className="justify-between w-full px-2"
                                        size="sm"
                                    >
                                        <span>{opt.label}</span>
                                        {opt.value === "" ? (
                                            sortValue === opt.value
                                                ? <Check size={14} />
                                                : <Check size={14} className="opacity-0" />
                                        ) : (
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

                    {(hasRole("admin") || hasRole("Super Admin")) && (
                        <Button onClick={() => setAddOpen(true)} className="gap-2">
                            <Plus size={16} />
                            Add Equipment
                        </Button>
                    )}
                </motion.div>

                <motion.div
                    {...motionProps}
                    className="ads-card overflow-hidden [&_[data-slot='table-container']]:rounded-none [&_[data-slot='table-container']]:border-0"
                >
                    <Table>
                        <TableHeader>
                            <TableRow className="text-sm">
                                <TableHead>Name</TableHead>
                                <TableHead className="w-36">Total Qty</TableHead>
                                <TableHead className="w-36">Assigned</TableHead>
                                <TableHead>Assigned To Facility</TableHead>
                                <TableHead className="w-28" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {enrichedEquipments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                                                <Package className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <p className="text-sm text-muted-foreground">No equipment found.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                enrichedEquipments.map((eq) => {
                                    const { assigned, over, empty } = eq;

                                    const ratioTone = over
                                        ? "border-[var(--ads-danger)]/30 bg-[var(--ads-danger-bg)] text-[var(--ads-danger)]"
                                        : empty
                                            ? "border-border bg-[var(--ads-neutral-bg)] text-[var(--ads-neutral)]"
                                            : "border-[var(--ads-ok)]/30 bg-[var(--ads-ok-bg)] text-[var(--ads-ok)]";

                                    return (
                                        <TableRow key={eq.id}>
                                            <TableCell className="text-sm font-medium">{eq.name}</TableCell>
                                            <TableCell>
                                                <span className="text-sm font-semibold tabular-nums">{eq.quantity}</span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 rounded-[4px] border px-2.5 py-0.5 text-sm whitespace-nowrap",
                                                    ratioTone
                                                )}>
                                                    <span className="font-semibold tabular-nums">{assigned}</span>
                                                    <span className="opacity-60">/</span>
                                                    <span className="tabular-nums">{eq.quantity}</span>
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {eq.facilities.length === 0 ? (
                                                        <span className="text-xs text-muted-foreground">
                                                            Unassigned
                                                        </span>
                                                    ) : (
                                                        eq.facilities.map((f) => {
                                                            const style = wordToColor(f.name);
                                                            return (
                                                                <Badge
                                                                    key={f.id}
                                                                    variant="secondary"
                                                                    className="tag items-center gap-1 rounded-[4px] border border-border px-2 py-0.5 text-xs font-semibold"
                                                                    style={style}
                                                                >
                                                                    {(f.pivot?.quantity && f.pivot.quantity > 1)
                                                                        ? <span>{`${f.pivot.quantity} in`}</span>
                                                                        : null}
                                                                    <span className="size-1.5 rounded-full bg-current" />
                                                                    <span>{f.name}</span>
                                                                </Badge>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-right">
                                                <div className="hidden items-center justify-end gap-1 md:flex">
                                                    <Button
                                                        onClick={() => setAssignTarget(eq)}
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Assign ${eq.name}`}
                                                    >
                                                        <ArrowLeftRight className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        onClick={() => setEditTarget(eq)}
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Edit ${eq.name}`}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        onClick={() => setDeleteTarget(eq)}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive focus:text-destructive"
                                                        aria-label={`Delete ${eq.name}`}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 md:hidden"
                                                            aria-label="Open menu"
                                                        >
                                                            <MoreHorizontal className="w-4 h-4" />
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
                </motion.div>

                <p className="text-sm w-full mb-4 mt-2 text-right text-muted-foreground shrink-0">{paginationLabel}</p>

                {equipments.last_page > 1 && (
                    <div className="flex items-center justify-between mt-4 gap-4">
                        <SmartPagination
                            currentPage={equipments.current_page}
                            lastPage={equipments.last_page}
                            onPageChange={handlePageChange}
                        />
                    </div>
                )}
            </div>
        </DefaultLayout>
    );
}
