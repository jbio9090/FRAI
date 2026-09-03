import { router, usePage } from '@inertiajs/react';
import { Archive, ArrowDownUp, ArrowUp, Check, ChevronDown, HousePlus, Map, MapPinned, Pencil } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState, type FormEvent, type MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import { cn } from '@/lib/utils';

interface Campus {
    id: number;
    name: string;
    deleted_at?: string | null;
}

interface Building {
    id: number;
    campus_id: number;
    name: string;
    campus?: Campus | null;
    deleted_at?: string | null;
}

interface Facility {
    id: number;
    name: string;
    building: string;
    capacity: number;
    campus_id: number | null;
    building_id: number | null;
    status: 'active' | 'unavailable';
    campus?: Campus | null;
    building_record?: Building | null;
    deleted_at?: string | null;
}

interface FacilityProps {
    facilities: Facility[];
    campuses: Campus[];
    buildings: Building[];
    activeCampuses: Campus[];
    activeBuildings: Building[];
    showArchived: boolean;
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

const emptyFacilityForm: FacilityForm = { name: '', campus_id: '', building_id: '', capacity: '' };
const emptyBuildingForm: BuildingForm = { name: '', campus_id: '' };
const emptyCampusForm: CampusForm = { name: '' };

type SortKey = 'name' | 'campus' | 'building' | 'capacity';
type SortDir = 'asc' | 'desc';
type SortValue = `${SortKey}-${'asc' | 'desc'}`;

const SORT_OPTIONS: { label: string; value: SortValue | '' }[] = [
    { label: 'None', value: '' },
    { label: 'Name (A-Z)', value: 'name-asc' },
    { label: 'Name (Z-A)', value: 'name-desc' },
    { label: 'Campus (A-Z)', value: 'campus-asc' },
    { label: 'Campus (Z-A)', value: 'campus-desc' },
    { label: 'Building (A-Z)', value: 'building-asc' },
    { label: 'Building (Z-A)', value: 'building-desc' },
    { label: 'Capacity (Low)', value: 'capacity-asc' },
    { label: 'Capacity (High)', value: 'capacity-desc' },
];

const isArchived = (item: { deleted_at?: string | null }) => Boolean(item.deleted_at);

const isFacilityFormValid = (form: FacilityForm) => {
    const capacity = Number(form.capacity);
    return form.name.trim() !== ''
        && form.campus_id !== ''
        && form.building_id !== ''
        && Number.isInteger(capacity)
        && capacity >= 1;
};

const getFacilitySortValue = (facility: Facility, sortKey: SortKey) => {
    if (sortKey === 'campus') return facility.campus?.name ?? '';
    return facility[sortKey];
};

function StatusText({ status }: { status: 'active' | 'unavailable' }) {
    const toneStyles = {
        ok: 'bg-[var(--ads-ok-bg)] text-[var(--ads-ok)]',
        neutral: 'bg-[var(--ads-neutral-bg)] text-[var(--ads-neutral)]',
    } as const;

    return (
        <span
            className={cn(
                'inline-flex w-fit items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
                toneStyles[status === 'active' ? 'ok' : 'neutral'],
            )}
        >
            <span className="size-1.5 shrink-0 rounded-full bg-current" />
            {status === 'active' ? 'Active' : 'Unavailable'}
        </span>
    );
}

interface FacilityFormFieldsProps {
    form: FacilityForm;
    campuses: Campus[];
    buildings: Building[];
    onChange: (f: FacilityForm) => void;
    errors: Partial<Record<keyof FacilityForm, string>>;
}

const FacilityFormFields = ({ form, campuses, buildings, onChange, errors }: FacilityFormFieldsProps) => {
    const filteredBuildings = buildings.filter((building) => String(building.campus_id) === form.campus_id);

    const updateCampus = (campusId: string) => {
        onChange({ ...form, campus_id: campusId, building_id: '' });
    };

    return (
        <>
            <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input
                    type="text"
                    placeholder="Enter facility name"
                    value={form.name}
                    className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                    onChange={(e) => onChange({ ...form, name: e.target.value })}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>Campus</Label>
                <Select value={form.campus_id} onValueChange={updateCampus}>
                    <SelectTrigger className={errors.campus_id ? 'w-full border-destructive focus-visible:ring-destructive' : 'w-full'}>
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
                    <SelectTrigger className={errors.building_id ? 'w-full border-destructive focus-visible:ring-destructive' : 'w-full'}>
                        <SelectValue placeholder={form.campus_id ? 'Select building' : 'Select campus first'} />
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
                    <p className="text-sm text-muted-foreground">No active buildings have been added for this campus.</p>
                )}
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>Capacity</Label>
                <Input
                    type="number"
                    placeholder="Enter capacity"
                    min={1}
                    value={form.capacity}
                    className={errors.capacity ? 'border-destructive focus-visible:ring-destructive' : ''}
                    onChange={(e) => onChange({ ...form, capacity: e.target.value })}
                />
                {errors.capacity && <p className="text-sm text-destructive">{errors.capacity}</p>}
            </div>
        </>
    );
};

