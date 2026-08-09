import { router, Link } from '@inertiajs/react';
import { format } from 'date-fns';
import { CalendarIcon, X, Clock, Users, AlertCircleIcon, Pen, MapPin, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { usePermission } from '@/hooks/use-permission';
import type { EquipmentConflict } from '@/types/equipment';
import StatusTag from './status-tag';

interface BorrowedEquipmentRequest {
    equipment_id: number;
    equipment_name: string;
    source_facility_id: number;
    source_facility_name: string;
    quantity_needed: number;
    max_quantity: number;
}

interface EquipmentRequest {
    equipment_id: number;
    equipment_name: string;
    quantity_needed: number;
    max_quantity: number;
    conflicts?: EquipmentConflict[];
}

interface BookingSchedule {
    request_id?: number;
    request_title: string;
    status: string;
    time_start: string;
    time_end: string;
    date?: string;
}

interface FacilityBooking {
    request_id?: number;
    facility_id: number;
    request_facility_id?: number;
    facility_name: string;
    date: string;
    time_start: string;
    time_end: string;
    equipment: EquipmentRequest[];
    borrowed_equipment: BorrowedEquipmentRequest[];
    conflicts: BookingSchedule[];
    external_equipment: { name: string }[];
    expected_capacity: number | null;
    facility_capacity?: number | null;
    has_outsiders: boolean;
    equipment_conflicts: Record<number, EquipmentConflict[]>;
    request_facility_status?: string;
}

interface DraftBookingConflict {
    index: number;
    facility_name: string;
    date: string;
    time_start: string;
    time_end: string;
}

interface BookingCardProps {
    booking: FacilityBooking;
    index: number;
    onEdit?: (index: number) => void;
    onRemove?: (index: number) => void;
    onRefresh?: () => void;
    className?: string;
    showActions?: boolean;
    /** When true the card is the one currently being edited in the form above */
    isEditing?: boolean;
    draftConflicts?: DraftBookingConflict[];
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

function groupBorrowed(borrowed: BorrowedEquipmentRequest[]): Record<string, BorrowedEquipmentRequest[]> {
    return borrowed.reduce(
        (groups, eq) => ({
            ...groups,
            [eq.equipment_name]: [...(groups[eq.equipment_name] ?? []), eq],
        }),
        {} as Record<string, BorrowedEquipmentRequest[]>,
    );
}

export function BookingCard({
    booking,
    index,
    onEdit,
    onRemove,
    onRefresh,
    className,
    showActions = true,
    isEditing = false,
    draftConflicts = [],
}: BookingCardProps) {
    const { hasPermission } = usePermission();

    const hasOwnEquipment = booking.equipment.length > 0;
    const hasBorrowedEquipment = (booking.borrowed_equipment ?? []).length > 0;
    const hasExternalEquipment = (booking.external_equipment ?? []).length > 0;
    const hasAnyEquipment = hasOwnEquipment || hasBorrowedEquipment || hasExternalEquipment;
    const hasConflicts = booking.conflicts.length > 0 || Object.keys(booking.equipment_conflicts ?? {}).length > 0 || draftConflicts.length > 0;

    const expectedNum = booking.expected_capacity != null ? Number(String(booking.expected_capacity).trim()) : null;
    const capacityNum = booking.facility_capacity != null ? Number(String(booking.facility_capacity).trim()) : null;
    const isCapacityExceeded =
        expectedNum != null && capacityNum != null && !Number.isNaN(expectedNum) && !Number.isNaN(capacityNum) && expectedNum > capacityNum;

    const borrowedGroups = groupBorrowed(booking.borrowed_equipment ?? []);

    const canMakeDecision = hasPermission('approve requests') && showActions;

    const handleAction = (action: string) => {
        const facilityParam = booking.request_facility_id ?? booking.facility_id;
        const inertiaOptions = {
            onSuccess: () => {
                try {
                    if (typeof onRefresh === 'function') onRefresh();
                } catch (e) {
                    console.error(e);
                }
                router.reload();
            },
        };

        router.post(
            route('requests.facilities.updateStatus', {
                request: booking.request_id,
                facility: facilityParam,
            }),
            {
                action,
            },
            inertiaOptions,
        );
    };

    return (
        <div
            className={`group relative flex flex-col rounded-lg border transition-shadow ${
                isEditing ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-card'
            } ${className ?? ''}`}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3.5">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Link
                            className="truncate text-lg font-semibold tracking-tight text-foreground hover:underline"
                            href={route('facility.detail', [booking.facility_id])}
                        >
                            {booking.facility_name}
                        </Link>
                        {isEditing && (
                            <span className="inline-flex items-center gap-1 rounded-[4px] bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                                <Pen size={9} />
                                Editing
                            </span>
                        )}
                        {booking.request_facility_status && <StatusTag requestStatus={booking.request_facility_status} variant="small" />}

                        {booking.has_outsiders && (
                            <span className="rounded-[4px] bg-[var(--ads-amber-bg)] px-1 text-xs font-medium text-[var(--ads-amber)]">Outsiders</span>
                        )}
                        {hasConflicts && (
                            <span className="flex items-center gap-1 rounded-[4px] bg-destructive/10 px-1 text-xs font-medium text-destructive">
                                <AlertCircleIcon size={10} />
                                Conflicts
                            </span>
                        )}
                        {isCapacityExceeded && (
                            <span className="flex items-center gap-1 rounded-[4px] bg-[var(--ads-amber-bg)] px-1 text-xs font-medium text-[var(--ads-amber)]">
                                <Users size={10} />
                                Capacity Exceeded
                            </span>
                        )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <CalendarIcon size={11} />
                            <span className="text-foreground">{format(booking.date, 'PPP')}</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock size={11} />
                            <span className="text-foreground">
                                {formatTime(booking.time_start)} – {formatTime(booking.time_end)}
                            </span>
                        </span>
                        {booking.expected_capacity != null && (
                            <span className="flex items-center gap-1">
                                <Users size={11} />
                                {booking.expected_capacity}
                            </span>
                        )}
                    </div>
                </div>

                {(onEdit || onRemove) && (
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {onEdit && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded text-muted-foreground hover:text-foreground"
                                onClick={() => onEdit(index)}
                            >
                                <Pen size={12} />
                            </Button>
                        )}
                        {onRemove && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded text-muted-foreground hover:text-destructive"
                                onClick={() => onRemove(index)}
                            >
                                <X size={12} />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Content Body */}
            <div className="flex-1 space-y-1.5 rounded-sm bg-background px-4">
                {/* Conflicts */}
                {hasConflicts && (
                    <div className="my-2 mb-2 space-y-1.5">
                        {draftConflicts.map((conflict) => (
                            <p key={`draft-${conflict.index}`} className="text-sm text-destructive">
                                Duplicate facility booking with card #{conflict.index + 1}: <strong>{conflict.facility_name}</strong> on{' '}
                                {format(conflict.date, 'PPP')} ({formatTime(conflict.time_start)}-{formatTime(conflict.time_end)})
                            </p>
                        ))}
                        {booking.conflicts.map((conflict, i) => (
                            <p key={i} className="text-sm text-destructive">
                                Schedule conflict with{' '}
                                {conflict.request_id ? (
                                    <Link className="font-bold hover:underline" href={route('requests.detail', [conflict.request_id])}>
                                        <span>"{conflict.request_title}"</span>
                                    </Link>
                                ) : (
                                    <span className="font-bold">"{conflict.request_title}"</span>
                                )}{' '}
                                ({formatTime(conflict.time_start)}–{formatTime(conflict.time_end)})
                            </p>
                        ))}
                        {Object.entries(booking.equipment_conflicts ?? {}).flatMap(([eqId, conflicts]) =>
                            conflicts.map((c, i) => {
                                const eqName = booking.equipment.find((e) => e.equipment_id === Number(eqId))?.equipment_name ?? `Equipment #${eqId}`;
                                return (
                                    <p key={`eq-${eqId}-${i}`} className="text-xs text-[var(--ads-amber)]">
                                        Equipment conflict ({eqName}) — also requested by "{c.request_title}" ({c.status})
                                    </p>
                                );
                            }),
                        )}
                    </div>
                )}

                {isCapacityExceeded && (
                    <p className="my-2 flex items-center gap-1.5 rounded-md border border-[var(--ads-amber)]/40 bg-[var(--ads-amber-bg)]/50 px-2 py-1.5 text-sm font-medium text-[var(--ads-amber)]">
                        <Users size={13} className="shrink-0" />
                        Expected attendees exceed this facility's capacity ({booking.expected_capacity} expected, {booking.facility_capacity}{' '}
                        capacity).
                    </p>
                )}

                {/* Equipment */}
                {hasAnyEquipment && (
                    <div className="my-2 space-y-2.5 rounded-md bg-background py-1">
                        {hasOwnEquipment && (
                            <EquipmentRow label="Facility">
                                {booking.equipment.map((eq, i) => (
                                    <Chip key={i}>
                                        {eq.equipment_name} <strong>×{eq.quantity_needed}</strong>
                                    </Chip>
                                ))}
                            </EquipmentRow>
                        )}
                        {hasBorrowedEquipment && (
                            <EquipmentRow label="Borrowed">
                                {Object.entries(borrowedGroups).map(([name, items]) => (
                                    <Chip key={name}>
                                        {name} <strong>×{items.reduce((s, e) => s + e.quantity_needed, 0)}</strong>
                                        <span className="ml-1 flex items-center gap-0.5 text-muted-foreground/60">
                                            <MapPin size={10} />
                                            {items.map((e) => e.source_facility_name).join(', ')}
                                        </span>
                                    </Chip>
                                ))}
                            </EquipmentRow>
                        )}
                        {hasExternalEquipment && (
                            <EquipmentRow label="External">
                                {booking.external_equipment.map((eq, i) => (
                                    <Chip key={i} muted>
                                        {eq.name}
                                    </Chip>
                                ))}
                            </EquipmentRow>
                        )}
                    </div>
                )}
            </div>

            {/* Individual Facility Decision Actions Footer */}
            {canMakeDecision && (
                <div className="flex items-center justify-between border-t border-border bg-background bg-muted/20 px-4 py-2.5">
                    <span className="text-xs font-medium text-muted-foreground">Facility Decision</span>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => handleAction('approve')} size="sm" className="h-7 px-3 text-xs">
                            Approve
                        </Button>
                        <Button
                            onClick={() => handleAction('reject')}
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                            Deny
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                                    <MoreHorizontal size={14} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuGroup className="text-sm *:cursor-pointer">
                                    <DropdownMenuItem onClick={() => handleAction('conditionally_approve')}>Conditionally Approve</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAction('for_reschedule')}>Mark for Reschedule</DropdownMenuItem>
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            )}
        </div>
    );
}

function EquipmentRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            {label && <span className="text-xs font-semibold text-muted-foreground">{label}</span>}
            <div className="flex items-start gap-3">
                <div className="flex flex-wrap gap-1">{children}</div>
            </div>
        </div>
    );
}

function Chip({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-sm ${
                muted ? 'border-border/40 text-muted-foreground' : 'border-border/50 text-foreground/80'
            }`}
        >
            {children}
        </span>
    );
}
