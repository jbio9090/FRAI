import { describe, expect, it } from 'vitest';
import type { EquipmentAvailabilityByDate, EquipmentAvailabilityMap, EquipmentReservation } from '@/pages/requests/create/api';
import { deriveShortfalls, mergeSlotAvailability, resolveAvailabilityEntry } from '@/pages/requests/create/availability';

function reservation(overrides: Partial<EquipmentReservation> = {}): EquipmentReservation {
    return {
        request_id: 1,
        request_title: 'Outreach',
        requester: 'Juan',
        date: '2026-10-20',
        time_start: '09:00',
        time_end: '11:00',
        quantity: 4,
        facility_name: 'Main Auditorium',
        source_facility_name: null,
        is_borrowed: false,
        ...overrides,
    };
}

function entry(available: number, total = 10, reserved = total - available): EquipmentAvailabilityMap[number] {
    return {
        equipment_name: 'Folding Table',
        total_quantity: total,
        reserved_quantity: reserved,
        available_quantity: available,
        is_limited: available < total,
        is_empty: available <= 0,
        reservations: [],
    };
}

function map(available: number, total = 10): EquipmentAvailabilityMap {
    return { 8: entry(available, total) };
}

function byDate(dates: Record<string, number | null>, total = 10): EquipmentAvailabilityByDate {
    const result: EquipmentAvailabilityByDate = {};

    for (const [date, available] of Object.entries(dates)) {
        result[date] = available === null ? {} : map(available, total);
    }

    return result;
}

describe('mergeSlotAvailability', () => {
    it('returns empty output when nothing resolved', () => {
        const { merged, tightestDate } = mergeSlotAvailability({});

        expect(merged).toEqual({});
        expect(tightestDate).toBeNull();
    });

    it('takes the tightest remaining quantity across dates', () => {
        const { merged } = mergeSlotAvailability(byDate({ '2026-10-20': 10, '2026-10-21': 3, '2026-10-22': 7 }));

        expect(merged[8].available_quantity).toBe(3);
    });

    // The bug this whole exercise exists for: the count survived but the date it
    // came from did not, so nothing downstream could name the offending day.
    it('reports which date produced the tightest count', () => {
        const { tightestDate } = mergeSlotAvailability(byDate({ '2026-10-20': 10, '2026-10-21': 3, '2026-10-22': 7 }));

        expect(tightestDate).toBe('2026-10-21');
    });

    it('breaks ties on the earliest date so the label does not flicker', () => {
        const { tightestDate } = mergeSlotAvailability(byDate({ '2026-10-22': 3, '2026-10-20': 3, '2026-10-21': 9 }));

        expect(tightestDate).toBe('2026-10-20');
    });

    it('ignores dates whose fetch failed instead of treating them as zero', () => {
        const { merged } = mergeSlotAvailability(byDate({ '2026-10-20': 4, '2026-10-21': null }));

        expect(merged[8].available_quantity).toBe(4);
    });

    it('carries a zero-remaining date through, since that is a real answer', () => {
        const { merged, tightestDate } = mergeSlotAvailability(byDate({ '2026-10-20': 10, '2026-10-21': 0 }));

        expect(merged[8].available_quantity).toBe(0);
        expect(tightestDate).toBe('2026-10-21');
    });

    it('merges independent equipment ids independently', () => {
        const input: EquipmentAvailabilityByDate = {
            '2026-10-20': { 1: entry(10), 2: entry(5) },
            '2026-10-21': { 1: entry(2), 2: entry(8) },
        };
        const { merged } = mergeSlotAvailability(input);

        expect(merged[1].available_quantity).toBe(2);
        expect(merged[2].available_quantity).toBe(5);
    });

    it('preserves the unmodified per-date view for attribution', () => {
        const input = byDate({ '2026-10-20': 10, '2026-10-21': 3 });
        const { byDate: preserved } = mergeSlotAvailability(input);

        expect(Object.keys(preserved).sort()).toEqual(['2026-10-20', '2026-10-21']);
        expect(preserved['2026-10-20'][8].available_quantity).toBe(10);
        expect(preserved['2026-10-21'][8].available_quantity).toBe(3);
    });

    it('unions reservations across dates while keeping the tightest count', () => {
        const input: EquipmentAvailabilityByDate = {
            '2026-10-20': { 8: { ...entry(10), reservations: [reservation({ date: '2026-10-20' })] } },
            '2026-10-21': { 8: { ...entry(3), reservations: [reservation({ date: '2026-10-21', request_id: 2 })] } },
        };
        const { merged } = mergeSlotAvailability(input);

        expect(merged[8].available_quantity).toBe(3);
        expect(merged[8].reservations).toHaveLength(2);
    });

    it('dedupes the same reservation seen on two dates', () => {
        const shared = reservation({ request_id: 5, time_start: '14:00', time_end: '16:00' });
        const input: EquipmentAvailabilityByDate = {
            '2026-10-20': { 8: { ...entry(10), reservations: [shared] } },
            '2026-10-21': { 8: { ...entry(10), reservations: [shared] } },
        };
        const { merged } = mergeSlotAvailability(input);

        expect(merged[8].reservations).toHaveLength(1);
    });
});