interface BuildingFormFieldsProps {
    form: BuildingForm;
    campuses: Campus[];
    onChange: (form: BuildingForm) => void;
    errors: Partial<Record<keyof BuildingForm, string>>;
}

const BuildingFormFields = ({ form, campuses, onChange, errors }: BuildingFormFieldsProps) => (
    <>
        <div className="flex flex-col gap-1.5">
            <Label>Campus</Label>
            <Select value={form.campus_id} onValueChange={(campusId) => onChange({ ...form, campus_id: campusId })}>
                <SelectTrigger className={errors.campus_id ? 'w-full border-destructive focus-visible:ring-destructive' : 'w-full'}>
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
                value={form.name}
                className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>
    </>
);

export default function Facilities({ facilities, campuses, buildings, activeCampuses, activeBuildings, showArchived }: FacilityProps) {
    const { errors } = usePage<PageProps>().props;
    const { hasPermission } = usePermission();
    const isAdmin = hasPermission('manage facilities');
    const reduceMotion = useReducedMotion();

    const [sortValue, setSortValue] = useState<SortValue | ''>('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addForm, setAddForm] = useState<FacilityForm>(emptyFacilityForm);
    const [isAddBuildingOpen, setIsAddBuildingOpen] = useState(false);
    const [buildingForm, setBuildingForm] = useState<BuildingForm>(emptyBuildingForm);
    const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
    const [editBuildingForm, setEditBuildingForm] = useState<BuildingForm>(emptyBuildingForm);
    const [isAddCampusOpen, setIsAddCampusOpen] = useState(false);
    const [campusForm, setCampusForm] = useState<CampusForm>(emptyCampusForm);
    const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
    const [editCampusForm, setEditCampusForm] = useState<CampusForm>(emptyCampusForm);
    const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
    const [editForm, setEditForm] = useState<FacilityForm>(emptyFacilityForm);

    const [sortKey, sortDir] = sortValue
        ? (sortValue.split('-') as [SortKey, SortDir])
        : [null, null];

    const sortedFacilities = useMemo(() => {
        return [...facilities].sort((a, b) => {
            if (!sortKey) return 0;

            const aVal = getFacilitySortValue(a, sortKey);
            const bVal = getFacilitySortValue(b, sortKey);
            const cmp =
                typeof aVal === 'number' && typeof bVal === 'number'
                    ? aVal - bVal
                    : String(aVal).localeCompare(String(bVal));

            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [facilities, sortDir, sortKey]);

    const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortValue)?.label;
    const canAddFacility = isFacilityFormValid(addForm);
    const canEditFacility = isFacilityFormValid(editForm);
    const canAddBuilding = buildingForm.name.trim() !== '' && buildingForm.campus_id !== '';
    const canEditBuilding = editBuildingForm.name.trim() !== '' && editBuildingForm.campus_id !== '';
    const canAddCampus = campusForm.name.trim() !== '';
    const canEditCampus = editCampusForm.name.trim() !== '';

    const toggleArchived = (checked: boolean) => {
        router.get(route('facilities'), checked ? { show_archived: 1 } : {}, {
            preserveScroll: true,
            preserveState: false,
        });
    };

    const handleAdd = (e: FormEvent) => {
        e.preventDefault();
        if (!canAddFacility) return;

        router.post(route('facility.store'), {
            name: addForm.name,
            campus_id: Number(addForm.campus_id),
            building_id: Number(addForm.building_id),
            capacity: Number(addForm.capacity),
            status: 'active',
        }, {
            onSuccess: () => { setIsAddOpen(false); setAddForm(emptyFacilityForm); },
            onError: () => setIsAddOpen(true),
        });
    };

    const handleAddBuilding = (e: FormEvent) => {
        e.preventDefault();
        if (!canAddBuilding) return;

        router.post(route('buildings.store'), {
            name: buildingForm.name,
            campus_id: Number(buildingForm.campus_id),
        }, {
            preserveScroll: true,
            onSuccess: () => { setIsAddBuildingOpen(false); setBuildingForm(emptyBuildingForm); },
            onError: () => setIsAddBuildingOpen(true),
        });
    };

    const handleEditBuilding = (e: FormEvent) => {
        e.preventDefault();
        if (!editingBuilding || !canEditBuilding) return;

        router.put(route('buildings.update', editingBuilding.id), {
            name: editBuildingForm.name,
            campus_id: Number(editBuildingForm.campus_id),
        }, {
            preserveScroll: true,
            onSuccess: () => { setEditingBuilding(null); setEditBuildingForm(emptyBuildingForm); },
        });
    };

    const handleAddCampus = (e: FormEvent) => {
        e.preventDefault();
        if (!canAddCampus) return;

        router.post(route('campuses.store'), {
            name: campusForm.name,
        }, {
            preserveScroll: true,
            onSuccess: () => { setIsAddCampusOpen(false); setCampusForm(emptyCampusForm); },
            onError: () => setIsAddCampusOpen(true),
        });
    };

    const handleEditCampus = (e: FormEvent) => {
        e.preventDefault();
        if (!editingCampus || !canEditCampus) return;

        router.put(route('campuses.update', editingCampus.id), {
            name: editCampusForm.name,
        }, {
            preserveScroll: true,
            onSuccess: () => { setEditingCampus(null); setEditCampusForm(emptyCampusForm); },
        });
    };

    const handleEdit = (e: FormEvent) => {
        e.preventDefault();
        if (!editingFacility || !canEditFacility) return;

        router.put(route('facility.update', editingFacility.id), {
            name: editForm.name,
            campus_id: Number(editForm.campus_id),
            building_id: Number(editForm.building_id),
            capacity: Number(editForm.capacity),
            from: 'facilities_page',
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
            campus_id: facility.campus_id ? String(facility.campus_id) : '',
            building_id: facility.building_id ? String(facility.building_id) : '',
            capacity: String(facility.capacity),
        });
    };

    const openEditBuildingDialog = (building: Building) => {
        setEditingBuilding(building);
        setEditBuildingForm({
            name: building.name,
            campus_id: String(building.campus_id),
        });
    };

    const openEditCampusDialog = (campus: Campus) => {
        setEditingCampus(campus);
        setEditCampusForm({ name: campus.name });
    };

    const handleArchiveFacility = (e: MouseEvent, id: number) => {
        e.stopPropagation();
        router.delete(route('facility.destroy', id), { preserveScroll: true });
    };

    const handleToggleStatus = (facility: Facility, checked: boolean) => {
        router.put(route('facility.update', facility.id), {
            name: facility.name,
            campus_id: facility.campus_id,
            building_id: facility.building_id,
            capacity: facility.capacity,
            status: checked ? 'active' : 'unavailable',
            from: 'facilities_page',
        }, { preserveScroll: true });
    };

    const handleArchiveBuilding = (building: Building) => {
        router.delete(route('buildings.destroy', building.id), { preserveScroll: true });
    };

    const handleArchiveCampus = (campus: Campus) => {
        router.delete(route('campuses.destroy', campus.id), { preserveScroll: true });
    };

    const motionProps = {
        initial: reduceMotion ? false : { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.25, ease: 'easeOut' as const },
    };

    return (
        <DefaultLayout>
            <div className="flex flex-col gap-6">
                <motion.div {...motionProps}>
                    <div className="flex flex-col gap-1">
                        <p className="ads-eyebrow">Facility management</p>
                        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Facilities</h1>
                    </div>
                </motion.div>

                <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                        <>
                            <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
                                <HousePlus className="h-4 w-4" />
                                Add Facility
                            </Button>
                            <Button variant="outline" className="gap-2" onClick={() => setIsAddBuildingOpen(true)}>
                                <MapPinned className="h-4 w-4" />
                                Add Building
                            </Button>
                            <Button variant="outline" className="gap-2" onClick={() => setIsAddCampusOpen(true)}>
                                <Map className="h-4 w-4" />
                                Add Campus
                            </Button>
                        </>
                    )}

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline">
                                <ArrowDownUp className="h-4 w-4" />
                                <span>{currentSortLabel && currentSortLabel !== 'None' ? currentSortLabel : 'Sort By'}</span>
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-52 p-0">
                            <PopoverHeader>
                                <PopoverTitle className="px-3 py-1 pt-4 text-xs font-semibold text-muted-foreground">
                                    Sort By
                                </PopoverTitle>
                            </PopoverHeader>
                            <div className="flex flex-col p-1">
                                {SORT_OPTIONS.map((opt) => (
                                    <Button
                                        key={opt.value || 'none'}
                                        onClick={() => setSortValue(opt.value)}
                                        variant={sortValue === opt.value ? 'secondary' : 'ghost'}
                                        className="justify-between w-full px-2"
                                        size="sm"
                                    >
                                        <span>{opt.label}</span>
                                        {opt.value === '' ? (
                                            sortValue === opt.value ? <Check size={14} /> : <Check size={14} className="opacity-0" />
                                        ) : (
                                            sortValue === opt.value
                                                ? sortDir === 'asc'
                                                    ? <ArrowUp size={14} className="rotate-180" />
                                                    : <ArrowUp size={14} />
                                                : <ArrowUp size={14} className="opacity-0" />
                                        )}
                                    </Button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="ml-auto flex items-center gap-2">
                        <Label htmlFor="show-archived" className="text-sm text-muted-foreground">Show archived</Label>
                        <Switch id="show-archived" checked={showArchived} onCheckedChange={toggleArchived} />
                    </div>
                </div>

                <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setAddForm(emptyFacilityForm); }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><HousePlus className="h-4 w-4" />Add Facility</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAdd} className="flex flex-col gap-4">
                            <FacilityFormFields form={addForm} campuses={activeCampuses} buildings={activeBuildings} onChange={setAddForm} errors={errors} />
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
                            <DialogTitle className="flex items-center gap-2"><Map className="h-4 w-4" />Add Campus</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddCampus} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Label>Campus</Label>
                                <Input
                                    type="text"
                                    placeholder="Enter campus name"
                                    value={campusForm.name}
                                    className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
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
                            <DialogTitle className="flex items-center gap-2"><MapPinned className="h-4 w-4" />Add Building</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddBuilding} className="flex flex-col gap-4">
                            <BuildingFormFields form={buildingForm} campuses={activeCampuses} onChange={setBuildingForm} errors={errors} />
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
                            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" />Edit Facility</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleEdit} className="flex flex-col gap-4">
                            <FacilityFormFields form={editForm} campuses={activeCampuses} buildings={activeBuildings} onChange={setEditForm} errors={errors} />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setEditingFacility(null)}>Cancel</Button>
                                <Button type="submit" disabled={!canEditFacility}>Save Changes</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={!!editingBuilding} onOpenChange={(open) => { if (!open) { setEditingBuilding(null); setEditBuildingForm(emptyBuildingForm); } }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" />Edit Building</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleEditBuilding} className="flex flex-col gap-4">
                            <BuildingFormFields form={editBuildingForm} campuses={activeCampuses} onChange={setEditBuildingForm} errors={errors} />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setEditingBuilding(null)}>Cancel</Button>
                                <Button type="submit" disabled={!canEditBuilding}>Save Changes</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={!!editingCampus} onOpenChange={(open) => { if (!open) { setEditingCampus(null); setEditCampusForm(emptyCampusForm); } }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" />Edit Campus</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleEditCampus} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Label>Campus</Label>
                                <Input
                                    type="text"
                                    placeholder="Enter campus name"
                                    value={editCampusForm.name}
                                    className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                                    onChange={(e) => setEditCampusForm({ name: e.target.value })}
                                />
                                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setEditingCampus(null)}>Cancel</Button>
                                <Button type="submit" disabled={!canEditCampus}>Save Changes</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <motion.div
                    {...motionProps}
                    className="ads-card overflow-hidden [&_[data-slot='table-container']]:rounded-none [&_[data-slot='table-container']]:border-0"
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Campus</TableHead>
                                <TableHead>Building</TableHead>
                                <TableHead>Capacity</TableHead>
                                <TableHead>Status</TableHead>
                                {isAdmin && <TableHead />}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedFacilities.length ? (
                                sortedFacilities.map((facility) => {
                                    const archived = isArchived(facility);

                                    return (
                                        <TableRow
                                            key={facility.id}
                                            className="cursor-pointer"
                                            onClick={() => router.visit(route('facility.detail', [facility.id]))}
                                        >
                                            <TableCell>{facility.name}</TableCell>
                                            <TableCell>{facility.campus?.name ?? 'Main'}</TableCell>
                                            <TableCell>{facility.building_record?.name ?? facility.building}</TableCell>
                                            <TableCell>{facility.capacity}</TableCell>
                                            <TableCell><StatusText status={facility.status} /></TableCell>
                                            {isAdmin && (
                                                <TableCell className="text-right">
                                                    {!archived && (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Switch
                                                                checked={facility.status === 'active'}
                                                                onCheckedChange={(checked) => handleToggleStatus(facility, checked)}
                                                                aria-label={`Toggle status for ${facility.name}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            <Button variant="ghost" size="icon" aria-label={`Edit ${facility.name}`} onClick={(e) => openEditDialog(e, facility)}>
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" aria-label={`Archive ${facility.name}`} onClick={(e) => handleArchiveFacility(e, facility.id)}>
                                                                <Archive className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={isAdmin ? 6 : 5} className="h-32">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                                                <HousePlus className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <p className="text-sm text-muted-foreground">No facilities found.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </motion.div>

                <motion.div {...motionProps} className="grid gap-6 lg:grid-cols-2">
                    <section className="ads-card overflow-hidden [&_[data-slot='table-container']]:rounded-none [&_[data-slot='table-container']]:border-0">
                        <div className="border-b border-border px-5 py-4">
                            <span className="ads-eyebrow">Buildings</span>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Campus</TableHead>
                                    <TableHead>Status</TableHead>
                                    {isAdmin && <TableHead />}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {buildings.length ? (
                                    buildings.map((building) => {
                                        const archived = isArchived(building);

                                        return (
                                            <TableRow key={building.id}>
                                                <TableCell className="max-w-48 whitespace-normal break-words leading-snug">{building.name}</TableCell>
                                                <TableCell className="max-w-48 whitespace-normal break-words leading-snug">
                                                    {building.campus?.name ?? `Campus #${building.campus_id}`}
                                                </TableCell>
                                                <TableCell><StatusText archived={archived} /></TableCell>
                                                {isAdmin && (
                                                    <TableCell className="whitespace-nowrap text-right">
                                                        {!archived && (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button variant="ghost" size="icon" aria-label={`Edit ${building.name}`} onClick={() => openEditBuildingDialog(building)}>
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" aria-label={`Archive ${building.name}`} onClick={() => handleArchiveBuilding(building)}>
                                                                    <Archive className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={isAdmin ? 4 : 3} className="h-32">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                                                    <MapPinned className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <p className="text-sm text-muted-foreground">No buildings found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </section>

                    <section className="ads-card overflow-hidden [&_[data-slot='table-container']]:rounded-none [&_[data-slot='table-container']]:border-0">
                        <div className="border-b border-border px-5 py-4">
                            <span className="ads-eyebrow">Campuses</span>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Status</TableHead>
                                    {isAdmin && <TableHead />}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {campuses.length ? (
                                    campuses.map((campus) => {
                                        const archived = isArchived(campus);

                                        return (
                                            <TableRow key={campus.id}>
                                                <TableCell className="max-w-64 whitespace-normal break-words leading-snug">{campus.name}</TableCell>
                                                <TableCell><StatusText archived={archived} /></TableCell>
                                                {isAdmin && (
                                                    <TableCell className="whitespace-nowrap text-right">
                                                        {!archived && (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button variant="ghost" size="icon" aria-label={`Edit ${campus.name}`} onClick={() => openEditCampusDialog(campus)}>
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" aria-label={`Archive ${campus.name}`} onClick={() => handleArchiveCampus(campus)}>
                                                                    <Archive className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={isAdmin ? 3 : 2} className="h-32">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                                                    <Map className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <p className="text-sm text-muted-foreground">No campuses found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </section>
                </motion.div>
            </div>
        </DefaultLayout>
    );
}
