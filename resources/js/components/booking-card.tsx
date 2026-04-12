import { format } from "date-fns";
import { CalendarIcon, X, Clock, User, AlertCircleIcon, Pen, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EquipmentConflict } from "@/types/equipment";

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
    request_title: string;
    status: string;
    time_start: string;
    time_end: string;
}

interface FacilityBooking {
    facility_id: number;
    facility_name: string;
    date: string;
    time_start: string;
    time_end: string;
    equipment: EquipmentRequest[];
    borrowed_equipment: BorrowedEquipmentRequest[];
    conflicts: BookingSchedule[];
    external_equipment: { name: string }[];
    expected_capacity: number | null;
    has_outsiders: boolean;
    equipment_conflicts: Record<number, EquipmentConflict[]>;
}

interface BookingCardProps {
    booking: FacilityBooking;
    index: number;
    onEdit: (index: number) => void;
    onRemove: (index: number) => void;
}

function formatTime(time: string): string {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

// Group borrowed equipment by name for a compact summary
function groupBorrowed(borrowed: BorrowedEquipmentRequest[]): Record<string, BorrowedEquipmentRequest[]> {
    return borrowed.reduce((groups, eq) => ({
        ...groups,
        [eq.equipment_name]: [...(groups[eq.equipment_name] ?? []), eq],
    }), {} as Record<string, BorrowedEquipmentRequest[]>);
}

export function BookingCard({ booking, index, onEdit, onRemove }: BookingCardProps) {
    const hasOwnEquipment = booking.equipment.length > 0;
    const hasBorrowedEquipment = (booking.borrowed_equipment ?? []).length > 0;
    const hasExternalEquipment = (booking.external_equipment ?? []).length > 0;
    const hasAnyEquipment = hasOwnEquipment || hasBorrowedEquipment || hasExternalEquipment;

    const borrowedGroups = groupBorrowed(booking.borrowed_equipment ?? []);

    return (
        <div className="overflow-hidden border border-border rounded-lg bg-secondary/30 shadow-sm">
            {/* ── Header ── */}
            <div className="p-4">
                <div className="flex items-center justify-between gap-4 mb-2">
                    <h3 className="font-bold text-lg text-foreground truncate">
                        {booking.facility_name}
                    </h3>

                    <div className="flex items-center gap-1 bg-background/50 rounded-md p-1 border border-border/50 shrink-0">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-background hover:text-primary transition-colors"
                            onClick={() => onEdit(index)}
                        >
                            <Pen size={14} />
                        </Button>
                        <div className="w-[1px] h-4 bg-border/60" />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive transition-colors"
                            onClick={() => onRemove(index)}
                        >
                            <X size={14} />
                        </Button>
                    </div>
                </div>

                {/* ── Meta row ── */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <CalendarIcon size={15} className="text-primary/70" />
                        <span>{format(booking.date, "PPP")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock size={15} className="text-primary/70" />
                        <span>{formatTime(booking.time_start)} – {formatTime(booking.time_end)}</span>
                    </div>
                    {booking.expected_capacity && (
                        <div className="flex items-center gap-2">
                            <User size={15} className="text-primary/70" />
                            <span>{booking.expected_capacity} attendees</span>
                        </div>
                    )}
                    {booking.has_outsiders && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            Has Outsiders
                        </span>
                    )}
                </div>

                {/* ── Schedule conflicts ── */}
                {booking.conflicts.map((conflict, i) => (
                    <div key={i} className="mt-3 flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                        <AlertCircleIcon size={14} className="shrink-0 mt-0.5" />
                        <span>
                            <strong>Schedule Conflict:</strong> Overlaps with "{conflict.request_title}" ({formatTime(conflict.time_start)}–{formatTime(conflict.time_end)})
                        </span>
                    </div>
                ))}

                {/* ── Equipment conflicts ── */}
                {Object.entries(booking.equipment_conflicts ?? {}).flatMap(([eqId, conflicts]) =>
                    conflicts.map((c, i) => {
                        const eqName = booking.equipment.find(e => e.equipment_id === Number(eqId))?.equipment_name ?? `Equipment #${eqId}`;
                        return (
                            <div key={`eq-${eqId}-${i}`} className="mt-2 flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
                                <AlertCircleIcon size={14} className="shrink-0 mt-0.5" />
                                <span>
                                    <strong>Equipment Conflict ({eqName}):</strong> Also requested by "{c.request_title}" ({c.status})
                                </span>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── Equipment footer ── */}
            {hasAnyEquipment && (
                <div className="bg-background/40 border-t border-border px-4 py-3 space-y-3">

                    {/* Own equipment */}
                    {hasOwnEquipment && (
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                Facility Equipment
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {booking.equipment.map((eq, i) => (
                                    <div key={i} className="text-sm flex items-center justify-between bg-background/50 px-2 py-1 rounded border border-border/40">
                                        <span className="text-foreground/80">{eq.equipment_name}</span>
                                        <span className="text-sm font-bold text-primary">×{eq.quantity_needed}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Borrowed equipment */}
                    {hasBorrowedEquipment && (
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                                <ArrowLeftRight size={11} />
                                Borrowed Equipment
                            </p>
                            <div className="space-y-2">
                                {Object.entries(borrowedGroups).map(([name, items]) => (
                                    <div key={name} className="rounded border border-border/40 bg-background/50 px-2 py-1.5">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-foreground/80 font-medium">{name}</span>
                                            <span className="text-sm font-bold text-primary">
                                                ×{items.reduce((s, e) => s + e.quantity_needed, 0)}
                                            </span>
                                        </div>
                                        <div className="space-y-0.5">
                                            {items.map((eq, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs text-muted-foreground pl-1">
                                                    <span>from {eq.source_facility_name}</span>
                                                    <span>×{eq.quantity_needed}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* External equipment */}
                    {hasExternalEquipment && (
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                External Equipment
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {booking.external_equipment.map((eq, i) => (
                                    <div key={i} className="text-sm flex items-center bg-background/50 px-2 py-1 rounded border border-border/40 text-foreground/80">
                                        {eq.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}