import type { EquipmentAvailabilityByDate, EquipmentAvailabilityMap, EquipmentReservation } from './api';

/**
 * Availability presentation helpers.
 *
 * These exist as standalone pure functions because the previous behaviour was a
 * single inline expression that made "we have not loaded this yet" render
 * identically to "everything is free":
 *
 *     const displayQty = availability ? availability.available_quantity : equipment.pivot.quantity;
 *
 * That fallback is what hid the real bug — the availability response was being
 * discarded before it ever reached state, and the UI showed the facility's full
 * allocation the entire time. An unknown value must now stay unknown.
 */

/** A row's availability, plus everything the markup needs to render it. */
export interface AvailabilityEntry {
    /** False when the slot has not been resolved yet. Never assume availability. */
    isKnown: boolean;
    /** Units left for the selected slot. Only meaningful when isKnown. */
    remaining: number;
    /** The facility's own allocation. Only meaningful when isKnown. */
    total: number;
    /** Units already committed by approved requests in the slot. */
    reserved: number;
    /** Something is committed, but stock remains. */
    isLimited: boolean;
    /** Nothing left at all — a harder state than "limited". */
    isEmpty: boolean;
    /** Ready-to-render caption. */
    label: string;
    /** Largest quantity the form should default to when this row is ticked. */
    defaultQuantity: number;
    /** Approved bookings holding this equipment; explains the remaining count. */
    reservations: EquipmentReservation[];
    /**
     * Which selected date the counts came from. Null when a single date is
     * selected, or when nothing is reserved anywhere.
     */
    tightestDate: string | null;
}

/** One date where a selection cannot be satisfied as requested. */
export interface AvailabilityShortfall {
    date: string;
    equipment_id: number;
    equipment_name: string;
    /** What the user asked for on this row. */
    requested: number;
    /** What is actually free that day. */
    remaining: number;
    total: number;
    /** Nothing free at all that day. */
    isEmpty: boolean;
}

export interface MergedSlotAvailability {
    /** Tightest remaining count per equipment across every selected date. */
    merged: EquipmentAvailabilityMap;
    /** The date that produced the tightest count, or null when none is tighter. */
    tightestDate: string | null;
    /** Unmodified per-date view, so callers can attribute a count to a day. */
    byDate: EquipmentAvailabilityByDate;
}

const UNKNOWN: AvailabilityEntry = {
    isKnown: false,
    remaining: 0,
    total: 0,
    reserved: 0,
    isLimited: false,
    isEmpty: false,
    label: 'Checking availability…',
    defaultQuantity: 1,
    reservations: [],
    tightestDate: null,
};

/**
 * Collapse per-date availability into the tightest figure a batch add can
 * safely use.
 *
 * A batch add writes one booking per selected date carrying the SAME quantity, so
 * the safe number is the smallest remaining across the selection. Dates missing
 * from the input are ignored rather than treated as zero — a date whose fetch
 * failed must not read as fully booked.
 *
 * The date that produced the minimum is returned as `tightestDate`, and the full
 * per-date view is preserved in `byDate`. Losing that attribution is what made
 * multi-date picks impossible to explain: the UI could show a count but never
 * name the day it came from.
 */
export function mergeSlotAvailability(byDate: EquipmentAvailabilityByDate): MergedSlotAvailability {
    const dateKeys = Object.keys(byDate).sort();
    const merged: EquipmentAvailabilityMap = {};
    let tightestDate: string | null = null;

    for (const dateKey of dateKeys) {
        const bucket = byDate[dateKey];

        if (!bucket) continue;

        for (const [equipmentIdKey, value] of Object.entries(bucket)) {
            const equipmentId = Number(equipmentIdKey);
            const existing = merged[equipmentId];
            const reservations = dedupeReservations([...(existing?.reservations ?? []), ...(value.reservations ?? [])]);

            if (!existing) {
                merged[equipmentId] = { ...value, reservations };
                tightestDate = dateKey;

                continue;
            }

            merged[equipmentId] = { ...existing, reservations };

            // Strictly less, so a tie keeps the earliest date and the label does
            // not flicker when two days are equally constrained.
            if (value.available_quantity < existing.available_quantity) {
                merged[equipmentId] = { ...value, reservations };
                tightestDate = dateKey;
            }
        }
    }

    return { merged, tightestDate, byDate };
}

