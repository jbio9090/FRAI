import { format } from "date-fns";
import { CalendarIcon, X, Clock, Users, AlertCircleIcon, Pen, ArrowLeftRight, MapPin } from "lucide-react";
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
    onEdit?: (index: number) => void;
    onRemove?: (index: number) => void;
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

function Badge({
    children,
    variant = "neutral",
}: {
    children: React.ReactNode;
    variant?: "neutral" | "warning" | "danger";
}) {
    const styles = {
        neutral: "bg-primary/10 text-primary border-primary/20",
        warning:
            "bg-amber-500/10 text-amber-600 border-amber-500/25 dark:text-amber-400",
        danger: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${styles[variant]}`}
        >
            {children}
        </span>
    );
}

// ── Thin divider ────────────────────────────────────────────────────────────
function Divider() {
    return <div className="h-px w-full bg-border/50" />;
}

export function BookingCard({ booking, index, onEdit, onRemove }: BookingCardProps) {
    const hasOwnEquipment = booking.equipment.length > 0;
    const hasBorrowedEquipment = (booking.borrowed_equipment ?? []).length > 0;
    const hasExternalEquipment = (booking.external_equipment ?? []).length > 0;
    const hasAnyEquipment = hasOwnEquipment || hasBorrowedEquipment || hasExternalEquipment;
    const hasConflicts =
        booking.conflicts.length > 0 ||
        Object.keys(booking.equipment_conflicts ?? {}).length > 0;

    const borrowedGroups = groupBorrowed(booking.borrowed_equipment ?? []);

    return (
        <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md">
            <div className="absolute inset-y-0 left-0 w-[3px] bg-primary/60 rounded-l-xl" />
            <div className="px-5 pt-4 pb-3 pl-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <h3 className="font-semibold text-base text-foreground truncate leading-snug">
                            {booking.facility_name}
                        </h3>
                        {booking.has_outsiders && (
                            <Badge variant="warning">Has Outsiders</Badge>
                        )}
                        {hasConflicts && (
                            <Badge variant="danger">
                                <AlertCircleIcon size={10} />
                                Conflicts
                            </Badge>
                        )}
                    </div>

                    {(onEdit || onRemove) && (
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {onEdit && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    onClick={() => onEdit(index)}
                                >
                                    <Pen size={13} />
                                </Button>
                            )}
                            {onRemove && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => onRemove(index)}
                                >
                                    <X size={13} />
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-semibold">
                        <CalendarIcon size={13} className="text-primary/60 shrink-0" />
                        {format(booking.date, "PPP")}
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold">
                        <Clock size={13} className="text-primary/60 shrink-0" />
                        <span>{formatTime(booking.time_start)}</span>
                        <span>–</span>
                        <span>{formatTime(booking.time_end)}</span>
                    </span>
                    {booking.expected_capacity && (
                        <span className="font-semibold flex items-center gap-1.5">
                            <Users size={13} className="text-primary/60 shrink-0" />
                            {booking.expected_capacity} attendees
                        </span>
                    )}
                </div>
            </div>

            {hasConflicts && (
                <>
                    <Divider />
                    <div className="px-5 py-3 pl-6 space-y-1.5">
                        {booking.conflicts.map((conflict, i) => (
                            <div
                                key={i}
                                className="flex items-start gap-2 rounded-lg bg-destructive/8 border border-destructive/15 px-3 py-2 text-[12px] text-destructive"
                            >
                                <AlertCircleIcon size={13} className="shrink-0 mt-0.5" />
                                <span>
                                    <strong className="font-semibold">Schedule conflict</strong> with "
                                    {conflict.request_title}" (
                                    {formatTime(conflict.time_start)}–{formatTime(conflict.time_end)})
                                </span>
                            </div>
                        ))}

                        {Object.entries(booking.equipment_conflicts ?? {}).flatMap(([eqId, conflicts]) =>
                            conflicts.map((c, i) => {
                                const eqName =
                                    booking.equipment.find(
                                        (e) => e.equipment_id === Number(eqId)
                                    )?.equipment_name ?? `Equipment #${eqId}`;
                                return (
                                    <div
                                        key={`eq-${eqId}-${i}`}
                                        className="flex items-start gap-2 rounded-lg bg-amber-500/8 border border-amber-500/15 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400"
                                    >
                                        <AlertCircleIcon size={13} className="shrink-0 mt-0.5" />
                                        <span>
                                            <strong className="font-semibold">
                                                Equipment conflict ({eqName})
                                            </strong>{" "}
                                            — also requested by "{c.request_title}" ({c.status})
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}

            {hasAnyEquipment && (
                <>
                    <Divider />
                    <div className="px-5 py-3 pl-6 space-y-3 bg-muted/20">

                        {hasOwnEquipment && (
                            <EquipmentSection label="Facility Equipment">
                                <div className="flex flex-wrap gap-1.5">
                                    {booking.equipment.map((eq, i) => (
                                        <EquipmentChip key={i} name={eq.equipment_name} qty={eq.quantity_needed} />
                                    ))}
                                </div>
                            </EquipmentSection>
                        )}

                        {hasBorrowedEquipment && (
                            <EquipmentSection
                                label="Borrowed Equipment"
                                icon={<ArrowLeftRight size={11} />}
                            >
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(borrowedGroups).map(([name, items]) => (
                                        <div
                                            key={name}
                                            className="group/chip flex items-center gap-1.5 rounded-md border border-border/50 bg-background/60 px-2.5 py-1 text-[12px]"
                                        >
                                            <span className="text-foreground font-medium">{name}</span>
                                            <span className="font-bold text-primary">
                                                ×{items.reduce((s, e) => s + e.quantity_needed, 0)}
                                            </span>
                                            <span className="text-muted-foreground/60">·</span>
                                            <span className="text-muted-foreground text-sm flex items-center gap-0.5">
                                                <MapPin size={13} />
                                                <span>
                                                    from {items.map((e) => e.source_facility_name).join(", ")}
                                                </span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </EquipmentSection>
                        )}

                        {hasExternalEquipment && (
                            <EquipmentSection label="External Equipment">
                                <div className="flex flex-wrap gap-1.5">
                                    {booking.external_equipment.map((eq, i) => (
                                        <span
                                            key={i}
                                            className="rounded-md border border-dashed border-border/60 bg-background/40 px-2.5 py-1 text-[12px] text-foreground/70"
                                        >
                                            {eq.name}
                                        </span>
                                    ))}
                                </div>
                            </EquipmentSection>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}


function EquipmentSection({
    label,
    icon,
    children,
}: {
    label: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                {icon}
                {label}
            </p>
            {children}
        </div>
    );
}

function EquipmentChip({ name, qty }: { name: string; qty: number }) {
    return (
        <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-background/60 px-2.5 py-1 text-[12px]">
            <span className="text-foreground/80">{name}</span>
            <span className="font-bold text-primary">×{qty}</span>
        </div>
    );
}