describe('resolveAvailabilityEntry', () => {
    it('reports unknown when the slot has not resolved', () => {
        const resolved = resolveAvailabilityEntry({}, 8);

        expect(resolved.isKnown).toBe(false);
        expect(resolved.label).toBe('Checking availability…');
    });

    // The original bug: an unresolved slot fell back to the facility's full
    // allocation and read as "Available: 10".
    it('never reports the facility total as available when unknown', () => {
        const resolved = resolveAvailabilityEntry({}, 8);

        expect(resolved.label).not.toContain('10');
        expect(resolved.remaining).toBe(0);
    });

    it('shows remaining and total when something is reserved', () => {
        const resolved = resolveAvailabilityEntry(map(3), 8);

        expect(resolved.isKnown).toBe(true);
        expect(resolved.remaining).toBe(3);
        expect(resolved.total).toBe(10);
        expect(resolved.reserved).toBe(7);
        expect(resolved.isLimited).toBe(true);
        expect(resolved.isEmpty).toBe(false);
        expect(resolved.label).toBe('Available: 3 (10 total)');
    });

    it('omits the total suffix when nothing is reserved', () => {
        expect(resolveAvailabilityEntry(map(10), 8).label).toBe('Available: 10');
    });

    it('flags a fully reserved row as empty, a harder state than limited', () => {
        const resolved = resolveAvailabilityEntry(map(0), 8);

        expect(resolved.remaining).toBe(0);
        expect(resolved.isEmpty).toBe(true);
        expect(resolved.isLimited).toBe(true);
        expect(resolved.label).toBe('Available: 0 (10 total)');
    });

    it('defaults the quantity to what remains', () => {
        expect(resolveAvailabilityEntry(map(3), 8).defaultQuantity).toBe(3);
        expect(resolveAvailabilityEntry(map(10), 8).defaultQuantity).toBe(10);
    });

    // quantity_needed is validated with min:1, so a zero default would be invalid.
    it('floors the default at 1 so a fully booked row still submits a valid payload', () => {
        expect(resolveAvailabilityEntry(map(0), 8).defaultQuantity).toBe(1);
    });

    it('attributes the count to a date only when several dates are selected', () => {
        expect(resolveAvailabilityEntry(map(3), 8, 1, '2026-10-20').tightestDate).toBeNull();
        expect(resolveAvailabilityEntry(map(3), 8, 3, '2026-10-21').tightestDate).toBe('2026-10-21');
    });

    it('has no reservations while availability is unknown, so no tooltip renders', () => {
        expect(resolveAvailabilityEntry({}, 8).reservations).toEqual([]);
    });
});

describe('deriveShortfalls', () => {
    const selection = [{ equipment_id: 8, equipment_name: 'Folding Table', quantity_needed: 4 }];

    it('names the date a selection cannot satisfy', () => {
        const shortfalls = deriveShortfalls(byDate({ '2026-10-20': 10, '2026-10-21': 3 }), selection);

        expect(shortfalls).toHaveLength(1);
        expect(shortfalls[0]).toMatchObject({
            date: '2026-10-21',
            equipment_id: 8,
            requested: 4,
            remaining: 3,
            total: 10,
            isEmpty: false,
        });
    });

    it('stays quiet when every date can satisfy the selection', () => {
        expect(deriveShortfalls(byDate({ '2026-10-20': 10, '2026-10-21': 9 }), selection)).toEqual([]);
    });

    it('reports a fully blocked date as empty', () => {
        const shortfalls = deriveShortfalls(byDate({ '2026-10-20': 0 }), selection);

        expect(shortfalls[0]).toMatchObject({ date: '2026-10-20', remaining: 0, isEmpty: true });
    });

    it('flags a fully booked row even when nothing is ticked for it yet', () => {
        const shortfalls = deriveShortfalls(byDate({ '2026-10-20': 0 }), []);

        expect(shortfalls).toHaveLength(1);
        expect(shortfalls[0]).toMatchObject({ requested: 0, isEmpty: true, equipment_name: 'Folding Table' });
    });

    it('does not flag a merely reduced row when nothing is ticked for it', () => {
        expect(deriveShortfalls(byDate({ '2026-10-20': 3 }), [])).toEqual([]);
    });

    it('reports every affected date, sorted', () => {
        const shortfalls = deriveShortfalls(byDate({ '2026-10-22': 1, '2026-10-20': 10, '2026-10-21': 2 }), selection);

        expect(shortfalls.map((s) => s.date)).toEqual(['2026-10-21', '2026-10-22']);
    });
});