/**
 * The subset of `mergeSlotAvailability` for callers that only need the merged
 * map — the borrow panel, which has no use for dates.
 */
export function mergeToTightest(byDate: EquipmentAvailabilityByDate): EquipmentAvailabilityMap {
    return mergeSlotAvailability(byDate).merged;
}

function dedupeReservations(reservations: readonly EquipmentReservation[]): EquipmentReservation[] {
    const seen = new Set<string>();

    return reservations.filter((reservation) => {
        const key = `${reservation.request_id}|${reservation.date}|${reservation.time_start}|${reservation.time_end}|${reservation.quantity}`;

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

/**
 * Resolve one equipment row's availability.
 *
 * `defaultQuantity` floors at 1 because `quantity_needed` is validated with
 * `min:1`; a zero default would submit an invalid payload.
 */
export function resolveAvailabilityEntry(map: EquipmentAvailabilityMap, equipmentId: number, dateCount = 1, tightestDate: string | null = null): AvailabilityEntry {
    const entry = map[equipmentId];

    if (!entry) {
        return UNKNOWN;
    }

    const remaining = Math.max(0, entry.available_quantity);
    const total = entry.total_quantity;
    const isLimited = remaining < total;
    const isEmpty = remaining <= 0;

    return {
        isKnown: true,
        remaining,
        total,
        reserved: entry.reserved_quantity,
        isLimited,
        isEmpty,
        label: isLimited ? `Available: ${remaining} (${total} total)` : `Available: ${remaining}`,
        defaultQuantity: Math.max(1, remaining),
        reservations: entry.reservations ?? [],
        tightestDate: dateCount > 1 && isLimited ? tightestDate : null,
    };
}

/**
 * Which of the selected dates cannot satisfy the current selection.
 *
 * Uses the per-date view rather than the merged count, because the whole point
 * is naming the offending day. When nothing is ticked yet there is no requested
 * quantity to compare against, so a date where the facility has something at
 * zero is still worth reporting — it is still a day to avoid for that item.
 */
export function deriveShortfalls(byDate: EquipmentAvailabilityByDate, selected: readonly { equipment_id: number; equipment_name: string; quantity_needed: number }[]): AvailabilityShortfall[] {
    const shortfalls: AvailabilityShortfall[] = [];
    const dates = Object.keys(byDate).sort();

    for (const date of dates) {
        const bucket = byDate[date];

        if (!bucket) continue;

        for (const [equipmentIdKey, value] of Object.entries(bucket)) {
            const equipmentId = Number(equipmentIdKey);
            const remaining = Math.max(0, value.available_quantity);
            const chosen = selected.find((item) => item.equipment_id === equipmentId);

            if (chosen) {
                if (chosen.quantity_needed > remaining) {
                    shortfalls.push({
                        date,
                        equipment_id: equipmentId,
                        equipment_name: chosen.equipment_name || value.equipment_name,
                        requested: chosen.quantity_needed,
                        remaining,
                        total: value.total_quantity,
                        isEmpty: remaining <= 0,
                    });
                }

                continue;
            }

            // Nothing ticked for this row yet: only flag a day that is fully
            // blocked, which is actionable without a requested quantity.
            if (remaining <= 0) {
                shortfalls.push({
                    date,
                    equipment_id: equipmentId,
                    equipment_name: value.equipment_name,
                    requested: 0,
                    remaining,
                    total: value.total_quantity,
                    isEmpty: true,
                });
            }
        }
    }

    return shortfalls;
}