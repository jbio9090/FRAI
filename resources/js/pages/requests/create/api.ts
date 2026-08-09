import { format } from 'date-fns';
import type { EquipmentConflict } from '@/types/equipment';
import type { Facility } from '@/types/facility';
import type { EquipmentAvailabilityData, FacilityScheduleData } from './types';

export type BorrowableAvailabilityMap = Record<number, Record<number, number>>;

export type EquipmentAvailabilityMap = Record<number, { total_quantity: number; available_quantity: number; is_limited: boolean }>;

function getCsrfToken(): string {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')!.content;
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

export async function fetchBorrowableAvailability(params: {
    facilities: Facility[];
    selectedFacility: number | null;
    currentDate: string;
    timeStart: string;
    timeEnd: string;
}): Promise<BorrowableAvailabilityMap | null> {
    if (!params.currentDate || !params.timeStart || !params.timeEnd) return null;

    const sourceFacilities = params.facilities.filter((f) => f.id !== params.selectedFacility);
    if (sourceFacilities.length === 0) return null;

    const csrfToken = getCsrfToken();

    const results = await Promise.allSettled(
        sourceFacilities.map(async (facility) => {
            const res = await fetch(route('equipment.availability'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
                body: JSON.stringify({
                    facility_id: facility.id,
                    date: params.currentDate,
                    time_start: params.timeStart,
                    time_end: params.timeEnd,
                }),
            });
            const json = await res.json();
            return { facilityId: facility.id, availability: json.availability ?? [] };
        }),
    );

    const map: BorrowableAvailabilityMap = {};
    for (const result of results) {
        if (result.status === 'fulfilled') {
            const { facilityId, availability } = result.value;
            map[facilityId] = {};
            for (const item of availability) {
                map[facilityId][item.equipment_id] = item.available_quantity;
            }
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
                'X-CSRF-TOKEN': getCsrfToken(),
            },
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
    currentDate: string;
    timeStart: string;
    timeEnd: string;
}): Promise<EquipmentAvailabilityMap | null> {
    if (!params.facilityId || !params.currentDate || !params.timeStart || !params.timeEnd) return null;

    try {
        const res = await fetch(route('equipment.availability'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(),
            },
            body: JSON.stringify({
                facility_id: params.facilityId,
                date: params.currentDate,
                time_start: params.timeStart,
                time_end: params.timeEnd,
            }),
        });
        const data = await res.json();
        return (data.availability ?? []).reduce(
            (map: Record<number, { total_quantity: number; available_quantity: number; is_limited: boolean }>, item: EquipmentAvailabilityData) => {
                map[item.equipment_id] = {
                    total_quantity: item.total_quantity,
                    available_quantity: item.available_quantity,
                    is_limited: item.is_limited,
                };
                return map;
            },
            {},
        );
    } catch (err) {
        console.error('Failed to check equipment availability', err);
        return null;
    }
}
