import { format } from "date-fns";
import { AlertCircleIcon, CalendarIcon, Clock, Pen, User, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConflictItem {
  request_title: string;
  time_start: string;
  time_end: string;
  status?: string;
}

interface Equipment {
  equipment_id: number;
  equipment_name: string;
  quantity_needed: number;
}

interface BorrowedEquipment {
  equipment_name: string;
  quantity_needed: number;
  source_facility_name: string;
}

interface FacilityBooking {
  facility_name: string;
  date: Date;
  time_start: string;
  time_end: string;
  expected_capacity?: number;
  has_outsiders?: boolean;
  conflicts: ConflictItem[];
  equipment_conflicts?: Record<string, ConflictItem[]>;
  equipment: Equipment[];
  borrowed_equipment?: BorrowedEquipment[];
}

interface FacilityBookingCardProps {
  booking: FacilityBooking;
  index: number;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  formatTime: (time: string) => string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FacilityBookingCard({
  booking,
  index,
  onEdit,
  onRemove,
  formatTime,
}: FacilityBookingCardProps) {
  const hasEquipment =
    booking.equipment.length > 0 || (booking.borrowed_equipment?.length ?? 0) > 0;

  const equipmentConflictEntries = Object.entries(booking.equipment_conflicts ?? {}).flatMap(
    ([eqId, conflicts]) =>
      conflicts.map((c) => ({
        eqName:
          booking.equipment.find((e) => e.equipment_id === Number(eqId))?.equipment_name ??
          `Equipment #${eqId}`,
        conflict: c,
        eqId,
      }))
  );

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow duration-200 hover:shadow-md">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 p-5 pb-4">
        <div className="min-w-0">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
            Facility
          </p>
          <h3 className="truncate text-[17px] font-bold leading-tight text-card-foreground">
            {booking.facility_name}
          </h3>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(index)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-all hover:border-border hover:text-foreground hover:shadow"
            aria-label="Edit booking"
          >
            <Pen size={13} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-all hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:shadow"
            aria-label="Remove booking"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── Meta row ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 pb-4">
        <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <CalendarIcon size={13} className="text-primary" />
          {format(booking.date, "PPP")}
        </span>
        <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Clock size={13} className="text-primary" />
          {formatTime(booking.time_start)} – {formatTime(booking.time_end)}
        </span>
        {booking.expected_capacity && (
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <User size={13} className="text-primary" />
            {booking.expected_capacity} attendees
          </span>
        )}
        {booking.has_outsiders && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800/40">
            Has Outsiders
          </span>
        )}
      </div>

      {/* ── Conflict alerts ── */}
      {(booking.conflicts.length > 0 || equipmentConflictEntries.length > 0) && (
        <div className="space-y-2 px-5 pb-4">
          {booking.conflicts.map((conflict, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-[12px] text-destructive ring-1 ring-inset ring-destructive/20"
            >
              <AlertCircleIcon size={13} className="mt-0.5 shrink-0" />
              <span>
                <strong className="font-semibold">Schedule conflict</strong> — overlaps with &ldquo;
                {conflict.request_title}&rdquo; ({formatTime(conflict.time_start)} –{" "}
                {formatTime(conflict.time_end)})
              </span>
            </div>
          ))}
          {equipmentConflictEntries.map(({ eqName, conflict }, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-[12px] text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400"
            >
              <AlertCircleIcon size={13} className="mt-0.5 shrink-0" />
              <span>
                <strong className="font-semibold">Equipment conflict ({eqName})</strong> — also
                requested by &ldquo;{conflict.request_title}&rdquo; ({conflict.status})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Equipment section ── */}
      {hasEquipment && (
        <>
          <div className="mx-5 border-t border-border" />
          <div className="p-5 pt-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Requested Equipment
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {booking.equipment.map((eq, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 ring-1 ring-inset ring-border/60"
                >
                  <span className="text-[13px] text-foreground/80">
                    {eq.equipment_name}
                  </span>
                  <span className="ml-3 shrink-0 text-[13px] font-bold text-primary">
                    ×{eq.quantity_needed}
                  </span>
                </div>
              ))}
              {booking.borrowed_equipment?.map((eq, i) => (
                <div
                  key={`borrowed-${i}`}
                  className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 ring-1 ring-inset ring-border/60"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] text-foreground/80">
                      {eq.equipment_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      from {eq.source_facility_name}
                    </span>
                  </div>
                  <span className="ml-3 shrink-0 text-[13px] font-bold text-primary">
                    ×{eq.quantity_needed}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── List wrapper (drop-in replacement for the original map) ─────────────────

interface FacilityBookingListProps {
  bookings: FacilityBooking[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  formatTime: (time: string) => string;
}

export function FacilityBookingList({
  bookings,
  onEdit,
  onRemove,
  formatTime,
}: FacilityBookingListProps) {
  return (
    <div className="space-y-4">
      {bookings.map((booking, index) => (
        <FacilityBookingCard
          key={index}
          booking={booking}
          index={index}
          onEdit={onEdit}
          onRemove={onRemove}
          formatTime={formatTime}
        />
      ))}
    </div>
  );
}