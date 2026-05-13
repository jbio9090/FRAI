import { AlertCircleIcon, ArrowUpDown, Building } from 'lucide-react';
import { useState } from 'react';
import MotionChevron from '@/components/animated_icons/MotionChevron';
import { BookingCard } from '@/components/booking-card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectTrigger, SelectItem, SelectGroup, SelectLabel, SelectValue } from '@/components/ui/select';
import type { FacilityBooking } from '@/pages/requests/create';
import type { Facility } from '@/types/facility';

/* ─────────────────────────────────────────────────────────────────────────
 | BookingCardList — sortable, filterable, collapsible list of booked slots
 ───────────────────────────────────────────────────────────────────────── */

type BookingSortKey = 'date-asc' | 'date-desc' | 'facility-asc' | 'facility-desc' | 'time-asc' | 'time-desc';

interface DraftBookingConflict {
    index: number;
    facility_name: string;
    date: string;
    time_start: string;
    time_end: string;
}

interface BookingCardListProps {
    bookings: FacilityBooking[];
    editingIndex: number | null;
    onEdit: (index: number) => void;
    onRemove: (index: number) => void;
    facilities: Facility[];
}

export function BookingCardList({ bookings, editingIndex, onEdit, onRemove, facilities }: BookingCardListProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [sortKey, setSortKey] = useState<BookingSortKey>('date-asc');
    const [filterFacility, setFilterFacility] = useState<string>('all');
    const [filterConflicts, setFilterConflicts] = useState<boolean>(false);

    const uniqueFacilities = Array.from(new Map(bookings.map((b) => [b.facility_id, b.facility_name])).entries());

    // Detect bookings in this draft list that overlap each other (same facility + date + time).
    // Must run before `processed` so the filter predicate can use it.
    const draftConflictsByIndex = new Map<number, DraftBookingConflict[]>();
    const addDraftConflict = (sourceIndex: number, conflictingIndex: number) => {
        const conflictingBooking = bookings[conflictingIndex];
        const existing = draftConflictsByIndex.get(sourceIndex) ?? [];
        existing.push({
            index: conflictingIndex,
            facility_name: conflictingBooking.facility_name,
            date: conflictingBooking.date,
            time_start: conflictingBooking.time_start,
            time_end: conflictingBooking.time_end,
        });
        draftConflictsByIndex.set(sourceIndex, existing);
    };

    for (let i = 0; i < bookings.length; i++) {
        for (let j = i + 1; j < bookings.length; j++) {
            const a = bookings[i];
            const b = bookings[j];
            if (
                a.facility_id === b.facility_id &&
                a.date === b.date &&
                a.time_start < b.time_end &&
                a.time_end > b.time_start
            ) {
                addDraftConflict(i, j);
                addDraftConflict(j, i);
            }
        }
    }

    // Build a sorted+filtered index map so we can pass the original index to onEdit/onRemove
    const processed = bookings
        .map((b, originalIndex) => ({ b, originalIndex }))
        .filter(({ b, originalIndex }) => {
            if (filterFacility !== 'all' && b.facility_id !== Number(filterFacility)) return false;
            if (filterConflicts && b.conflicts.length === 0 && !draftConflictsByIndex.has(originalIndex)) return false;
            return true;
        })
        .sort((x, y) => {
            const { b: a } = x;
            const { b: bv } = y;
            switch (sortKey) {
                case 'date-asc':
                    return a.date.localeCompare(bv.date);
                case 'date-desc':
                    return bv.date.localeCompare(a.date);
                case 'facility-asc':
                    return a.facility_name.localeCompare(bv.facility_name);
                case 'facility-desc':
                    return bv.facility_name.localeCompare(a.facility_name);
                case 'time-asc':
                    return a.time_start.localeCompare(bv.time_start);
                case 'time-desc':
                    return bv.time_start.localeCompare(a.time_start);
                default:
                    return 0;
            }
        });

    const hasConflicts = bookings.some((b) => b.conflicts.length > 0) || draftConflictsByIndex.size > 0;
    const draftConflictFacilities = Array.from(new Set(Array.from(draftConflictsByIndex.values()).flat().map((conflict) => conflict.facility_name)));

    return (
        <div className="mt-9">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                {/* Header row — accordion trigger only */}
                <div className="mb-2 flex items-center gap-2">
                    <CollapsibleTrigger asChild>
                        <button
                            type="button"
                            className="flex items-center gap-2 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            <h2 className="flex items-center gap-2 font-semibold tracking-tight">
                                Facility Bookings
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-background">
                                    {bookings.length}
                                </span>
                            </h2>
                            <MotionChevron openCollapsible={isOpen} className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </CollapsibleTrigger>
                </div>

                <CollapsibleContent className="space-y-2">
                    {/* Sort + Filter toolbar — inside the accordion, same style as borrow panel */}
                    <div className="space-y-2 rounded-md border-b bg-muted/20 p-2">
                        <div className="flex flex-col gap-2 md:flex-row">
                            {/* Sort */}
                            <Select value={sortKey} onValueChange={(v) => setSortKey(v as BookingSortKey)}>
                                <SelectTrigger className="h-8 flex-1 gap-1 text-sm">
                                    <ArrowUpDown size={16} className="shrink-0 text-muted-foreground" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="date-asc">Date: Earliest first</SelectItem>
                                    <SelectItem value="date-desc">Date: Latest first</SelectItem>
                                    <SelectItem value="facility-asc">Facility A–Z</SelectItem>
                                    <SelectItem value="facility-desc">Facility Z–A</SelectItem>
                                    <SelectItem value="time-asc">Start time: Earliest</SelectItem>
                                    <SelectItem value="time-desc">Start time: Latest</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Facility filter */}
                            <Select value={filterFacility} onValueChange={setFilterFacility}>
                                <SelectTrigger className="h-8 flex-1 gap-1 text-sm">
                                    <Building size={16} className="shrink-0 text-muted-foreground" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Facilities</SelectItem>
                                    {uniqueFacilities.map(([id, name]) => (
                                        <SelectItem key={id} value={String(id)}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Conflicts filter */}
                            <Button
                                type="button"
                                size="sm"
                                variant={filterConflicts ? 'destructive' : 'outline'}
                                className="h-8 gap-1.5 text-sm"
                                onClick={() => setFilterConflicts((v) => !v)}
                                disabled={!hasConflicts}
                            >
                                <AlertCircleIcon size={16} />
                                Conflicts only
                            </Button>
                        </div>
                    </div>
                    {draftConflictsByIndex.size > 0 && (
                        <p className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive">
                            <AlertCircleIcon size={12} className="shrink-0" />
                            Duplicate facility/time booking detected for {draftConflictFacilities.join(', ')}.
                        </p>
                    )}
                    {processed.length === 0 ? (
                        <p className="py-3 text-center text-xs text-muted-foreground">No bookings match the current filter.</p>
                    ) : (
                        processed.map(({ b: booking, originalIndex }) => (
                            <BookingCard
                                key={originalIndex}
                                booking={booking}
                                index={originalIndex}
                                onEdit={onEdit}
                                onRemove={editingIndex === originalIndex ? undefined : onRemove}
                                showActions={false}
                                isEditing={editingIndex === originalIndex}
                                draftConflicts={draftConflictsByIndex.get(originalIndex) ?? []}
                            />
                        ))
                    )}
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
