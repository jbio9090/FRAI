import { LayoutGrid, Filter, Clock, Calendar } from 'lucide-react';
import moment from 'moment';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { Facility } from '@/pages/requests/create/types';
import type { AlternativeSlot } from '../use-create-request';
import { Button } from '@/components/ui/button';

type ToggleKey = 'same_facility' | 'same_time';

const toggleOptions: { key: ToggleKey; label: string; types: readonly string[] }[] = [
    { key: 'same_facility', label: 'Same Facility', types: ['same_facility_time', 'same_facility_date'] },
    { key: 'same_time', label: 'Same Time', types: ['different_facility', 'different_facility_date'] },
];

interface AlternativesPanelProps {
    alternatives: Record<number, AlternativeSlot[]>;
    alternativesLoading: boolean;
    alternativesError: string | null;
    includeEquipmentFilter: boolean;
    setIncludeEquipmentFilter: (v: boolean) => void;
    applyAlternative: (slot: AlternativeSlot) => void;
    facilities: Facility[];
    isEditing: boolean;
    existingRequest: { status?: string } | null;
    editingIndex: number | null;
}

export function AlternativesPanel({
    alternatives,
    alternativesLoading,
    alternativesError,
    includeEquipmentFilter,
    setIncludeEquipmentFilter,
    applyAlternative,
    facilities,
    isEditing,
    existingRequest,
    editingIndex,
}: AlternativesPanelProps) {
    const [selectedAlternative, setSelectedAlternative] = useState<string | null>(null);
    const [activeToggle, setActiveToggle] = useState<ToggleKey>('same_facility');

    if (!isEditing || existingRequest?.status !== 'For Reschedule' || editingIndex === null) {
        return null;
    }

    return (
        <div className="mt-6 border-t border-border pt-6">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-[var(--ads-ok)]" />
                    <span className="text-sm font-semibold">Suggested Alternatives</span>
                </div>
            </div>

            <div className="flex items-center gap-1 mb-3 rounded-md p-1 w-fit">
                {toggleOptions.map((option) => (
                    <Button
                        key={option.key}
                        type="button"
                        onClick={() => setActiveToggle(option.key)}
                        size="sm"
                        variant="outline"
                        className={cn(
                            "text-xs p-2", 
                            activeToggle === option.key ? 'bg-background border-primary text-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {option.label}
                    </Button>
                ))}
            </div>

            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer mb-3">
                <Filter className="h-3.5 w-3.5" />
                <input
                    type="checkbox"
                    checked={includeEquipmentFilter}
                    onChange={(e) => setIncludeEquipmentFilter(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                Check equipment availability
            </label>

            {alternativesLoading && (
                <div className="flex flex-col items-center gap-3 py-4">
                    <Spinner />
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                </div>
            )}

            {alternativesError && (
                <div className="text-sm text-destructive mb-3">
                    Failed to load alternatives: {alternativesError}
                </div>
            )}

            {!alternativesLoading && !alternativesError && Object.keys(alternatives).length > 0 && (
                <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                    {Object.entries(alternatives).map(([facilityId, slots]) => {
                        if (!slots.length) return null;

                        const facility = facilities.find((f) => f.id === Number(facilityId));
                        const facilityName = facility?.name ?? `Facility #${facilityId}`;

                        const grouped = slots.reduce((acc: Record<string, typeof slots>, slot) => {
                            if (!acc[slot.type]) acc[slot.type] = [];
                            acc[slot.type].push(slot);
                            return acc;
                        }, {});

                        const activeOption = toggleOptions.find((o) => o.key === activeToggle)!;
                        const typeOrder = activeOption.types;

                        function getTypeLabel(type: string) {
                            switch (type) {
                                case 'same_facility_time': return 'Same Facility - Different Times';
                                case 'same_facility_date': return 'Same Facility - Nearby Dates';
                                case 'different_facility': return 'Other Facilities - Same Date/Time';
                                case 'different_facility_date': return 'Other Facilities - Nearby Dates';
                                default: return type;
                            }
                        }

                        return (
                            <div key={facilityId} className="space-y-3">
                                <h5 className="text-xs font-medium text-foreground uppercase tracking-wide text-muted-foreground">{facilityName}</h5>
                                <div className="space-y-3">
                                    {typeOrder.map((type) => {
                                        const typeSlots = grouped[type];
                                        if (!typeSlots?.length) return null;

                                        return (
                                            <div key={type} className="space-y-2">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{getTypeLabel(type)}</span>
                                                <div className="grid gap-1.5 sm:grid-cols-2">
                                                    {typeSlots.map((slot) => {
                                                        const slotKey = `${slot.facility_id}-${slot.date}-${slot.time_start}`;
                                                        const isSelected = selectedAlternative === slotKey;
                                                        return (
                                                            <button
                                                                key={slotKey}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedAlternative(slotKey);
                                                                    applyAlternative(slot);
                                                                }}
                                                                className={`group relative flex flex-col p-3 text-left transition-all duration-150 text-xs cursor-pointer border border-border hover:bg-primary/15 ${
                                                                    isSelected
                                                                        ? 'border border-primary bg-primary/15 border-primary text-primary'
                                                                        : 'border-border'
                                                                }`}
                                                            >
                                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                                    {slot.type === 'different_facility' || slot.type === 'different_facility_date' ? (
                                                                        <span className="font-medium text-foreground truncate flex gap-1 text-sm">
                                                                            <LayoutGrid size={14}/>
                                                                            {slot.facility_name}</span>
                                                                    ) : (
                                                                        <>
                                                                            <span className="font-medium text-foreground truncate flex gap-1 text-sm">
                                                                                <Calendar size={14}/>
                                                                                {moment(slot.date).format('MMM D')}</span>
                                                                            <span className="flex items-center gap-1 text-foreground shrink-0 text-xs">
                                                                                <Clock size={14} />
                                                                                {moment(slot.time_start, 'HH:mm:ss').format('h:mm A')} – {moment(slot.time_end, 'HH:mm:ss').format('h:mm A')}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-1.5">
                                                                    <Badge variant={slot.capacity_fit === 'exact' ? 'default' : slot.capacity_fit === 'larger' ? 'secondary' : 'outline'} className="text-[10px] px-2 py-0.5">
                                                                        {slot.capacity_fit}
                                                                    </Badge>
                                                                    <Badge variant={slot.equipment_available ? 'default' : 'outline'} className="text-[10px] px-2 py-0.5">
                                                                        {slot.equipment_available ? 'Equipment Available' : 'Equipment Unavailable'}
                                                                    </Badge>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!alternativesLoading && !alternativesError && Object.keys(alternatives).length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-4">
                    No available alternatives found.
                </div>
            )}
        </div>
    );
}