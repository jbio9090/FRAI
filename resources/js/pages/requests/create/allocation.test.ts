import { describe, expect, it } from 'vitest';
import { allocationsForEquipment } from '@/pages/requests/create/allocation';
import type { Facility } from '@/types/facility';

function facility(id: number, name: string, equipment: { id: number; pivot?: { quantity?: number } }[]): Facility {
    return { id, name, capacity: 100, building: '', status: 'active', equipment } as unknown as Facility;
}

describe('allocationsForEquipment', () => {
    const facilities = [
        facility(1, 'Main Auditorium', [{ id: 5, pivot: { quantity: 3 } }]),
        facility(2, 'Assembly Hall', [{ id: 5, pivot: { quantity: 1 } }]),
        facility(3, 'COED AVR', [{ id: 6, pivot: { quantity: 1 } }]),
    ];

    it('returns the other facilities holding the same item', () => {
        expect(allocationsForEquipment(facilities, 5, 1)).toEqual([{ facilityId: 2, facilityName: 'Assembly Hall', quantity: 1 }]);
    });

    it('is empty when no other facility holds it', () => {
        expect(allocationsForEquipment(facilities, 6, 3)).toEqual([]);
    });

    it('is empty for an unknown item', () => {
        expect(allocationsForEquipment(facilities, 999, 1)).toEqual([]);
    });

    it('skips zero-quantity rows rather than listing a facility with nothing', () => {
        const withZero = [...facilities, facility(4, 'Empty Hall', [{ id: 5, pivot: { quantity: 0 } }])];

        expect(allocationsForEquipment(withZero, 5, 1)).toEqual([{ facilityId: 2, facilityName: 'Assembly Hall', quantity: 1 }]);
    });

    it('skips rows with a missing pivot instead of crashing', () => {
        const withoutPivot = [...facilities, facility(4, 'Broken Hall', [{ id: 5 }])];

        expect(allocationsForEquipment(withoutPivot, 5, 1)).toEqual([{ facilityId: 2, facilityName: 'Assembly Hall', quantity: 1 }]);
    });

    it('sorts by facility name', () => {
        const unordered = [
            facility(2, 'Zulu Hall', [{ id: 5, pivot: { quantity: 1 } }]),
            facility(3, 'Alpha Hall', [{ id: 5, pivot: { quantity: 2 } }]),
        ];

        expect(allocationsForEquipment(unordered, 5, 1).map((a) => a.facilityName)).toEqual(['Alpha Hall', 'Zulu Hall']);
    });

    it('tolerates facilities with no equipment list at all', () => {
        const bare = [{ id: 2, name: 'Bare Hall', capacity: 0, building: '', status: 'active' } as unknown as Facility];

        expect(allocationsForEquipment(bare, 5, 1)).toEqual([]);
    });
});