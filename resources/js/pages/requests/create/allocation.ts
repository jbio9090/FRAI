import type { Facility } from '@/types/facility';

/** One other facility's share of an equipment item. */
export interface FacilityAllocation {
    facilityId: number;
    facilityName: string;
    quantity: number;
}

/**
 * Where else an equipment item is held, besides the facility being booked.
 *
 * Each equipment row on the create page sits inside the selected facility's
 * list, so the row already answers "what do we hold" via its own pivot
 * quantity. What it never showed is who else holds the same item — which is
 * what this returns, derived from the `facilities` prop that already carries
 * every facility's allocation list. No backend call: allocation is static stock
 * data, not live availability.
 */
export function allocationsForEquipment(
    facilities: readonly Facility[],
    equipmentId: number,
    selectedFacilityId: number | null,
): FacilityAllocation[] {
    const allocations: FacilityAllocation[] = [];

    for (const facility of facilities) {
        if (facility.id === selectedFacilityId) {
            continue;
        }

        // The shared Facility type declares `equipments?`; the composer payload
        // carries the same list as `equipment`. Read the runtime key first.
        const runtimeItems = (facility as unknown as { equipment?: { id: number; pivot?: { quantity?: number } }[] }).equipment;
        const items = runtimeItems ?? facility.equipments?.map((item) => ({ id: item.id, pivot: item.pivot }));

        for (const item of items ?? []) {
            if (item?.id !== equipmentId) {
                continue;
            }

            const quantity = item.pivot?.quantity ?? 0;

            if (quantity > 0) {
                allocations.push({ facilityId: facility.id, facilityName: facility.name, quantity });
            }
        }
    }

    return allocations.sort((a, b) => a.facilityName.localeCompare(b.facilityName));
}
