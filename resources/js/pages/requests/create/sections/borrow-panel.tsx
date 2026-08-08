import { ArrowUpDown, Box, Minus, Plus, Search, X } from 'lucide-react';
import MotionChevron from '@/components/animated_icons/MotionChevron';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Facility } from '@/types/facility';
import type { BorrowableAvailabilityMap } from '../api';
import type { BorrowableEquipment, BorrowedEquipmentRequest, BorrowSort } from '../types';

export interface BorrowPanelProps {
    selectedFacility: number | null;
    isBorrowOpen: boolean;
    setIsBorrowOpen: (open: boolean) => void;
    allBorrowableEquipment: BorrowableEquipment[];
    allSourceFacilities: Facility[];
    filteredBorrowableEquipment: BorrowableEquipment[];
    borrowSearch: string;
    setBorrowSearch: (value: string) => void;
    borrowSort: BorrowSort;
    setBorrowSort: (value: BorrowSort) => void;
    borrowFacilityFilter: string;
    setBorrowFacilityFilter: (value: string) => void;
    borrowingEquipmentId: number | null;
    setBorrowingEquipmentId: (value: number | null) => void;
    selectedBorrowedEquipment: BorrowedEquipmentRequest[];
    setSelectedBorrowedEquipment: React.Dispatch<React.SetStateAction<BorrowedEquipmentRequest[]>>;
    borrowableAvailability: BorrowableAvailabilityMap;
}

