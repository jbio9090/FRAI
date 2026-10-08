import { describe, expect, it } from 'vitest';
import type { EquipmentAvailabilityByDate, EquipmentAvailabilityMap } from '@/pages/requests/create/api';
import { deriveShortfalls, mergeSlotAvailability, resolveAvailabilityEntry, resolveBorrowEntry, summariseBorrowAvailability } from '@/pages/requests/create/availability';

function entry(available: number, total = 10, reserved = total - available): EquipmentAvailabilityMap[number] {
    return {
        equipment_name: 'Folding Table',
        total_quantity: total,
        reserved_quantity: reserved,
        available_quantity: available,
        is_limited: available < total,
        is_empty: available <= 0,
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
    it('returns an empty map when nothing resolved', () => {
        expect(mergeSlotAvailability({}).merged).toEqual({});
    });

    it('takes the tightest remaining quantity across dates', () => {
        const { merged } = mergeSlotAvailability(byDate({ '2026-10-20': 10, '2026-10-21': 3, '2026-10-22': 7 }));

        expect(merged[8].available_quantity).toBe(3);
    });

    it('ignores dates whose fetch failed instead of treating them as zero', () => {
        const { merged } = mergeSlotAvailability(byDate({ '2026-10-20': 4, '2026-10-21': null }));

        expect(merged[8].available_quantity).toBe(4);
    });

    it('carries a zero-remaining date through, since that is a real answer', () => {
        const { merged } = mergeSlotAvailability(byDate({ '2026-10-20': 10, '2026-10-21': 0 }));

        expect(merged[8].available_quantity).toBe(0);
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

    it('preserves the unmodified per-date view for shortfall attribution', () => {
        const input = byDate({ '2026-10-20': 10, '2026-10-21': 3 });
        const { byDate: preserved } = mergeSlotAvailability(input);

        expect(Object.keys(preserved).sort()).toEqual(['2026-10-20', '2026-10-21']);
        expect(preserved['2026-10-20'][8].available_quantity).toBe(10);
        expect(preserved['2026-10-21'][8].available_quantity).toBe(3);
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
describe('resolveBorrowEntry', () => {
    it('stays unknown until the source slot has resolved', () => {
        const entry = resolveBorrowEntry(undefined, 10);

        expect(entry.isKnown).toBe(false);
        expect(entry.label).toBe('Checking availability\u2026');
    });

    // The bug: `?? source.quantity` substituted the facility's whole allocation
    // whenever availability had not loaded, announcing the pre-approval number.
    it('never reports the full allocation as available while unknown', () => {
        expect(resolveBorrowEntry(undefined, 10).label).not.toContain('10');
    });

    it('matches the Equipment panel wording when nothing is reserved', () => {
        const entry = resolveBorrowEntry(10, 10);

        expect(entry.isKnown).toBe(true);
        expect(entry.isLimited).toBe(false);
        expect(entry.label).toBe('Available: 10');
    });

    it('shows remaining of total so approved consumption is visible', () => {
        const entry = resolveBorrowEntry(3, 10);

        expect(entry.isLimited).toBe(true);
        expect(entry.label).toBe('Available: 3 of 10');
    });

    it('treats a fully borrowed slot as empty, not merely limited', () => {
        const entry = resolveBorrowEntry(0, 10);

        expect(entry.isEmpty).toBe(true);
        expect(entry.isLimited).toBe(true);
        expect(entry.label).toBe('Available: 0 of 10');
    });

    it('clamps a negative reading to zero rather than going amber-free', () => {
        expect(resolveBorrowEntry(-2, 10).remaining).toBe(0);
    });
});

describe('summariseBorrowAvailability', () => {
    it('sums across sources when all have resolved', () => {
        const summary = summariseBorrowAvailability([
            { known: 3, total: 4 },
            { known: 2, total: 6 },
        ]);

        expect(summary.isKnown).toBe(true);
        expect(summary.remaining).toBe(5);
        expect(summary.total).toBe(10);
        expect(summary.isLimited).toBe(true);
    });

    // A partial total would read as authoritative, which is the same lie the
    // per-source fallback was telling.
    it('stays unknown while any source is unresolved', () => {
        const summary = summariseBorrowAvailability([
            { known: 3, total: 4 },
            { known: undefined, total: 6 },
        ]);

        expect(summary.isKnown).toBe(false);
        expect(summary.isLimited).toBe(false);
    });

    it('stays unknown with no sources at all', () => {
        expect(summariseBorrowAvailability([]).isKnown).toBe(false);
    });

    it('is not limited when everything is free', () => {
        expect(summariseBorrowAvailability([{ known: 4, total: 4 }]).isLimited).toBe(false);
    });
});
