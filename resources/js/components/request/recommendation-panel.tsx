import { Link, router, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { Calendar, Clock, Sparkles, LayoutGrid, Filter, CheckSquare, Send, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAlternatives } from '@/hooks/use-alternatives';
import { usePermission } from '@/hooks/use-permission';
import { cn } from '@/lib/utils';
import type { Request, AlternativeSlot } from '@/types/request';
import StatusTag from '../status-tag';

interface RecommendationPanelProps {
    request: Request;
    isLoading: boolean;
    variant?: 'card' | 'page';
}

function formatDate(date?: string) {
    if (!date) {
        return '---';
    }

    const parsed = new Date(`${date}T00:00:00`);

    if (isNaN(parsed.getTime())) {
        return date;
    }

    return format(parsed, 'PPP');
}

function formatTime(time: string): string {
    if (!time) return '---';
    const normalized = time === '24:00' || time === '24:00:00' ? '23:59:00' : time;
    const parsed = new Date(`2000-01-01T${normalized}`);
    if (isNaN(parsed.getTime())) return '---';
    return parsed.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

function getTypeLabel(type: AlternativeSlot['type']): string {
    switch (type) {
        case 'same_facility_time':
            return 'Same Facility - Different Times';
        case 'same_facility_date':
            return 'Same Facility - Nearby Dates';
        case 'different_facility':
            return 'Other Facilities - Same Date/Time';
        case 'different_facility_date':
            return 'Other Facilities - Nearby Dates';
    }
}

function getCapacityBadge(fit: AlternativeSlot['capacity_fit']) {
    const styles = {
        exact: 'bg-[var(--ads-ok-bg)] text-[var(--ads-ok)]',
        larger: 'bg-[var(--ads-info-bg)] text-[var(--ads-info)]',
        smaller: 'bg-[var(--ads-warning-bg)] text-[var(--ads-warning)]',
    };
    return <span className={cn('rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold', styles[fit])}>{fit}</span>;
}

function getSlotKey(slot: AlternativeSlot): string {
    return `${slot.facility_id}-${slot.date}-${slot.time_start}`;
}

export function RecommendationPanel({ request, isLoading, variant = 'card' }: RecommendationPanelProps) {
    const auth = usePage().props.auth;
    const { hasRole } = usePermission();
    const isAdmin = hasRole('admin') || hasRole('Super Admin');

    const {
        alternatives,
        loading: altLoading,
        error: altError,
        refetch,
        includeEquipment,
        setIncludeEquipment,
    } = useAlternatives({
        requestId: request.id,
        includeEquipment: false,
        enabled: request.status === 'For Reschedule',
    });

    const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSlotToggle = (slot: AlternativeSlot) => {
        const key = getSlotKey(slot);
        setSelectedSlots((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const handleSubmitChosen = async () => {
        if (selectedSlots.size === 0) {
            toast.error('Please select at least one alternative');
            return;
        }

        if (!alternatives) return;

        setIsSubmitting(true);

        const chosenAlternatives: AlternativeSlot[] = [];
        Object.values(alternatives.alternatives)
            .flat()
            .forEach((slot) => {
                if (selectedSlots.has(getSlotKey(slot))) {
                    chosenAlternatives.push(slot);
                }
            });

        try {
            const response = await fetch(route('requests.reschedule-alternatives.store', [request.id]), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ alternatives: chosenAlternatives }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to send alternatives');
            }

            toast.success('Selected alternatives sent to requester');
            setSelectedSlots(new Set());
            refetch();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to send alternatives');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Overall verdict card */}
            <div className="ads-card flex flex-col gap-3 p-5">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--ads-ok)]" />
                    <span className="ads-eyebrow">Overall recommendation</span>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center gap-3 py-1">
                        <div className="h-8 w-52 animate-pulse rounded-[4px] bg-muted" />
                        <div className="h-3 w-full max-w-md animate-pulse rounded bg-muted" />
                        <div className="h-3 w-4/5 max-w-sm animate-pulse rounded bg-muted" />
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="flex flex-col items-center gap-2 py-1"
                    >
                        <StatusTag requestStatus={request.recommended_action ?? 'Pending'} variant="large" />
                        {request.recommended_action_reason && (
                            <p className="max-w-lg text-center text-sm leading-relaxed text-muted-foreground">{request.recommended_action_reason}</p>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Per-facility breakdown */}
            {request.request_facilities?.length > 0 && (
                <div className="flex flex-col gap-2">
                    <span className="ads-eyebrow">Per-facility breakdown</span>
                    <div className={cn('flex flex-col gap-2', variant === 'page' && 'md:grid md:grid-cols-2')}>
                        {request.request_facilities.map((rf) => {
                            const facility = request.facilities.find((f) => f.id === rf.facility_id);
                            const facilityName = facility?.name ?? `Facility #${rf.facility_id}`;
                            const rfStatus = rf.ai_recommended_status;
                            const rfReason = rf.ai_recommendation_reason;

                            return (
                                <div key={rf.id} className="ads-card flex flex-col gap-1.5 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <Link
                                                className="truncate text-lg font-semibold tracking-tight text-foreground hover:underline"
                                                href={route('facility.detail', [rf.facility_id])}
                                            >
                                                {facilityName}
                                            </Link>
                                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={11} className="shrink-0" />
                                                    <span className="text-foreground">{formatDate(rf.date_requested)}</span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock size={11} className="shrink-0" />
                                                    <span className="text-foreground">
                                                        {formatTime(rf.time_start)} – {formatTime(rf.time_end)}
                                                    </span>
                                                </span>
                                            </span>
                                        </div>
                                        {isLoading || !rfStatus ? (
                                            <div className="h-5 w-24 shrink-0 animate-pulse rounded-[4px] bg-muted" />
                                        ) : (
                                            <StatusTag requestStatus={rfStatus} variant="small" />
                                        )}
                                    </div>
                                    {isLoading ? (
                                        <div className="mt-1 h-3 w-3/4 animate-pulse rounded bg-muted" />
                                    ) : rfReason ? (
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rfReason}</p>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Alternatives for FOR_RESCHEDULE requests */}
            {request.status === 'For Reschedule' && request.request_facilities?.length > 0 && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <LayoutGrid className="h-4 w-4 text-[var(--ads-ok)]" />
                            <span className="ads-eyebrow">Suggested Alternatives</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                                <Filter className="h-3.5 w-3.5" />
                                <input
                                    type="checkbox"
                                    checked={includeEquipment}
                                    onChange={(e) => setIncludeEquipment(e.target.checked)}
                                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                                />
                                Check equipment availability
                            </label>
                        </div>
                    </div>

                    {isAdmin && selectedSlots.size > 0 && (
                        <div className="ads-card flex items-center justify-between gap-3 border-primary/20 bg-primary/5 p-3">
                            <span className="text-sm font-medium text-primary">{selectedSlots.size} alternative(s) selected</span>
                            <button
                                onClick={handleSubmitChosen}
                                disabled={isSubmitting}
                                className="flex items-center gap-2 rounded-[4px] bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        Send to Requester
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {altLoading && (
                        <div className="flex flex-col items-center gap-3 py-4">
                            <div className="h-8 w-52 animate-pulse rounded-[4px] bg-muted" />
                            <div className="h-3 w-full max-w-md animate-pulse rounded bg-muted" />
                        </div>
                    )}

                    {altError && (
                        <div className="ads-card p-4 text-sm text-destructive">
                            Failed to load alternatives: {altError}
                            <button onClick={refetch} className="ml-2 underline">
                                Retry
                            </button>
                        </div>
                    )}

                    {alternatives && !altLoading && (
                        <div className="flex flex-col gap-3">
                            {Object.entries(alternatives.alternatives).map(([facilityId, slots]) => {
                                if (!slots.length) return null;

                                const facility = request.facilities.find((f) => f.id === Number(facilityId));
                                const facilityName = facility?.name ?? `Facility #${facilityId}`;

                                // Group slots by type
                                const grouped = slots.reduce(
                                    (acc, slot) => {
                                        if (!acc[slot.type]) acc[slot.type] = [];
                                        acc[slot.type].push(slot);
                                        return acc;
                                    },
                                    {} as Record<AlternativeSlot['type'], AlternativeSlot[]>,
                                );

                                const typeOrder: AlternativeSlot['type'][] = [
                                    'same_facility_time',
                                    'same_facility_date',
                                    'different_facility',
                                    'different_facility_date',
                                ];

                                return (
                                    <div key={facilityId} className="ads-card flex flex-col gap-3 p-4">
                                        <h4 className="text-sm font-semibold text-foreground">{facilityName}</h4>
                                        <div className="flex flex-col gap-2">
                                            {typeOrder.map((type) => {
                                                const typeSlots = grouped[type];
                                                if (!typeSlots?.length) return null;

                                                return (
                                                    <div key={type} className="flex flex-col gap-2">
                                                        <span className="ads-eyebrow text-xs">{getTypeLabel(type)}</span>
                                                        <div className="flex flex-col gap-2">
                                                            {typeSlots.map((slot) => {
                                                                const slotKey = getSlotKey(slot);
                                                                const isSelected = selectedSlots.has(slotKey);
                                                                return (
                                                                    <button
                                                                        key={slotKey}
                                                                        type="button"
                                                                        onClick={() => handleSlotToggle(slot)}
                                                                        className={`group relative flex cursor-pointer flex-col border-2 p-3 text-left text-xs transition-all duration-150 ${
                                                                            isSelected
                                                                                ? 'border-primary bg-primary/10'
                                                                                : 'border-border hover:border-primary/50'
                                                                        }`}
                                                                    >
                                                                        <div className="mb-2 flex items-center justify-between gap-2">
                                                                            <div className="flex items-center gap-1.5">
                                                                                {isAdmin && (
                                                                                    <CheckSquare
                                                                                        className={cn(
                                                                                            'h-4 w-4 flex-shrink-0 transition-colors',
                                                                                            isSelected ? 'text-primary' : 'text-muted-foreground',
                                                                                        )}
                                                                                        strokeWidth={2.5}
                                                                                    />
                                                                                )}
                                                                                {slot.type === 'different_facility' ||
                                                                                slot.type === 'different_facility_date' ? (
                                                                                    <span className="flex items-center gap-1 truncate text-sm font-medium">
                                                                                        <LayoutGrid size={11} />
                                                                                        {slot.facility_name}
                                                                                    </span>
                                                                                ) : (
                                                                                    <>
                                                                                        <span className="text-sm font-medium">
                                                                                            {formatDate(slot.date)}
                                                                                        </span>
                                                                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                                            <Clock size={11} />
                                                                                            {formatTime(slot.time_start)} –{' '}
                                                                                            {formatTime(slot.time_end)}
                                                                                        </span>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                                                            {getCapacityBadge(slot.capacity_fit)}
                                                                            <span
                                                                                className={cn(
                                                                                    'rounded-[4px] px-1.5 py-0.5',
                                                                                    slot.equipment_available
                                                                                        ? 'bg-[var(--ads-ok-bg)] text-[var(--ads-ok)]'
                                                                                        : 'bg-[var(--ads-muted-bg)] text-[var(--ads-muted)]',
                                                                                )}
                                                                            >
                                                                                {slot.equipment_available ? 'Equipment ✓' : 'Equipment ✗'}
                                                                            </span>
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

                    {alternatives && !altLoading && Object.values(alternatives.alternatives).every((slots) => !slots.length) && (
                        <div className="ads-card p-4 text-center text-sm text-muted-foreground">
                            No available alternatives found for the selected criteria.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
