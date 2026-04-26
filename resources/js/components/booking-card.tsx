import { format } from "date-fns";
import { CalendarIcon, X, Clock, Users, AlertCircleIcon, Pen, ArrowLeftRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EquipmentConflict } from "@/types/equipment";
import { Link } from "@inertiajs/react";

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
    request_id: number;
    request_title: string;
    status: string;
    time_start: string;
    time_end: string;
}

interface FacilityBooking {
    request_id: number;
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
    onEdit?: (index: number) => void;
    onRemove?: (index: number) => void;
    className?: string;
}

function formatTime(time: string): string {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

function groupBorrowed(
    borrowed: BorrowedEquipmentRequest[]
): Record<string, BorrowedEquipmentRequest[]> {
    return borrowed.reduce(
        (groups, eq) => ({
            ...groups,
            [eq.equipment_name]: [...(groups[eq.equipment_name] ?? []), eq],
        }),
        {} as Record<string, BorrowedEquipmentRequest[]>
    );
}

export function BookingCard({ booking, index, onEdit, onRemove, className }: BookingCardProps) {
    const hasOwnEquipment = booking.equipment.length > 0;
    const hasBorrowedEquipment = (booking.borrowed_equipment ?? []).length > 0;
    const hasExternalEquipment = (booking.external_equipment ?? []).length > 0;
    const hasAnyEquipment = hasOwnEquipment || hasBorrowedEquipment || hasExternalEquipment;
    const hasConflicts =
        booking.conflicts.length > 0 ||
        Object.keys(booking.equipment_conflicts ?? {}).length > 0;

    const borrowedGroups = groupBorrowed(booking.borrowed_equipment ?? []);

    return (
        <div className={`group relative rounded-lg border border-border transition-shadow ${className ?? ""}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b bg-card">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Link className="font-semibold tracking-tight text-lg text-foreground truncate hover:underline" href={route("facility.detail", [booking.facility_id])}>
                            {booking.facility_name}
                        </Link>
                        {booking.has_outsiders && (
                            <span className="text-amber-600 dark:text-amber-400 bg-amber-100 rounded-full text-xs px-1 font-medium">
                                Outsiders
                            </span>
                        )}
                        {hasConflicts && (
                            <span className="flex items-center gap-1 bg-destructive/10 text-destructive font-medium rounded-full text-xs px-1">
                                <AlertCircleIcon size={10} />
                                Conflicts
                            </span>
                        )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <CalendarIcon size={11} />
                            {format(booking.date, "PPP")}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {formatTime(booking.time_start)} – {formatTime(booking.time_end)}
                        </span>
                        {booking.expected_capacity && (
                            <span className="flex items-center gap-1">
                                <Users size={11} />
                                {booking.expected_capacity}
                            </span>
                        )}
                    </div>
                </div>

                {(onEdit || onRemove) && (
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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

            {/* Conflicts */}
            {hasConflicts && (
                <div className="space-y-1.5 px-4 py-2">
                    {booking.conflicts.map((conflict, i) => (
                        <p key={i} className="text-sm text-destructive">
                            Schedule conflict with{" "}
                            <Link
                                className="hover:underline font-bold"
                                href={route("requests.detail", [conflict.request_id])}>
                                <span>
                                    "{conflict.request_title}"
                                </span>
                            </Link>
                            {" "}({formatTime(conflict.time_start)}–{formatTime(conflict.time_end)})
                        </p>
                    ))}
                    {Object.entries(booking.equipment_conflicts ?? {}).flatMap(([eqId, conflicts]) =>
                        conflicts.map((c, i) => {
                            const eqName =
                                booking.equipment.find((e) => e.equipment_id === Number(eqId))
                                    ?.equipment_name ?? `Equipment #${eqId}`;
                            return (
                                <p key={`eq-${eqId}-${i}`} className="text-[12px] text-amber-600 dark:text-amber-400">
                                    Equipment conflict ({eqName}) — also requested by "{c.request_title}" ({c.status})
                                </p>
                            );
                        })
                    )}
                </div>
            )}

            {/* Equipment */}
            {hasAnyEquipment && (
                <div className="rounded-md space-y-2.5 px-4 py-3.5 bg-background">
                    {hasOwnEquipment && (
                        <EquipmentRow label="Facility">
                            {booking.equipment.map((eq, i) => (
                                <Chip key={i}>{eq.equipment_name} <strong>×{eq.quantity_needed}</strong></Chip>
                            ))}
                        </EquipmentRow>
                    )}
                    {hasBorrowedEquipment && (
                        <EquipmentRow label="Borrowed">
                            {Object.entries(borrowedGroups).map(([name, items]) => (
                                <Chip key={name}>
                                    {name} <strong>×{items.reduce((s, e) => s + e.quantity_needed, 0)}</strong>
                                    <span className="text-muted-foreground/60 ml-1 flex items-center gap-0.5">
                                        <MapPin size={10} />
                                        {items.map((e) => e.source_facility_name).join(", ")}
                                    </span>
                                </Chip>
                            ))}
                        </EquipmentRow>
                    )}
                    {hasExternalEquipment && (
                        <EquipmentRow label="External">
                            {booking.external_equipment.map((eq, i) => (
                                <Chip key={i} muted>{eq.name}</Chip>
                            ))}
                        </EquipmentRow>
                    )}
                </div>
            )}
        </div>
    );
}

function EquipmentRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            {label && (
                <span className="text-xs text-muted-foreground font-semibold">
                    {label}
                </span>
            )}
            <div className="flex items-start gap-3">
                <div className="flex flex-wrap gap-1">{children}</div>
            </div>
        </div>

    );
}

function Chip({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
    return (
        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm border ${muted
            ? "border-border/40 text-muted-foreground"
            : "border-border/50 text-foreground/80"
            }`}>
            {children}
        </span>
    );
}