export function BorrowPanel({
    selectedFacility,
    isBorrowOpen,
    setIsBorrowOpen,
    allBorrowableEquipment,
    allSourceFacilities,
    filteredBorrowableEquipment,
    borrowSearch,
    setBorrowSearch,
    borrowSort,
    setBorrowSort,
    borrowFacilityFilter,
    setBorrowFacilityFilter,
    borrowingEquipmentId,
    setBorrowingEquipmentId,
    selectedBorrowedEquipment,
    setSelectedBorrowedEquipment,
    borrowableAvailability,
}: BorrowPanelProps) {
    return (
        <>
            {selectedFacility && (
                <Collapsible open={isBorrowOpen} onOpenChange={setIsBorrowOpen}>
                    <CollapsibleTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                        >
                            {isBorrowOpen ? <Minus size={16} /> : <Plus size={16} />}
                            <span>Borrow from another facility</span>
                            {selectedBorrowedEquipment.length > 0 && (
                                <span className="ml-auto rounded-[4px] bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                                    {selectedBorrowedEquipment.length}
                                </span>
                            )}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                        {allBorrowableEquipment.length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">No equipment available to borrow.</p>
                        ) : (
                            <div className="overflow-hidden rounded-md border">
                                {/* ── Search + Sort + Filter toolbar ── */}
                                <div className="space-y-2 border-b bg-muted/20 p-2">
                                    {/* Search bar */}
                                    <div className="relative">
                                        <Search
                                            size={14}
                                            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                                        />
                                        <Input
                                            placeholder="Search equipment..."
                                            value={borrowSearch}
                                            onChange={(e) => setBorrowSearch(e.target.value)}
                                            className="h-8 pl-8 text-sm"
                                        />
                                        {borrowSearch && (
                                            <button
                                                type="button"
                                                onClick={() => setBorrowSearch('')}
                                                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                <X size={13} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Sort + Filter row */}
                                    <div className="flex flex-col gap-2 md:flex-row">
                                        {/* Sort */}
                                        <Select value={borrowSort} onValueChange={(v) => setBorrowSort(v as BorrowSort)}>
                                            <SelectTrigger className="h-8 flex-1 gap-1 text-sm">
                                                <ArrowUpDown size={16} className="shrink-0 text-muted-foreground" />
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="name-asc">Name A–Z</SelectItem>
                                                <SelectItem value="name-desc">Name Z–A</SelectItem>
                                                <SelectItem value="qty-desc">Most Available</SelectItem>
                                                <SelectItem value="qty-asc">Least Available</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {/* Filter by facility */}
                                        <Select value={borrowFacilityFilter} onValueChange={setBorrowFacilityFilter}>
                                            <SelectTrigger className="h-8 flex-1 gap-1 text-sm">
                                                <Box size={16} className="shrink-0 text-muted-foreground" />
                                                <SelectValue className="truncate" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Facilities</SelectItem>
                                                {allSourceFacilities.map((f) => (
                                                    <SelectItem key={f.id} value={f.id.toString()}>
                                                        {f.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* ── Equipment list in ScrollArea ── */}
                                <ScrollArea className="h-64">
                                    <div className="divide-y">
                                        {filteredBorrowableEquipment.length === 0 ? (
                                            <p className="py-6 text-center text-sm text-muted-foreground">No equipment matches your search.</p>
                                        ) : (
                                            filteredBorrowableEquipment.map((equipment) => {
                                                const isExpanded = borrowingEquipmentId === equipment.id;
                                                const borrowed = selectedBorrowedEquipment.filter((e) => e.equipment_id === equipment.id);
                                                const totalBorrowed = borrowed.reduce((s, e) => s + e.quantity_needed, 0);
                                                const totalAvailable = equipment.sources.reduce(
                                                    (s, src) => s + (borrowableAvailability[src.facilityId]?.[equipment.id] ?? src.quantity),
                                                    0,
                                                );
                                                const totalStock = equipment.sources.reduce((s, src) => s + src.quantity, 0);
                                                const isAnyLimited = totalAvailable < totalStock;

                                                return (
                                                    <div key={equipment.id}>
                                                        {/* Equipment header row */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setBorrowingEquipmentId(isExpanded ? null : equipment.id)}
                                                            className={cn(
                                                                'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors',
                                                                isExpanded ? 'bg-muted/40' : 'hover:bg-muted/20',
                                                            )}
                                                        >
                                                            <span className="font-medium">{equipment.name}</span>
                                                            <div className="flex items-center gap-2">
                                                                {totalBorrowed > 0 && (
                                                                    <span className="text-xs font-medium text-primary">{totalBorrowed} selected</span>
                                                                )}
                                                                <span
                                                                    className={cn(
                                                                        'text-xs tabular-nums',
                                                                        isAnyLimited
                                                                            ? 'font-medium text-[var(--ads-amber)]'
                                                                            : 'text-muted-foreground',
                                                                    )}
                                                                >
                                                                    {totalAvailable} avail.
                                                                </span>
                                                                <MotionChevron openCollapsible={isExpanded} />
                                                            </div>
                                                        </button>

                                                        {/* Sources — shown when expanded */}
                                                        {isExpanded && (
                                                            <div className="divide-y border-t bg-muted/10 px-3">
                                                                {equipment.sources
                                                                    .filter(
                                                                        (source) =>
                                                                            borrowFacilityFilter === 'all' ||
                                                                            source.facilityId === Number(borrowFacilityFilter),
                                                                    )
                                                                    .map((source) => {
                                                                        const item = borrowed.find((e) => e.source_facility_id === source.facilityId);
                                                                        const available =
                                                                            borrowableAvailability[source.facilityId]?.[equipment.id] ??
                                                                            source.quantity;
                                                                        const isLimited = available < source.quantity;

                                                                        return (
                                                                            <div key={source.facilityId} className="flex items-center gap-3 py-2.5">
                                                                                <Checkbox
                                                                                    id={`borrow-${equipment.id}-${source.facilityId}`}
                                                                                    checked={!!item}
                                                                                    onCheckedChange={() => {
                                                                                        if (item) {
                                                                                            setSelectedBorrowedEquipment((prev) =>
                                                                                                prev.filter(
                                                                                                    (e) =>
                                                                                                        !(
                                                                                                            e.equipment_id === equipment.id &&
                                                                                                            e.source_facility_id === source.facilityId
                                                                                                        ),
                                                                                                ),
                                                                                            );
                                                                                        } else {
                                                                                            setSelectedBorrowedEquipment((prev) => [
                                                                                                ...prev,
                                                                                                {
                                                                                                    equipment_id: equipment.id,
                                                                                                    equipment_name: equipment.name,
                                                                                                    source_facility_id: source.facilityId,
                                                                                                    source_facility_name: source.facilityName,
                                                                                                    quantity_needed: 1,
                                                                                                    max_quantity: available,
                                                                                                },
                                                                                            ]);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                                <div className="min-w-0 flex-1">
                                                                                    <Label
                                                                                        htmlFor={`borrow-${equipment.id}-${source.facilityId}`}
                                                                                        className="block cursor-pointer truncate text-sm font-medium"
                                                                                    >
                                                                                        {source.facilityName}
                                                                                    </Label>
                                                                                    <span
                                                                                        className={cn(
                                                                                            'text-xs',
                                                                                            isLimited
                                                                                                ? 'font-medium text-[var(--ads-amber)]'
                                                                                                : 'text-muted-foreground',
                                                                                        )}
                                                                                    >
                                                                                        {available} available
                                                                                        {isLimited && ` of ${source.quantity}`}
                                                                                    </span>
                                                                                </div>
                                                                                {item && (
                                                                                    <div className="flex shrink-0 items-center gap-1.5">
                                                                                        <Label className="text-xs text-muted-foreground">Qty</Label>
                                                                                        <Input
                                                                                            type="number"
                                                                                            min="1"
                                                                                            max={available}
                                                                                            value={item.quantity_needed}
                                                                                            onChange={(e) => {
                                                                                                const qty = Math.min(
                                                                                                    Number(e.target.value),
                                                                                                    available,
                                                                                                );
                                                                                                setSelectedBorrowedEquipment((prev) =>
                                                                                                    prev.map((i) =>
                                                                                                        i.equipment_id === equipment.id &&
                                                                                                        i.source_facility_id === source.facilityId
                                                                                                            ? { ...i, quantity_needed: qty }
                                                                                                            : i,
                                                                                                    ),
                                                                                                );
                                                                                            }}
                                                                                            className="h-7 w-16 px-2 text-sm"
                                                                                        />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        )}

                        {/* Summary when nothing is expanded */}
                        {!borrowingEquipmentId && selectedBorrowedEquipment.length > 0 && (
                            <div className="mt-3 space-y-2 rounded-md border bg-muted/10 px-3 py-2.5">
                                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Selected to borrow</p>
                                {Object.entries(
                                    selectedBorrowedEquipment.reduce(
                                        (groups, eq) => ({
                                            ...groups,
                                            [eq.equipment_name]: [...(groups[eq.equipment_name] ?? []), eq],
                                        }),
                                        {} as Record<string, BorrowedEquipmentRequest[]>,
                                    ),
                                ).map(([name, items]) => (
                                    <div key={name}>
                                        <p className="text-xs font-medium">
                                            {name}
                                            <span className="ml-1 font-normal text-muted-foreground">
                                                · {items.reduce((s, e) => s + e.quantity_needed, 0)} total
                                            </span>
                                        </p>
                                        {items.map((eq) => (
                                            <div
                                                key={`${eq.equipment_id}-${eq.source_facility_id}`}
                                                className="flex items-center justify-between py-0.5 pl-3 text-xs text-muted-foreground"
                                            >
                                                <span>
                                                    from {eq.source_facility_name} · {eq.quantity_needed}
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 text-destructive hover:text-destructive/70"
                                                    onClick={() =>
                                                        setSelectedBorrowedEquipment((prev) =>
                                                            prev.filter(
                                                                (e) =>
                                                                    !(
                                                                        e.equipment_id === eq.equipment_id &&
                                                                        e.source_facility_id === eq.source_facility_id
                                                                    ),
                                                            ),
                                                        )
                                                    }
                                                >
                                                    <X size={10} />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CollapsibleContent>
                </Collapsible>
            )}
        </>
    );
}
