import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(time: string) {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes}${ampm}`;
};

export function recommendedActionToPresentTense(action: string): string {
  let word = action;
  switch (action) {
    case "Denied":
      word = "Deny";
      break;
  }
  return word;
}

interface ConflictCandidate {
  id: number;
  facility_id: number;
  date_requested: string;
  time_start: string;
  time_end: string;
}

interface OwnBooking {
  facility_id: number;
  date_requested: string;
  time_start: string;
  time_end: string;
}

function normalizeConflictDate(date: string): string {
  return date.slice(0, 10);
}

function timeToMinutes(time: string): number {
  const [h, m, s] = time.split(':').map(Number);
  return h * 60 + (m || 0) + (s || 0) / 60;
}

/**
 * True when a stored conflict RF actually overlaps the given booking:
 * same facility, same date, and intersecting time range. Stored
 * pending/approved_conflict_rf_ids are flat per-request lists that can
 * contain other-date/other-facility ids from multi-booking requests, so
 * callers must filter per-RF instead of by facility alone.
 */
export function isOverlappingConflict(own: OwnBooking, conflict: ConflictCandidate): boolean {
  if (Number(conflict.facility_id) !== Number(own.facility_id)) {
    return false;
  }
  if (normalizeConflictDate(conflict.date_requested) !== normalizeConflictDate(own.date_requested)) {
    return false;
  }
  const ownStart = timeToMinutes(own.time_start);
  const ownEnd = timeToMinutes(own.time_end);
  const conflictStart = timeToMinutes(conflict.time_start);
  const conflictEnd = timeToMinutes(conflict.time_end);
  return ownStart < conflictEnd && ownEnd > conflictStart;
}

/**
 * Filter + dedupe stored conflicts for one booking RF. Unique by
 * conflicting RF id so the same request showing two overlapping rows
 * (e.g. two RFs on the same date) still renders once per RF id, and only
 * when it truly overlaps that booking.
 */
export function conflictsForBooking<T extends ConflictCandidate>(own: OwnBooking, conflicts: readonly T[] | null | undefined): T[] {
  if (!conflicts) {
    return [];
  }
  const seen = new Set<number>();
  return conflicts.filter((c) => {
    if (seen.has(c.id)) {
      return false;
    }
    if (!isOverlappingConflict(own, c)) {
      return false;
    }
    seen.add(c.id);
    return true;
  });
}