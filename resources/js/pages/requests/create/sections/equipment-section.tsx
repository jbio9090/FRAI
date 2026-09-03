import { AlertCircleIcon, Info, SquareMousePointer, User, X } from 'lucide-react';
import { FacilityInfo } from '@/components/create-page/facility-info';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { EquipmentConflict, FacilityEquipment } from '@/types/equipment';
import type { Facility } from '@/types/facility';
import type { EquipmentAvailabilityMap } from '../api';
import type { EquipmentRequest } from '../types';
import { BorrowPanel } from './borrow-panel';
import type { BorrowPanelProps } from './borrow-panel';
import { ExternalEquipmentCollapsible } from './external-equipment';
import type { ExternalEquipmentProps } from './external-equipment';

interface EquipmentSectionProps {
    facilities: Facility[];
    selectedFacility: number | null;
    handleFacilityChange: (value: string) => void;
    availableEquipment: FacilityEquipment[];
    selectedEquipment: EquipmentRequest[];
    equipmentConflicts: Record<number, EquipmentConflict[]>;
    equipmentAvailability: EquipmentAvailabilityMap;
    selectAllEquipment: (e: React.MouseEvent<HTMLButtonElement>) => void;
    clearEquipmentSelection: (e: React.MouseEvent<HTMLButtonElement>) => void;
    handleEquipmentToggle: (equipment: FacilityEquipment) => void;
    updateEquipmentQuantity: (equipmentId: number, quantity: number) => void;
    externalEquipmentProps: ExternalEquipmentProps;
    borrowPanelProps: BorrowPanelProps;
}

export function EquipmentSection({
    facilities,
    selectedFacility,
    handleFacilityChange,
    availableEquipment,
    selectedEquipment,
    equipmentConflicts,
    equipmentAvailability,
    selectAllEquipment,
    clearEquipmentSelection,
    handleEquipmentToggle,
    updateEquipmentQuantity,
    externalEquipmentProps,
    borrowPanelProps,
}: EquipmentSectionProps) {
    return (
        <section className="ads-card p-5 md:p-6">
            <div className="mb-5 border-b border-border pb-3">
                <span className="ads-eyebrow">Facility & equipment</span>
            </div>
            <div className="space-y-5">
                {/* Facility picker */}
                <div className="space-y-2">
                    <div className="flex justify-start gap-1">
                        <Label>
                            Facility <span className="text-destructive">*</span>
                        </Label>
                        <div className="block lg:hidden">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                                        <Info size={14} />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>Facility Info</DialogTitle>
                                    </DialogHeader>
                                    <FacilityInfo facilities={facilities} isForSidebar={false} />
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                    <Select value={selectedFacility?.toString() || ''} onValueChange={handleFacilityChange}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose a Facility" />
                        </SelectTrigger>
                        <SelectContent>
                            {facilities.map((facility) => {
                                const isUnavailable = facility.status === 'unavailable';
                                return (
                                    <SelectItem key={facility.id} value={facility.id.toString()} disabled={isUnavailable} className={isUnavailable ? 'pointer-events-none opacity-50 text-muted-foreground' : ''}>
                                        <b>{facility.name}</b>
                                        {isUnavailable && (
                                            <span className="ml-1.5 text-xs text-muted-foreground">(Unavailable)</span>
                                        )}
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                            <User className="h-3 w-3" />
                                            <span className="text-xs">{facility.capacity}</span>
                                        </div>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>

                {/* Equipment selection */}
                {selectedFacility && availableEquipment.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center">
                            <Label className="mr-auto">Equipment</Label>
                            {selectedEquipment.length < availableEquipment.length && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={selectAllEquipment}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <span className="text-sm">Select All</span>
                                    <SquareMousePointer />
                                </Button>
                            )}
                            {selectedEquipment.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearEquipmentSelection}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <span className="text-sm">Clear All</span>
                                    <X />
                                </Button>
                            )}
                        </div>

                        <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border p-3">
                            {availableEquipment.map((equipment) => {
                                const selected = selectedEquipment.find((e) => e.equipment_id === equipment.id);
                                const conflicts = equipmentConflicts[equipment.id] ?? [];
                                const availability = equipmentAvailability[equipment.id];
                                const displayQty = availability ? availability.available_quantity : equipment.pivot.quantity;
                                const isLimited = availability ? availability.is_limited : false;
                                const exceedsAvailable = selected && availability && selected.quantity_needed > availability.available_quantity;

                                return (
                                    <div key={equipment.id} className="space-y-1">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex flex-1 items-center space-x-3">
                                                <Checkbox
                                                    id={`equipment-${equipment.id}`}
                                                    checked={!!selected}
                                                    onCheckedChange={() => handleEquipmentToggle(equipment)}
                                                />
                                                <div className="flex-1">
                                                    <Label htmlFor={`equipment-${equipment.id}`} className="cursor-pointer text-sm font-medium">
                                                        {equipment.name}
                                                    </Label>
                                                    <Label
                                                        className={cn(
                                                            'block text-xs',
                                                            isLimited ? 'font-medium text-[var(--ads-amber)]' : 'text-muted-foreground',
                                                        )}
                                                    >
                                                        Available: {displayQty}
                                                        {isLimited && ` (${availability?.total_quantity} total)`}
                                                    </Label>
                                                </div>
                                            </div>
                                            {selected && (
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-sm">Qty:</Label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        max={displayQty}
                                                        value={selected.quantity_needed}
                                                        onChange={(e) =>
                                                            updateEquipmentQuantity(equipment.id, Math.min(Number(e.target.value), displayQty))
                                                        }
                                                        className={cn(
                                                            'w-20 p-2 text-sm',
                                                            exceedsAvailable && 'border-[var(--ads-amber)]/60 bg-[var(--ads-amber-bg)]/40',
                                                        )}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {exceedsAvailable && (
                                            <div className="ml-7 flex items-start gap-1.5 rounded border border-[var(--ads-amber)]/40 bg-[var(--ads-amber-bg)]/50 px-2 py-1 text-xs text-[var(--ads-amber)]">
                                                <AlertCircleIcon size={12} className="mt-0.5 shrink-0" />
                                                <span>
                                                    Only <strong>{availability?.available_quantity}</strong> available for the selected time
                                                </span>
                                            </div>
                                        )}

                                        {selected && conflicts.length > 0 && (
                                            <div className="ml-7 space-y-1">
                                                {conflicts.map((c, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex items-start gap-1.5 rounded border border-[var(--ads-amber)]/40 bg-[var(--ads-amber-bg)]/50 px-2 py-1 text-xs text-[var(--ads-amber)]"
                                                    >
                                                        <AlertCircleIcon size={12} className="mt-0.5 shrink-0" />
                                                        <span>
                                                            Also requested by <strong>{c.requester}</strong> ("{c.request_title}") —{' '}
                                                            <span className={c.status === 'Approved' ? 'font-semibold text-[var(--ads-danger)]' : ''}>
                                                                {c.status}
                                                            </span>
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Optional extras — external equipment + borrow */}
                <div className="space-y-2">
                    <ExternalEquipmentCollapsible {...externalEquipmentProps} />
                    <BorrowPanel {...borrowPanelProps} />
                </div>
            </div>
        </section>
    );
}
