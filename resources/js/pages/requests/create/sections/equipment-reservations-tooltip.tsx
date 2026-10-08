import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { EquipmentReservation } from '../api';

interface EquipmentReservationsTooltipProps {
    reservations: EquipmentReservation[];
    /**
     * Context for the accessible name. Must be the date the count came from —
     * the tightest one — not simply the first selected date.
     */
    tightestDate: string | null;
    /** True when several dates are selected, which changes the wording. */
    isMultiDate: boolean;
}

/**
 * Desktop-only explanation of where the remaining-count went.
 *
 * Hover has no mobile equivalent, so the trigger is hidden below md and mobile
 * keeps relying on the visible "N of M available" line instead. Rendered as a
 * sibling of that line rather than replacing it.
 */
export function EquipmentReservationsTooltip({ reservations, tightestDate, isMultiDate }: EquipmentReservationsTooltipProps) {
    if (reservations.length === 0) return null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label={isMultiDate ? 'Show where this equipment is booked on the selected dates' : `Show where this equipment is booked for ${tightestDate ?? 'the selected date'}`}
                    className="hidden shrink-0 rounded-full p-0.5 align-middle text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none md:inline-flex"
                >
                    <Info size={12} />
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs p-0">
                <div className="px-3 py-2">
                    <p className="font-medium">{isMultiDate ? 'Booked on your selected dates' : 'Booked for this slot'}</p>
                    <ul className="mt-1.5 space-y-1.5">
                        {reservations.map((reservation, index) => (
                            <li key={`${reservation.request_id}-${reservation.date}-${reservation.time_start}-${index}`} className="text-xs opacity-90">
                                <span className="font-medium">
                                    ×{reservation.quantity} · {reservation.time_start}–{reservation.time_end}
                                    {/* Without the date a merged multi-date list is unattributable. */}
                                    {isMultiDate && <span className="opacity-75"> · {reservation.date}</span>}
                                </span>
                                <br />
                                {reservation.requester} — {reservation.request_title || 'Untitled request'}
                                <br />
                                {reservation.is_borrowed ? (
                                    <span className="opacity-75">
                                        borrowed from {reservation.source_facility_name ?? 'another facility'} → {reservation.facility_name}
                                    </span>
                                ) : (
                                    <span className="opacity-75">
                                        at {reservation.facility_name}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </TooltipContent>
        </Tooltip>
    );
}

/** Mirrors the tooltip's "nothing is booked" case for screen readers. */
export function EquipmentAvailabilityHint({ isEmpty, total }: { isEmpty: boolean; total: number }) {
    if (!isEmpty) return null;

    return <span className={cn('sr-only')}>All {total} units are already reserved for the selected time.</span>;
}