import { LayoutGrid, Calendar, Clock, AlertCircle } from 'lucide-react';
import moment from 'moment';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { Facility } from '@/pages/requests/create/types';
import type { ChosenAlternative } from '@/types/request';
import { useChosenAlternatives } from '@/hooks/use-chosen-alternatives';

interface ChosenAlternativesPanelProps {
    facilities: Facility[];
    isEditing: boolean;
    existingRequest: { status?: string; id?: number } | null;
    editingIndex: number | null;
    applyAlternative: (slot: ChosenAlternative) => void;
}

export function ChosenAlternativesPanel({
    facilities,
    isEditing,
    existingRequest,
    editingIndex,
    applyAlternative,
}: ChosenAlternativesPanelProps) {
    const [selectedAlternative, setSelectedAlternative] = useState<string | null>(null);

    const { chosenAlternatives, loading, error, refetch } = useChosenAlternatives({
        requestId: existingRequest?.id ?? 0,
        enabled: isEditing && existingRequest?.status === 'For Reschedule' && editingIndex !== null,
    });

    if (!isEditing || existingRequest?.status !== 'For Reschedule' || editingIndex === null) {
        return null;
    }

    return (
        <div className="mt-6 border-t border-border pt-6">
            <div className="flex items-center gap-2 mb-1">
                <LayoutGrid className="h-4 w-4 text-[var(--ads-ok)]" />
                <span className="text-sm font-semibold">Suggested Reschedule Options</span>
            </div>

            <p className="text-sm text-muted-foreground mb-3">
                These options were selected by an admin. Choose one to reschedule your request.
            </p>

            {loading && (
                <div className="flex flex-col items-center gap-3 py-4">
                    <Spinner />
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                </div>
            )}

            {error && (
                <div className="text-sm text-destructive mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Failed to load suggestions: {error}
                    <button onClick={refetch} className="ml-2 underline text-xs">Retry</button>
                </div>
            )}

            {!loading && !error && chosenAlternatives && Object.keys(chosenAlternatives.alternatives).length > 0 && (
                <div className="space-y-4 max-h-[50vh] overflow-y-auto mt-3">
                    {Object.entries(chosenAlternatives.alternatives).map(([facilityId, slots]) => {
                        if (!slots.length) return null;

                        const facility = facilities.find((f) => f.id === Number(facilityId));
                        const facilityName = facility?.name ?? `Facility #${facilityId}`;

                        return (
                            <div key={facilityId} className="space-y-2">
                                <h5 className="text-sm font-semibold text-foreground ">{facilityName}</h5>
                                <div className="flex flex-col gap-2">
                                    {slots.map((slot) => {
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
                                                        ? 'border-primary bg-primary/15 text-primary'
                                                        : 'border-border'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <span className="flex items-center gap-1 font-medium text-foreground truncate flex gap-1 text-sm">
                                                        <Calendar size={14} />
                                                        {moment(slot.date).format('MMM D')}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-foreground shrink-0 text-xs">
                                                        <Clock size={14} />
                                                        {moment(slot.time_start, 'HH:mm:ss').format('h:mm A')} – {moment(slot.time_end, 'HH:mm:ss').format('h:mm A')}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <Badge variant={slot.capacity_fit === 'exact' ? 'default' : slot.capacity_fit === 'larger' ? 'secondary' : 'outline'} className="text-[10px] px-2 py-0.5">
                                                        {slot.capacity_fit}
                                                    </Badge>
                                                    <Badge variant={slot.equipment_available ? 'default' : 'outline'} className="text-[10px] px-2 py-0.5">
                                                        {slot.equipment_available ? 'Equipment Available' : 'Equipment Unavailable'}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                                                        Suggested by {slot.chosen_by_admin.name}
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
            )}

            {!loading && !error && chosenAlternatives && Object.keys(chosenAlternatives.alternatives).length === 0 && (
                <div className="ads-card p-4 text-center text-sm text-muted-foreground">
                    <AlertCircle className="h-5 w-5 mx-auto mb-2 text-muted-foreground/50" />
                    <p>No reschedule options have been suggested by an admin yet.</p>
                    <p className="mt-1 text-xs">Please check back later or contact the admin.</p>
                </div>
            )}
        </div>
    );
}