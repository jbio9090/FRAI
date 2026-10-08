import { format } from 'date-fns';
import { csrfHeaders } from '@/lib/csrfHeaders';
import type { EquipmentConflict } from '@/types/equipment';
import type { Facility } from '@/types/facility';
import { mergeSlotAvailability } from './availability';
import type { EquipmentAvailabilityData, FacilityScheduleData } from './types';

export type BorrowableAvailabilityMap = Record<number, Record<number, number>>;

export interface EquipmentAvailabilityEntry {
    equipment_name: string;
    total_quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    is_limited: boolean;
    is_empty: boolean;
}

export type EquipmentAvailabilityMap = Record<number, EquipmentAvailabilityEntry>;

/** Wire shape: one bucket per requested date, each holding a list of rows. */
export type AvailabilityWireResponse = Record<string, { availability: EquipmentAvailabilityData[] }>;

/**
 * Reshape the endpoint's per-date row lists into per-date maps keyed by
 * equipment id. Every requested date is present in the response even when the
 * facility holds no equipment, so an empty array means "nothing there" rather
 * than "not fetched".
 */
export function normaliseAvailabilityByDate(dates: AvailabilityWireResponse | null | undefined): EquipmentAvailabilityByDate {
    const byDate: EquipmentAvailabilityByDate = {};

    for (const [date, bucket] of Object.entries(dates ?? {})) {
        const map: EquipmentAvailabilityMap = {};

        for (const item of bucket?.availability ?? []) {
            map[item.equipment_id] = {
                equipment_name: item.equipment_name,
                total_quantity: item.total_quantity,
                reserved_quantity: item.reserved_quantity,
                available_quantity: item.available_quantity,
                is_limited: item.is_limited,
                is_empty: item.is_empty ?? item.available_quantity <= 0,
            };
        }

        byDate[date] = map;
    }

    return byDate;
}

export async function loadSchedule(facilityId: number, date: Date): Promise<FacilityScheduleData | null> {
    try {
        const dateString = format(date, 'yyyy-MM-dd');

        const response = await fetch(
            route('facility.schedule', {
                facility: facilityId,
                date: dateString,
            }),
        );

        const data = await response.json();

        return {
            bookings: data.bookings ?? [],
            date: dateString,
        };
    } catch (error) {
        console.error('Failed to load schedule:', error);
        return null;
    }
}

export type EquipmentAvailabilityByDate = Record<string, EquipmentAvailabilityMap>;

export async function fetchBorrowableAvailability(params: {
    facilities: Facility[];
    selectedFacility: number | null;
    dates: string[];
    timeStart: string;
    timeEnd: string;
    /** Editing a request must not count its own borrow against the source. */
    excludeRequestId?: number | null;
}): Promise<BorrowableAvailabilityMap | null> {
    if (params.dates.length === 0 || !params.timeStart || !params.timeEnd) return null;

    const sourceFacilities = params.facilities.filter((f) => f.id !== params.selectedFacility);
    if (sourceFacilities.length === 0) return null;

    const results = await Promise.allSettled(
        sourceFacilities.map(async (facility) => {
            const res = await fetch(route('equipment.availability'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
                credentials: 'same-origin',
                body: JSON.stringify({
                    facility_id: facility.id,
                    dates: params.dates,
                    time_start: params.timeStart,
                    time_end: params.timeEnd,
                    exclude_request_id: params.excludeRequestId ?? null,
                }),
            });
            const json = await res.json();

            return { facilityId: facility.id, byDate: normaliseAvailabilityByDate(json.dates) };
        }),
    );

    const map: BorrowableAvailabilityMap = {};

    for (const result of results) {
        if (result.status !== 'fulfilled') continue;

        // Tightest date wins: a borrowable that is free on one selected day and
        // gone on another is not borrowable for this submission. Previously this
        // read only the first date, so later days were under-detected and the
        // rejection surfaced as a 422 at submit.

        const { facilityId, byDate } = result.value;
        const { merged } = mergeSlotAvailability(byDate);

        map[facilityId] = {};

        for (const [equipmentIdKey, entry] of Object.entries(merged)) {
            map[facilityId][Number(equipmentIdKey)] = entry.available_quantity;
        }
    }
    return map;
}

export async function fetchEquipmentConflicts(params: {
    equipmentIds: number[];
    currentDate: string;
    timeStart: string;
    timeEnd: string;
    excludeRequestId?: number | null;
}): Promise<Record<number, EquipmentConflict[]> | null> {
    if (!params.currentDate || !params.timeStart || !params.timeEnd || params.equipmentIds.length === 0) return null;

    try {
        const res = await fetch(route('equipment.check-conflicts'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...csrfHeaders(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                equipment_ids: params.equipmentIds,
                date: params.currentDate,
                time_start: params.timeStart,
                time_end: params.timeEnd,
                exclude_request_id: params.excludeRequestId ?? null,
            }),
        });
        const data = await res.json();
        return data.conflicts ?? {};
    } catch (err) {
        console.error('Failed to check equipment conflicts', err);
        return null;
    }
}

export async function fetchEquipmentAvailability(params: {
    facilityId: number | null;
    dates: string[];
    timeStart: string;
    timeEnd: string;
    excludeRequestId?: number | null;
}): Promise<EquipmentAvailabilityByDate | null> {
    if (!params.facilityId || params.dates.length === 0 || !params.timeStart || !params.timeEnd) return null;

    try {
        const res = await fetch(route('equipment.availability'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...csrfHeaders(),
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                facility_id: params.facilityId,
                dates: params.dates,
                time_start: params.timeStart,
                time_end: params.timeEnd,
                exclude_request_id: params.excludeRequestId ?? null,
            }),
        });
        const data = await res.json();

        return normaliseAvailabilityByDate(data.dates);
    } catch (err) {
        console.error('Failed to check equipment availability', err);
        return null;
    }
}
